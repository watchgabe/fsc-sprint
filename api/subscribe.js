// Lead-magnet email opt-in handler.
//
// POST body: { email, first_name, lead_magnet }
// `lead_magnet` is a slug from LEAD_MAGNETS below.
// Subscribes via Kit v4 REST API.
//
// Every subscriber gets ALWAYS_TAGS (new-subscriber) on top of whatever the
// lead magnet itself specifies, so there is one list of everyone who has ever
// opted in anywhere, plus a per-magnet tag for segmenting.
// A magnet may declare `tagId` (single) or `tagIds` (array). Both work.
//   - Cinematic Storyteller's Guide → existing sequence (delivery via email).
//   - All other LMs → Kit tag (no sequence). Response includes `redirect` URL
//     so the client can send the visitor straight to the resource.
//
// Requires Vercel env var: KIT_API_KEY (the Kit "API Secret" from Settings → Advanced).

// Applied to every successful opt-in, regardless of which magnet they came through.
const ALWAYS_TAGS = [23768062]; // new-subscriber

const LEAD_MAGNETS = {
  'cinematic-storytellers-guide': {
    name: "Cinematic Storyteller's Guide",
    sequenceId: 2796352,
  },
  'content-engine-stack': {
    name: "The $64/mo Content Engine Stack",
    tagId: 20595949,
    redirect: 'https://fscreative-ai-stack.pplx.app/',
  },
  'ai-brand-foundation-interview': {
    name: 'AI Brand Foundation Interview',
    tagId: 20595950,
    redirect: 'https://citrine-giver-f51.notion.site/Your-Brand-Foundation-AI-Interview-37d6dd5462bb806a9ba7deee291b7ea5?source=copy_link',
  },
  'iconic-brand-quiz': {
    name: 'Iconic Brand Quiz',
    tagId: 20595952,
    redirect: 'https://quiz.fscreative.live/',
  },
  'batch-content-creation-guide': {
    name: 'Batch Content Creation Guide',
    tagId: 20595953,
    redirect: 'https://citrine-giver-f51.notion.site/Batch-Creation-Guide-2d16dd5462bb81e3840ad60fd7170bff?source=copy_link',
  },
  'cbc-waitlist': {
    name: 'Cinematic Brand Challenge Waitlist',
    tagId: 23039551,
  },
  'gap-framework': {
    name: 'The GAP Framework',
    tagId: 23768063,
  },
};

const KIT_API_BASE = 'https://api.kit.com/v4';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const apiKey = process.env.KIT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'server_misconfigured', detail: 'KIT_API_KEY missing' });
  }

  const { email, first_name, lead_magnet } = req.body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  if (!lead_magnet || !LEAD_MAGNETS[lead_magnet]) {
    return res.status(400).json({ error: 'unknown_lead_magnet', detail: `Add "${lead_magnet}" to LEAD_MAGNETS map.` });
  }

  const lm = LEAD_MAGNETS[lead_magnet];

  const magnetTagIds = lm.tagIds || (lm.tagId ? [lm.tagId] : []);
  if (!lm.sequenceId && magnetTagIds.length === 0) {
    return res.status(500).json({ error: 'lm_misconfigured', detail: `${lead_magnet} has no sequenceId, tagId or tagIds.` });
  }

  const kitHeaders = {
    'Content-Type': 'application/json',
    'X-Kit-Api-Key': apiKey,
  };

  try {
    // Step 1: upsert the subscriber (Kit v4 dedupes on email_address).
    const createRes = await fetch(`${KIT_API_BASE}/subscribers`, {
      method: 'POST',
      headers: kitHeaders,
      body: JSON.stringify({
        email_address: email,
        first_name: first_name || undefined,
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok || !createData.subscriber || !createData.subscriber.id) {
      return res.status(502).json({ error: 'kit_error', detail: createData, step: 'create_subscriber' });
    }
    const subscriberId = createData.subscriber.id;

    // Step 2: attach the sequence, if this magnet uses one.
    if (lm.sequenceId) {
      const seqRes = await fetch(
        `${KIT_API_BASE}/sequences/${lm.sequenceId}/subscribers/${subscriberId}`,
        { method: 'POST', headers: kitHeaders }
      );
      if (!seqRes.ok) {
        const seqData = await seqRes.json().catch(() => ({}));
        return res.status(502).json({ error: 'kit_error', detail: seqData, step: 'attach_sequence' });
      }
    }

    // Step 3: attach every tag (the global ones plus this magnet's own).
    // De-duped so a magnet that reuses a global tag doesn't double-post.
    const allTagIds = [...new Set([...ALWAYS_TAGS, ...magnetTagIds])];
    const tagFailures = [];

    for (const tagId of allTagIds) {
      try {
        const tagRes = await fetch(
          `${KIT_API_BASE}/tags/${tagId}/subscribers/${subscriberId}`,
          { method: 'POST', headers: kitHeaders }
        );
        if (!tagRes.ok) {
          const tagData = await tagRes.json().catch(() => ({}));
          tagFailures.push({ tagId, detail: tagData });
        }
      } catch (e) {
        tagFailures.push({ tagId, detail: e.message });
      }
    }

    // The subscriber exists at this point, so a tag failure is not worth
    // failing the whole request over. Report it and let them through.
    return res.status(200).json({
      ok: true,
      redirect: lm.redirect || null,
      subscriber_id: subscriberId,
      tags_applied: allTagIds.filter(id => !tagFailures.some(f => f.tagId === id)),
      tag_failures: tagFailures.length ? tagFailures : undefined,
    });
  } catch (err) {
    return res.status(500).json({ error: 'kit_request_failed', detail: err.message });
  }
}
