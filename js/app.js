'use strict';
/*
 * Mes Finances (My Finances) — personal finance tracking for irregular income.
 * Envelope method: every income lands in "Unassigned" (one per currency), then it is assigned
 * to envelopes (rent, studies, emergency fund…). Every expense comes out of an envelope.
 * Each account and envelope has its own currency; currencies only mix through a real exchange
 * (a transfer between two accounts in different currencies), whose rate is recorded.
 * Data stays on the device (localStorage); Google sync is optional (sync.js).
 * Amounts are stored in cents (integers). Interface texts go through t() (i18n.js);
 * what the user types is never translated.
 */

const KEY = 'mes-finances-v1';
const BACKUP_KEY = 'mes-finances-backup-v2';   // copy of the data from before the 2.0 update
const PREFS_KEY = 'mes-finances-prefs';        // preferences specific to this device (sorting, period…)
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoDate(new Date());
const monthOf = d => d.slice(0, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function shiftMonth(m, k) {
  let [y, mo] = m.split('-').map(Number);
  mo += k;
  while (mo > 12) { mo -= 12; y++; }
  while (mo < 1) { mo += 12; y--; }
  return `${y}-${pad(mo)}`;
}
const endOfMonth = m => { const [y, mo] = m.split('-').map(Number); return `${m}-${pad(new Date(y, mo, 0).getDate())}`; };
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return isoDate(x); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const monthLabel = (m, short) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString(LOCALE, short ? { month: 'short' } : { month: 'long', year: 'numeric' }); };
const dayLabel = d => new Date(d + 'T12:00:00').toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = d => new Date(d + 'T12:00:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const dateTime = ts => new Date(ts).toLocaleString(LOCALE);

const COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#9333ea', '#dc2626', '#4f46e5', '#65a30d', '#c026d3'];
const KINDS = () => ({ normal: [t('Normale'), 'folder'], emergency: [t("Fonds d'urgence"), 'life-buoy'], saving: [t('Épargne'), 'piggy-bank'], invest: [t('Investissement'), 'trending-up'] });
const ACC_TYPES = () => ({ platform: [t('Plateforme (Upwork, Payoneer…)'), 'briefcase'], trading: [t('Compte de trading'), 'chart-candlestick'], cash: [t('Espèces'), 'banknote'], mobile: [t('Mobile money'), 'smartphone'], bank: [t('Banque'), 'landmark'], crypto: [t('Portefeuille crypto'), 'bitcoin'], other: [t('Autre'), 'wallet'] });
const TX_TYPES = () => ({ expense: [t('Dépense'), 'arrow-up-right', '#ea580c'], income: [t('Revenu'), 'arrow-down-left', '#16a34a'], transfer: [t('Transfert'), 'arrow-left-right', '#2563eb'], alloc: [t('Répartition'), 'wallet-cards', '#64748b'], adjust: [t('Ajustement'), 'scale', '#ca8a04'] });
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'CHF', 'UGX', 'KES', 'TZS', 'RWF', 'BIF', 'CDF', 'XAF', 'XOF', 'NGN', 'GHS', 'ZAR', 'MAD', 'ETB', 'USDT'];
const SYMBOL_CURRENCIES = new Set(['USD', 'EUR', 'GBP']);
const COLS = ['accounts', 'envelopes', 'goals', 'tx'];
const SHARED_SETTINGS = ['currency', 'sources', 'lang', 'rates', 'setupDone'];
const IN_TYPES = new Set(['platform', 'trading', 'bank', 'crypto']);
const IN_KINDS = new Set(['emergency', 'saving', 'invest']);
// Older versions: emojis → Lucide icons.
const EMOJI_MAP = { '🏠': 'house', '💡': 'lightbulb', '🧹': 'spray-can', '🛒': 'shopping-cart', '🎓': 'graduation-cap', '🚗': 'car', '🔧': 'wrench', '🛟': 'life-buoy', '🏦': 'piggy-bank', '📈': 'trending-up', '💻': 'laptop', '🎯': 'ticket', '🎉': 'party-popper', '💼': 'briefcase', '📊': 'chart-candlestick', '💵': 'banknote', '📱': 'smartphone', '💳': 'credit-card', '📁': 'folder' };

let DEMO = false; // demo mode: nothing is saved or synced

/* ---------- Icons ---------- */

const icon = (n, cls = '') => ICONS[n]
  ? `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`
  : `<span class="i i-txt ${cls}">${esc(n || '')}</span>`;
const tile = (n, color, cls = '') => `<span class="tile ${cls}" style="--c:${color || 'var(--accent)'}">${icon(n)}</span>`;

/* ---------- Data ---------- */

// Default items, in both languages. They follow the language as long as the user doesn't rename them.
// [fr, en, icon, group fr, group en, % (one currency), kind, % (two currencies: split within its currency)]
const DEFAULT_ENVS = [
  ['Loyer', 'Rent', 'house', 'Charges fixes', 'Fixed costs', 20, 'normal', 26],
  ['Factures (eau, électricité, internet)', 'Bills (water, power, internet)', 'lightbulb', 'Charges fixes', 'Fixed costs', 8, 'normal', 10],
  ['Maison (entretien, ménage)', 'Home (upkeep, cleaning)', 'spray-can', 'Charges fixes', 'Fixed costs', 6, 'normal', 8],
  ['Besoins courants (nourriture, transport)', 'Daily needs (food, transport)', 'shopping-cart', 'Vie courante', 'Daily life', 15, 'normal', 19],
  ['Études (frais, livres, cours)', 'Studies (fees, books, courses)', 'graduation-cap', 'Études', 'Studies', 10, 'normal', 13],
  ['Entretien voiture', 'Car maintenance', 'car', 'Voiture', 'Car', 5, 'normal', 6],
  ['Urgence mécanique', 'Car repairs (emergency)', 'wrench', 'Voiture', 'Car', 3, 'normal', 4],
  ["Fonds d'urgence", 'Emergency fund', 'life-buoy', 'Sécurité', 'Safety', 10, 'emergency', 45],
  ['Épargne', 'Savings', 'piggy-bank', 'Avenir', 'Future', 7, 'saving', 30],
  ['Investissement', 'Investing', 'trending-up', 'Avenir', 'Future', 5, 'invest', 25],
  ['Setup (écran, disque, casque…)', 'Setup (monitor, drive, headset…)', 'laptop', 'Équipement', 'Equipment', 6, 'normal', 8],
  ['Activités & sorties', 'Activities & outings', 'ticket', 'Loisirs', 'Leisure', 3, 'normal', 4],
  ['Événements (anniversaires, fêtes)', 'Events (birthdays, parties)', 'party-popper', 'Loisirs', 'Leisure', 2, 'normal', 2],
];
const DEFAULT_ACCS = [['Upwork', 'Upwork', 'briefcase', 'platform'], ['Compte de trading', 'Trading account', 'chart-candlestick', 'trading'], ['Espèces', 'Cash', 'banknote', 'cash'], ['Mobile money', 'Mobile money', 'smartphone', 'mobile']];
const DEFAULT_GOALS = [['Disque dur externe', 'External hard drive'], ['Écran externe', 'External monitor'], ['Casque', 'Headset'], ['Table / bureau', 'Desk'], ['Clavier', 'Keyboard'], ['Téléphone', 'Phone']];
const DEFAULT_SOURCES = [['Upwork', 'Upwork'], ['Trading', 'Trading'], ['Autre', 'Other']];
const DEFAULT_GROUPS = [...new Map(DEFAULT_ENVS.map(d => [d[3], [d[3], d[4]]])).values()];
const L = lang => (lang === 'en' ? 1 : 0);
// Fixed IDs: default items are the same on every device (no duplicates when syncing).
const envId = i => `env-${pad(i + 1)}`;

function defaults(lang = detectLang()) {
  const l = L(lang);
  const envs = DEFAULT_ENVS.map((d, i) => ({ id: envId(i), name: d[l], icon: d[2], group: d[3 + l], percent: d[5], kind: d[6], target: 0, priority: i + 1, color: COLORS[i % COLORS.length], currency: 'USD' }));
  const accounts = DEFAULT_ACCS.map((d, i) => ({ id: `acc-${pad(i + 1)}`, name: d[l], icon: d[2], type: d[3], initial: 0, currency: 'USD' }));
  const goals = DEFAULT_GOALS.map((d, i) => ({ id: `goal-${pad(i + 1)}`, name: d[l], envelopeId: envs[10].id, target: 0, priority: i + 1, purchased: false }));
  return {
    version: 3,
    settings: { lang, currency: 'USD', sources: DEFAULT_SOURCES.map(d => d[l]), rates: {}, setupDone: false, theme: 'auto', lastBackup: null, lastAccount: null, lastEnv: null },
    accounts, envelopes: envs, goals, tx: [], deleted: {},
  };
}

// Currency choice at startup: income (platform accounts, savings…) and expenses (cash, mobile money, bills…).
function applyCurrencySetup(d, inCur, outCur) {
  d.settings.currency = inCur;
  for (const a of d.accounts) a.currency = IN_TYPES.has(a.type) ? inCur : outCur;
  for (const e of d.envelopes) {
    e.currency = IN_KINDS.has(e.kind) ? inCur : outCur;
    const i = DEFAULT_ENVS.findIndex((_, k) => envId(k) === e.id);
    if (i >= 0) e.percent = DEFAULT_ENVS[i][inCur === outCur ? 5 : 7];
  }
  d.settings.setupDone = true;
}

// Renames default items that were never edited (name identical to the default in the old language).
function translateDefaults(from, to) {
  if (from === to) return;
  const a = L(from), b = L(to);
  const swap = (list, pairs) => { for (const x of list) { const p = pairs.find(d => d[a] === x.name); if (p) x.name = p[b]; } };
  swap(S.envelopes, DEFAULT_ENVS);
  swap(S.accounts, DEFAULT_ACCS);
  swap(S.goals, DEFAULT_GOALS);
  for (const e of S.envelopes) { const g = DEFAULT_GROUPS.find(d => d[a] === e.group); if (g) e.group = g[b]; }
  S.settings.sources = S.settings.sources.map(s => DEFAULT_SOURCES.find(d => d[a] === s)?.[b] ?? s);
  for (const x of S.tx) if (x.type === 'income') { const d = DEFAULT_SOURCES.find(p => p[a] === x.source); if (d) x.source = d[b]; }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      // Before migrating to 2.0, keep a copy so the user can go back.
      if ((d.version || 1) < 3 && !localStorage.getItem(BACKUP_KEY)) localStorage.setItem(BACKUP_KEY, raw);
      return migrate(d);
    }
  } catch (e) { console.error(e); }
  return defaults();
}
function migrate(d) {
  const old = d.version || 1;
  const base = defaults(d.settings?.lang || 'fr');
  d.settings = { ...base.settings, ...(d.settings || {}) };
  if (!d.settings.rates || typeof d.settings.rates !== 'object') d.settings.rates = {};
  for (const k of COLS) if (!Array.isArray(d[k])) d[k] = [];
  if (!d.deleted || typeof d.deleted !== 'object') d.deleted = {};
  for (const x of [...d.envelopes, ...d.accounts]) {
    if (EMOJI_MAP[x.icon]) x.icon = EMOJI_MAP[x.icon];
    else if (!ICONS[x.icon]) x.icon = x.type ? 'wallet' : 'folder';
    if (!x.currency) x.currency = d.settings.currency;
  }
  if (old < 3) {
    d.settings.setupDone = d.tx.length > 0;
    if (d.tx.length) d.settings.multiNotice = true;
  }
  d.version = 3;
  return d;
}

let S = load();
setLang(S.settings.lang);

// Preferences specific to this device (not synced).
let P = (() => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; } })();
const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(P)); } catch { /* ignored */ } };
P.lastAccByCur ||= {};

/* ---------- Change tracking (for sync) ---------- */

// Snapshot of every item (without its modification date) to detect what changed.
function snapshot() {
  const m = new Map();
  for (const c of COLS) for (const x of S[c]) { const { updatedAt, ...r } = x; m.set(`${c}:${x.id}`, JSON.stringify(r)); }
  m.set('settings', JSON.stringify(SHARED_SETTINGS.map(k => S.settings[k])));
  return m;
}
let snap = snapshot();

function stamp() {
  const now = Date.now();
  const cur = snapshot();
  let changed = false;
  const byKey = new Map();
  for (const c of COLS) for (const x of S[c]) byKey.set(`${c}:${x.id}`, x);
  for (const [k, v] of cur) {
    if (snap.get(k) === v) continue;
    changed = true;
    if (k === 'settings') S.settings.updatedAt = now; else byKey.get(k).updatedAt = now;
  }
  for (const k of snap.keys()) if (!cur.has(k) && k !== 'settings') { S.deleted[k.slice(k.indexOf(':') + 1)] = now; changed = true; }
  snap = cur;
  return changed;
}

function persist() {
  if (DEMO) { snap = snapshot(); return; }
  const changed = stamp();
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast(t('Erreur de sauvegarde : {x}', { x: e.message })); }
  if (changed) onLocalChange();
}
function commit(msg) { persist(); render(); if (msg) toast(msg); }

// Part of the data shared between devices (local preferences stay local).
function sharedData(d = S) {
  const settings = { updatedAt: d.settings.updatedAt || 0 };
  for (const k of SHARED_SETTINGS) settings[k] = d.settings[k];
  return { version: 3, settings, accounts: d.accounts, envelopes: d.envelopes, goals: d.goals, tx: d.tx, deleted: d.deleted || {} };
}

// Merge: for each item, keep the most recently modified version; deletions win when more recent.
function mergeData(local, remote) {
  const yearAgo = Date.now() - 365 * 864e5;
  const deleted = {};
  for (const src of [local.deleted || {}, remote.deleted || {}]) for (const [k, v] of Object.entries(src)) if (v > yearAgo) deleted[k] = Math.max(deleted[k] || 0, v);
  const out = { ...local, deleted, settings: { ...local.settings } };
  for (const c of COLS) {
    const map = new Map();
    for (const x of [...(local[c] || []), ...(remote[c] || [])]) {
      const cur = map.get(x.id);
      if (!cur || (x.updatedAt || 0) > (cur.updatedAt || 0)) map.set(x.id, x);
    }
    out[c] = [...map.values()].filter(x => !(deleted[x.id] >= (x.updatedAt || 0)));
  }
  if ((remote.settings?.updatedAt || 0) > (local.settings.updatedAt || 0)) {
    for (const k of SHARED_SETTINGS) if (remote.settings[k] !== undefined) out.settings[k] = remote.settings[k];
    out.settings.updatedAt = remote.settings.updatedAt;
  }
  return out;
}
// Replaces the device data with the Drive data while keeping local preferences.
function fromRemote(remote) {
  const d = migrate(JSON.parse(JSON.stringify(remote)));
  d.settings = { ...S.settings, ...Object.fromEntries(SHARED_SETTINGS.filter(k => remote.settings?.[k] !== undefined).map(k => [k, remote.settings[k]])), updatedAt: remote.settings?.updatedAt || 0 };
  return d;
}
// Applies received data without marking it as changed locally.
function applyData(d) {
  S = migrate(d);
  snap = snapshot();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* ignored */ }
  applyPrefs(); render();
}

// After merging two devices: groups identical envelopes, accounts and goals
// (same name, same currency) and points their transactions to the one that is kept.
function dedupe() {
  let n = 0;
  const squash = (list, keyFn, canMerge, onMerge) => {
    const seen = new Map();
    return list.filter(x => {
      const first = seen.get(keyFn(x));
      if (first && canMerge(first, x)) { onMerge(first, x); n++; return false; }
      if (!first) seen.set(keyFn(x), x);
      return true;
    });
  };
  const envMap = {}, accMap = {};
  const key = x => `${x.name.trim().toLowerCase()}|${x.currency}`;
  S.envelopes = squash(S.envelopes, key, () => true, (a, b) => { envMap[b.id] = a.id; a.target = Math.max(a.target || 0, b.target || 0); });
  S.accounts = squash(S.accounts, key, (a, b) => !(a.initial && b.initial), (a, b) => { accMap[b.id] = a.id; a.initial = (a.initial || 0) + (b.initial || 0); });
  for (const x of S.tx) {
    if (envMap[x.envelopeId]) x.envelopeId = envMap[x.envelopeId];
    for (const l of x.lines || []) if (envMap[l.envelopeId]) l.envelopeId = envMap[l.envelopeId];
    if (accMap[x.accountId]) x.accountId = accMap[x.accountId];
    if (accMap[x.toAccountId]) x.toAccountId = accMap[x.toAccountId];
  }
  for (const g of S.goals) if (envMap[g.envelopeId]) g.envelopeId = envMap[g.envelopeId];
  S.goals = squash(S.goals, g => `${g.name.trim().toLowerCase()}|${g.envelopeId}`, (a, b) => a.purchased === b.purchased, (a, b) => { a.target = Math.max(a.target || 0, b.target || 0); });
  return n;
}

let C = null;              // computed balances
let view = 'dashboard';
let entering = true;       // animate when a view appears
let curMonth = monthOf(today());
const txFilter = { type: '', env: '', acc: '', q: '' };

/* ---------- Money and currencies ---------- */

const MAIN = () => S.settings.currency;
const NFS = {};
function nf(cur) {
  const k = LOCALE + cur;
  if (!NFS[k]) {
    try { NFS[k] = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: cur, currencyDisplay: SYMBOL_CURRENCIES.has(cur) ? 'narrowSymbol' : 'code' }); }
    catch {
      const n = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      NFS[k] = { format: v => `${n.format(v)} ${cur}`, resolvedOptions: () => ({ maximumFractionDigits: 2 }) };
    }
  }
  return NFS[k];
}
const money = (c, cur = MAIN()) => nf(cur).format((c || 0) / 100);
const signed = (c, cur) => (c > 0 ? '+' : c < 0 ? '−' : '') + money(Math.abs(c), cur);
const digits = cur => nf(cur).resolvedOptions().maximumFractionDigits ?? 2;
const num = (c, cur = MAIN()) => (c / 100).toFixed(digits(cur));
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
const fmtNum = (v, max = 2) => v.toLocaleString(LOCALE, { maximumFractionDigits: max });
// Accepts "12,50", "12.50", "1 234,50" and "1,234.50": the last separator is the decimal one.
function toCents(v) {
  let s = String(v ?? '').replace(/[\s  ]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else s = s.replace(',', '.');
  if (s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
// "1 USD = 3,700 UGX": always expressed from the stronger currency.
function fmtRate(a, b, r) {
  if (!r) return '';
  return r >= 1 ? `1 ${a} = ${fmtNum(r, r < 10 ? 4 : 0)} ${b}` : `1 ${b} = ${fmtNum(1 / r, 1 / r < 10 ? 4 : 0)} ${a}`;
}

/* ---------- Calculations ---------- */

const envById = id => S.envelopes.find(e => e.id === id);
const accById = id => S.accounts.find(a => a.id === id);
const activeEnvs = (cur) => S.envelopes.filter(e => !e.archived && (!cur || e.currency === cur)).sort((a, b) => (a.priority || 99) - (b.priority || 99));
const activeAccs = (cur) => S.accounts.filter(a => !a.archived && (!cur || a.currency === cur));
const accCur = id => accById(id)?.currency || MAIN();
const envCur = id => envById(id)?.currency || MAIN();
const txNet = x => x.amount - (x.fee || 0);
const envAmt = x => x.envAmount ?? x.amount;      // expense: amount seen by the envelope
const recvAmt = x => x.received ?? x.amount;      // transfer: amount received on the destination account
const add = (o, k, v) => { o[k] = (o[k] || 0) + v; };

// Invariant, per currency: sum of accounts = unassigned + sum of envelopes.
function calc() {
  const acc = {}, env = {}, un = {}, tot = {};
  for (const a of S.accounts) { acc[a.id] = a.initial || 0; add(un, a.currency, a.initial || 0); }
  for (const e of S.envelopes) env[e.id] = 0;
  for (const x of S.tx) {
    switch (x.type) {
      case 'income': add(acc, x.accountId, txNet(x)); add(un, accCur(x.accountId), txNet(x)); break;
      case 'expense':
        add(acc, x.accountId, -x.amount); add(env, x.envelopeId, -envAmt(x));
        add(un, accCur(x.accountId), -x.amount); add(un, envCur(x.envelopeId), envAmt(x));
        break;
      case 'transfer':
        add(acc, x.accountId, -(x.amount + (x.fee || 0))); add(acc, x.toAccountId, recvAmt(x));
        add(un, accCur(x.accountId), -(x.amount + (x.fee || 0))); add(un, accCur(x.toAccountId), recvAmt(x));
        break;
      case 'adjust': add(acc, x.accountId, x.amount); add(un, accCur(x.accountId), x.amount); break;
      case 'alloc': for (const l of x.lines) { add(env, l.envelopeId, l.amount); add(un, envCur(l.envelopeId), -l.amount); } break;
    }
  }
  for (const a of S.accounts) add(tot, a.currency, acc[a.id]);
  const curs = new Set([...activeAccs().map(a => a.currency), ...activeEnvs().map(e => e.currency)]);
  return { acc, env, un, tot, rates: buildRates(), curs: [...curs], multi: curs.size > 1 };
}

// Rate history (units of the currency per 1 unit of the main currency), taken from real exchanges.
function buildRates() {
  const main = MAIN(), h = {};
  const push = (cur, date, r) => { if (r > 0 && Number.isFinite(r)) (h[cur] ||= []).push({ date, r }); };
  const sorted = [...S.tx].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.created || 0) - (b.created || 0)));
  for (const x of sorted) {
    let a, b, va, vb;
    if (x.type === 'transfer') { a = accCur(x.accountId); b = accCur(x.toAccountId); va = x.amount; vb = recvAmt(x); }
    else if (x.type === 'expense' && x.envAmount != null) { a = accCur(x.accountId); b = envCur(x.envelopeId); va = x.amount; vb = x.envAmount; }
    else continue;
    if (a === b || !va || !vb) continue;
    if (a === main) push(b, x.date, vb / va); else if (b === main) push(a, x.date, va / vb);
  }
  return h;
}
function rateAt(cur, date = today()) {
  if (cur === MAIN()) return 1;
  const list = C?.rates[cur];
  if (list?.length) { let best = list[0]; for (const p of list) { if (p.date <= date) best = p; else break; } return best.r; }
  const m = +S.settings.rates?.[cur];
  return m > 0 ? m : null;
}
const lastRate = cur => (cur === MAIN() ? 1 : (C?.rates[cur]?.at(-1)?.r ?? (+S.settings.rates?.[cur] || null)));
// Rate between any two currencies (through the main currency): units of b for 1 a.
const crossRate = (a, b) => { const ra = lastRate(a), rb = lastRate(b); return ra && rb ? rb / ra : null; };
function toMain(c, cur, date) { if (!cur || cur === MAIN()) return c; const r = rateAt(cur, date); return r ? Math.round(c / r) : null; }

// Total of a {currency: amount} map in the main currency (approximate when converted).
function inMain(map, date) {
  let total = 0, approx = false;
  const missing = [];
  for (const [cur, v] of Object.entries(map)) {
    if (!v) continue;
    if (cur === MAIN()) { total += v; continue; }
    const m = toMain(v, cur, date);
    if (m === null) missing.push(cur); else { total += m; approx = true; }
  }
  return { total, approx, missing };
}
const nonZero = map => Object.entries(map).filter(([, v]) => v);
const moneyList = (map, mode = 'money') => nonZero(map).map(([c, v]) => (mode === 'signed' ? signed(v, c) : money(v, c))).join(' · ') || money(0);
const curChip = cur => (C?.multi ? `<span class="chip cur">${esc(cur)}</span>` : '');

// KPI amount: exact with a single currency, otherwise an ≈ total in the main currency with the breakdown.
function kpiMoney(map, mode = 'money') {
  const nz = nonZero(map);
  if (nz.length <= 1) { const [c, v] = nz[0] || [MAIN(), 0]; return { value: countVal(v, mode, c), detail: '' }; }
  const r = inMain(map);
  if (r.missing.length) return { value: nz.map(([c, v]) => `<span class="mline">${mode === 'signed' ? signed(v, c) : money(v, c)}</span>`).join(''), detail: t('taux manquant pour {c}', { c: r.missing.join(', ') }) };
  return { value: `≈ ${countVal(r.total, mode)}`, detail: moneyList(map, mode) };
}

function statsFor(test) {
  const r = { inc: {}, exp: {}, income: 0, expense: 0, fees: 0, transferFees: 0, untracked: 0, bySource: {}, byEnv: {}, alloc: {}, incomeCount: 0, fx: {}, missing: new Set() };
  const conv = (c, cur, date) => { const m = toMain(c, cur, date); if (m === null) { r.missing.add(cur); return 0; } return m; };
  for (const x of S.tx) {
    if (!test(x.date)) continue;
    if (x.type === 'income') {
      const cur = accCur(x.accountId), n = txNet(x), m = conv(n, cur, x.date);
      add(r.inc, cur, n); r.income += m; add(r.bySource, x.source, m);
      r.fees += conv(x.fee || 0, cur, x.date); r.incomeCount++;
    } else if (x.type === 'expense') {
      const cur = envCur(x.envelopeId), v = envAmt(x);
      add(r.exp, cur, v); r.expense += conv(v, cur, x.date); add(r.byEnv, x.envelopeId, v);
    } else if (x.type === 'alloc') {
      for (const l of x.lines) add(r.alloc, l.envelopeId, l.amount);
    } else if (x.type === 'transfer') {
      const a = accCur(x.accountId), b = accCur(x.toAccountId);
      r.transferFees += conv(x.fee || 0, a, x.date);
      if (a !== b) {
        const f = (r.fx[`${a}>${b}`] ||= { from: a, to: b, sent: 0, recv: 0, fees: 0, n: 0 });
        f.sent += x.amount; f.recv += recvAmt(x); f.fees += x.fee || 0; f.n++;
      }
    } else if (x.type === 'adjust' && x.amount < 0) r.untracked += conv(-x.amount, accCur(x.accountId), x.date);
  }
  return r;
}
const monthStats = m => statsFor(d => monthOf(d) === m);
const rangeStats = r => statsFor(d => d >= r.from && d <= r.to);

// Net worth (in the main currency) on a given date.
function wealthAt(date) {
  const bal = {};
  for (const a of S.accounts) add(bal, a.currency, a.initial || 0);
  for (const x of S.tx) {
    if (x.date > date) continue;
    if (x.type === 'income') add(bal, accCur(x.accountId), txNet(x));
    else if (x.type === 'expense') add(bal, accCur(x.accountId), -x.amount);
    else if (x.type === 'transfer') { add(bal, accCur(x.accountId), -(x.amount + (x.fee || 0))); add(bal, accCur(x.toAccountId), recvAmt(x)); }
    else if (x.type === 'adjust') add(bal, accCur(x.accountId), x.amount);
  }
  return inMain(bal, date).total;
}

const monthlyNeeds = cur => activeEnvs(cur).reduce((s, e) => s + (e.target || 0), 0);
const needsByCur = () => { const m = {}; for (const e of activeEnvs()) add(m, e.currency, e.target || 0); return m; };
const firstDate = () => S.tx.reduce((m, x) => (!m || x.date < m ? x.date : m), null);

// What is missing in a currency to cover this month's budgets (after what is already available).
function shortfall(cur, allocM = monthStats(monthOf(today())).alloc) {
  const need = activeEnvs(cur).reduce((s, e) => s + Math.max(0, (e.target || 0) - (allocM[e.id] || 0)), 0);
  return Math.max(0, need - Math.max(0, C.un[cur] || 0));
}

function sortedTx(list = S.tx) {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.created || 0) - (a.created || 0)));
}

// Displayed label of a transaction: the note typed by the user, otherwise a translated label.
// (Older versions stored these labels in French in the note.)
const AUTO_NOTES = { 'Répartition': 'alloc', 'Déplacement': 'move', 'Argent non tracé': 'lost', 'Argent retrouvé': 'found' };
function txTitle(x) {
  const auto = AUTO_NOTES[x.note];
  if (x.note && !auto) return x.note;
  if (x.type === 'alloc') return x.move || auto === 'move' ? t('Déplacement') : t('Répartition');
  if (x.type === 'adjust') return x.amount < 0 ? t('Argent non tracé') : t('Argent retrouvé');
  return '';
}
const isMove = x => x.move || x.note === 'Déplacement';

// Splits an envelope's money between its goals, by priority.
function goalFunding() {
  const out = {};
  const byEnv = {};
  for (const g of S.goals.filter(g => !g.purchased)) (byEnv[g.envelopeId] ||= []).push(g);
  for (const [id, goals] of Object.entries(byEnv)) {
    let left = Math.max(0, C.env[id] || 0);
    for (const g of goals.sort((a, b) => (a.priority || 99) - (b.priority || 99))) {
      const v = Math.min(g.target || 0, left); out[g.id] = v; left -= v;
    }
  }
  return out;
}

/* ---------- Allocation (per currency) ---------- */

function splitPercent(total, envs) {
  const out = {};
  const withP = envs.filter(e => (+e.percent || 0) > 0);
  const sumP = withP.reduce((s, e) => s + +e.percent, 0);
  if (!sumP || total <= 0) return out;
  let used = 0;
  for (const e of withP) { const v = Math.floor(total * e.percent / sumP); out[e.id] = v; used += v; }
  const top = [...withP].sort((a, b) => b.percent - a.percent)[0];
  out[top.id] += total - used; // the leftover cents go to the largest envelope
  return out;
}

// First fills each envelope's monthly budget (by priority), then splits the rest by %.
function splitNeeds(total, allocThisMonth, envs) {
  const out = {};
  let left = total;
  for (const e of envs) {
    if (left <= 0) break;
    const v = Math.min(Math.max(0, (e.target || 0) - (allocThisMonth[e.id] || 0)), left);
    if (v > 0) { out[e.id] = v; left -= v; }
  }
  if (left > 0) for (const [k, v] of Object.entries(splitPercent(left, envs))) add(out, k, v);
  return out;
}

/* ---------- UI helpers ---------- */

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), 2800);
}

// Small tag shown when a chart is tapped.
function showTip(el, ev) {
  const tip = $('#tip');
  tip.innerHTML = el.dataset.tip;
  tip.classList.add('show');
  const w = tip.offsetWidth, h = tip.offsetHeight;
  const x = Math.max(8, Math.min(ev.clientX - w / 2, innerWidth - w - 8));
  const y = ev.clientY - h - 14 < 8 ? ev.clientY + 16 : ev.clientY - h - 14;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
  $$('.tip-on').forEach(n => n.classList.remove('tip-on'));
  el.classList.add('tip-on');
}
function hideTip() { $('#tip').classList.remove('show'); $$('.tip-on').forEach(n => n.classList.remove('tip-on')); }
const tipAttr = lines => `data-tip="${esc(lines.filter(Boolean).join('<br>'))}"`;

function openModal(title, body, onSubmit, opts = {}) {
  const d = $('#modal');
  closeRich();
  d.innerHTML = `<form class="modal-card" novalidate>
    <header><h2>${title}</h2><button type="button" class="icon-btn" data-close aria-label="${t('Fermer')}">${icon('x')}</button></header>
    <div class="modal-body">${body}</div>
    <div class="err" hidden></div>
    <footer>
      ${opts.onDelete ? `<button type="button" class="btn danger" data-del>${opts.deleteLabel || t('Supprimer')}</button>` : ''}
      <span class="spacer"></span>${opts.extra || ''}
      <button type="button" class="btn ghost" data-close>${onSubmit ? t('Annuler') : t('Fermer')}</button>
      ${onSubmit ? `<button class="btn primary">${opts.submitLabel || t('Enregistrer')}</button>` : ''}
    </footer></form>`;
  const f = d.querySelector('form');
  const err = d.querySelector('.err');
  const g = n => { const el = f.elements.namedItem(n); return el?.value ?? ''; };
  const chk = n => !!f.elements.namedItem(n)?.checked;
  f.onsubmit = e => {
    e.preventDefault();
    if (!onSubmit) return d.close();
    const r = onSubmit(g, chk, f);
    if (typeof r === 'string') { err.textContent = r; err.hidden = false; err.classList.remove('shake'); void err.offsetWidth; err.classList.add('shake'); return; }
    d.close();
    if (typeof r === 'function') setTimeout(r, 30); // next action (e.g. open the allocation dialog)
  };
  $$('[data-close]', d).forEach(b => b.onclick = () => d.close());
  const del = $('[data-del]', d);
  if (del) del.onclick = () => { if (confirm(opts.confirmDelete || t('Supprimer définitivement ?'))) { d.close(); opts.onDelete(); } };
  d.showModal();
  enhanceSelects(d);
  const first = $('[autofocus]', d);
  if (first) setTimeout(() => first.focus(), 30);
  return f;
}
document.addEventListener('close', e => { if (e.target.id === 'modal') closeRich(); }, true);

const field = (label, inner, hint = '') => `<label class="field"><span>${label}</span>${inner}${hint ? `<small>${hint}</small>` : ''}</label>`;
const amountInput = (name, v, attrs = '', cur = MAIN()) => `<input name="${name}" inputmode="decimal" autocomplete="off" placeholder="0" value="${v ? num(v, cur) : ''}" ${attrs}>`;
const opt = (value, label, sel, ic, color) => `<option value="${esc(value)}" ${value === sel ? 'selected' : ''} ${ic ? `data-icon="${ic}"` : ''} ${color ? `data-color="${color}"` : ''}>${esc(label)}</option>`;

function envOptions(sel, { withBal = true, cur, exclude } = {}) {
  let h = '';
  const list = activeEnvs(cur).filter(e => e.id !== exclude);
  for (const grp of [...new Set(list.map(e => e.group || t('Autres')))]) {
    h += `<optgroup label="${esc(grp)}">` + list.filter(e => (e.group || t('Autres')) === grp).map(e =>
      opt(e.id, `${e.name}${withBal ? ' — ' + money(C.env[e.id], e.currency) : ''}`, sel, e.icon, e.color)).join('') + '</optgroup>';
  }
  const s = envById(sel);
  if (s?.archived) h += opt(s.id, `${s.name} (${t('archivée')})`, sel, s.icon, s.color);
  return h;
}
function accOptions(sel, { cur } = {}) {
  let h = activeAccs(cur).map(a => opt(a.id, `${a.name} — ${money(C.acc[a.id], a.currency)}`, sel, a.icon)).join('');
  const s = accById(sel);
  if (s?.archived) h += opt(s.id, `${s.name} (${t('archivé')})`, sel, s.icon);
  return h;
}
const curOptions = (sel, extra = []) => [...new Set([...CURRENCIES, ...extra, sel].filter(Boolean))].map(c => `<option ${c === sel ? 'selected' : ''}>${c}</option>`).join('');
const srcIcon = s => ({ Upwork: 'briefcase', Trading: 'chart-candlestick' }[s] || 'coins');
function iconPicker(sel, color) {
  const list = ICON_PICK.includes(sel) || !ICONS[sel] ? ICON_PICK : [sel, ...ICON_PICK];
  return `<div class="icon-pick" style="--c:${color || 'var(--accent)'}">${list.map(n => `<label title="${n}"><input type="radio" name="icon" value="${n}" ${n === sel ? 'checked' : ''}>${icon(n)}</label>`).join('')}</div>`;
}
const setSelect = (sel, value) => { sel.value = value; sel.dispatchEvent(new Event('change', { bubbles: true })); };

// Suggested account for a currency: the last one used in that currency, otherwise the first match.
function pickAccount(cur, strict) {
  const ok = a => a && !a.archived && (!cur || a.currency === cur);
  for (const id of [P.lastAccByCur[cur], S.settings.lastAccount]) if (ok(accById(id))) return id;
  const first = activeAccs(cur)[0];
  if (first) return first.id;
  if (strict) return null;
  return accById(S.settings.lastAccount)?.archived === false ? S.settings.lastAccount : activeAccs()[0]?.id;
}

function upsertTx(x, data) {
  if (x) Object.assign(x, data);
  else S.tx.push({ id: uid(), created: Date.now(), ...data });
}
function deleteTx(x) {
  if (x.goalId) { const g = S.goals.find(y => y.id === x.goalId); if (g) { g.purchased = false; delete g.paid; } }
  S.tx = S.tx.filter(y => y !== x);
  commit(t('Opération supprimée'));
}

/* ---------- Forms ---------- */

function openQuick() {
  const tt = TX_TYPES();
  openModal(t('Ajouter'), `<div class="quick">
    <button type="button" data-q="expense">${tile(tt.expense[1], tt.expense[2])}${t('Dépense')}</button>
    <button type="button" data-q="income">${tile(tt.income[1], tt.income[2])}${t('Revenu')}</button>
    <button type="button" data-q="alloc">${tile('wallet-cards', '#0f766e')}${t('Répartir')}</button>
    <button type="button" data-q="transfer">${tile(tt.transfer[1], tt.transfer[2])}${C.multi ? t('Transfert / change') : t('Transfert')}</button>
  </div>`, null);
  $$('[data-q]', $('#modal')).forEach(b => b.onclick = () => {
    $('#modal').close();
    setTimeout(() => ({ expense: () => openExpense(), income: () => openIncome(), alloc: () => openAllocate(), transfer: () => openTransfer() })[b.dataset.q](), 30);
  });
}

function openExpense(x, preset = {}) {
  if (!activeAccs().length) return toast(t("Ajoute d'abord un compte"));
  const e = x || { date: today(), amount: preset.amount || 0, note: preset.note || '', envelopeId: preset.envelopeId || S.settings.lastEnv || activeEnvs()[0]?.id };
  if (!x) e.accountId = pickAccount(envCur(e.envelopeId));
  const f = openModal(x ? t('Modifier la dépense') : (preset.goalId ? t('Acheter : {x}', { x: esc(preset.note) }) : t('Nouvelle dépense')), `
    ${field(t('Enveloppe (pour quoi ?)'), `<select name="envelopeId" data-rich>${envOptions(e.envelopeId)}</select>`, t("Le montant affiché est ce qu'il reste dans chaque enveloppe."))}
    ${field(t('Payé depuis'), `<select name="accountId" data-rich>${accOptions(e.accountId)}</select>`)}
    ${field('<span id="amt-label"></span>', amountInput('amount', e.amount, 'autofocus', accCur(e.accountId)))}
    <div id="conv" hidden>${field('<span id="conv-label"></span>', `<input name="envAmount" inputmode="decimal" autocomplete="off" value="${x?.envAmount != null ? num(x.envAmount, envCur(x.envelopeId)) : ''}">`, '<span id="conv-hint"></span>')}</div>
    <div class="two">
      ${field(t('Date'), `<input type="date" name="date" value="${e.date}">`)}
      ${field(t('Note'), `<input name="note" value="${esc(e.note)}" placeholder="${t('ex. carburant, marché…')}">`)}
    </div>`, g => {
    const amount = toCents(g('amount'));
    if (!(amount > 0)) return t('Entre un montant valide.');
    const ca = accCur(g('accountId')), ce = envCur(g('envelopeId'));
    const envAmount = ca !== ce ? toCents(g('envAmount')) : undefined;
    if (ca !== ce && !(envAmount > 0)) return t("Entre le montant en {c} pour l'enveloppe.", { c: ce });
    const data = { type: 'expense', amount, envAmount, envelopeId: g('envelopeId'), accountId: g('accountId'), date: g('date') || today(), note: g('note').trim() };
    if (preset.goalId) data.goalId = preset.goalId;
    const spent = envAmount ?? amount;
    const left = C.env[data.envelopeId] - spent + (x && x.envelopeId === data.envelopeId ? envAmt(x) : 0);
    upsertTx(x, data);
    if (preset.goalId) { const goal = S.goals.find(y => y.id === preset.goalId); if (goal) { goal.purchased = true; goal.paid = spent; } }
    S.settings.lastAccount = data.accountId; S.settings.lastEnv = data.envelopeId;
    P.lastAccByCur[ca] = data.accountId; savePrefs();
    commit(left < 0 ? t('Attention : enveloppe à découvert de {x}', { x: money(-left, ce) }) : (x ? t('Dépense modifiée') : t('Dépense enregistrée')));
  }, x ? { onDelete: () => deleteTx(x) } : {});

  // If the account and the envelope don't share a currency, also ask for the envelope amount.
  let manual = x?.envAmount != null;
  const els = f.elements;
  const sync = () => {
    const ca = accCur(els.accountId.value), ce = envCur(els.envelopeId.value);
    $('#amt-label').textContent = `${t('Montant')} (${ca})`;
    $('#conv').hidden = ca === ce;
    if (ca === ce) return;
    const r = crossRate(ca, ce);
    $('#conv-label').textContent = t("Équivaut dans l'enveloppe ({c})", { c: ce });
    $('#conv-hint').textContent = r ? t('Taux utilisé : {r}', { r: fmtRate(ca, ce, r) }) : t('Aucun taux connu : entre le montant toi-même.');
    if (!manual && r) { const a = toCents(els.amount.value) || 0; els.envAmount.value = a ? num(Math.round(a * r), ce) : ''; }
  };
  els.envAmount.addEventListener('input', () => { manual = true; });
  els.amount.addEventListener('input', sync);
  els.accountId.addEventListener('change', () => { manual = false; sync(); });
  els.envelopeId.addEventListener('change', () => {
    const ce = envCur(els.envelopeId.value);
    if (accCur(els.accountId.value) !== ce) { const id = pickAccount(ce, true); if (id) setSelect(els.accountId, id); }
    manual = false; sync();
  });
  sync();
}

function openIncome(x) {
  if (!activeAccs().length) return toast(t("Ajoute d'abord un compte"));
  const e = x || { date: today(), amount: 0, fee: 0, source: S.settings.sources[0], accountId: pickAccount(MAIN()) || activeAccs()[0].id, note: '' };
  const loss = e.amount < 0;
  const sources = [...new Set([...S.settings.sources, e.source].filter(Boolean))];
  const cur0 = accCur(e.accountId);
  const f = openModal(x ? t('Modifier le revenu') : t('Nouveau revenu'), `
    ${field(t('Source'), `<select name="source" data-rich>${sources.map(s => opt(s, s, e.source, srcIcon(s))).join('')}</select>`)}
    ${field(t('Reçu sur le compte'), `<select name="accountId" data-rich>${accOptions(e.accountId)}</select>`)}
    <label class="check"><input type="checkbox" name="loss" ${loss ? 'checked' : ''}> ${t("C'est une perte (trading)")}</label>
    <div class="two">
      ${field('<span id="inc-l"></span>', amountInput('amount', Math.abs(e.amount), 'autofocus', cur0))}
      ${field('<span id="fee-l"></span>', amountInput('fee', e.fee, '', cur0), t('Commission Upwork, retrait…'))}
    </div>
    <div class="two">
      ${field(t('Date'), `<input type="date" name="date" value="${e.date}">`)}
      ${field(t('Note / client'), `<input name="note" value="${esc(e.note)}" placeholder="${t('ex. Projet logo – client X')}">`)}
    </div>
    <p class="hint" id="net-line"></p>
    ${x ? '' : `<label class="check"><input type="checkbox" name="split" checked> ${t('Répartir dans mes enveloppes juste après')}</label>`}
  `, (g, chk) => {
    const amount = toCents(g('amount')); const fee = toCents(g('fee'));
    if (!(amount > 0)) return t('Entre un montant valide.');
    if (Number.isNaN(fee) || fee < 0) return t('Frais invalides.');
    const isLoss = chk('loss');
    if (!isLoss && fee > amount) return t('Les frais dépassent le montant.');
    const data = { type: 'income', source: g('source'), amount: isLoss ? -amount : amount, fee: isLoss ? 0 : fee, accountId: g('accountId'), date: g('date') || today(), note: g('note').trim() };
    const cur = accCur(data.accountId);
    upsertTx(x, data);
    commit(x ? t('Revenu modifié') : (isLoss ? t('Perte enregistrée') : t('+{x} enregistré', { x: money(txNet(data), cur) })));
    if (!x && !isLoss && chk('split') && C.un[cur] > 0) return () => openAllocate(txNet(data), cur);
  }, x ? { onDelete: () => deleteTx(x) } : {});
  const upd = () => {
    const cur = accCur(f.elements.accountId.value);
    const a = toCents(f.elements.amount.value) || 0, fe = toCents(f.elements.fee.value) || 0, l = f.elements.loss.checked;
    $('#inc-l').textContent = `${t('Montant reçu (brut)')} (${cur})`;
    $('#fee-l').textContent = `${t('Frais')} (${cur})`;
    f.elements.fee.disabled = l;
    $('#net-line').innerHTML = l ? `${t('Perte :')} <b class="neg">−${money(a, cur)}</b>` : `${t('Net reçu :')} <b class="pos">${money(a - fe, cur)}</b>`;
  };
  f.addEventListener('input', upd); f.addEventListener('change', upd); upd();
}

// Today's reference rate (optional, only when the user asks; no personal data is sent).
async function fetchRefRate(from, to) {
  const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`);
  const j = await res.json();
  if (j.result !== 'success' || !j.rates?.[to]) throw new Error('rate');
  return j.rates[to];
}

function openTransfer(x, preset = {}) {
  if (activeAccs().length < 2) return toast(t('Il faut au moins deux comptes'));
  const e = x || { date: today(), amount: preset.amount || 0, fee: 0, accountId: preset.from || activeAccs()[0].id, toAccountId: preset.to || activeAccs().find(a => a.id !== (preset.from || activeAccs()[0].id)).id, note: '' };
  const f = openModal(x ? t('Modifier le transfert') : (C.multi ? t('Transfert ou change') : t('Transfert entre comptes')), `
    <p class="hint">${C.multi ? t("Entre deux comptes de devises différentes, c'est un change : indique ce que tu as envoyé et ce que tu as réellement reçu. Le taux est enregistré.") : t('Ex. retrait Upwork → mobile money, ou dépôt sur le compte de trading. Les frais sont déduits du compte de départ.')}</p>
    ${field(t('De'), `<select name="accountId" data-rich>${accOptions(e.accountId)}</select>`)}
    ${field(t('Vers'), `<select name="toAccountId" data-rich>${accOptions(e.toAccountId)}</select>`)}
    <div class="two">
      ${field('<span id="t-amt"></span>', amountInput('amount', e.amount, 'autofocus', accCur(e.accountId)))}
      ${field('<span id="t-fee"></span>', amountInput('fee', e.fee, '', accCur(e.accountId)))}
    </div>
    <div id="t-fx" hidden>
      ${field('<span id="t-recv"></span>', `<input name="received" inputmode="decimal" autocomplete="off" value="${x?.received != null ? num(x.received, accCur(x.toAccountId)) : ''}">`)}
      <p class="hint" id="t-rate"></p>
      <button type="button" class="btn sm" data-ref>${icon('globe')} ${t('Voir le taux du jour (en ligne)')}</button>
      <p class="hint" id="t-ref"></p>
    </div>
    <div class="two">
      ${field(t('Date'), `<input type="date" name="date" value="${e.date}">`)}
      ${field(t('Note'), `<input name="note" value="${esc(e.note)}">`)}
    </div>`, g => {
    const amount = toCents(g('amount')), fee = toCents(g('fee'));
    if (!(amount > 0)) return t('Entre un montant valide.');
    if (Number.isNaN(fee) || fee < 0) return t('Frais invalides.');
    if (g('accountId') === g('toAccountId')) return t('Choisis deux comptes différents.');
    const fx = accCur(g('accountId')) !== accCur(g('toAccountId'));
    const received = fx ? toCents(g('received')) : undefined;
    if (fx && !(received > 0)) return t('Entre le montant reçu.');
    upsertTx(x, { type: 'transfer', amount, fee, received, accountId: g('accountId'), toAccountId: g('toAccountId'), date: g('date') || today(), note: g('note').trim() });
    P.lastAccByCur[accCur(g('toAccountId'))] = g('toAccountId'); savePrefs();
    commit(x ? t('Transfert modifié') : (fx ? t('Change enregistré : {r}', { r: fmtRate(accCur(g('accountId')), accCur(g('toAccountId')), received / amount) }) : t('Transfert enregistré')));
  }, x ? { onDelete: () => deleteTx(x) } : {});
  const els = f.elements;
  const sync = () => {
    const a = accCur(els.accountId.value), b = accCur(els.toAccountId.value), fx = a !== b;
    $('#t-amt').textContent = fx ? t('Montant envoyé ({c})', { c: a }) : t('Montant arrivé ({c})', { c: a });
    $('#t-fee').textContent = t('Frais ({c})', { c: a });
    $('#t-fx').hidden = !fx;
    if (!fx) return;
    $('#t-recv').textContent = t('Montant reçu ({c})', { c: b });
    const sent = toCents(els.amount.value) || 0, recv = toCents(els.received.value) || 0, last = crossRate(a, b);
    els.received.placeholder = last && sent ? `≈ ${num(Math.round(sent * last), b)}` : '';
    $('#t-rate').textContent = sent && recv ? t('Taux obtenu : {r}', { r: fmtRate(a, b, recv / sent) }) : (last ? t('Dernier taux : {r}', { r: fmtRate(a, b, last) }) : '');
  };
  f.addEventListener('input', sync); f.addEventListener('change', sync); sync();
  $('[data-ref]', f).onclick = async () => {
    const a = accCur(els.accountId.value), b = accCur(els.toAccountId.value);
    $('#t-ref').textContent = '…';
    try { $('#t-ref').textContent = t('Taux de référence : {r} (open.er-api.com)', { r: fmtRate(a, b, await fetchRefRate(a, b)) }); }
    catch { $('#t-ref').textContent = t('Taux du jour indisponible (pas de connexion ?)'); }
  };
}

function openAdjust(acc) {
  const cur = C.acc[acc.id], c = acc.currency;
  const f = openModal(t('Ajuster : {x}', { x: esc(acc.name) }), `
    <p class="hint">${t("Le solde dans l'app ne correspond pas à la réalité ? Entre le solde <b>réel</b> que tu vois (app Upwork, wallet, billets en poche…). L'écart sera enregistré comme « argent non tracé » : ça t'aide à voir combien t'échappe.")}</p>
    ${field(t("Solde dans l'app"), `<input value="${money(cur, c)}" disabled>`)}
    ${field(`${t('Solde réel')} (${c})`, amountInput('real', 0, 'autofocus', c))}
    ${field(t('Explication (facultatif)'), `<input name="note" placeholder="${t('ex. dépenses non notées cette semaine')}">`)}
    <p class="hint" id="diff-line"></p>`, g => {
    const real = toCents(g('real'));
    if (Number.isNaN(real) || g('real').trim() === '') return t('Entre le solde réel.');
    const diff = real - cur;
    if (diff === 0) return () => toast(t('Le solde est déjà juste'));
    upsertTx(null, { type: 'adjust', accountId: acc.id, amount: diff, date: today(), note: g('note').trim() });
    commit(diff < 0 ? t('{x} non tracé — pense à tout noter !', { x: money(-diff, c) }) : t('Solde ajusté'));
  }, { submitLabel: t('Ajuster') });
  f.addEventListener('input', () => {
    const r = toCents(f.elements.real.value);
    $('#diff-line').innerHTML = Number.isNaN(r) || f.elements.real.value === '' ? '' : `${t('Écart :')} <b class="${r - cur < 0 ? 'neg' : 'pos'}">${signed(r - cur, c)}</b>`;
  });
}

function openAllocate(preAmount, preCur) {
  const curs = [...new Set(activeEnvs().map(e => e.currency))];
  if (!curs.length) return toast(t("Crée d'abord une enveloppe"));
  if (preAmount === undefined && !curs.some(c => C.un[c] > 0)) {
    const neg = curs.find(c => C.un[c] < 0);
    return toast(neg ? t("Tu as réparti {x} de trop — retire de l'argent d'une enveloppe", { x: money(-C.un[neg], neg) }) : t("Rien à répartir : enregistre d'abord un revenu"));
  }
  let cur = preCur && curs.includes(preCur) ? preCur : (curs.find(c => C.un[c] > 0) || curs[0]);
  const allocM = monthStats(monthOf(today())).alloc;
  let mode = 'needs', pre = preAmount;
  const hints = {
    needs: t("Remplit d'abord le budget mensuel de chaque enveloppe (dans l'ordre de priorité : loyer, factures…), puis répartit le reste selon tes pourcentages. Idéal quand les revenus sont irréguliers."),
    pct: t('Répartit le montant selon les pourcentages de chaque enveloppe.'),
    manual: t('Tape toi-même les montants.'),
  };
  const f = openModal(t('Répartir mon argent'), `
    ${curs.length > 1 ? `<div class="seg" id="cur-tabs">${curs.map(c => `<button type="button" data-cur="${c}">${c}</button>`).join('')}</div>` : ''}
    <div id="alloc-inner"></div>`, () => {
    const lines = [];
    for (const inp of $$('[data-env]', f)) {
      const v = toCents(inp.value);
      if (Number.isNaN(v)) return t('Un montant est invalide.');
      if (v) lines.push({ envelopeId: inp.dataset.env, amount: v });
    }
    const sum = lines.reduce((s, l) => s + l.amount, 0);
    if (sum <= 0) return t('Rien à répartir.');
    if (sum > C.un[cur]) return t('Tu ne peux pas répartir plus que {x}.', { x: money(C.un[cur], cur) });
    upsertTx(null, { type: 'alloc', date: today(), lines, note: '' });
    commit(t('{x} réparti dans {n} enveloppe(s)', { x: money(sum, cur), n: lines.length }));
  }, { submitLabel: t('Répartir') });

  const draw = () => {
    const envs = activeEnvs(cur), avail = Math.max(0, C.un[cur] || 0);
    // In the main currency, keep enough aside to exchange and cover the budgets in the other currencies.
    let reserve = 0;
    const reserveInfo = [];
    if (cur === MAIN()) for (const c of curs.filter(c => c !== cur)) {
      const s = shortfall(c, allocM), r = lastRate(c);
      if (s && r) { const m = Math.ceil(s / r / 100) * 100; reserve += m; reserveInfo.push(`${money(s, c)} ≈ ${money(m, cur)}`); }
    }
    const needText = e => {
      if (!e.target) return `${e.percent || 0} %`;
      const need = e.target - (allocM[e.id] || 0);
      return need > 0 ? t('manque {x} ce mois · {p} %', { x: money(need, cur), p: e.percent || 0 }) : t('budget du mois atteint · {p} %', { p: e.percent || 0 });
    };
    $('#alloc-inner').innerHTML = `
      <div class="alert info">${icon('wallet-cards')}<span class="grow">${t('Disponible à répartir')}</span><b class="num">${money(avail, cur)}</b></div>
      ${field(`${t('Montant à répartir')} (${cur})`, amountInput('total', Math.min(pre ?? avail, avail), '', cur))}
      <div class="seg">${Object.entries({ needs: t("Besoins d'abord"), pct: t('Pourcentages'), manual: t('Manuel') }).map(([k, v]) => `<button type="button" data-mode="${k}">${v}</button>`).join('')}</div>
      <p class="hint" id="mode-hint"></p>
      <div id="reserve-row"></div>
      <div>${envs.map(e => `<div class="alloc-row">${tile(e.icon, e.color, 'sm')}<span class="ellipsis">${esc(e.name)}<small>${needText(e)}</small></span><input data-env="${e.id}" inputmode="decimal" placeholder="0"></div>`).join('')}</div>
      <div class="alloc-sum"><span>${t('Réparti :')} <b id="a-sum" class="num"></b></span><span id="a-left-l">${t('Reste :')} <b id="a-left" class="num"></b></span></div>`;
    pre = undefined;
    const sumUp = () => {
      const sum = $$('[data-env]', f).reduce((s, i) => s + (toCents(i.value) || 0), 0);
      $('#a-sum').textContent = money(sum, cur);
      $('#a-left').textContent = money(avail - sum, cur);
      $('#a-left').className = 'num ' + (avail - sum < 0 ? 'neg' : '');
    };
    const compute = () => {
      $$('[data-mode]', f).forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
      $('#mode-hint').textContent = hints[mode];
      const total = Math.max(0, toCents(f.elements.total.value) || 0);
      const kept = mode === 'needs' ? Math.min(reserve, total) : 0;
      $('#reserve-row').innerHTML = kept ? `<div class="alloc-row reserve">${tile('repeat', '#2563eb', 'sm')}<span class="ellipsis">${t('Gardé pour le change')}<small>${reserveInfo.join(' · ')}</small></span><b class="num" style="text-align:right">${money(kept, cur)}</b></div>` : '';
      if (mode !== 'manual') {
        const out = mode === 'needs' ? splitNeeds(total - kept, allocM, envs) : splitPercent(total, envs);
        $$('[data-env]', f).forEach(i => { i.value = out[i.dataset.env] ? num(out[i.dataset.env], cur) : ''; });
      }
      sumUp();
    };
    $$('[data-mode]', f).forEach(b => b.onclick = () => { mode = b.dataset.mode; compute(); });
    f.elements.total.addEventListener('input', compute);
    $$('[data-env]', f).forEach(i => i.addEventListener('input', sumUp));
    compute();
  };
  $$('[data-cur]', f).forEach(b => b.onclick = () => { cur = b.dataset.cur; $$('[data-cur]', f).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $$('[data-cur]', f).forEach(b => b.classList.toggle('on', b.dataset.cur === cur));
  draw();
}

function openMove(fromId) {
  const curs = C.curs.length ? C.curs : [MAIN()];
  const unOpt = (c, sel) => opt(`u:${c}`, `${t('Non réparti')}${C.multi ? ' ' + c : ''} (${money(C.un[c] || 0, c)})`, sel, 'wallet-cards', '#64748b');
  const fromHtml = sel => curs.map(c => unOpt(c, sel)).join('') + envOptions(sel);
  const curOf = v => (v.startsWith('u:') ? v.slice(2) : envCur(v));
  const toHtml = from => { const c = curOf(from); return (from.startsWith('u:') ? '' : unOpt(c)) + envOptions('', { cur: c, exclude: from }); };
  const from0 = fromId || `u:${curs[0]}`;
  const f = openModal(t('Déplacer entre enveloppes'), `
    <p class="hint">${t("Une enveloppe est à découvert ou tu as trop mis quelque part ? Déplace l'argent. Choisir « Non réparti » rend l'argent disponible.")}</p>
    ${field(t('Prendre dans'), `<select name="from" data-rich>${fromHtml(from0)}</select>`)}
    ${field(t('Mettre dans'), `<select name="to" data-rich>${toHtml(from0)}</select>`, C.multi ? t("Seulement dans la même devise : pour passer d'une devise à l'autre, fais un change entre comptes.") : '')}
    ${field(`<span id="mv-l"></span>`, amountInput('amount', 0, 'autofocus'))}`, g => {
    const amount = toCents(g('amount'));
    const from = g('from'), to = g('to'), c = curOf(from);
    if (!(amount > 0)) return t('Entre un montant valide.');
    if (!to || from === to) return t('Choisis deux endroits différents.');
    if (from.startsWith('u:') && amount > (C.un[c] || 0)) return t("Il n'y a que {x} de non réparti.", { x: money(C.un[c] || 0, c) });
    const lines = [];
    if (!from.startsWith('u:')) lines.push({ envelopeId: from, amount: -amount });
    if (!to.startsWith('u:')) lines.push({ envelopeId: to, amount });
    upsertTx(null, { type: 'alloc', date: today(), lines, note: '', move: true });
    commit(t('Argent déplacé'));
  }, { submitLabel: t('Déplacer') });
  const lab = () => { $('#mv-l').textContent = `${t('Montant')} (${curOf(f.elements.from.value)})`; };
  f.elements.from.addEventListener('change', () => { f.elements.to.innerHTML = toHtml(f.elements.from.value); f.elements.to.dispatchEvent(new Event('change')); lab(); });
  lab();
}

function openAllocTx(x) {
  const body = x.lines.map(l => { const e = envById(l.envelopeId); return `<div class="alloc-row">${tile(e?.icon || 'folder', e?.color, 'sm')}<span>${esc(e?.name || t('Enveloppe supprimée'))}</span><b class="num ${l.amount < 0 ? 'neg' : ''}" style="text-align:right">${signed(l.amount, envCur(l.envelopeId))}</b></div>`; }).join('');
  openModal(t('{x} du {d}', { x: esc(txTitle(x)), d: dayLabel(x.date) }), body + `<p class="hint" style="margin-top:12px">${t("Supprimer annule cette répartition : l'argent revient dans « Non réparti ».")}</p>`, null,
    { onDelete: () => deleteTx(x), deleteLabel: t('Annuler la répartition'), confirmDelete: t('Annuler cette répartition ?') });
}

function openTx(x) {
  if (!x) return;
  ({
    expense: openExpense, income: openIncome, transfer: openTransfer, alloc: openAllocTx,
    adjust: y => openModal(t('Ajustement de solde'), `<p>${esc(accById(y.accountId)?.name)} : <b>${signed(y.amount, accCur(y.accountId))}</b></p><p class="muted">${esc(txTitle(y))}</p>`, null, { onDelete: () => deleteTx(y) }),
  })[x.type](x);
}

function openEnvelope(e) {
  const isNew = !e;
  e = e || { name: '', icon: 'folder', group: DEFAULT_GROUPS[1][L(LANG)], percent: 0, target: 0, kind: 'normal', priority: S.envelopes.length + 1, color: COLORS[S.envelopes.length % COLORS.length], currency: C.curs.includes(MAIN()) && C.curs.length > 1 ? C.curs.find(c => c !== MAIN()) : MAIN() };
  const used = !isNew && (S.tx.some(x => x.envelopeId === e.id || x.lines?.some(l => l.envelopeId === e.id)) || S.goals.some(g => g.envelopeId === e.id));
  const groups = [...new Set([...DEFAULT_GROUPS.map(d => d[L(LANG)]), ...S.envelopes.map(x => x.group)])];
  const kinds = KINDS();
  const f = openModal(isNew ? t('Nouvelle enveloppe') : t("Modifier l'enveloppe"), `
    ${field(t('Nom'), `<input name="name" value="${esc(e.name)}" autofocus>`)}
    <div class="field"><span>${t('Icône et couleur')}</span>${iconPicker(e.icon, e.color)}
      <div class="colors">${COLORS.map(c => `<label style="--c:${c}"><input type="radio" name="color" value="${c}" ${c === e.color ? 'checked' : ''}></label>`).join('')}</div></div>
    <div class="two">
      ${field(t('Groupe'), `<input name="group" list="groups" value="${esc(e.group)}"><datalist id="groups">${groups.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`)}
      ${field(t('Devise'), `<select name="currency">${curOptions(e.currency, C.curs)}</select>`, used ? t('Changer la devise ne convertit pas les montants.') : '')}
    </div>
    <div class="two">
      ${field('<span id="tgt-l"></span>', amountInput('target', e.target, '', e.currency), t('Ce dont tu as besoin chaque mois (ex. loyer). 0 = pas de budget fixe.'))}
      ${field(t('% des revenus'), `<input name="percent" type="number" min="0" max="100" step="0.5" value="${e.percent || 0}">`, C.multi ? t('Part de ce qui reste après les besoins, parmi les enveloppes de la même devise.') : t('Part de ce qui reste après les besoins.'))}
    </div>
    <div class="two">
      ${field(t('Priorité'), `<input name="priority" type="number" min="1" value="${e.priority || 1}">`, t('1 = remplie en premier.'))}
      ${field(t('Type'), `<select name="kind" data-rich>${Object.entries(kinds).map(([k, [l, ic]]) => opt(k, l, e.kind, ic)).join('')}</select>`)}
    </div>`, g => {
    const target = toCents(g('target'));
    if (!g('name').trim()) return t('Donne un nom.');
    if (Number.isNaN(target) || target < 0) return t('Budget invalide.');
    const data = { name: g('name').trim(), icon: g('icon') || 'folder', group: g('group').trim() || t('Autres'), currency: g('currency'), target, percent: Math.max(0, +g('percent') || 0), priority: Math.max(1, +g('priority') || 1), kind: g('kind'), color: g('color') || e.color };
    if (isNew) S.envelopes.push({ id: uid(), ...data }); else Object.assign(e, data);
    commit(isNew ? t('Enveloppe créée') : t('Enveloppe modifiée'));
  }, isNew ? {} : used
    ? { onDelete: () => { if (C.env[e.id]) return toast(t("Vide d'abord l'enveloppe (Déplacer)")); e.archived = !e.archived; commit(e.archived ? t('Enveloppe archivée') : t('Enveloppe restaurée')); }, deleteLabel: e.archived ? t('Restaurer') : t('Archiver'), confirmDelete: e.archived ? t('Restaurer cette enveloppe ?') : t("Archiver ? Elle sera masquée mais l'historique est conservé.") }
    : { onDelete: () => { S.envelopes = S.envelopes.filter(y => y !== e); commit(t('Enveloppe supprimée')); } });
  const lab = () => { $('#tgt-l').textContent = `${t('Budget mensuel')} (${f.elements.currency.value})`; };
  f.addEventListener('change', ev => {
    if (ev.target.name === 'color') $('.icon-pick', f).style.setProperty('--c', ev.target.value);
    if (ev.target.name === 'currency') lab();
  });
  lab();
}

function openAccount(a) {
  const isNew = !a;
  a = a || { name: '', icon: 'wallet', type: 'other', initial: 0, currency: MAIN() };
  const used = !isNew && S.tx.some(x => x.accountId === a.id || x.toAccountId === a.id);
  const types = ACC_TYPES();
  const f = openModal(isNew ? t('Nouveau compte') : t('Modifier le compte'), `
    ${field(t('Nom'), `<input name="name" value="${esc(a.name)}" autofocus placeholder="${t('ex. Payoneer, M-Pesa, Binance…')}">`)}
    <div class="field"><span>${t('Icône')}</span>${iconPicker(a.icon)}</div>
    <div class="two">
      ${field(t('Type'), `<select name="type" data-rich>${Object.entries(types).map(([k, [l, ic]]) => opt(k, l, a.type, ic)).join('')}</select>`)}
      ${field(t('Devise'), `<select name="currency">${curOptions(a.currency, C.curs)}</select>`, used ? t('Changer la devise ne convertit pas les montants.') : '')}
    </div>
    ${field('<span id="ini-l"></span>', amountInput('initial', a.initial, '', a.currency), t("L'argent présent sur ce compte au moment où tu commences le suivi. Il arrive dans « Non réparti » pour que tu le répartisses."))}`, g => {
    const initial = toCents(g('initial'));
    if (!g('name').trim()) return t('Donne un nom.');
    if (Number.isNaN(initial)) return t('Solde invalide.');
    const data = { name: g('name').trim(), icon: g('icon') || 'wallet', type: g('type'), currency: g('currency'), initial };
    if (isNew) S.accounts.push({ id: uid(), ...data }); else Object.assign(a, data);
    commit(isNew ? t('Compte ajouté') : t('Compte modifié'));
  }, isNew ? {} : used
    ? { onDelete: () => { if (C.acc[a.id]) return toast(t('Le solde doit être à 0 pour archiver (fais un transfert)')); a.archived = !a.archived; commit(a.archived ? t('Compte archivé') : t('Compte restauré')); }, deleteLabel: a.archived ? t('Restaurer') : t('Archiver'), confirmDelete: a.archived ? t('Restaurer ce compte ?') : t('Archiver ce compte ?') }
    : { onDelete: () => { S.accounts = S.accounts.filter(y => y !== a); commit(t('Compte supprimé')); } });
  const lab = () => { $('#ini-l').textContent = `${t('Solde de départ')} (${f.elements.currency.value})`; };
  f.elements.currency.addEventListener('change', lab);
  lab();
}

function openGoal(gl) {
  const isNew = !gl;
  const equip = DEFAULT_GROUPS.find(d => d[0] === 'Équipement');
  gl = gl || { name: '', envelopeId: activeEnvs().find(e => equip.includes(e.group))?.id || activeEnvs()[0]?.id, target: 0, priority: S.goals.length + 1 };
  const f = openModal(isNew ? t('Nouvel objectif') : t("Modifier l'objectif"), `
    ${field(t('Quoi ?'), `<input name="name" value="${esc(gl.name)}" autofocus placeholder="${t('ex. Écran 27 pouces')}">`)}
    ${field(t("Financé par l'enveloppe"), `<select name="envelopeId" data-rich>${envOptions(gl.envelopeId)}</select>`, t("L'argent de l'enveloppe finance les objectifs dans l'ordre de priorité."))}
    ${field('<span id="gp-l"></span>', amountInput('target', gl.target, '', envCur(gl.envelopeId)))}
    ${field(t('Priorité'), `<input name="priority" type="number" min="1" value="${gl.priority || 1}">`, t('1 = acheté en premier.'))}`, g => {
    const target = toCents(g('target'));
    if (!g('name').trim()) return t('Donne un nom.');
    if (Number.isNaN(target) || target < 0) return t('Montant invalide.');
    const data = { name: g('name').trim(), target, envelopeId: g('envelopeId'), priority: Math.max(1, +g('priority') || 1) };
    if (isNew) S.goals.push({ id: uid(), purchased: false, ...data }); else Object.assign(gl, data);
    commit(isNew ? t('Objectif ajouté') : t('Objectif modifié'));
  }, isNew ? {} : { onDelete: () => { S.goals = S.goals.filter(y => y !== gl); S.tx.forEach(x => { if (x.goalId === gl.id) delete x.goalId; }); commit(t('Objectif supprimé')); } });
  const lab = () => { $('#gp-l').textContent = `${t('Prix / montant visé')} (${envCur(f.elements.envelopeId.value)})`; };
  f.elements.envelopeId.addEventListener('change', lab);
  lab();
}

// Currencies: which currency each account and envelope is in, and fallback rates.
function openCurrencies() {
  const main = MAIN();
  const others = C.curs.filter(c => c !== main);
  const row = (x, kind) => `<div class="cur-row">${tile(x.icon, x.color, 'sm')}<span class="ellipsis">${esc(x.name)}</span><select name="${kind}-${x.id}">${curOptions(x.currency, C.curs)}</select></div>`;
  openModal(t('Gérer les devises'), `
    <p class="hint">${t("Indique dans quelle monnaie est chaque compte et chaque enveloppe. Cela ne convertit pas les montants : ça dit seulement en quelle devise ils sont.")}</p>
    <h3 class="sub-title">${t('Comptes')}</h3>${activeAccs().map(a => row(a, 'acc')).join('')}
    <h3 class="sub-title">${t('Enveloppes')}</h3>${activeEnvs().map(e => row(e, 'env')).join('')}
    ${others.length ? `<h3 class="sub-title">${t('Taux de secours')}</h3><p class="hint">${t("Utilisés seulement tant qu'aucun change réel n'est enregistré pour cette devise.")}</p>
      ${others.map(c => field(`1 ${main} = ? ${c}`, `<input name="rate-${c}" inputmode="decimal" value="${S.settings.rates?.[c] || ''}" placeholder="${lastRate(c) ? fmtNum(lastRate(c), 4) : ''}">`)).join('')}` : ''}`, g => {
    for (const a of activeAccs()) a.currency = g(`acc-${a.id}`) || a.currency;
    for (const e of activeEnvs()) e.currency = g(`env-${e.id}`) || e.currency;
    const rates = { ...(S.settings.rates || {}) };
    for (const c of others) { const v = toCents(g(`rate-${c}`)) / 100; if (v > 0) rates[c] = v; else delete rates[c]; }
    S.settings.rates = rates;
    S.settings.multiNotice = false;
    commit(t('Devises enregistrées'));
  });
}

/* ---------- Charts ---------- */

function barsChart(items) {
  const W = 640, H = 260, B = 34, T = 10;
  const max = Math.max(1, ...items.flatMap(h => [h.inc, h.exp]));
  const gw = W / items.length, bw = Math.max(2, Math.min(30, gw * 0.32)), ph = H - T - B;
  const every = Math.ceil(items.length / 12);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart ${items.length > 8 ? 'dense' : ''}" role="img" aria-label="${t('Revenus et dépenses')}">`;
  for (let i = 0; i <= 3; i++) { const y = T + ph * i / 3; s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" class="grid-line"/>`; }
  items.forEach((h, i) => {
    const cx = gw * i + gw / 2;
    const hi = ph * Math.max(0, h.inc) / max, he = ph * h.exp / max;
    s += `<g class="bar-g" ${tipAttr([`<b>${esc(h.long)}</b>`, `${t('Revenus')} : ${money(h.inc)}`, `${t('Dépenses')} : ${money(h.exp)}`, `${t('Solde')} : ${signed(h.inc - h.exp)}`])} style="--d:${Math.min(i, 30) * 25}ms">
      <rect x="${cx - gw / 2}" y="${T}" width="${gw}" height="${ph}" class="hit"/>
      <rect x="${cx - bw - 1}" y="${H - B - hi}" width="${bw}" height="${hi}" rx="${Math.min(4, bw / 2)}" class="b-inc"/>
      <rect x="${cx + 1}" y="${H - B - he}" width="${bw}" height="${he}" rx="${Math.min(4, bw / 2)}" class="b-exp"/>
      ${i % every === 0 ? `<text x="${cx}" y="${H - 6}" text-anchor="middle" class="axis">${esc(h.short)}</text>` : ''}</g>`;
  });
  return s + '</svg>';
}

function lineChart(points) {
  const W = 640, H = 220, B = 30, T = 16, LP = 26;
  const vals = points.map(p => p.v);
  const max = Math.max(...vals, 0), min = Math.min(...vals, 0);
  const span = max - min || 1;
  const x = i => LP + (W - 2 * LP) * (points.length === 1 ? 0.5 : i / (points.length - 1));
  const y = v => T + (H - T - B) * (1 - (v - min) / span);
  const every = Math.ceil(points.length / 12);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points.length - 1).toFixed(1)},${y(min)} L${x(0).toFixed(1)},${y(min)} Z`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart ${points.length > 8 ? 'dense' : ''}" role="img" aria-label="${t('Évolution du patrimoine')}">
    <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${min < 0 ? `<line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="grid-line"/>` : ''}
    <path d="${area}" fill="url(#lg)" class="area"/>
    <path d="${d}" class="line" pathLength="1"/>
    ${points.map((p, i) => `<g class="dot-g" ${tipAttr([`<b>${esc(p.long)}</b>`, money(p.v)])}><circle cx="${x(i)}" cy="${y(p.v)}" r="14" class="hit"/><circle cx="${x(i)}" cy="${y(p.v)}" r="4" class="dot"/></g>${i % every === 0 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="axis">${esc(p.short)}</text>` : ''}`).join('')}
  </svg>`;
}

function hbar(label, value, max, { right, over = false, color, tip } = {}) {
  const w = max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0;
  return `<div class="hbar-row" ${tip ? tipAttr(tip) : ''}><span class="ellipsis">${label}</span><span class="num">${right ?? money(value)}</span>
    <div class="bar"><i class="${over ? 'over' : ''}" style="width:${w}%;${color && !over ? `background:${color}` : ''}"></i></div></div>`;
}

// Animated value (counter) when the view appears.
const countVal = (c, mode = 'money', cur = MAIN()) => `<span data-count="${c}" data-mode="${mode}" data-cur="${cur}">${mode === 'signed' ? signed(c, cur) : money(c, cur)}</span>`;
function runCounters() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const el of $$('[data-count]')) {
    const to = +el.dataset.count, mode = el.dataset.mode, cur = el.dataset.cur, t0 = performance.now(), dur = 700;
    const fmt = v => (mode === 'signed' ? signed(v, cur) : money(v, cur));
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(to * e));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

/* ---------- Views ---------- */

const navArrows = (label, prev, next) => `<div class="month-nav"><button class="icon-btn" data-act="${prev}" aria-label="${t('Précédent')}">${icon('chevron-left')}</button><span>${label}</span><button class="icon-btn" data-act="${next}" aria-label="${t('Suivant')}">${icon('chevron-right')}</button></div>`;
const monthNav = () => navArrows(monthLabel(curMonth), 'm-prev', 'm-next');
const approxNote = () => (C.multi ? `<p class="hint">${t('Montants convertis en {c} au taux de chaque période (≈).', { c: MAIN() })}</p>` : '');

function txRow(x) {
  const acc = id => esc(accById(id)?.name || '?');
  const tt = TX_TYPES();
  let ic, color, title, sub, amt, cls = '';
  switch (x.type) {
    case 'expense': {
      const e = envById(x.envelopeId), ce = envCur(x.envelopeId), ca = accCur(x.accountId);
      ic = e?.icon || tt.expense[1]; color = e?.color; title = x.note || e?.name;
      sub = `${esc(e?.name || '?')} · ${acc(x.accountId)}${ca !== ce ? ` · ${t('payé {x}', { x: money(x.amount, ca) })}` : ''}`;
      amt = '−' + money(envAmt(x), ce); cls = 'neg'; break;
    }
    case 'income': { const n = txNet(x), c = accCur(x.accountId); ic = n < 0 ? 'trending-down' : tt.income[1]; color = n < 0 ? '#ea580c' : tt.income[2]; title = x.note || x.source; sub = `${esc(x.source)} · ${acc(x.accountId)}${x.fee ? ` · ${t('frais')} ${money(x.fee, c)}` : ''}`; amt = signed(n, c); cls = n < 0 ? 'neg' : 'pos'; break; }
    case 'transfer': {
      const a = accCur(x.accountId), b = accCur(x.toAccountId);
      ic = a !== b ? 'repeat' : tt.transfer[1]; color = tt.transfer[2]; title = x.note || (a !== b ? t('Change') : t('Transfert'));
      sub = `${acc(x.accountId)} → ${acc(x.toAccountId)}${x.fee ? ` · ${t('frais')} ${money(x.fee, a)}` : ''}${a !== b ? ` · ${fmtRate(a, b, recvAmt(x) / x.amount)}` : ''}`;
      amt = a !== b ? `${money(x.amount, a)} → ${money(recvAmt(x), b)}` : money(x.amount, a); break;
    }
    case 'alloc': { const pos = x.lines.filter(l => l.amount > 0); ic = isMove(x) ? 'shuffle' : tt.alloc[1]; color = tt.alloc[2]; title = txTitle(x); sub = t('{n} enveloppe(s)', { n: x.lines.length }); amt = money(pos.reduce((s, l) => s + l.amount, 0), envCur(x.lines[0]?.envelopeId)); cls = 'muted'; break; }
    case 'adjust': ic = tt.adjust[1]; color = tt.adjust[2]; title = txTitle(x); sub = `${t('Ajustement')} · ${acc(x.accountId)}`; amt = signed(x.amount, accCur(x.accountId)); cls = x.amount < 0 ? 'neg' : 'pos'; break;
  }
  return `<button class="tx" data-act="tx" data-id="${x.id}">${tile(ic, color)}<span class="mid"><div class="t ellipsis">${esc(title)}</div><div class="s ellipsis">${sub}</div></span><span class="amt ${cls}">${amt}</span></button>`;
}

function txList(list) {
  if (!list.length) return `<div class="empty">${icon('receipt')}<p>${t('Aucune opération.')}</p></div>`;
  let h = '', day = '';
  for (const x of sortedTx(list)) {
    if (x.date !== day) { day = x.date; h += `<div class="tx-day">${dayLabel(day)}</div>`; }
    h += txRow(x);
  }
  return h;
}

const alertBox = (ic, html, cls = '', btn = '') => `<div class="alert ${cls}">${icon(ic)}<span class="grow">${html}</span>${btn}</div>`;

function welcomeCard() {
  const s = S.settings;
  const cur = s.currency;
  return `<div class="card welcome"><div class="card-head"><h2>${icon('sparkles')} ${t('Bienvenue ! Pour démarrer :')}</h2>${langSwitch()}</div><ol class="steps">
    ${s.setupDone ? '' : `<li><b>${t('Tes devises')}</b>
      <div class="onboard">
        ${field(t('Je reçois mes revenus en'), `<select id="ob-in">${curOptions(cur)}</select>`)}
        ${field(t('Je paie mes dépenses du quotidien en'), `<select id="ob-out">${curOptions(cur)}</select>`)}
        <button class="btn primary" data-act="onboard">${icon('check')} ${t('Valider')}</button>
      </div><small class="muted">${t("Même devise ? L'app reste simple. Deux devises (ex. USD et UGX) ? Chaque compte et enveloppe aura la sienne.")}</small></li>`}
    <li>${t('<b>Comptes</b> : indique combien tu as maintenant sur chaque compte (Upwork, trading, espèces, mobile money…).')} <button class="btn sm" data-act="go" data-view="accounts">${t('Mes comptes')}</button></li>
    <li>${t('<b>Enveloppes</b> : mets le budget mensuel de chaque poste (loyer, factures, études…).')} <button class="btn sm" data-act="go" data-view="envelopes">${t('Mes enveloppes')}</button></li>
    <li>${t('<b>Répartis</b> ton argent actuel dans les enveloppes.')} <button class="btn sm" data-act="alloc">${t('Répartir')}</button></li>
    <li>${t('Ensuite, à <b>chaque</b> revenu et <b>chaque</b> dépense, appuie sur <b>+</b>. Même 1 centime.')}</li></ol>
    <p class="muted">${t("Besoin d'aide ?")} <a href="#guide" data-act="go" data-view="guide">${t('Lis le guide')}</a> · <a href="#" data-act="demo">${t('Essayer la démo')}</a></p></div>`;
}

function viewDashboard() {
  const st = monthStats(curMonth);
  const main = MAIN();
  const needsMain = inMain(needsByCur()).total;
  const fd = firstDate(), fm = fd?.slice(0, 7);
  const hist = [...Array(6)].map((_, i) => { const m = shiftMonth(curMonth, i - 5); const s = monthStats(m); return { m, short: monthLabel(m, true), long: monthLabel(m), inc: s.income, exp: s.expense }; });
  const known = hist.filter(h => fm && h.m >= fm && h.m <= monthOf(today()));
  const avg = known.length ? Math.round(known.reduce((s, h) => s + h.inc, 0) / known.length) : 0;
  const minInc = known.length ? Math.min(...known.map(h => h.inc)) : 0;
  const emMap = {}, futureMap = {};
  for (const e of activeEnvs()) {
    if (e.kind === 'emergency') add(emMap, e.currency, C.env[e.id]);
    if (e.kind === 'saving' || e.kind === 'invest') add(futureMap, e.currency, C.env[e.id]);
  }
  const emergency = inMain(emMap).total;
  const cover = needsMain > 0 ? emergency / needsMain : null;
  const balMap = { ...st.inc };
  for (const [c, v] of Object.entries(st.exp)) add(balMap, c, -v);
  const b = s => `<b>${s}</b>`;

  const alerts = [];
  if (!S.tx.length) alerts.push(welcomeCard());
  if (S.settings.multiNotice) alerts.push(alertBox('coins', t('<b>Nouveau :</b> plusieurs devises. Si tu utilises par exemple USD et UGX, indique la devise de chaque compte et enveloppe.'), 'info', `<button class="btn sm primary" data-act="currencies">${t('Configurer')}</button><button class="icon-btn" data-act="dismiss-multi" aria-label="${t('Fermer')}">${icon('x')}</button>`));
  for (const c of C.curs) {
    if (C.un[c] > 0) alerts.push(alertBox('wallet-cards', t('{x} ne sont pas encore répartis. Donne une mission à chaque centime.', { x: b(money(C.un[c], c)) }), 'info', `<button class="btn sm primary" data-act="alloc" data-cur="${c}">${t('Répartir')}</button>`));
    if (C.un[c] < 0) alerts.push(alertBox('triangle-alert', t("Tu as réparti {x} de plus que ce que tu possèdes. Retire cet argent d'une enveloppe.", { x: b(money(-C.un[c], c)) }), 'bad', `<button class="btn sm" data-act="move">${t('Déplacer')}</button>`));
  }
  // How much to exchange to cover this month's budgets in the other currencies.
  for (const c of C.curs.filter(c => c !== main)) {
    const s = shortfall(c);
    if (!s || !activeEnvs(c).length) continue;
    const r = lastRate(c);
    const m = r ? Math.ceil(s / r / 100) * 100 : null;
    alerts.push(alertBox('repeat', m ? t('Il te manque {x} pour les budgets du mois, soit environ {y} à changer.', { x: b(money(s, c)), y: b(money(m, main)) }) : t('Il te manque {x} pour les budgets du mois.', { x: b(money(s, c)) }), 'info', `<button class="btn sm" data-act="exchange" data-cur="${c}" data-amount="${m || 0}">${t('Changer')}</button>`));
  }
  for (const e of activeEnvs()) {
    if (C.env[e.id] < 0) alerts.push(alertBox('triangle-alert', t('{e} est à découvert de {x}. Prends dans une autre enveloppe.', { e: b(esc(e.name)), x: b(money(-C.env[e.id], e.currency)) }), 'bad', `<button class="btn sm" data-act="move">${t('Déplacer')}</button>`));
    else if (e.target && (st.byEnv[e.id] || 0) > e.target) alerts.push(alertBox('info', t('Budget {e} dépassé ce mois : {x} / {y}.', { e: b(esc(e.name)), x: money(st.byEnv[e.id], e.currency), y: money(e.target, e.currency) })));
  }
  if (st.untracked) alerts.push(alertBox('scale', t("{x} d'argent non tracé ce mois (ajustements de solde). Note tes dépenses au moment où tu les fais.", { x: b(money(st.untracked)) }), 'bad'));
  if (needsMain && known.length >= 2 && avg < needsMain) alerts.push(alertBox('trending-down', t('Tes revenus moyens ({x}/mois) ne couvrent pas tes besoins mensuels ({y}). Réduis les budgets ou augmente les revenus.', { x: money(avg), y: money(needsMain) })));
  const daysSinceBackup = S.settings.lastBackup ? (Date.now() - S.settings.lastBackup) / 864e5 : Infinity;
  if (!syncOn() && !DEMO && S.tx.length >= 5 && daysSinceBackup > 7) alerts.push(alertBox('download', `${S.settings.lastBackup ? t('Dernière sauvegarde il y a {n} jours.', { n: Math.floor(daysSinceBackup) }) : t('Aucune sauvegarde encore.')} ${t('Tes données ne sont que sur cet appareil.')}`, '', `<button class="btn sm" data-act="go" data-view="settings">${t('Sauvegarder')}</button>`));

  const sources = Object.entries(st.bySource).sort((a, c) => c[1] - a[1]);
  const srcMax = Math.max(1, ...sources.map(s => Math.abs(s[1])));
  const spend = activeEnvs().map(e => ({ e, v: st.byEnv[e.id] || 0 })).filter(z => z.v > 0 || z.e.target > 0).sort((a, c) => (toMain(c.v, c.e.currency) ?? c.v) - (toMain(a.v, a.e.currency) ?? a.v) || c.e.target - a.e.target);
  const recent = sortedTx(S.tx).slice(0, 8);
  const kInc = kpiMoney(st.inc), kExp = kpiMoney(st.exp), kBal = kpiMoney(balMap, 'signed'), kTot = kpiMoney(C.tot);
  const fees = st.fees + st.transferFees;

  return `
  <div class="page-head"><h1>${t('Tableau de bord')}</h1>${monthNav()}</div>
  ${alerts.length ? `<div class="alerts">${alerts.join('')}</div>` : ''}
  <div class="grid kpis">
    <div class="card kpi"><div class="label">${icon('arrow-down-left')} ${t('Revenus nets du mois')}</div><div class="value pos">${kInc.value}</div><div class="sub">${kInc.detail ? kInc.detail + ' · ' : ''}${fees ? `${t('frais payés')} ${money(fees)} · ` : ''}${t('moy. {x}/mois', { x: money(avg) })}</div></div>
    <div class="card kpi"><div class="label">${icon('arrow-up-right')} ${t('Dépenses du mois')}</div><div class="value neg">${kExp.value}</div><div class="sub">${kExp.detail ? kExp.detail + ' · ' : ''}${t('besoins prévus')} ${moneyList(needsByCur())}</div></div>
    <div class="card kpi"><div class="label">${icon('scale')} ${t('Solde du mois')}</div><div class="value ${st.income - st.expense < 0 ? 'neg' : ''}">${kBal.value}</div><div class="sub">${st.income > 0 ? t('tu as gardé {p} % de tes revenus', { p: pct(st.income - st.expense, st.income) }) : t('revenus − dépenses')}</div></div>
    <div class="card kpi accent"><div class="label">${icon('landmark')} ${t('Patrimoine total')}</div><div class="value">${kTot.value}</div><div class="sub">${kTot.detail ? kTot.detail + ' · ' : ''}${t('dont épargne + invest.')} ${moneyList(futureMap)}</div></div>
    <div class="card kpi"><div class="label">${icon('life-buoy')} ${t('Coussin de sécurité')}</div><div class="value">${cover === null ? money(emergency) : t('{n} mois', { n: cover.toLocaleString(LOCALE, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) })}</div><div class="sub">${cover === null ? t('définis tes budgets mensuels') : `${money(emergency)} · ${t('objectif 3 à 6 mois')}`}</div></div>
  </div>
  <div class="grid cols-2">
    <div class="card"><div class="card-head"><h2>${t('Revenus vs dépenses')}</h2><button class="btn sm" data-act="go" data-view="reports">${icon('chart-column')} ${t('Rapports')}</button></div>${barsChart(hist)}
      <div class="legend"><span><i style="background:var(--inc)"></i>${t('Revenus nets')}</span><span><i style="background:var(--exp)"></i>${t('Dépenses')}</span><span>${t('Touche une barre pour le détail')}</span></div>
      ${approxNote()}
      ${known.length ? `<p class="hint" style="margin-top:10px">${t('Revenus irréguliers : moyenne {x}, mois le plus faible {y}. Base ton train de vie sur le mois faible, pas sur la moyenne.', { x: b(money(avg)), y: b(money(minInc)) })}</p>` : ''}
    </div>
    <div class="card"><h2>${t('Revenus par source — {m}', { m: monthLabel(curMonth) })}</h2>
      ${sources.length ? sources.map(([s, v]) => hbar(esc(s), Math.abs(v), srcMax, { right: signed(v), over: v < 0, tip: [`<b>${esc(s)}</b>`, signed(v), t('{p} % des revenus', { p: pct(v, st.income) })] })).join('') : `<p class="muted">${t('Aucun revenu ce mois.')}</p>`}
      <div class="card-head" style="margin-top:18px"><h2>${t("Où va l'argent")}</h2><button class="btn sm" data-act="go" data-view="envelopes">${t('Enveloppes')}</button></div>
      ${spend.length ? spend.slice(0, 8).map(({ e, v }) => hbar(`${tile(e.icon, e.color, 'xs')} ${esc(e.name)}`, v, Math.max(e.target, v), {
        right: e.target ? `${money(v, e.currency)} / ${money(e.target, e.currency)}` : money(v, e.currency), over: e.target && v > e.target, color: e.color,
        tip: [`<b>${esc(e.name)}</b>`, `${t('Dépensé')} : ${money(v, e.currency)}`, e.target ? `${t('Budget')} : ${money(e.target, e.currency)} (${pct(v, e.target)} %)` : '', `${t("Reste dans l'enveloppe")} : ${money(C.env[e.id], e.currency)}`],
      })).join('') : `<p class="muted">${t('Aucune dépense ce mois.')}</p>`}
    </div>
  </div>
  <div class="card"><div class="card-head"><h2>${t('Dernières opérations')}</h2><button class="btn sm" data-act="go" data-view="tx">${t('Tout voir')}</button></div>${txList(recent)}</div>`;
}

function viewTx() {
  const types = { expense: t('Dépenses'), income: t('Revenus'), transfer: t('Transferts'), alloc: t('Répartitions'), adjust: t('Ajustements') };
  const tt = TX_TYPES();
  return `<div class="page-head"><h1>${t('Opérations')}</h1>${monthNav()}</div>
  <div class="card">
    <div class="filters">
      <input type="search" data-filter="q" placeholder="${t('Rechercher…')}" value="${esc(txFilter.q)}">
      <select data-filter="type" data-rich>${opt('', t('Tous les types'), txFilter.type, 'list')}${Object.entries(types).map(([k, v]) => opt(k, v, txFilter.type, tt[k][1], tt[k][2])).join('')}</select>
      <select data-filter="env" data-rich>${opt('', t('Toutes les enveloppes'), txFilter.env, 'wallet-cards')}${S.envelopes.map(e => opt(e.id, e.name, txFilter.env, e.icon, e.color)).join('')}</select>
      <select data-filter="acc" data-rich>${opt('', t('Tous les comptes'), txFilter.acc, 'landmark')}${S.accounts.map(a => opt(a.id, a.name, txFilter.acc, a.icon)).join('')}</select>
    </div>
    <div id="tx-out"></div>
    <div class="row-actions" style="margin-top:12px"><button class="btn sm" data-act="csv">${icon('file-spreadsheet')} ${t('Exporter en CSV (Excel)')}</button></div>
  </div>`;
}
function renderTxList() {
  const q = txFilter.q.trim().toLowerCase();
  const list = S.tx.filter(x => monthOf(x.date) === curMonth
    && (!txFilter.type || x.type === txFilter.type)
    && (!txFilter.env || x.envelopeId === txFilter.env || x.lines?.some(l => l.envelopeId === txFilter.env))
    && (!txFilter.acc || x.accountId === txFilter.acc || x.toAccountId === txFilter.acc)
    && (!q || [x.note, x.source, envById(x.envelopeId)?.name, accById(x.accountId)?.name].join(' ').toLowerCase().includes(q)));
  const inc = {}, exp = {};
  for (const x of list) {
    if (x.type === 'income') add(inc, accCur(x.accountId), txNet(x));
    if (x.type === 'expense') add(exp, envCur(x.envelopeId), envAmt(x));
  }
  $('#tx-out').innerHTML = `<div class="totals"><span>${t('{n} opération(s)', { n: list.length })}</span><span>${t('Entrées')} <b class="pos">${moneyList(inc)}</b></span><span>${t('Sorties')} <b class="neg">${moneyList(exp)}</b></span></div>${txList(list)}`;
}

function viewEnvelopes() {
  const st = monthStats(monthOf(today()));
  const envs = activeEnvs();
  const groups = [...new Set(envs.map(e => e.group || t('Autres')))];
  const archived = S.envelopes.filter(e => e.archived);
  const kinds = KINDS();
  const inEnv = {}, pctBy = {};
  for (const e of envs) { add(inEnv, e.currency, C.env[e.id]); add(pctBy, e.currency, +e.percent || 0); }
  const pctOk = Object.values(pctBy).every(v => Math.abs(v - 100) < 0.01);
  const unMap = Object.fromEntries(C.curs.map(c => [c, C.un[c] || 0]));
  const card = e => {
    const spent = st.byEnv[e.id] || 0, bal = C.env[e.id], c = e.currency;
    return `<div class="card env lift" style="--c:${e.color}">
      <div class="top">${tile(e.icon, e.color)}<span class="name ellipsis">${esc(e.name)}</span>${e.kind !== 'normal' ? `<span class="chip">${kinds[e.kind][0]}</span>` : ''}${curChip(c)}<button class="icon-btn" data-act="env" data-id="${e.id}" aria-label="${t('Modifier')}">${icon('pencil')}</button></div>
      <div class="bal ${bal < 0 ? 'neg' : ''}">${money(bal, c)}</div>
      <div class="meta"><span>${t('Ce mois : reçu {x} · dépensé {y}', { x: money(st.alloc[e.id] || 0, c), y: money(spent, c) })}</span></div>
      ${e.target ? `<div class="bar"><i class="${spent > e.target ? 'over' : ''}" style="width:${Math.min(100, spent / e.target * 100)}%;${spent > e.target ? '' : `background:${e.color}`}"></i></div>
      <div class="meta"><span>${t('Budget {x}/mois', { x: money(e.target, c) })}</span><span>${spent > e.target ? `<b class="neg">+${money(spent - e.target, c)}</b>` : t('reste {x}', { x: money(e.target - spent, c) })}</span></div>` : `<div class="meta"><span>${t('Pas de budget mensuel')}</span><span>${t('{p} % des revenus', { p: e.percent || 0 })}</span></div>`}
      <div class="row-actions" style="margin-top:8px"><button class="btn sm" data-act="spend" data-id="${e.id}">${icon('minus')} ${t('Dépense')}</button><button class="btn sm ghost" data-act="move" data-id="${e.id}">${icon('shuffle')} ${t('Déplacer')}</button></div>
    </div>`;
  };
  return `<div class="page-head"><h1>${t('Enveloppes')}</h1><div class="row-actions"><button class="btn" data-act="move">${icon('shuffle')} ${t('Déplacer')}</button><button class="btn primary" data-act="alloc">${icon('wallet-cards')} ${t('Répartir')}</button></div></div>
  <div class="grid kpis">
    <div class="card kpi accent"><div class="label">${t('Non réparti')}</div><div class="value multi">${nonZero(unMap).length > 1 ? nonZero(unMap).map(([c, v]) => `<span class="mline ${v < 0 ? 'neg' : ''}">${money(v, c)}</span>`).join('') : countVal(nonZero(unMap)[0]?.[1] || 0, 'money', nonZero(unMap)[0]?.[0])}</div></div>
    <div class="card kpi"><div class="label">${t('Dans les enveloppes')}</div><div class="value multi">${nonZero(inEnv).length > 1 ? nonZero(inEnv).map(([c, v]) => `<span class="mline">${money(v, c)}</span>`).join('') : countVal(nonZero(inEnv)[0]?.[1] || 0, 'money', nonZero(inEnv)[0]?.[0])}</div></div>
    <div class="card kpi"><div class="label">${t('Besoins mensuels')}</div><div class="value multi">${nonZero(needsByCur()).map(([c, v]) => `<span class="mline">${money(v, c)}</span>`).join('') || money(0)}</div></div>
    <div class="card kpi"><div class="label">${t('Total des %')}</div><div class="value ${pctOk ? '' : 'neg'}">${Object.entries(pctBy).map(([c, v]) => `<span class="mline">${C.multi ? c + ' ' : ''}${fmtNum(v)} %</span>`).join('')}</div><div class="sub">${pctOk ? t('parfait') : (C.multi ? t('idéalement 100 % par devise') : t('idéalement 100 %'))}</div></div>
  </div>
  ${groups.map(g => `<h3 class="group-title">${esc(g)}</h3><div class="grid env-grid">${envs.filter(e => (e.group || t('Autres')) === g).map(card).join('')}</div>`).join('')}
  <div class="row-actions" style="margin-top:20px"><button class="btn" data-act="env">${icon('plus')} ${t('Nouvelle enveloppe')}</button></div>
  ${archived.length ? `<h3 class="group-title">${t('Archivées')}</h3><div class="row-actions">${archived.map(e => `<button class="btn sm ghost" data-act="env" data-id="${e.id}">${icon(e.icon)} ${esc(e.name)}</button>`).join('')}</div>` : ''}`;
}

function viewGoals() {
  const fund = goalFunding();
  const open = S.goals.filter(g => !g.purchased);
  const done = S.goals.filter(g => g.purchased);
  const byEnv = [...new Set(open.map(g => g.envelopeId))];
  const left = {};
  for (const g of open) add(left, envCur(g.envelopeId), Math.max(0, (g.target || 0) - (fund[g.id] || 0)));
  const row = g => {
    const c = envCur(g.envelopeId), have = fund[g.id] || 0, w = g.target ? Math.min(100, have / g.target * 100) : 0;
    const ready = g.target && have >= g.target;
    return `<div class="goal"><div class="mid">
      <div class="card-head" style="margin-bottom:6px"><span class="t">${g.priority}. ${esc(g.name)}</span><span class="num">${g.target ? `${money(have, c)} / ${money(g.target, c)}` : `<span class="muted">${t('prix à définir')}</span>`}</span></div>
      <div class="bar"><i style="width:${w}%"></i></div></div>
      ${ready ? `<button class="btn sm primary" data-act="buy" data-id="${g.id}">${icon('check')} ${t('Acheter')}</button>` : ''}
      <button class="icon-btn" data-act="goal" data-id="${g.id}" aria-label="${t('Modifier')}">${icon('pencil')}</button></div>`;
  };
  return `<div class="page-head"><h1>${t('Objectifs')}</h1><button class="btn primary" data-act="goal">${icon('plus')} ${t('Objectif')}</button></div>
  <p class="muted lead">${t("Les objectifs sont financés par l'argent de leur enveloppe, dans l'ordre de priorité. Quand la barre est pleine, tu peux acheter <b>sans toucher au reste</b>.")}
  ${nonZero(left).length ? t('Il manque encore {x} au total.', { x: `<b>${moneyList(left)}</b>` }) : ''}</p>
  ${byEnv.map(id => { const e = envById(id); return `<div class="card" style="margin-bottom:14px"><div class="card-head"><h2 class="with-tile">${tile(e?.icon || 'folder', e?.color)} ${esc(e?.name || t('Enveloppe supprimée'))}</h2><span class="chip">${t('dispo {x}', { x: money(C.env[id] || 0, envCur(id)) })}</span></div>${open.filter(g => g.envelopeId === id).sort((a, c) => a.priority - c.priority).map(row).join('')}</div>`; }).join('')}
  ${!open.length ? `<div class="card empty">${icon('target')}<p>${t('Aucun objectif en cours. Ajoute ce que tu veux acheter ou atteindre.')}</p></div>` : ''}
  ${done.length ? `<h3 class="group-title">${t('Achetés')}</h3><div class="card">${done.map(g => `<div class="goal done"><div class="mid"><span class="t">${esc(g.name)}</span></div><span class="num">${money(g.paid ?? g.target, envCur(g.envelopeId))}</span><button class="icon-btn" data-act="goal" data-id="${g.id}">${icon('pencil')}</button></div>`).join('')}</div>` : ''}`;
}

const ACC_SORTS = () => ({
  default: [t('Ordre de création'), 'list'], 'name-asc': [t('Nom (A → Z)'), 'arrow-down-a-z'], 'name-desc': [t('Nom (Z → A)'), 'arrow-down-z-a'],
  'bal-desc': [t('Solde (plus grand)'), 'arrow-down-wide-narrow'], 'bal-asc': [t('Solde (plus petit)'), 'arrow-down-narrow-wide'],
  type: [t('Type'), 'shapes'], currency: [t('Devise'), 'coins'],
});
function sortAccounts(list) {
  const mode = P.accSort || 'default';
  const types = Object.keys(ACC_TYPES());
  const byName = (a, b) => a.name.localeCompare(b.name, LOCALE, { sensitivity: 'base' });
  const bal = a => toMain(C.acc[a.id], a.currency) ?? C.acc[a.id];
  const cmp = {
    'name-asc': byName, 'name-desc': (a, b) => byName(b, a),
    'bal-desc': (a, b) => bal(b) - bal(a), 'bal-asc': (a, b) => bal(a) - bal(b),
    type: (a, b) => types.indexOf(a.type) - types.indexOf(b.type) || byName(a, b),
    currency: (a, b) => a.currency.localeCompare(b.currency) || byName(a, b),
  }[mode];
  return cmp ? [...list].sort(cmp) : list;
}

function viewAccounts() {
  const accs = sortAccounts(activeAccs());
  const archived = S.accounts.filter(a => a.archived);
  const types = ACC_TYPES();
  const kTot = kpiMoney(C.tot);
  return `<div class="page-head"><h1>${t('Comptes')}</h1><div class="row-actions"><button class="btn" data-act="transfer">${icon('arrow-left-right')} ${C.multi ? t('Transfert / change') : t('Transfert')}</button><button class="btn primary" data-act="acc">${icon('plus')} ${t('Compte')}</button></div></div>
  <p class="muted lead">${t('Où se trouve physiquement ton argent. Vérifie de temps en temps que les soldes correspondent à la réalité et utilise « Ajuster » si besoin.')}</p>
  <div class="acc-bar">
    <div class="card kpi accent"><div class="label">${icon('landmark')} ${t('Total')}</div><div class="value">${kTot.value}</div>${kTot.detail ? `<div class="sub">${kTot.detail}</div>` : ''}</div>
    <label class="sort">${icon('arrow-down-a-z')}<span>${t('Trier par')}</span><select data-sort="acc" data-rich>${Object.entries(ACC_SORTS()).map(([k, [l, ic]]) => opt(k, l, P.accSort || 'default', ic)).join('')}</select></label>
  </div>
  <div class="grid env-grid">${accs.map(a => `<div class="card lift">
    <div class="env-top">${tile(a.icon)}<span class="name ellipsis">${esc(a.name)}</span>${curChip(a.currency)}<button class="icon-btn" data-act="acc" data-id="${a.id}" aria-label="${t('Modifier')}">${icon('pencil')}</button></div>
    <div class="bal num">${money(C.acc[a.id], a.currency)}</div>
    <div class="meta">${types[a.type]?.[0] || ''} · ${t('départ {x}', { x: money(a.initial, a.currency) })}</div>
    <div class="row-actions"><button class="btn sm" data-act="adjust" data-id="${a.id}">${icon('scale')} ${t('Ajuster')}</button><button class="btn sm ghost" data-act="acc-tx" data-id="${a.id}">${icon('receipt')} ${t('Opérations')}</button></div>
  </div>`).join('')}</div>
  ${archived.length ? `<h3 class="group-title">${t('Archivés')}</h3><div class="row-actions">${archived.map(a => `<button class="btn sm ghost" data-act="acc" data-id="${a.id}">${icon(a.icon)} ${esc(a.name)}</button>`).join('')}</div>` : ''}`;
}

/* ---------- Reports by period ---------- */

const REP_STEP = { month: 1, '3m': 3, '6m': 6, year: 12 };
const rep = () => (P.rep ||= { mode: 'month', anchor: monthOf(today()) });
function periodRange(p) {
  const a = p.anchor || monthOf(today());
  switch (p.mode) {
    case '3m': return { from: shiftMonth(a, -2) + '-01', to: endOfMonth(a) };
    case '6m': return { from: shiftMonth(a, -5) + '-01', to: endOfMonth(a) };
    case 'year': return { from: a.slice(0, 4) + '-01-01', to: a.slice(0, 4) + '-12-31' };
    case 'custom': { let from = p.from || a + '-01', to = p.to || today(); if (from > to) [from, to] = [to, from]; return { from, to }; }
    default: return { from: a + '-01', to: endOfMonth(a) };
  }
}
function prevRange(p, r) {
  if (REP_STEP[p.mode]) return periodRange({ ...p, anchor: shiftMonth(p.anchor, -REP_STEP[p.mode]) });
  const to = addDays(r.from, -1);
  return { from: addDays(to, -daysBetween(r.from, r.to)), to };
}
const periodLabel = (p, r) => (p.mode === 'month' ? monthLabel(p.anchor) : p.mode === 'year' ? p.anchor.slice(0, 4) : `${shortDate(r.from)} – ${shortDate(r.to)}`);

// Chart buckets: daily for short periods, monthly otherwise.
function buckets(r) {
  const out = [];
  if (daysBetween(r.from, r.to) < 45) {
    for (let d = r.from; d <= r.to; d = addDays(d, 1)) out.push({ from: d, to: d, short: String(+d.slice(8)), long: dayLabel(d) });
    return out;
  }
  const multiYear = r.from.slice(0, 4) !== r.to.slice(0, 4);
  for (let m = monthOf(r.from); m <= monthOf(r.to); m = shiftMonth(m, 1)) {
    out.push({ m, from: m + '-01' < r.from ? r.from : m + '-01', to: endOfMonth(m) > r.to ? r.to : endOfMonth(m), short: monthLabel(m, true) + (multiYear ? ` ${m.slice(2, 4)}` : ''), long: monthLabel(m) });
  }
  return out;
}

function viewReports() {
  const p = rep(), r = periodRange(p), pr = prevRange(p, r);
  const st = rangeStats(r), prev = rangeStats(pr);
  const now = today(), fd = firstDate();
  const modes = { month: t('Mois'), '3m': t('3 mois'), '6m': t('6 mois'), year: t('Année'), custom: t('Personnalisé') };
  const head = `<div class="page-head"><h1>${t('Rapport')} <span class="muted rep-label">${esc(periodLabel(p, r))}</span></h1>
    <div class="row-actions">${p.mode === 'custom' ? '' : navArrows(esc(periodLabel(p, r)), 'rep-prev', 'rep-next')}
    <button class="btn" data-act="print">${icon('printer')} ${t('Imprimer / PDF')}</button><button class="btn" data-act="csv-period">${icon('file-spreadsheet')} CSV</button></div></div>
    <div class="rep-bar"><div class="seg">${Object.entries(modes).map(([k, v]) => `<button type="button" class="${k === p.mode ? 'on' : ''}" data-act="rep-mode" data-mode="${k}">${v}</button>`).join('')}</div>
    ${p.mode === 'custom' ? `<div class="rep-dates"><label>${t('Du')} <input type="date" data-rep="from" value="${r.from}"></label><label>${t('au')} <input type="date" data-rep="to" value="${r.to}"></label></div>` : ''}</div>`;
  if (!S.tx.some(x => x.date >= r.from && x.date <= r.to)) {
    return `${head}<div class="card empty">${icon('chart-column')}<p>${t('Aucune opération sur cette période.')}</p></div>`;
  }
  const bks = buckets(r).map(b => { const s = rangeStats(b); return { ...b, inc: s.income, exp: s.expense }; });
  const nbMonths = Math.max(1, Math.round((daysBetween(r.from, r.to) + 1) / 30.44));
  const saved = st.income - st.expense;
  const fees = st.fees + st.transferFees;
  const active = bks.filter(b => b.inc || b.exp);
  const best = bks.length > 1 && active.length ? active.reduce((a, c) => (c.inc > a.inc ? c : a)) : null;
  const worst = bks.length > 1 && active.length ? active.reduce((a, c) => (c.inc < a.inc ? c : a)) : null;
  const vs = (a, c, goodUp) => (c ? `<span class="${(a >= c) === goodUp ? 'pos' : 'neg'}">${a >= c ? '▲' : '▼'} ${Math.abs(pct(a - c, Math.abs(c)))} %</span> ${t('vs période précédente')}` : t('pas de données sur la période précédente'));
  const wealth = bks.filter(b => fd && b.to >= fd && b.from <= now).map(b => { const end = b.to > now ? now : b.to; return { short: b.short, long: b.long, v: wealthAt(end) }; });
  const sources = Object.entries(st.bySource).sort((a, c) => c[1] - a[1]);
  const envRows = S.envelopes.map(e => ({ e, v: st.byEnv[e.id] || 0 })).filter(z => z.v > 0).sort((a, c) => (toMain(c.v, c.e.currency) ?? c.v) - (toMain(a.v, a.e.currency) ?? a.v));
  const topExp = S.tx.filter(x => x.type === 'expense' && x.date >= r.from && x.date <= r.to).sort((a, c) => (toMain(envAmt(c), envCur(c.envelopeId), c.date) ?? 0) - (toMain(envAmt(a), envCur(a.envelopeId), a.date) ?? 0)).slice(0, 10);
  const fx = Object.values(st.fx);
  const kInc = kpiMoney(st.inc), kExp = kpiMoney(st.exp);
  let cumul = 0;

  return `${head}
  <div class="grid kpis">
    <div class="card kpi"><div class="label">${icon('arrow-down-left')} ${t('Revenus nets')}</div><div class="value pos">${kInc.value}</div><div class="sub">${kInc.detail ? kInc.detail + '<br>' : ''}${vs(st.income, prev.income, true)}</div></div>
    <div class="card kpi"><div class="label">${icon('arrow-up-right')} ${t('Dépenses')}</div><div class="value neg">${kExp.value}</div><div class="sub">${kExp.detail ? kExp.detail + '<br>' : ''}${vs(st.expense, prev.expense, false)}</div></div>
    <div class="card kpi accent"><div class="label">${icon('piggy-bank')} ${t('Gardé (revenus − dépenses)')}</div><div class="value ${saved < 0 ? 'neg' : ''}">${C.multi ? '≈ ' : ''}${countVal(saved, 'signed')}</div><div class="sub">${t("taux d'épargne {p} %", { p: pct(saved, st.income) })}</div></div>
    <div class="card kpi"><div class="label">${icon('calendar')} ${t('Par mois (moyenne)')}</div><div class="value">${money(Math.round(st.income / nbMonths))}</div><div class="sub">${t('dépenses {x}/mois', { x: money(Math.round(st.expense / nbMonths)) })}</div></div>
    <div class="card kpi"><div class="label">${icon('hand-coins')} ${t('Frais payés')}</div><div class="value">${money(fees)}</div><div class="sub">${t('{p} % de tes revenus bruts', { p: pct(fees, st.income + st.fees) })}</div></div>
    <div class="card kpi"><div class="label">${icon('scale')} ${t('Argent non tracé')}</div><div class="value ${st.untracked ? 'neg' : ''}">${money(st.untracked)}</div><div class="sub">${st.untracked ? t('à réduire à zéro') : t('bravo, tout est noté')}</div></div>
  </div>
  <div class="grid cols-2">
    <div class="card"><h2>${t('Revenus et dépenses')}</h2>${barsChart(bks)}
      <div class="legend"><span><i style="background:var(--inc)"></i>${t('Revenus nets')}</span><span><i style="background:var(--exp)"></i>${t('Dépenses')}</span><span>${t('Touche une barre pour le détail')}</span></div>
      ${approxNote()}
      ${best && best !== worst ? `<p class="hint" style="margin-top:10px">${t('Meilleur : {a} ({x}) · Plus faible : {b} ({y}).', { a: `<b>${esc(best.long)}</b>`, x: money(best.inc), b: `<b>${esc(worst.long)}</b>`, y: money(worst.inc) })}</p>` : ''}</div>
    <div class="card"><h2>${t('Évolution du patrimoine')}</h2>${wealth.length ? lineChart(wealth) : `<p class="muted">${t('Pas encore de données.')}</p>`}
      ${wealth.length ? `<p class="hint" style="margin-top:10px">${t('Fin de période :')} <b>${money(wealth[wealth.length - 1].v)}</b></p>` : ''}</div>
  </div>
  <div class="grid cols-2">
    <div class="card"><h2>${t('Revenus par source')}</h2>
      ${sources.length ? sources.map(([s, v]) => hbar(`${esc(s)} <small class="muted">${pct(v, st.income)} %${prev.bySource[s] ? ` · ${t('avant')} ${money(prev.bySource[s])}` : ''}</small>`, Math.abs(v), Math.max(...sources.map(z => Math.abs(z[1]))), { right: signed(v), over: v < 0, tip: [`<b>${esc(s)}</b>`, signed(v), t('{p} % des revenus', { p: pct(v, st.income) }), prev.bySource[s] ? `${t('Période précédente')} : ${money(prev.bySource[s])}` : ''] })).join('') : `<p class="muted">${t('Aucun revenu.')}</p>`}
      <p class="hint">${t("{n} rentrée(s) d'argent sur la période.", { n: st.incomeCount })}</p></div>
    <div class="card"><h2>${t('Dépenses par enveloppe')}</h2>
      <div class="table-wrap"><table class="table"><thead><tr><th>${t('Enveloppe')}</th><th>${t('Total')}</th><th>${t('Budget période')}</th></tr></thead><tbody>
      ${envRows.map(({ e, v }) => { const budget = (e.target || 0) * nbMonths; return `<tr><td><span class="cell-name">${tile(e.icon, e.color, 'xs')}${esc(e.name)}</span></td><td class="num">${money(v, e.currency)}</td><td class="num ${budget && v > budget ? 'neg' : ''}">${budget ? money(budget, e.currency) : '—'}</td></tr>`; }).join('') || `<tr><td colspan="3" class="muted">${t('Aucune dépense.')}</td></tr>`}
      </tbody></table></div></div>
  </div>
  ${fx.length ? `<div class="card" style="margin-bottom:14px"><h2>${icon('repeat')} ${t('Changes de devises')}</h2>
    <div class="table-wrap"><table class="table"><thead><tr><th>${t('Change')}</th><th>${t('Envoyé')}</th><th>${t('Reçu')}</th><th>${t('Taux moyen')}</th><th>${t('Frais')}</th></tr></thead><tbody>
    ${fx.map(f => `<tr><td>${f.from} → ${f.to} <small class="muted">(${f.n})</small></td><td class="num">${money(f.sent, f.from)}</td><td class="num">${money(f.recv, f.to)}</td><td class="num">${fmtRate(f.from, f.to, f.recv / f.sent)}</td><td class="num">${money(f.fees, f.from)}</td></tr>`).join('')}
    </tbody></table></div></div>` : ''}
  <div class="card" style="margin-bottom:14px"><h2>${t('Détail')}</h2>
    <div class="table-wrap"><table class="table"><thead><tr><th>${bks[0]?.m ? t('Mois') : t('Jour')}</th><th>${t('Revenus')}</th><th>${t('Dépenses')}</th><th>${t('Solde')}</th><th>${t('Cumul')}</th></tr></thead><tbody>
    ${bks.filter(b => b.inc || b.exp).map(b => { const bal = b.inc - b.exp; cumul += bal; return `<tr ${b.m ? `class="clickable" data-act="rep-month" data-m="${b.m}"` : ''}><td>${esc(b.long)}</td><td class="num pos">${money(b.inc)}</td><td class="num neg">${money(b.exp)}</td><td class="num ${bal < 0 ? 'neg' : ''}">${signed(bal)}</td><td class="num">${signed(cumul)}</td></tr>`; }).join('')}
    </tbody></table></div>${bks[0]?.m ? `<p class="hint">${t('Touche un mois pour afficher son rapport.')}</p>` : ''}</div>
  <div class="card"><h2>${t('Plus grosses dépenses')}</h2>${topExp.length ? topExp.map(txRow).join('') : `<p class="muted">${t('Aucune dépense.')}</p>`}</div>`;
}

/* ---------- Guide ---------- */

function viewGuide() {
  const sec = ([ic, title, body], i) => `<details class="card guide" ${i === 0 ? 'open' : ''}><summary>${tile(ic)}<h2>${title}</h2>${icon('chevron-right', 'chev')}</summary><div class="guide-body">${body}</div></details>`;
  return `<div class="page-head"><h1>${t('Guide')}</h1>${langSwitch()}</div>
  <p class="muted lead">${t("Tout ce qu'il faut savoir pour suivre chaque centime, même avec des revenus irréguliers.")}</p>
  ${guideSections(LANG).map(sec).join('')}`;
}

/* ---------- Settings ---------- */

const langSwitch = () => `<div class="seg lang-switch">${Object.entries(LANGS).map(([k, v]) => `<button type="button" class="${k === LANG ? 'on' : ''}" data-act="lang" data-lang="${k}">${v}</button>`).join('')}</div>`;

function viewSettings() {
  const s = S.settings;
  const main = MAIN();
  const others = C.curs.filter(c => c !== main);
  const hasBackup = !!localStorage.getItem(BACKUP_KEY);
  return `<div class="page-head"><h1>${t('Réglages')}</h1></div>
  ${DEMO ? alertBox('flask-conical', t("Tu es en mode démo : les réglages de synchronisation, de sauvegarde et d'effacement sont désactivés."), 'info') : ''}
  <div class="grid cols-2">
    ${syncSection()}
    <div class="card"><h2>${icon('coins')} ${t('Devises')}</h2>
      ${field(t('Devise principale'), `<select data-set="currency">${curOptions(main, C.curs)}</select>`, t('Celle de tes revenus, utilisée pour les totaux et les rapports (≈).'))}
      ${others.length ? `<p class="muted">${t('Autres devises utilisées :')}</p><ul class="rates">${others.map(c => `<li><b>${c}</b> · ${lastRate(c) ? fmtRate(main, c, lastRate(c)) : `<span class="neg">${t('aucun taux')}</span>`}</li>`).join('')}</ul>` : `<p class="muted">${t('Une seule devise utilisée.')}</p>`}
      <p class="hint">${t("Changer une devise ne convertit pas les montants : elle indique seulement dans quelle monnaie ils sont. Les vrais changes se font avec un transfert entre deux comptes de devises différentes.")}</p>
      <button class="btn" data-act="currencies">${icon('coins')} ${t('Gérer les devises')}</button>
    </div>
    <div class="card"><h2>${icon('download')} ${t('Sauvegarde manuelle')}</h2>
      <p class="muted">${syncOn() ? t('Tes données sont stockées dans ce navigateur et synchronisées avec ton Google Drive.') : t('Tes données sont stockées dans ce navigateur, <b>uniquement sur cet appareil</b>.')}
      ${t('Tu peux aussi exporter un fichier de sauvegarde (Drive, clé USB, e-mail à toi-même).')}</p>
      <p class="muted">${t('Dernier export :')} <b>${s.lastBackup && !DEMO ? dateTime(s.lastBackup) : t('jamais')}</b></p>
      <div class="row-actions">
        <button class="btn primary" data-act="export">${icon('download')} ${t('Exporter (JSON)')}</button>
        <button class="btn" data-act="import">${icon('upload')} ${t('Importer')}</button>
        <button class="btn" data-act="csv">${icon('file-spreadsheet')} ${t('CSV (Excel)')}</button>
      </div>
      ${hasBackup ? `<p class="hint" style="margin-top:12px">${t("Une copie de tes données d'avant la mise à jour 2.0 est gardée sur cet appareil.")}</p><button class="btn sm ghost" data-act="restore-backup">${icon('undo-2')} ${t("Revenir aux données d'avant la 2.0")}</button>` : ''}
    </div>
    <div class="card"><h2>${icon('settings')} ${t('Préférences')}</h2>
      <div class="field"><span>${t('Langue')}</span>${langSwitch()}<small>${t("Seule l'interface change : ce que tu as tapé reste tel quel.")}</small></div>
      ${field(t('Thème'), `<select data-set="theme">${Object.entries({ auto: t('Automatique'), light: t('Clair'), dark: t('Sombre') }).map(([k, v]) => `<option value="${k}" ${k === s.theme ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
      ${field(t('Sources de revenus (une par ligne)'), `<textarea data-set="sources" rows="4">${esc(s.sources.join('\n'))}</textarea>`)}
    </div>
    <div class="card"><h2>${icon('flask-conical')} ${t('Démo')}</h2>
      <p class="muted">${t("Découvre l'app avec 6 mois de données d'exemple (revenus en USD, dépenses en UGX). Tes vraies données ne sont ni modifiées ni synchronisées, et rien de ce que tu fais en démo n'est enregistré.")}</p>
      ${DEMO ? `<button class="btn primary" data-act="demo-exit">${icon('log-out')} ${t('Quitter la démo')}</button>` : `<button class="btn primary" data-act="demo">${icon('play')} ${t('Lancer la démo')}</button>`}
    </div>
    ${aboutSection()}
    <div class="card"><h2>${icon('triangle-alert')} ${t('Zone dangereuse')}</h2>
      <p class="muted">${t("Efface toutes les données et repars de zéro. Exporte d'abord une sauvegarde !")}${syncOn() ? ` <b>${t("Avec la synchro active, l'effacement sera aussi appliqué à tes autres appareils.")}</b>` : ''}</p>
      <button class="btn danger" data-act="reset">${icon('trash-2')} ${t('Tout effacer')}</button>
    </div>
  </div>`;
}

function changeLang(lang) {
  if (!LANGS[lang] || lang === LANG) return;
  translateDefaults(LANG, lang);
  S.settings.lang = lang;
  applyPrefs();
  commit();
}

// Changing the main currency: fallback rates are recalculated against the new currency.
function changeMain(next) {
  const old = MAIN(), rates = S.settings.rates || {};
  const k = lastRate(next); // units of "next" for 1 "old"
  const out = {};
  if (k) {
    for (const [c, r] of Object.entries(rates)) if (c !== next) out[c] = r / k;
    out[old] = 1 / k;
  }
  S.settings.rates = out;
  S.settings.currency = next;
}

/* ---------- Demo ---------- */

function enterDemo() {
  if (DEMO) return;
  closeRich();
  if ($('#modal').open) $('#modal').close();
  DEMO = true;
  S = buildDemo(LANG);
  snap = snapshot();
  curMonth = monthOf(today());
  document.body.classList.add('demo');
  applyPrefs();
  setSync('off');
  go('dashboard');
  toast(t('Mode démo : rien ne sera enregistré'));
}
function exitDemo() {
  if (!DEMO) return;
  DEMO = false;
  S = load(); snap = snapshot();
  document.body.classList.remove('demo');
  applyPrefs();
  initSyncState();
  go('dashboard');
  toast(t('Démo terminée : tu retrouves tes données'));
}

/* ---------- Export / import ---------- */

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportJSON() {
  S.settings.lastBackup = Date.now();
  download(`${t('mes-finances-sauvegarde')}-${today()}.json`, JSON.stringify(S, null, 1), 'application/json');
  commit(t('Sauvegarde exportée'));
}
function exportCSV(range) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const sep = LANG === 'fr' ? ';' : ',';
  const types = TX_TYPES();
  const rows = [[t('Date'), t('Type'), t('Montant'), t('Devise'), t('Frais'), t('Montant reçu / enveloppe'), t('Devise'), t('Source'), t('Enveloppe'), t('Compte'), t('Vers compte'), t('Note')]];
  const list = range ? S.tx.filter(x => x.date >= range.from && x.date <= range.to) : S.tx;
  for (const x of sortedTx(list).reverse()) {
    const ty = types[x.type][0];
    if (x.type === 'alloc') {
      for (const l of x.lines) rows.push([x.date, ty, num(l.amount, envCur(l.envelopeId)), envCur(l.envelopeId), '', '', '', '', envById(l.envelopeId)?.name, '', '', txTitle(x)]);
      continue;
    }
    const ca = accCur(x.accountId);
    const amt = x.type === 'expense' ? -x.amount : x.amount;
    const second = x.type === 'transfer' && x.received != null ? [num(x.received, accCur(x.toAccountId)), accCur(x.toAccountId)]
      : x.type === 'expense' && x.envAmount != null ? [num(-x.envAmount, envCur(x.envelopeId)), envCur(x.envelopeId)] : ['', ''];
    rows.push([x.date, ty, num(amt, ca), ca, x.fee ? num(x.fee, ca) : '', ...second, x.source, envById(x.envelopeId)?.name, accById(x.accountId)?.name, accById(x.toAccountId)?.name, x.type === 'adjust' ? txTitle(x) : x.note]);
  }
  download(`${t('mes-finances-operations')}-${range ? `${range.from}_${range.to}` : today()}.csv`, '﻿' + rows.map(r => r.map(q).join(sep)).join('\r\n'), 'text/csv;charset=utf-8');
  toast(t('CSV exporté'));
}
function importJSON(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.tx) || !Array.isArray(d.envelopes) || !Array.isArray(d.accounts)) throw new Error(t('fichier non reconnu'));
      const msg = syncOn() ? t('Importer cette sauvegarde ({n} opérations) ? Les données actuelles seront remplacées, aussi sur tes autres appareils synchronisés.', { n: d.tx.length })
        : t('Importer cette sauvegarde ({n} opérations) ? Les données actuelles seront remplacées.', { n: d.tx.length });
      if (!confirm(msg)) return;
      const keep = { theme: S.settings.theme };
      S = migrate(d); Object.assign(S.settings, keep);
      applyPrefs(); commit(t('Sauvegarde importée'));
    } catch (e) { toast(t('Import impossible : {x}', { x: e.message })); }
  };
  r.readAsText(file);
}

/* ---------- Rendering & events ---------- */

// [view, icon, label, shown in the bottom bar on mobile]
const NAV = () => [
  ['dashboard', 'layout-dashboard', t('Accueil'), 1], ['tx', 'receipt', t('Opérations'), 1], ['envelopes', 'wallet-cards', t('Enveloppes'), 1], ['reports', 'chart-column', t('Rapports'), 1],
  ['goals', 'target', t('Objectifs')], ['accounts', 'landmark', t('Comptes')], ['settings', 'settings', t('Réglages')], ['guide', 'book-open', t('Guide')],
];
const VIEWS = { dashboard: viewDashboard, tx: viewTx, envelopes: viewEnvelopes, reports: viewReports, goals: viewGoals, accounts: viewAccounts, settings: viewSettings, guide: viewGuide };

function render() {
  C = calc();
  hideTip(); closeRich();
  const nav = NAV();
  const secondary = !nav.find(n => n[0] === view)?.[3];
  $('#nav').innerHTML = nav.map(([k, i, l, main]) => `<button class="${k === view ? 'on' : ''} ${main ? '' : 'secondary'}" data-act="go" data-view="${k}">${icon(i)}<span>${l}</span></button>`).join('')
    + `<button class="more ${secondary ? 'on' : ''}" data-act="more">${icon('ellipsis')}<span>${t('Plus')}</span></button>`;
  const main = $('#main');
  main.innerHTML = VIEWS[view]();
  main.classList.toggle('enter', entering);
  if (view === 'tx') renderTxList();
  enhanceSelects(main);
  if (entering) { runCounters(); entering = false; }
  $('#demo-bar').hidden = !DEMO;
  updateSyncPill();
}

// Language, formats and theme.
function applyPrefs() {
  setLang(S.settings.lang);
  const th = S.settings.theme;
  if (th === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = th;
  document.title = t('Mes Finances');
  $$('.brand span').forEach(el => { el.textContent = t('Mes Finances'); });
  $('#fab').setAttribute('aria-label', t('Ajouter une opération'));
  $('#demo-bar').innerHTML = `${icon('flask-conical')}<span>${t('Mode démo — tes vraies données ne sont pas touchées')}</span><button class="btn sm" data-act="demo-exit">${icon('log-out')} ${t('Quitter')}</button>`;
}

function go(v) {
  view = VIEWS[v] ? v : 'dashboard';
  if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
  entering = true;
  render(); window.scrollTo(0, 0);
}

function openMore() {
  openModal(t('Menu'), `<div class="quick">${NAV().filter(n => !n[3]).map(([k, i, l]) => `<button type="button" data-go="${k}">${tile(i)}${l}</button>`).join('')}</div>`, null);
  $$('[data-go]', $('#modal')).forEach(b => b.onclick = () => { $('#modal').close(); go(b.dataset.go); });
}

const DEMO_BLOCKED = /^(sync-(?!pill)|export$|import$|reset$|restore-backup$)/;

document.addEventListener('click', e => {
  // Chart tag.
  const tipEl = e.target.closest('[data-tip]');
  if (tipEl) { showTip(tipEl, e); return; }
  hideTip();

  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act, id = b.dataset.id;
  if (b.tagName === 'A') e.preventDefault();
  if (DEMO && DEMO_BLOCKED.test(act)) return toast(t('Indisponible en mode démo'));
  if (handleSyncAction(act, b)) return;
  switch (act) {
    case 'go': go(b.dataset.view); break;
    case 'more': openMore(); break;
    case 'quick': openQuick(); break;
    case 'lang': changeLang(b.dataset.lang); break;
    case 'm-prev': curMonth = shiftMonth(curMonth, -1); render(); break;
    case 'm-next': curMonth = shiftMonth(curMonth, 1); render(); break;
    case 'rep-mode': {
      const p = rep(), r = periodRange(p);
      p.mode = b.dataset.mode;
      if (p.mode === 'custom') { p.from = r.from; p.to = r.to; } else p.anchor = monthOf(r.to > today() ? today() : r.to);
      savePrefs(); entering = true; render(); break;
    }
    case 'rep-prev': case 'rep-next': { const p = rep(); p.anchor = shiftMonth(p.anchor, (act === 'rep-prev' ? -1 : 1) * REP_STEP[p.mode]); savePrefs(); entering = true; render(); break; }
    case 'rep-month': Object.assign(rep(), { mode: 'month', anchor: b.dataset.m }); savePrefs(); entering = true; render(); window.scrollTo(0, 0); break;
    case 'tx': openTx(S.tx.find(x => x.id === id)); break;
    case 'alloc': openAllocate(undefined, b.dataset.cur); break;
    case 'move': openMove(id); break;
    case 'transfer': openTransfer(); break;
    case 'exchange': {
      const c = b.dataset.cur, main = MAIN();
      const from = activeAccs(main).sort((x, y) => C.acc[y.id] - C.acc[x.id])[0]?.id;
      const to = pickAccount(c, true);
      if (!from || !to) { toast(t('Il faut un compte en {a} et un compte en {b}', { a: main, b: c })); break; }
      openTransfer(null, { from, to, amount: +b.dataset.amount || 0 }); break;
    }
    case 'spend': openExpense(null, { envelopeId: id }); break;
    case 'env': openEnvelope(envById(id)); break;
    case 'acc': openAccount(accById(id)); break;
    case 'adjust': openAdjust(accById(id)); break;
    case 'acc-tx': Object.assign(txFilter, { type: '', env: '', acc: id, q: '' }); go('tx'); break;
    case 'goal': openGoal(S.goals.find(g => g.id === id)); break;
    case 'buy': { const g = S.goals.find(y => y.id === id); openExpense(null, { goalId: g.id, envelopeId: g.envelopeId, amount: g.target, note: g.name }); break; }
    case 'currencies': openCurrencies(); break;
    case 'dismiss-multi': S.settings.multiNotice = false; commit(); break;
    case 'onboard': {
      const inC = $('#ob-in').value, outC = $('#ob-out').value;
      applyCurrencySetup(S, inC, outC);
      commit(inC === outC ? t('Devise enregistrée : {c}', { c: inC }) : t('Devises enregistrées : revenus en {a}, dépenses en {b}', { a: inC, b: outC }));
      break;
    }
    case 'demo': enterDemo(); break;
    case 'demo-exit': exitDemo(); break;
    case 'feedback': openFeedback(); break;
    case 'coffee': openCoffee(); break;
    case 'export': exportJSON(); break;
    case 'csv': exportCSV(); break;
    case 'csv-period': exportCSV(periodRange(rep())); break;
    case 'print': window.print(); break;
    case 'import': $('#import-file').click(); break;
    case 'restore-backup': {
      if (!confirm(t("Revenir aux données d'avant la mise à jour 2.0 ? Ce que tu as saisi depuis sera perdu.")) ) break;
      try { S = migrate(JSON.parse(localStorage.getItem(BACKUP_KEY))); applyPrefs(); commit(t('Données restaurées')); } catch (err) { toast(err.message); }
      break;
    }
    case 'reset': {
      const word = t('EFFACER');
      if (prompt(t('Tape {w} pour tout supprimer définitivement :', { w: word })) === word) {
        const { theme, lang } = S.settings; S = defaults(lang); S.settings.theme = theme; applyPrefs(); commit(t('Données effacées'));
      }
      break;
    }
  }
});

document.addEventListener('input', e => {
  const f = e.target.dataset.filter;
  if (f) { txFilter[f] = e.target.value; renderTxList(); }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.sort === 'acc') { P.accSort = el.value; savePrefs(); render(); return; }
  if (el.dataset.rep) { const p = rep(); p[el.dataset.rep] = el.value; savePrefs(); render(); return; }
  const k = el.dataset.set;
  if (!k) return;
  if (k === 'sources') {
    const list = el.value.split('\n').map(s => s.trim()).filter(Boolean);
    S.settings.sources = list.length ? [...new Set(list)] : [t('Autre')];
  } else if (k === 'currency') changeMain(el.value);
  else S.settings[k] = el.value;
  applyPrefs(); commit(t('Réglage enregistré'));
});

$('#import-file').addEventListener('change', e => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ''; });
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v !== view) go(v); });
window.addEventListener('scroll', hideTip, { passive: true });
// If the app is open in another tab, stay in sync (except in demo mode).
window.addEventListener('storage', e => { if (e.key === KEY && !DEMO) { S = load(); snap = snapshot(); applyPrefs(); render(); } });

applyPrefs();
view = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard';
render();
initSync();

// Launch screen: shown for at least a short moment, then faded out.
const splash = $('#splash');
if (splash) {
  $('.sp-ver', splash).textContent = `v${APP_VERSION}`;
  setTimeout(() => { splash.classList.add('hide'); setTimeout(() => splash.remove(), 450); }, Math.max(0, 900 - performance.now()));
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
navigator.storage?.persist?.().catch(() => {});
