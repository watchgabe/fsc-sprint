// Lead-magnet email opt-in handler.
//
// POST body: { email, first_name, lead_magnet }
// `lead_magnet` is a slug from LEAD_MAGNETS below.
// Subscribes via Kit v3 REST API.
//   - Cinematic Storyteller's Guide → existing sequence (delivery via email).
//   - All other LMs → Kit tag (no sequence). Response includes `redirect` URL
//     so the client can send the visitor straight to the resource.
//
// Requires Vercel env var: KIT_API_KEY (the Kit "API Secret" from Settings → Advanced).

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

  if (!lm.sequenceId && !lm.tagId) {
    return res.status(500).json({ error: 'lm_misconfigured', detail: `${lead_magnet} has no sequenceId or tagId.` });
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

    // Step 2: attach to sequence or tag by id.
    const attachPath = lm.sequenceId
      ? `/sequences/${lm.sequenceId}/subscribers/${subscriberId}`
      : `/tags/${lm.tagId}/subscribers/${subscriberId}`;

    const attachRes = await fetch(`${KIT_API_BASE}${attachPath}`, {
      method: 'POST',
      headers: kitHeaders,
    });
    const attachData = await attachRes.json();
    if (!attachRes.ok) {
      return res.status(502).json({ error: 'kit_error', detail: attachData, step: 'attach' });
    }

    return res.status(200).json({
      ok: true,
      redirect: lm.redirect || null,
      subscriber: attachData.subscriber,
    });
  } catch (err) {
    return res.status(500).json({ error: 'kit_request_failed', detail: err.message });
  }
}
