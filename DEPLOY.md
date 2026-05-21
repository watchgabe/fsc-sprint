# Deploying fscreative.live

This repo is the source for **fscreative.live**. Deploys are manual via the Vercel CLI — pushing to GitHub by itself does not update the live site.

---

## TL;DR — How to ship a change

```bash
cd /path/to/fsc-sprint
# 1. Edit the HTML file(s)
# 2. Commit + push to GitHub
git add .
git commit -m "describe the change"
git push
# 3. Deploy to production
vercel deploy --prod --yes
```

That's it. Within ~30 seconds the change is live at fscreative.live.

---

## How the site is wired

```
Local edit
   ↓
GitHub (watchgabe/fsc-sprint, main branch)   ← version history only
   ↓
vercel deploy --prod --yes                   ← what actually pushes to the live site
   ↓
Vercel project "fscreative-site"
   ↓
fscreative.live (custom domain alias)
```

**Important:** GitHub and Vercel are NOT auto-connected. If you push to GitHub but skip `vercel deploy --prod`, the live site doesn't change. If you `vercel deploy --prod` without pushing to GitHub, the live site changes but the change isn't versioned in git.

Always do both.

---

## URL → file map

| URL                                  | Source file                  |
|--------------------------------------|------------------------------|
| `fscreative.live/`                   | `index.html`                 |
| `fscreative.live/brand-launch-sprint`| `brand-launch-sprint.html`   |
| `fscreative.live/fsc-sprint-b`       | `fsc-sprint-b.html`          |
| `fscreative.live/fscreative-sprint-b`| `fscreative-sprint-b.html`   |
| `fscreative.live/thank-you`          | `thank-you.html`             |

URLs are served without the `.html` extension because of `vercel.json` (`"cleanUrls": true`). Requesting the `.html` version 308-redirects to the clean URL. Don't rename the files to drop the `.html` extension — keep the file as `foo.html` and it'll serve at `/foo`.

---

## Adding a new page

1. Drop the HTML file into the repo root, e.g. `new-page.html`.
2. Commit + push.
3. `vercel deploy --prod --yes`.
4. Live at `fscreative.live/new-page`.

If you want it to be the homepage, name it `index.html`. (See "Replacing the homepage" below.)

---

## Replacing the homepage

The homepage is whatever's in `index.html`. To swap:

```bash
# Save the current homepage under a new URL
git mv index.html previous-home.html

# Promote the new page to homepage
git mv new-page.html index.html

git commit -m "Promote new-page to homepage"
git push
vercel deploy --prod --yes
```

The old homepage stays reachable at `fscreative.live/previous-home`.

---

## One-time setup (fresh machine)

```bash
# Tools
brew install gh vercel-cli

# Authenticate
gh auth login           # follow the device-code prompt
vercel login            # follow the email link

# Clone + link
git clone https://github.com/watchgabe/fsc-sprint.git
cd fsc-sprint
vercel link --project fscreative-site --yes
```

After this, the `vercel deploy --prod --yes` command works from inside the repo directory.

---

## Verifying a deploy

```bash
curl -sI https://fscreative.live/ | head -5
curl -sL -o /dev/null -w "%{http_code}\n" https://fscreative.live/your-new-page
```

200 means it shipped. If you get 404, the file probably isn't named the way you think — check the actual file name in the repo (case-sensitive, no hidden spaces).

---

## Common gotchas

- **You edited the HTML on the Desktop, not in the repo.** The Desktop file isn't what deploys. Always edit the file inside the cloned repo (or copy your changes in before committing).
- **You pushed to GitHub but didn't run `vercel deploy --prod`.** The live site won't update. There's no auto-deploy hook.
- **You deleted `vercel.json`.** Clean URLs will stop working and every URL will need the `.html` suffix. Keep the file.
- **You forgot `--prod`.** Without it, Vercel creates a preview deployment at a `*.vercel.app` URL but doesn't update fscreative.live.
- **You deployed without committing.** Live site is updated, but git history doesn't reflect it. Next person to clone won't have the change. Always commit + push first.

---

## File reference

- `index.html` — homepage (currently the Frictionless OS offer)
- `brand-launch-sprint.html` — previous homepage, kept for reference
- `vercel.json` — Vercel config (clean URLs)
- `.vercel/` — local-only project link (don't commit, already in .gitignore via Vercel CLI)
- `CNAME` — leftover from when this repo was on GitHub Pages. Vercel ignores it. Safe to delete if you want.
