// Lead-magnet email opt-in handler.
//
// POST body: { email, first_name, lead_magnet }
// `lead_magnet` is a slug from LEAD_MAGNETS below.
// Adds the subscriber to the matching Kit sequence via Kit's v3 REST API.
//
// Requires Vercel env var: KIT_API_KEY (Kit → Settings → Advanced → API Key)

const LEAD_MAGNETS = {
  'cinematic-storytellers-guide': { sequenceId: 2796352, name: "Cinematic Storyteller's Guide" },
};

const KIT_API_BASE = 'https://api.convertkit.com/v3';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const apiSecret = process.env.KIT_API_KEY;
  if (!apiSecret) {
    return res.status(500).json({ error: 'server_misconfigured', detail: 'KIT_API_KEY missing' });
  }

  const { email, first_name, lead_magnet } = req.body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  if (!lead_magnet || !LEAD_MAGNETS[lead_magnet]) {
    return res.status(400).json({ error: 'unknown_lead_magnet', detail: `Add "${lead_magnet}" to LEAD_MAGNETS map.` });
  }

  const { sequenceId } = LEAD_MAGNETS[lead_magnet];

  try {
    const kitRes = await fetch(`${KIT_API_BASE}/sequences/${sequenceId}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_secret: apiSecret,
        email,
        first_name: first_name || undefined,
      }),
    });

    const data = await kitRes.json();
    if (!kitRes.ok) {
      return res.status(502).json({ error: 'kit_error', detail: data });
    }
    return res.status(200).json({ ok: true, subscription: data.subscription });
  } catch (err) {
    return res.status(500).json({ error: 'kit_request_failed', detail: err.message });
  }
}
