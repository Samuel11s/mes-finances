# Mes Finances

A web app to track every cent when income is irregular (Upwork freelancing, trading…).

- **No server, no database, no account**: just HTML/CSS/JS files.
- Data stays **in the device's browser** (localStorage). Nothing is sent over the internet.
- Installable on phones (PWA) and usable offline.

The app's interface is in French.

## The idea: envelopes

1. **Income comes in** (Upwork, trading…) → it lands in "Unassigned" (*Non réparti*). Fees (Upwork commission, withdrawals) are recorded separately, so you know what you really pay.
2. **You assign it** to your envelopes: rent, bills, home, daily needs, studies, car maintenance, car repairs, emergency fund, savings, investing, setup, activities, events.
   - **"Needs first"** mode (recommended for irregular income): fills each envelope's monthly budget first, in priority order, then splits the rest by your percentages.
3. **Every expense comes out of an envelope.** When an envelope is empty you see it right away and have to consciously take the money from somewhere else ("Move").
4. **Accounts**: where the money actually is (Upwork, trading account, cash, mobile money…). "Adjust" compares with the real balance and shows the **untracked money**.
5. **Goals**: external drive, monitor, headset, desk, keyboard, phone… funded in order by the Setup envelope. The "Buy" button appears once a goal is funded.

Trading losses are recorded as income by ticking "This is a loss".

## Run locally

Just open `index.html` in a browser, or start a small server:

```bash
python -m http.server 5178
```

then open http://localhost:5178

## Free hosting

Any static hosting works. Just upload the content of this folder.

- **Netlify Drop** (easiest): go to https://app.netlify.com/drop and drag and drop the folder.
- **GitHub Pages**: push the folder to a GitHub repository, then Settings → Pages → Deploy from branch → `main` / root.
- **Cloudflare Pages** or **Vercel**: import the repository, no build command, output folder `/`.

Then, on your phone, open the address and choose "Add to Home Screen".

> ⚠️ Data is tied to the browser **and** to the site's address. If you change address or device, use Settings → Export, then Import. Export regularly (the app reminds you every week).

## Files

| File | Role |
|---|---|
| `index.html` | App page |
| `css/style.css` | Styles (light / dark, mobile) |
| `js/app.js` | All the logic |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | Phone install and offline mode |
