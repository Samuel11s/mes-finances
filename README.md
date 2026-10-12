# Mes Finances

A web app to track every cent when income is irregular (Upwork freelancing, trading…).

- **No server to pay for, no database, no account**: just HTML/CSS/JS files.
- Data stays **in the device's browser** (localStorage). With the optional sync, it also goes to **your own Google Drive**, never to a third party.
- Installable on phones (PWA) and **usable offline**.

The **full user guide** is inside the app (**Guide** menu).

## Features

- **French and English**: the language is detected from the device and can be changed in Settings. Translation is built in (`js/i18n.js`), so it works offline. What the user types is never translated; only default names that were never edited ("Loyer" ⇄ "Rent") follow the language.
- **Envelopes**: every income is assigned ("Needs first" mode, ideal for irregular income), every expense comes out of an envelope.
- **Accounts**: Upwork, trading, cash, mobile money… with transfers, fees and "Adjust" to spot untracked money.
- **Goals**: purchases funded in priority order (monitor, headset…).
- **Monthly dashboard** and **annual report**: income by source, expenses by envelope, net worth over time, fees paid, month by month, largest expenses, PDF printing and CSV export.
- **Phone ⇄ computer sync + automatic backups** through a free Google Apps Script in the user's own account:
  - data file in Google Drive, "Mes Finances" folder;
  - one dated copy per day (the last 30);
  - backup sent by email every Sunday;
  - works offline: changes are sent when the connection is back and merged (nothing is overwritten).

## Run locally

```bash
python -m http.server 5178
```

then open http://localhost:5178. Opening `index.html` directly also works, but without offline mode or copying the sync script.

## Free hosting

Any static hosting works. Just upload the content of this folder (except `.claude/`).

- **Netlify Drop** (easiest): go to https://app.netlify.com/drop and drag and drop the folder.
- **GitHub Pages**: push the folder to a GitHub repository, then Settings → Pages → Deploy from branch → `main` / root.
- **Cloudflare Pages** or **Vercel**: import the repository, no build command, output folder `/`.

Sharing the address is safe: every visitor gets their own empty app, in their own browser. The code contains no data and no key.

## Updating the app

After a change, bump the cache version in `sw.js` (`mes-finances-v3` → `v4`) so installed devices get the new version.

## Files

| File | Role |
|---|---|
| `index.html` | App page |
| `css/style.css` | Styles (light / dark, mobile, animations, printing) |
| `js/app.js` | Logic: data, calculations, views, reports, guide |
| `js/sync.js` | Sync and merge with the Google script |
| `js/i18n.js` | French → English dictionary (the French text is the key) |
| `js/guide.js` | Guide content in both languages |
| `js/icons.js` | [Lucide](https://lucide.dev) icons (ISC license), only the ones in use |
| `google-apps-script.gs` | Script to paste into script.google.com (the app copies it with the user's key) |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | Phone install and offline mode |
