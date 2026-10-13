# Contributing to Mes Finances

Thanks for wanting to improve Mes Finances! This guide explains how to report a problem, suggest an idea or send code.

## App principles

Every contribution should respect them:

1. **Free and serverless**: plain HTML/CSS/JS files that can be hosted anywhere. No framework, no build step, no runtime npm dependency.
2. **Offline-first**: everything works without internet; the network is only a bonus (sync, reference exchange rate).
3. **Private**: data stays on the device or in the user's own Google Drive. No third-party service ever receives it.
4. **Simple**: made for people who aren't accountants and have irregular income.
5. **Bilingual**: every interface text exists in French and English; what the user types is never translated.

## Reporting a bug or suggesting an idea

- Use the templates: [bug report](../../issues/new?template=bug_report.yml) or [feature request](../../issues/new?template=feature_request.yml).
- Search the existing issues first.
- **Never publish** your real data, your sync key or your connection code. Hide amounts on screenshots.
- For a security issue, write privately (see [SECURITY.md](SECURITY.md)).

## Running the app locally

```bash
git clone https://github.com/Samuel11s/mes-finances.git
cd mes-finances
python -m http.server 5178
```

Then open http://localhost:5178. To test like on a phone, use the device mode of your browser's developer tools. **Demo mode** (Settings → Demo) fills the app without touching your data.

## Code layout

| File | Role |
|---|---|
| `js/app.js` | Data, currencies, calculations, views, reports, demo |
| `js/sync.js` | Sync with the Google script |
| `js/i18n.js` | French → English dictionary |
| `js/guide.js` | In-app guide (both languages) |
| `js/about.js` | Version, version history, contact |
| `js/select.js` | Dropdowns with icons |
| `js/demo.js` | Demo data |
| `css/style.css` | Styles |
| `google-apps-script.gs` | Script each user installs in their own Google account |

Things to know:
- **Amounts are stored as integer cents.** Never use floating-point numbers for money.
- Every account and envelope has a **currency**; never mix two currencies without a recorded exchange rate.
- Every data change goes through `commit()`: it saves, timestamps the changes and triggers sync.
- If you change the data format, add a **migration** in `migrate()`: users' existing data must keep working.
- Code, comments and commit messages are written in **English**.

## Texts and translations

- Every displayed text goes through `t('French text')`. The French text is the key.
- Add the English translation to `EN` in `js/i18n.js`.
- For variable values: `t('Il manque {x}', { x: amount })`.
- Long guide content lives in `js/guide.js`, in both languages.

## Before opening a pull request

1. `node scripts/check.mjs` must pass: syntax, missing translations, offline files, version.
2. Test on a **phone and a desktop**, in **light and dark** mode, and offline if you touch data.
3. If app files change, bump the cache version in `sw.js` (`mes-finances-vN`).
4. For a new release: update `APP_VERSION` and `CHANGELOG` in `js/about.js`, and the version on the launch screen in `index.html`.
5. One pull request = one topic. Link it to its issue (`Fixes #12`).

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/), in English:

```
fix(sync): stop duplicating envelopes on first connection

Fixes #4
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `ci`, `chore`. Common scopes: `sync`, `i18n`, `pwa`, `ui`, `report`.

## License of contributions

The project is licensed under [PolyForm Noncommercial 1.0.0](LICENSE.md). By contributing, you agree that your contribution is distributed under the same license. Commercial use and resale remain reserved to the author.
