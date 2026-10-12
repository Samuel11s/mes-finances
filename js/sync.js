'use strict';
/*
 * Sync through a Google Apps Script installed in the user's own Google account.
 * - Data is always written to the device first (works offline).
 * - On every change, the online version is fetched and merged (by ID + last
 *   modification date, deletions are remembered) and the result is sent back.
 * - The script URL and the secret key stay in this browser (never in the code or in exports).
 */

const SYNC_KEY = 'mes-finances-sync';
let syncCfg = (() => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch { return {}; } })();
const syncState = { status: 'off', error: '', busy: false, again: false, timer: null };
let localRev = 0;

const saveSyncCfg = () => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(syncCfg)); } catch { /* storage full */ } };
const syncOn = () => !!(syncCfg.url && syncCfg.key && syncCfg.linked);

function setSync(status, error = '') {
  syncState.status = status;
  syncState.error = error;
  updateSyncPill();
}

const PILL = () => ({
  off: ['cloud-off', t('Synchro désactivée')],
  ok: ['circle-check', t('Synchronisé')],
  pending: ['cloud', t('En attente…')],
  syncing: ['refresh-cw', t('Synchronisation…')],
  offline: ['wifi-off', t('Hors ligne')],
  error: ['triangle-alert', t('Erreur de synchro')],
});
function updateSyncPill() {
  const pills = PILL();
  const [ic, label] = pills[syncState.status] || pills.off;
  for (const el of $$('.sync-pill')) {
    el.className = `sync-pill s-${syncState.status}`;
    el.title = syncState.error || (syncCfg.lastSync ? t('Dernière synchro : {d}', { d: dateTime(syncCfg.lastSync) }) : label);
    el.innerHTML = `${icon(ic, syncState.status === 'syncing' ? 'spin' : '')}<span>${label}</span>`;
  }
}

async function callScript(action, extra = {}, cfg = syncCfg) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    // text/plain avoids the CORS "preflight" request that Google Apps Script doesn't support.
    const res = await fetch(cfg.url, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ key: cfg.key, action, ...extra }), signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(t('Le script a répondu {n}', { n: res.status }));
    let j;
    try { j = await res.json(); } catch { throw new Error(t("Réponse inattendue : vérifie l'adresse et que l'accès est réglé sur « Tout le monde ».")); }
    // The script's error messages are in French: translate them here.
    if (!j.ok) throw new Error(t(j.error || 'Erreur du script'));
    return j;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(t('Le script met trop de temps à répondre.'));
    if (e instanceof TypeError) throw new Error(t('Impossible de joindre le script (connexion internet ou adresse incorrecte).'));
    throw e;
  } finally { clearTimeout(timer); }
}

// Lightweight fingerprint to tell whether two versions differ.
function fingerprint(d) {
  const parts = [String(d.settings?.updatedAt || 0)];
  for (const c of COLS) for (const x of d[c] || []) parts.push(`${c}:${x.id}:${x.updatedAt || 0}`);
  parts.push(...Object.keys(d.deleted || {}).map(k => `d:${k}`));
  return parts.sort().join('|');
}

function onLocalChange() {
  localRev++;
  if (!syncOn()) return;
  syncCfg.dirty = true; saveSyncCfg();
  setSync(navigator.onLine ? 'pending' : 'offline');
  clearTimeout(syncState.timer);
  syncState.timer = setTimeout(() => syncNow(), 2500);
}

async function syncNow(manual = false) {
  if (!syncOn()) return;
  if (syncState.busy) { syncState.again = true; return; }
  if (!navigator.onLine) { setSync('offline'); if (manual) toast(t('Pas de connexion : la synchro se fera au retour du réseau')); return; }
  syncState.busy = true; syncState.again = false;
  setSync('syncing');
  const rev = localRev;
  try {
    const { data: remote } = await callScript('pull');
    const merged = remote ? mergeData(S, remote) : S;
    if (!remote || fingerprint(sharedData(merged)) !== fingerprint(remote)) await callScript('push', { data: sharedData(merged) });
    // If the user changed something during the sync, merge with the current state.
    if (fingerprint(sharedData(merged)) !== fingerprint(sharedData(S))) applyData(mergeData(S, sharedData(merged)));
    if (localRev === rev) syncCfg.dirty = false;
    syncCfg.lastSync = Date.now(); saveSyncCfg();
    setSync(syncCfg.dirty ? 'pending' : 'ok');
    if (manual) toast(t('Synchronisé'));
    if (syncCfg.dirty || syncState.again) setTimeout(() => syncNow(), 1500);
  } catch (e) {
    setSync('error', e.message);
    if (manual) toast(e.message);
  } finally { syncState.busy = false; }
}

/* ---------- Connection ---------- */

function genKey() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function scriptText() {
  const res = await fetch('google-apps-script.gs', { cache: 'no-cache' });
  if (!res.ok) throw new Error('404');
  return (await res.text()).replace('PASTE_YOUR_KEY_HERE', syncCfg.key);
}

async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); return true; }
  catch { return false; }
}

async function copyScript() {
  if (!syncCfg.key) { syncCfg.key = genKey(); saveSyncCfg(); }
  let text;
  try { text = await scriptText(); }
  catch { return toast(t("Impossible de lire le script : ouvre l'app depuis son adresse web, pas depuis le fichier.")); }
  if (!(await copyText(text, t('Script copié avec ta clé — colle-le dans Apps Script')))) {
    openModal(t('Copie le script'), `<p class="hint">${t('Sélectionne tout le texte (Ctrl+A) puis copie-le (Ctrl+C).')}</p><textarea rows="14" readonly style="font-family:monospace;font-size:.75rem">${esc(text)}</textarea>`, null);
  }
}

// First connection of a device: avoid duplicating the default envelopes.
async function connectSync(url, key) {
  url = url.trim(); key = key.trim();
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) return toast(t("L'adresse doit commencer par https://script.google.com/"));
  if (key.length < 16) return toast(t('Clé secrète invalide'));
  const cfg = { url, key };
  setSync('syncing');
  try {
    const ping = await callScript('ping', {}, cfg);
    const { data: remote } = await callScript('pull', {}, cfg);
    const localEmpty = !S.tx.length;
    const remoteEmpty = !remote || !remote.tx?.length;
    const finish = async mode => {
      try {
        if (mode === 'adopt') applyData(fromRemote(remote));
        else if (mode === 'merge') applyData(mergeData(S, remote));
        await callScript('push', { data: sharedData(S) }, cfg);
        Object.assign(syncCfg, cfg, { linked: true, email: ping.email, lastSync: Date.now(), dirty: false });
        saveSyncCfg(); setSync('ok'); render();
        toast(t('Synchronisation activée ({x})', { x: ping.email || 'Google Drive' }));
      } catch (e) { setSync('off'); toast(e.message); }
    };
    if (remoteEmpty) return finish('local');
    if (localEmpty) return finish('adopt');
    setSync('off');
    openModal(t('Deux versions trouvées'), `
      <p>${t('Cet appareil contient {a} opération(s) et ton Google Drive en contient {b}.', { a: `<b>${S.tx.length}</b>`, b: `<b>${remote.tx.length}</b>` })}</p>
      <p class="hint">${t('<b>Fusionner</b> garde tout des deux côtés. <b>Utiliser le Drive</b> remplace les données de cet appareil par celles du Drive.')}</p>`,
    () => () => finish('merge'), { submitLabel: t('Fusionner'), extra: `<button type="button" class="btn" data-adopt>${t('Utiliser le Drive')}</button>` });
    $('[data-adopt]').onclick = () => { $('#modal').close(); finish('adopt'); };
  } catch (e) {
    setSync('off');
    toast(e.message);
  }
}

function disconnectSync() {
  if (!confirm(t('Désactiver la synchronisation sur cet appareil ? Tes données restent ici et sur ton Drive.'))) return;
  syncCfg = {}; saveSyncCfg(); setSync('off'); render();
}

function showConnectionCode() {
  const code = `${syncCfg.url}|${syncCfg.key}`;
  openModal(t('Code pour un autre appareil'), `
    <p class="hint">${t("Sur ton autre appareil : ouvre l'app → Réglages → Synchronisation → « J'ai déjà configuré » et colle ce code. <b>Ne le partage avec personne</b> : il donne accès à tes données.")}</p>
    <textarea rows="4" readonly style="font-family:monospace;font-size:.75rem">${esc(code)}</textarea>`, null,
  { extra: `<button type="button" class="btn primary" data-copy-code>${t('Copier')}</button>` });
  $('[data-copy-code]').onclick = () => copyText(code, t('Code copié'));
}

async function emailBackup() {
  try { const r = await callScript('email'); toast(t('Sauvegarde envoyée à {x}', { x: r.email || 'Gmail' })); }
  catch (e) { toast(e.message); }
}

function syncSection() {
  if (syncOn()) {
    return `<div class="card"><h2>${icon('cloud')} ${t('Synchronisation')}</h2>
      <p class="muted">${t('Connecté au Google Drive de {x}.', { x: `<b>${esc(syncCfg.email || '?')}</b>` })}<br>
      ${t('Dernière synchro :')} <b>${syncCfg.lastSync ? dateTime(syncCfg.lastSync) : t('jamais')}</b>
      ${syncState.error ? `<br><span class="neg">${esc(syncState.error)}</span>` : ''}</p>
      <div class="row-actions">
        <button class="btn primary" data-act="sync-now">${icon('refresh-cw')} ${t('Synchroniser')}</button>
        <button class="btn" data-act="sync-email">${icon('mail')} ${t("M'envoyer la sauvegarde")}</button>
        <button class="btn" data-act="sync-code">${icon('smartphone')} ${t('Ajouter un appareil')}</button>
        <button class="btn ghost danger" data-act="sync-off">${t('Désactiver')}</button>
      </div></div>`;
  }
  return `<div class="card"><h2>${icon('cloud')} ${t('Synchronisation & sauvegardes Google')}</h2>
    <p class="muted">${t('Synchronise ton téléphone et ton PC et reçois des sauvegardes automatiques (Drive + e-mail), grâce à un petit script gratuit dans <b>ton</b> compte Google.')}
    <a href="#guide" data-act="go" data-view="guide">${t('Voir le guide pas à pas')}</a>.</p>
    <div class="seg" style="margin-top:10px">
      <button type="button" class="${syncCfg.mode !== 'join' ? 'on' : ''}" data-act="sync-mode" data-mode="new">${t('Premier appareil')}</button>
      <button type="button" class="${syncCfg.mode === 'join' ? 'on' : ''}" data-act="sync-mode" data-mode="join">${t("J'ai déjà configuré")}</button>
    </div>
    ${syncCfg.mode === 'join' ? `
      ${field(t('Code de connexion'), `<textarea id="sync-code" rows="3" placeholder="https://script.google.com/macros/s/…|${t('clé')}"></textarea>`, t('Sur ton premier appareil : Réglages → Ajouter un appareil.'))}
      <button class="btn primary" data-act="sync-join">${t('Connecter')}</button>` : `
      <ol class="steps">
        <li><button class="btn sm" data-act="sync-script">${icon('copy')} ${t('Copier mon script')}</button><br><small class="muted">${t('Le script contient ta clé secrète, générée sur cet appareil.')}</small></li>
        <li>${t('Va sur {link}, efface tout et colle le script. Enregistre.', { link: `<a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com ${icon('external-link')}</a>` })}</li>
        <li>${t("Choisis la fonction <code>setup</code> et clique sur <b>Exécuter</b>. Autorise l'accès (Paramètres avancés → Accéder au projet).")}</li>
        <li>${t("<b>Déployer → Nouveau déploiement</b> → type <b>Application Web</b>, exécuter en tant que <b>Moi</b>, accès <b>Tout le monde</b>. Copie l'URL.")}</li>
        <li>${field(t("Colle l'URL de l'application Web"), '<input id="sync-url" placeholder="https://script.google.com/macros/s/…/exec">')}
          <button class="btn primary" data-act="sync-connect">${t('Connecter')}</button></li>
      </ol>`}
  </div>`;
}

function handleSyncAction(act, el) {
  switch (act) {
    case 'sync-pill': if (syncOn()) syncNow(true); else go('settings'); return true;
    case 'sync-now': syncNow(true); return true;
    case 'sync-mode': syncCfg.mode = el.dataset.mode; saveSyncCfg(); render(); return true;
    case 'sync-script': copyScript(); return true;
    case 'sync-connect':
      if (!syncCfg.key) { toast(t("Copie d'abord ton script (étape 1)")); return true; }
      connectSync($('#sync-url').value, syncCfg.key); return true;
    case 'sync-join': {
      const [url, key] = $('#sync-code').value.trim().split('|');
      if (!url || !key) { toast(t('Code incomplet')); return true; }
      connectSync(url, key); return true;
    }
    case 'sync-code': showConnectionCode(); return true;
    case 'sync-email': emailBackup(); return true;
    case 'sync-off': disconnectSync(); return true;
  }
  return false;
}

function initSync() {
  setSync(syncOn() ? (navigator.onLine ? (syncCfg.dirty ? 'pending' : 'ok') : 'offline') : 'off');
  syncNow();
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => { if (syncOn()) setSync('offline'); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - (syncCfg.lastSync || 0) > 60000) syncNow();
  });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 5 * 60000);
}
