// Loop Studio licenses (2026-10-31). A key is the Stripe payment it came from, signed:
//   VS-<payment id>-<signature>          a sale (the payment's id without "pi_")
//   VS-T<name>-<signature>               a free key (a tester, a gift): made with scripts/make_key.py in the Loop Studio folder
// No database: a key is checked by its signature, then a sale's payment is looked up on Stripe, so a refund or a lost dispute
// switches its key off by itself. REVOKED (comma-separated keys or ids) switches any key off by hand.
//
// Vercel env vars:
//   LICENSE_SECRET     signs keys (the same value is in ~/.config/visual-studio/license_secret on Gabe's Mac, for free keys)
//   STRIPE_SECRET_KEY  a restricted key: Checkout Sessions read, PaymentIntents write (to mark a key as emailed), Charges read
//   RESEND_API_KEY     optional: emails the key to the buyer (from LICENSE_FROM, e.g. "Loop Studio <studio@fscreative.live>")
//   REVOKED            optional
//   SUPPORT_EMAIL      where a buyer with a problem writes (shown on the pages and in the email)
import crypto from 'node:crypto';
import releases from './_releases.js';

export const RELEASES = releases;      // written by Loop Studio's ship step: the install zip and the update feed, at a path nobody can guess

const b32 = (buf) => {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let bits = 0, v = 0, out = '';
  for (const x of buf) { v = (v << 8) | x; bits += 8; while (bits >= 5) { out += A[(v >>> (bits - 5)) & 31]; bits -= 5; } }
  return out;
};
const sign = (id) => b32(crypto.createHmac('sha256', process.env.LICENSE_SECRET || '').update(id).digest()).slice(0, 12);

export const help = () => process.env.SUPPORT_EMAIL ? `email ${process.env.SUPPORT_EMAIL}` : 'reply to your receipt email';

export function makeKey(id) { return `VS-${id}-${sign(id)}`; }

export function parseKey(key) {
  const m = /^VS-([A-Za-z0-9_]+)-([A-Z2-9]{12})$/.exec(String(key || '').trim());
  if (!m || !process.env.LICENSE_SECRET) return null;
  const a = Buffer.from(sign(m[1])), b = Buffer.from(m[2]);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? m[1] : null;
}

export async function stripe(path, body) {
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: body ? new URLSearchParams(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error && j.error.message || 'stripe ' + r.status);
  return j;
}

// A Gumroad sale's key (2026-10-31: the beta sells on Gumroad; its download page shows each buyer a key like 6F0E4C97-B72A4E69-…).
// Gumroad says whether it's real and whether it was refunded or charged back. The product id is public (it's on the product page).
const GUMROAD_PRODUCT = 'QyvqCk56xko-brlpAVejxQ==';
export const isGumroad = (k) => /^[0-9A-F]{8}(-[0-9A-F]{8}){3}$/i.test(String(k || '').trim());
async function gumroad(key) {
  try {
    const r = await fetch('https://api.gumroad.com/v2/licenses/verify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ product_id: GUMROAD_PRODUCT, license_key: String(key).trim(), increment_uses_count: 'false' }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 || j.success === false) return { ok: false, reason: 'invalid' };
    if (!r.ok) return { ok: null, reason: 'unreachable' };
    const p = j.purchase || {};
    if (p.refunded) return { ok: false, reason: 'refunded' };
    if (p.chargebacked || (p.disputed && !p.dispute_won)) return { ok: false, reason: 'disputed' };
    return { ok: true, email: p.email || '' };
  } catch (e) { return { ok: null, reason: 'unreachable' }; }
}

// { ok, reason, email } for a key
export async function check(key) {
  const revokedG = (process.env.REVOKED || '').split(',').map(s => s.trim().toUpperCase());
  if (isGumroad(key)) return revokedG.includes(String(key).trim().toUpperCase()) ? { ok: false, reason: 'revoked' } : gumroad(key);
  const id = parseKey(key);
  if (!id) return { ok: false, reason: 'invalid' };
  const revoked = (process.env.REVOKED || '').split(',').map(s => s.trim()).filter(Boolean);
  if (revoked.includes(id) || revoked.includes(String(key).trim())) return { ok: false, reason: 'revoked' };
  if (id.startsWith('T')) return { ok: true };
  try {
    const pi = await stripe(`payment_intents/pi_${id}?expand[]=latest_charge`);
    const ch = pi.latest_charge || {};
    if (pi.status !== 'succeeded') return { ok: false, reason: 'unpaid' };
    if (ch.refunded) return { ok: false, reason: 'refunded' };
    if (ch.disputed && ch.dispute && ch.dispute.status === 'lost') return { ok: false, reason: 'disputed' };
    return { ok: true, email: ch.billing_details && ch.billing_details.email || pi.receipt_email || '' };
  } catch (e) { return { ok: null, reason: 'unreachable' }; }      // Stripe down: the app keeps working on its last answer
}

export async function emailKey(to, key, site) {
  if (!process.env.RESEND_API_KEY || !to) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.LICENSE_FROM || 'Loop Studio <studio@fscreative.live>', to, subject: 'Your Loop Studio license key',
      text: `Thanks for getting Loop Studio.\n\nYour license key:\n${key}\n\nDownload it here (this link works any time):\n${site}/api/download?key=${encodeURIComponent(key)}\n\n` +
        `Unzip it, open the folder in the Claude app's Code tab and type "set me up". When Loop Studio asks for your key, paste the one above.\n\nKeep creating,\nGabe`,
    }),
  });
  return r.ok;
}

export const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
:root{--bg:#0d0d0f;--fg:#f2f2f2;--mut:#9a9aa2;--acc:#ffffff;--line:#2a2a30}
@media (prefers-color-scheme: light){:root{--bg:#fafafa;--fg:#111;--mut:#5c5c66;--acc:#111;--line:#ddd}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Helvetica,Arial,sans-serif}
main{max-width:560px;margin:0 auto;padding:64px 16px}h1{font-size:32px;line-height:1.15;margin:0 0 16px}p{color:var(--mut);margin:0 0 16px}
.key{display:flex;gap:8px;margin:24px 0}.key code{flex:1;padding:12px 16px;border:1px solid var(--line);border-radius:8px;font:15px ui-monospace,Menlo,monospace;word-break:break-all;color:var(--fg)}
button,.btn{display:inline-block;padding:12px 16px;border-radius:8px;border:1px solid var(--acc);background:var(--acc);color:var(--bg);font:600 15px inherit;text-decoration:none;cursor:pointer}
button.ghost{background:transparent;color:var(--fg);border-color:var(--line)}ol{color:var(--mut);padding-left:20px}li{margin:0 0 8px}
</style></head><body><main>${body}</main></body></html>`;
