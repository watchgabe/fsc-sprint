// The install zip, for a key that's switched on: /api/download?key=VS-…
import { check, page, help, RELEASES } from './_license.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const r = await check(req.query.key);
  if (r.ok === false) return res.status(403).send(page('Visual Studio', r.reason === 'refunded'
    ? '<h1>This key was refunded</h1><p>It no longer downloads Visual Studio.</p>'
    : `<h1>That key doesn't work</h1><p>Check it against the one in your email, or ${help()}.</p>`));
  res.redirect(302, RELEASES.install);
}
