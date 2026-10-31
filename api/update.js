// The update feed for a licensed copy: /api/update?key=VS-… → the same JSON as cineyap/version.json, or 403 for a key that's off
import { check, help, RELEASES } from './_license.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const r = await check(req.query.key);
  if (r.ok === false) return res.status(403).json({ error: r.reason === 'refunded' ? 'This copy was refunded, so it no longer gets updates.' : `This copy's license key doesn't work: ${help()}.` });
  res.status(200).json(RELEASES.feed);
}
