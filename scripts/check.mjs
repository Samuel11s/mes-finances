// Checks run by CI (and locally with `node scripts/check.mjs`):
// 1. syntax of every JavaScript file;
// 2. every interface text passed to t('…') has an English translation in js/i18n.js;
// 3. every file listed in the service worker exists;
// 4. the version shown on the launch screen matches APP_VERSION.
import fs from 'fs';
import vm from 'vm';

const errors = [];
const read = f => fs.readFileSync(f, 'utf8');
const jsFiles = fs.readdirSync('js').filter(f => f.endsWith('.js')).map(f => `js/${f}`).concat('sw.js');

for (const f of [...jsFiles, 'google-apps-script.gs']) {
  try { new vm.Script(read(f), { filename: f }); } catch (e) { errors.push(`Syntax — ${f}: ${e.message}`); }
}

// Translations: the French text is the key, EN holds the English text.
const EN = new Function(`${read('js/i18n.js')}; return EN;`)();
const keys = new Set();
for (const f of ['js/app.js', 'js/sync.js', 'js/about.js']) {
  for (const m of read(f).matchAll(/\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) keys.add(m[2].replace(/\\(['"])/g, '$1'));
}
// Error messages returned by the Google script, translated by the app.
for (const k of ['Clé secrète invalide', 'Données invalides', 'Action inconnue', 'Erreur du script']) keys.add(k);
for (const k of keys) if (!(k in EN)) errors.push(`Missing English translation: "${k}"`);
const unused = Object.keys(EN).filter(k => !keys.has(k));
if (unused.length) console.warn(`(info) ${unused.length} unused translation(s): ${unused.join(' | ')}`);

// Files cached for offline mode
const assets = [...read('sw.js').matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
for (const a of assets) if (!fs.existsSync(a)) errors.push(`Service worker: missing file "${a}"`);

// Version
const version = read('js/about.js').match(/APP_VERSION = '([^']+)'/)?.[1];
if (!read('index.html').includes(`v${version}`)) errors.push(`index.html doesn't show version v${version}`);

if (errors.length) {
  console.error(errors.map(e => `✖ ${e}`).join('\n'));
  process.exit(1);
}
console.log(`✔ ${jsFiles.length + 1} valid files · ${keys.size} translated texts · ${assets.length} offline files · version ${version}`);
