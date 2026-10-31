// What Loop Studio asks when it opens: /api/license?key=VS-… → {"ok": true} | {"ok": false, "reason": "refunded"} | {"ok": null} (can't tell now)
import { check } from './_license.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const r = await check(req.query.key);
  res.status(200).json({ ok: r.ok, reason: r.reason || '' });
}
