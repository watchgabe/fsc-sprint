// After paying, Stripe sends the buyer here: /api/get?session_id={CHECKOUT_SESSION_ID} (the Payment Link's "After payment" redirect).
// Shows their key and the download, and emails the key once.
import { makeKey, stripe, emailKey, page, help } from './_license.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const sid = String(req.query.session_id || '');
  if (!/^cs_[A-Za-z0-9_]+$/.test(sid)) return res.status(400).send(page('Visual Studio', `<h1>That link is missing its receipt</h1><p>Open the link from your Stripe receipt, or ${help()} and I'll send your key.</p>`));
  let s;
  try { s = await stripe(`checkout/sessions/${sid}?expand[]=payment_intent`); }
  catch (e) { return res.status(404).send(page('Visual Studio', `<h1>I couldn't find that payment</h1><p>If you just paid, wait a moment and reload. Still stuck? ${help()}</p>`)); }
  if (s.payment_status !== 'paid' || !s.payment_intent) return res.status(402).send(page('Visual Studio', '<h1>The payment hasn\'t gone through yet</h1><p>Reload this page in a minute.</p>'));
  const pi = s.payment_intent, key = makeKey(pi.id.replace(/^pi_/, ''));
  const site = `https://${req.headers.host}`, email = s.customer_details && s.customer_details.email;
  let emailed = !!(pi.metadata && pi.metadata.vs_emailed);
  if (!emailed && await emailKey(email, key, site).catch(() => false)) {
    emailed = true; await stripe(`payment_intents/${pi.id}`, { 'metadata[vs_emailed]': '1' }).catch(() => {});
  }
  const dl = `/api/download?key=${encodeURIComponent(key)}`;
  res.status(200).send(page('Your Visual Studio', `<h1>You're in.</h1>
<p>This is your license key. Visual Studio asks for it once, the first time it opens. ${emailed && email ? `It's in your email at ${email.replace(/[<>&]/g, '')} too.` : 'Copy it somewhere safe: this page is the only place it shows.'}</p>
<div class="key"><code id="k">${key}</code><button class="ghost" onclick="navigator.clipboard.writeText(document.getElementById('k').textContent);this.textContent='Copied'">Copy</button></div>
<p><a class="btn" href="${dl}">Download Visual Studio</a></p>
<ol><li>Unzip it and put the Visual Studio folder somewhere you'll keep it, like Documents.</li>
<li>Open the Claude app, go to the Code tab and open that folder.</li>
<li>Type <b>set me up</b>. It installs everything in about ten minutes.</li>
<li>Paste your key when Visual Studio asks.</li></ol>
<p>Needs a Mac with Apple Silicon, 16 GB of memory, about 50 GB free, and a paid Claude plan.</p>`));
}
