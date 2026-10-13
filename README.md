# Mes Finances

**Version 2.0.0** · developed by **Sbit/>**

A web app to track every cent when income is irregular (Upwork freelancing, trading…), in one or several currencies.

- **No server to pay for, no database, no account**: just HTML/CSS/JS files.
- Data stays **in the device's browser** (localStorage). With the optional sync, it also goes to **your own Google Drive**, never to a third party.
- Installable on phones (PWA, iPhone included) and **usable offline**.

The **full user guide** is inside the app (**Guide** menu). The version history is in Settings → About.

## Features

- **Envelopes**: every income is assigned ("Needs first" mode, ideal for irregular income), every expense comes out of an envelope.
- **Multiple currencies**: each account and envelope has its own currency (e.g. income in USD, bills in UGX). Currencies only mix through a real exchange (a transfer between two accounts in different currencies), whose real rate is recorded. The app tells you how much to exchange to cover this month's budgets. Amounts are never recalculated.
- **Accounts**: Upwork, trading, cash, mobile money… with transfers, exchanges, fees and "Adjust" to spot untracked money. Sort by name, balance, type or currency.
- **Goals**: purchases funded in priority order (monitor, headset…).
- **Monthly dashboard** and **reports by period** (month, 3 months, 6 months, year, custom dates), compared with the previous period: income by source, expenses by envelope, exchanges, net worth over time, PDF printing and CSV export. Tapping a chart shows the details.
- **Phone ⇄ computer sync + automatic backups** through a free Google Apps Script in the user's own account (Drive, one copy per day, email every Sunday). Works offline: changes are merged when the connection is back.
- **French and English**, built in (offline). What the user types is never translated.
- **Demo mode**: 6 months of sample data in memory, without touching the real data.
- **About**: version, history, contact (email, WhatsApp, GitHub), suggestions / bugs, support.

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

### After deploying: link previews on WhatsApp / Facebook

Some apps (WhatsApp in particular) only show the preview image when its address is absolute. In `index.html`, replace `og-image.png` with your site's full address in `og:image` and `twitter:image`, for example:

```html
<meta property="og:image" content="https://mes-finances.netlify.app/og-image.png">
```

## Updating the app

After a change:
1. bump the cache version in `sw.js` (`mes-finances-v4` → `v5`) so installed devices get the new version;
2. update `APP_VERSION` and `CHANGELOG` in `js/about.js` (and the version shown on the launch screen in `index.html`).

Data from before 2.0 is migrated automatically; a copy is kept on the device (Settings → Go back to pre-2.0 data).

## Files

| File | Role |
|---|---|
| `index.html` | App page, SEO / sharing tags, launch screen |
| `css/style.css` | Styles (light / dark, mobile, animations, printing) |
| `js/app.js` | Logic: data, currencies, calculations, views, reports, demo |
| `js/sync.js` | Sync and merge with the Google script |
| `js/i18n.js` | French → English dictionary (the French text is the key) |
| `js/guide.js` | Guide content in both languages |
| `js/about.js` | Version, history, developer, contact, support |
| `js/select.js` | Dropdowns with icons |
| `js/demo.js` | Demo data (never saved) |
| `js/icons.js` | [Lucide](https://lucide.dev) icons (ISC license), only the ones in use |
| `google-apps-script.gs` | Script to paste into script.google.com (the app copies it with the user's key) |
| `sw.js`, `manifest.webmanifest` | Phone install and offline mode |
| `icon.svg`, `icon-*.png`, `apple-touch-icon.png`, `favicon-32.png` | Icons (browser, Android, iPhone) |
| `og-image.png` | Social media preview image (1200×630) |
