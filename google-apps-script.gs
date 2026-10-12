/**
 * Mes Finances (My Finances) — sync and automatic backups.
 * The backup email follows the user's language (French or English).
 *
 * This script runs in YOUR own Google account (free). It:
 *   - keeps your data in Google Drive > "Mes Finances" (phone ⇄ computer sync);
 *   - makes a dated copy every day in "Mes Finances/Sauvegardes" (keeps the last 30);
 *   - emails you your backup every week (or every month).
 *
 * Setup: follow the guide in the app (Guide menu > Sync).
 * Never share your secret key.
 */

const SECRET_KEY = 'PASTE_YOUR_KEY_HERE';
const FOLDER = 'Mes Finances';
const DATA_FILE = 'mes-finances-donnees.json';
const BACKUPS_TO_KEEP = 30;
const EMAIL_FREQUENCY = 'weekly'; // 'weekly', 'monthly' or 'never'

/* ---------- Entry point called by the app ---------- */

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    // Error messages stay in French: the app uses them as translation keys.
    if (!req || req.key !== SECRET_KEY) return respond({ ok: false, error: 'Clé secrète invalide' });
    switch (req.action) {
      case 'ping':
        return respond({ ok: true, email: Session.getEffectiveUser().getEmail() });
      case 'pull': {
        const f = findFile(getFolder(), DATA_FILE);
        return respond({ ok: true, data: f ? JSON.parse(f.getBlob().getDataAsString()) : null });
      }
      case 'push':
        saveData(req.data);
        return respond({ ok: true });
      case 'email':
        sendBackupEmail();
        return respond({ ok: true, email: Session.getEffectiveUser().getEmail() });
      default:
        return respond({ ok: false, error: 'Action inconnue' });
    }
  } catch (err) {
    return respond({ ok: false, error: String(err && err.message || err) });
  }
}

// Opening the script URL in a browser just shows this message.
function doGet() {
  return ContentService.createTextOutput("Mes Finances : le script fonctionne. Colle cette adresse dans l'app (Réglages > Synchronisation).\nMy Finances: the script works. Paste this address into the app (Settings > Sync).");
}

/* ---------- Run ONCE from the editor (▶ Run button) ---------- */

function setup() {
  getFolder();
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendBackupEmail')
    .forEach(t => ScriptApp.deleteTrigger(t));
  if (EMAIL_FREQUENCY === 'weekly') {
    ScriptApp.newTrigger('sendBackupEmail').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(19).create();
  } else if (EMAIL_FREQUENCY === 'monthly') {
    ScriptApp.newTrigger('sendBackupEmail').timeBased().onMonthDay(1).atHour(8).create();
  }
  Logger.log('Setup complete. Next step: Deploy > New deployment > Web app. / Installation terminée. Étape suivante : Déployer > Nouveau déploiement > Application Web.');
}

/* ---------- Storage ---------- */

function saveData(data) {
  if (!data || !Array.isArray(data.tx) || !Array.isArray(data.envelopes) || !Array.isArray(data.accounts)) {
    throw new Error('Données invalides');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const json = JSON.stringify(data);
    const folder = getFolder();
    const f = findFile(folder, DATA_FILE);
    if (f) f.setContent(json); else folder.createFile(DATA_FILE, json, 'application/json');
    saveDailyBackup(json);
  } finally {
    lock.releaseLock();
  }
}

function saveDailyBackup(json) {
  const backups = getSubfolder(getFolder(), 'Sauvegardes');
  const name = 'sauvegarde-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd') + '.json';
  const f = findFile(backups, name);
  if (f) f.setContent(json); else backups.createFile(name, json, 'application/json');
  // Only keep the BACKUPS_TO_KEEP most recent ones.
  const files = [];
  const it = backups.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort((a, b) => b.getName().localeCompare(a.getName()));
  files.slice(BACKUPS_TO_KEEP).forEach(x => x.setTrashed(true));
}

function getFolder() {
  const it = DriveApp.getFoldersByName(FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER);
}
function getSubfolder(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function findFile(folder, name) {
  const it = folder.getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

/* ---------- Backup email ---------- */

function sendBackupEmail() {
  const f = findFile(getFolder(), DATA_FILE);
  if (!f) return;
  const json = f.getBlob().getDataAsString();
  const data = JSON.parse(json);
  const en = data.settings && data.settings.lang === 'en';
  const currency = (data.settings && data.settings.currency) || '';
  const fmt = c => (c / 100).toLocaleString(en ? 'en-US' : 'fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
  const days = EMAIL_FREQUENCY === 'monthly' ? 31 : 7;
  const since = Utilities.formatDate(new Date(Date.now() - days * 864e5), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  let income = 0, expenses = 0;
  const byEnvelope = {};
  data.tx.filter(t => t.date >= since).forEach(t => {
    if (t.type === 'income') income += t.amount - (t.fee || 0);
    if (t.type === 'expense') { expenses += t.amount; byEnvelope[t.envelopeId] = (byEnvelope[t.envelopeId] || 0) + t.amount; }
  });
  // Envelope names are typed by the user: they are never translated.
  const names = {};
  data.envelopes.forEach(e => { names[e.id] = e.name; });
  const top = Object.keys(byEnvelope).sort((a, b) => byEnvelope[b] - byEnvelope[a]).slice(0, 5)
    .map(id => `<li>${names[id] || '?'} : <b>${fmt(byEnvelope[id])}</b></li>`).join('');
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const T = en ? {
    subject: `My Finances — backup of ${date}`, intro: 'Here is your automatic backup (attached).',
    period: days === 7 ? 'Last 7 days' : 'Last month', income: 'Net income', expenses: 'Expenses', balance: 'Balance',
    top: 'Top expenses:', restore: 'To restore: app > Settings > Import, then choose this file.', file: 'my-finances-backup',
  } : {
    subject: `Mes Finances — sauvegarde du ${date}`, intro: 'Voici ta sauvegarde automatique (pièce jointe).',
    period: days === 7 ? 'Ces 7 derniers jours' : 'Ce dernier mois', income: 'Revenus nets', expenses: 'Dépenses', balance: 'Solde',
    top: 'Principales dépenses :', restore: 'Pour restaurer : app > Réglages > Importer, puis choisis ce fichier.', file: 'mes-finances-sauvegarde',
  };
  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: T.subject,
    htmlBody: `<p>${T.intro}</p>
      <p><b>${T.period}</b> :<br>
      ${T.income} : <b>${fmt(income)}</b><br>${T.expenses} : <b>${fmt(expenses)}</b><br>${T.balance} : <b>${fmt(income - expenses)}</b></p>
      ${top ? `<p>${T.top}</p><ul>${top}</ul>` : ''}
      <p style="color:#777">${T.restore}</p>`,
    attachments: [Utilities.newBlob(json, 'application/json', `${T.file}-${date}.json`)],
  });
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
