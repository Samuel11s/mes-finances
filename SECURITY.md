# Security

## Reporting a vulnerability

**Please don't open a public issue** for a security problem. Email **samuelbitingingwa@gmail.com** privately with:
- a description of the problem and its impact;
- steps to reproduce it;
- the app version (Settings → About).

You'll get an answer as soon as possible, and the fix will be published in a new release.

## How the app protects data

- Data stays in the device's browser (localStorage). The website contains no data and no key.
- Sync goes through a Google Apps Script installed in **the user's own Google account**. It rejects every request without the secret key, which is generated on the device.
- The sync key is never included in the code or in exported files.
- The only call to an external service is the reference exchange rate (open.er-api.com). It only happens when the user taps the button, and sends no personal data.
