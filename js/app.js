'use strict';
/*
 * Mes Finances (My Finances) — personal finance tracking for irregular income.
 * Envelope method: every income lands in "Unassigned", then it is assigned
 * to envelopes (rent, studies, emergency fund…). Every expense comes out of an envelope.
 * Data stays on the device (localStorage); Google sync is optional (sync.js).
 * Amounts are stored in cents (integers). Interface texts go through t() (i18n.js);
 * what the user types is never translated.
 */

const KEY = 'mes-finances-v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthOf = d => d.slice(0, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function shiftMonth(m, k) {
  let [y, mo] = m.split('-').map(Number);
  mo += k;
  while (mo > 12) { mo -= 12; y++; }
  while (mo < 1) { mo += 12; y--; }
  return `${y}-${pad(mo)}`;
}
const monthDate = m => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1); };
const monthLabel = (m, short) => monthDate(m).toLocaleDateString(LOCALE, short ? { month: 'short' } : { month: 'long', year: 'numeric' });
const dayLabel = d => new Date(d + 'T12:00:00').toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const dateTime = ts => new Date(ts).toLocaleString(LOCALE);

const COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#9333ea', '#dc2626', '#4f46e5', '#65a30d', '#c026d3'];
const KINDS = () => ({ normal: t('Normale'), emergency: t("Fonds d'urgence"), saving: t('Épargne'), invest: t('Investissement') });
const ACC_TYPES = () => ({ platform: t('Plateforme (Upwork, Payoneer…)'), trading: t('Compte de trading'), cash: t('Espèces'), mobile: t('Mobile money'), bank: t('Banque'), crypto: t('Portefeuille crypto'), other: t('Autre') });
const TX_TYPES = () => ({ expense: t('Dépense'), income: t('Revenu'), transfer: t('Transfert'), alloc: t('Répartition'), adjust: t('Ajustement') });
const CURRENCIES = ['USD', 'EUR', 'CDF', 'XAF', 'XOF', 'RWF', 'BIF', 'UGX', 'KES', 'TZS', 'NGN', 'GHS', 'ZAR', 'MAD', 'CAD', 'GBP', 'CHF'];
const COLS = ['accounts', 'envelopes', 'goals', 'tx'];
const SHARED_SETTINGS = ['currency', 'sources', 'lang'];
// Older versions: emojis → Lucide icons.
const EMOJI_MAP = { '🏠': 'house', '💡': 'lightbulb', '🧹': 'spray-can', '🛒': 'shopping-cart', '🎓': 'graduation-cap', '🚗': 'car', '🔧': 'wrench', '🛟': 'life-buoy', '🏦': 'piggy-bank', '📈': 'trending-up', '💻': 'laptop', '🎯': 'ticket', '🎉': 'party-popper', '💼': 'briefcase', '📊': 'chart-candlestick', '💵': 'banknote', '📱': 'smartphone', '💳': 'credit-card', '📁': 'folder' };

/* ---------- Icons ---------- */

const icon = (n, cls = '') => ICONS[n]
  ? `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`
  : `<span class="i i-txt ${cls}">${esc(n || '')}</span>`;
const tile = (n, color, cls = '') => `<span class="tile ${cls}" style="--c:${color || 'var(--accent)'}">${icon(n)}</span>`;

/* ---------- Data ---------- */

// Default items, in both languages. They follow the language as long as the user doesn't rename them.
const DEFAULT_ENVS = [
  ['Loyer', 'Rent', 'house', 'Charges fixes', 'Fixed costs', 20, 'normal'],
  ['Factures (eau, électricité, internet)', 'Bills (water, power, internet)', 'lightbulb', 'Charges fixes', 'Fixed costs', 8, 'normal'],
  ['Maison (entretien, ménage)', 'Home (upkeep, cleaning)', 'spray-can', 'Charges fixes', 'Fixed costs', 6, 'normal'],
  ['Besoins courants (nourriture, transport)', 'Daily needs (food, transport)', 'shopping-cart', 'Vie courante', 'Daily life', 15, 'normal'],
  ['Études (frais, livres, cours)', 'Studies (fees, books, courses)', 'graduation-cap', 'Études', 'Studies', 10, 'normal'],
  ['Entretien voiture', 'Car maintenance', 'car', 'Voiture', 'Car', 5, 'normal'],
  ['Urgence mécanique', 'Car repairs (emergency)', 'wrench', 'Voiture', 'Car', 3, 'normal'],
  ["Fonds d'urgence", 'Emergency fund', 'life-buoy', 'Sécurité', 'Safety', 10, 'emergency'],
  ['Épargne', 'Savings', 'piggy-bank', 'Avenir', 'Future', 7, 'saving'],
  ['Investissement', 'Investing', 'trending-up', 'Avenir', 'Future', 5, 'invest'],
  ['Setup (écran, disque, casque…)', 'Setup (monitor, drive, headset…)', 'laptop', 'Équipement', 'Equipment', 6, 'normal'],
  ['Activités & sorties', 'Activities & outings', 'ticket', 'Loisirs', 'Leisure', 3, 'normal'],
  ['Événements (anniversaires, fêtes)', 'Events (birthdays, parties)', 'party-popper', 'Loisirs', 'Leisure', 2, 'normal'],
];
const DEFAULT_ACCS = [['Upwork', 'Upwork', 'briefcase', 'platform'], ['Compte de trading', 'Trading account', 'chart-candlestick', 'trading'], ['Espèces', 'Cash', 'banknote', 'cash'], ['Mobile money', 'Mobile money', 'smartphone', 'mobile']];
const DEFAULT_GOALS = [['Disque dur externe', 'External hard drive'], ['Écran externe', 'External monitor'], ['Casque', 'Headset'], ['Table / bureau', 'Desk'], ['Clavier', 'Keyboard'], ['Téléphone', 'Phone']];
const DEFAULT_SOURCES = [['Upwork', 'Upwork'], ['Trading', 'Trading'], ['Autre', 'Other']];
const DEFAULT_GROUPS = [...new Map(DEFAULT_ENVS.map(d => [d[3], [d[3], d[4]]])).values()];
const L = lang => (lang === 'en' ? 1 : 0);

function defaults(lang = detectLang()) {
  const l = L(lang);
  const envs = DEFAULT_ENVS.map((d, i) => ({ id: uid() + i, name: d[l], icon: d[2], group: d[3 + l], percent: d[5], kind: d[6], target: 0, priority: i + 1, color: COLORS[i % COLORS.length] }));
  const accounts = DEFAULT_ACCS.map((d, i) => ({ id: uid() + 'a' + i, name: d[l], icon: d[2], type: d[3], initial: 0 }));
  const goals = DEFAULT_GOALS.map((d, i) => ({ id: uid() + 'g' + i, name: d[l], envelopeId: envs[10].id, target: 0, priority: i + 1, purchased: false }));
  return {
    version: 2,
    settings: { lang, currency: 'USD', sources: DEFAULT_SOURCES.map(d => d[l]), theme: 'auto', lastBackup: null, lastAccount: null, lastEnv: null },
    accounts, envelopes: envs, goals, tx: [], deleted: {},
  };
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
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { console.error(e); }
  return defaults();
}
function migrate(d) {
  const base = defaults(d.settings?.lang || 'fr');
  d.settings = { ...base.settings, ...(d.settings || {}) };
  for (const k of COLS) if (!Array.isArray(d[k])) d[k] = [];
  if (!d.deleted || typeof d.deleted !== 'object') d.deleted = {};
  for (const x of [...d.envelopes, ...d.accounts]) {
    if (EMOJI_MAP[x.icon]) x.icon = EMOJI_MAP[x.icon];
    else if (!ICONS[x.icon]) x.icon = x.type ? 'wallet' : 'folder';
  }
  d.version = 2;
  return d;
}

let S = load();
setLang(S.settings.lang);

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
  return { version: 2, settings, accounts: d.accounts, envelopes: d.envelopes, goals: d.goals, tx: d.tx, deleted: d.deleted || {} };
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

let C = null;              // computed balances
let view = 'dashboard';
let entering = true;       // animate when a view appears
let curMonth = monthOf(today());
let curYear = new Date().getFullYear();
const txFilter = { type: '', env: '', acc: '', q: '' };

/* ---------- Money ---------- */

let NF;
function buildFmt() {
  try { NF = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: S.settings.currency, currencyDisplay: 'narrowSymbol' }); }
  catch {
    const nf = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    NF = { format: v => nf.format(v) + ' ' + S.settings.currency };
  }
}
const money = c => NF.format((c || 0) / 100);
const signed = c => (c > 0 ? '+' : c < 0 ? '−' : '') + money(Math.abs(c));
const num = c => (c / 100).toFixed(2);
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
// Accepts "12,50", "12.50", "1 234,50" and "1,234.50": the last separator is the decimal one.
function toCents(v) {
  let s = String(v ?? '').replace(/[\s  ]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else s = s.replace(',', '.');
  if (s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/* ---------- Calculations ---------- */

const envById = id => S.envelopes.find(e => e.id === id);
const accById = id => S.accounts.find(a => a.id === id);
const activeEnvs = () => S.envelopes.filter(e => !e.archived).sort((a, b) => (a.priority || 99) - (b.priority || 99));
const activeAccs = () => S.accounts.filter(a => !a.archived);
const txNet = x => x.amount - (x.fee || 0);

// Effect of a transaction on total net worth.
function wealthFlow(x) {
  switch (x.type) {
    case 'income': return txNet(x);
    case 'expense': return -x.amount;
    case 'transfer': return -(x.fee || 0);
    case 'adjust': return x.amount;
    default: return 0;
  }
}

// Invariant: sum of accounts = unassigned + sum of envelopes.
function calc() {
  const acc = {}, env = {};
  let unalloc = 0;
  for (const a of S.accounts) { acc[a.id] = a.initial || 0; unalloc += a.initial || 0; }
  for (const e of S.envelopes) env[e.id] = 0;
  const add = (o, k, v) => { o[k] = (o[k] || 0) + v; };
  for (const x of S.tx) {
    switch (x.type) {
      case 'income': add(acc, x.accountId, txNet(x)); unalloc += txNet(x); break;
      case 'expense': add(acc, x.accountId, -x.amount); add(env, x.envelopeId, -x.amount); break;
      case 'transfer': add(acc, x.accountId, -(x.amount + (x.fee || 0))); add(acc, x.toAccountId, x.amount); unalloc -= x.fee || 0; break;
      case 'adjust': add(acc, x.accountId, x.amount); unalloc += x.amount; break;
      case 'alloc': for (const l of x.lines) { add(env, l.envelopeId, l.amount); unalloc -= l.amount; } break;
    }
  }
  const total = Object.values(acc).reduce((s, v) => s + v, 0);
  return { acc, env, unalloc, total };
}

function statsFor(test) {
  const r = { income: 0, fees: 0, bySource: {}, expense: 0, byEnv: {}, alloc: {}, transferFees: 0, untracked: 0, incomeCount: 0 };
  for (const x of S.tx) {
    if (!test(x.date)) continue;
    if (x.type === 'income') {
      r.income += txNet(x); r.fees += x.fee || 0; r.incomeCount++;
      r.bySource[x.source] = (r.bySource[x.source] || 0) + txNet(x);
    } else if (x.type === 'expense') {
      r.expense += x.amount; r.byEnv[x.envelopeId] = (r.byEnv[x.envelopeId] || 0) + x.amount;
    } else if (x.type === 'alloc') {
      for (const l of x.lines) r.alloc[l.envelopeId] = (r.alloc[l.envelopeId] || 0) + l.amount;
    } else if (x.type === 'transfer') r.transferFees += x.fee || 0;
    else if (x.type === 'adjust' && x.amount < 0) r.untracked -= x.amount;
  }
  return r;
}
const monthStats = m => statsFor(d => monthOf(d) === m);
const yearStats = y => statsFor(d => d.startsWith(y + '-'));

const monthlyNeeds = () => activeEnvs().reduce((s, e) => s + (e.target || 0), 0);
const firstMonth = () => S.tx.reduce((m, x) => (!m || x.date < m ? x.date : m), null)?.slice(0, 7);

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
  for (const [envId, goals] of Object.entries(byEnv)) {
    let left = Math.max(0, C.env[envId] || 0);
    for (const g of goals.sort((a, b) => (a.priority || 99) - (b.priority || 99))) {
      const v = Math.min(g.target || 0, left); out[g.id] = v; left -= v;
    }
  }
  return out;
}

/* ---------- Allocation ---------- */

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
function splitNeeds(total, allocThisMonth) {
  const out = {};
  let left = total;
  for (const e of activeEnvs()) {
    if (left <= 0) break;
    const need = Math.max(0, (e.target || 0) - (allocThisMonth[e.id] || 0));
    const v = Math.min(need, left);
    if (v > 0) { out[e.id] = v; left -= v; }
  }
  if (left > 0) {
    const p = splitPercent(left, activeEnvs());
    for (const k in p) out[k] = (out[k] || 0) + p[k];
  }
  return out;
}

/* ---------- UI helpers ---------- */

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), 2800);
}

function openModal(title, body, onSubmit, opts = {}) {
  const d = $('#modal');
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
  const first = $('[autofocus]', d);
  if (first) setTimeout(() => first.focus(), 30);
  return f;
}

const field = (label, inner, hint = '') => `<label class="field"><span>${label}</span>${inner}${hint ? `<small>${hint}</small>` : ''}</label>`;
const amountInput = (name, v, attrs = '') => `<input name="${name}" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${v ? num(v) : ''}" ${attrs}>`;

function envOptions(sel, { withBal = true } = {}) {
  let h = '';
  for (const grp of [...new Set(activeEnvs().map(e => e.group || t('Autres')))]) {
    h += `<optgroup label="${esc(grp)}">` + activeEnvs().filter(e => (e.group || t('Autres')) === grp).map(e =>
      `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${esc(e.name)}${withBal ? ' — ' + money(C.env[e.id]) : ''}</option>`).join('') + '</optgroup>';
  }
  const s = envById(sel);
  if (s?.archived) h += `<option value="${s.id}" selected>${esc(s.name)} (${t('archivée')})</option>`;
  return h;
}
function accOptions(sel) {
  let h = activeAccs().map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)} — ${money(C.acc[a.id])}</option>`).join('');
  const s = accById(sel);
  if (s?.archived) h += `<option value="${s.id}" selected>${esc(s.name)} (${t('archivé')})</option>`;
  return h;
}
function iconPicker(sel, color) {
  const list = ICON_PICK.includes(sel) || !ICONS[sel] ? ICON_PICK : [sel, ...ICON_PICK];
  return `<div class="icon-pick" style="--c:${color || 'var(--accent)'}">${list.map(n => `<label title="${n}"><input type="radio" name="icon" value="${n}" ${n === sel ? 'checked' : ''}>${icon(n)}</label>`).join('')}</div>`;
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
  openModal(t('Ajouter'), `<div class="quick">
    <button type="button" data-q="expense">${tile('arrow-up-right', '#ea580c')}${t('Dépense')}</button>
    <button type="button" data-q="income">${tile('arrow-down-left', '#16a34a')}${t('Revenu')}</button>
    <button type="button" data-q="alloc">${tile('wallet-cards', '#0f766e')}${t('Répartir')}</button>
    <button type="button" data-q="transfer">${tile('arrow-left-right', '#2563eb')}${t('Transfert')}</button>
  </div>`, null);
  $$('[data-q]', $('#modal')).forEach(b => b.onclick = () => {
    $('#modal').close();
    setTimeout(() => ({ expense: openExpense, income: openIncome, alloc: openAllocate, transfer: openTransfer })[b.dataset.q](), 30);
  });
}

function openExpense(x, preset = {}) {
  if (!activeAccs().length) return toast(t("Ajoute d'abord un compte"));
  const last = accById(S.settings.lastAccount);
  const e = x || {
    date: today(), amount: preset.amount || 0, note: preset.note || '',
    accountId: last && !last.archived ? last.id : activeAccs()[0].id,
    envelopeId: preset.envelopeId || S.settings.lastEnv,
  };
  openModal(x ? t('Modifier la dépense') : (preset.goalId ? t('Acheter : {x}', { x: esc(preset.note) }) : t('Nouvelle dépense')), `
    ${field(t('Montant'), amountInput('amount', e.amount, 'autofocus'))}
    ${field(t('Enveloppe (pour quoi ?)'), `<select name="envelopeId">${envOptions(e.envelopeId)}</select>`, t("Le montant affiché est ce qu'il reste dans chaque enveloppe."))}
    ${field(t('Payé depuis'), `<select name="accountId">${accOptions(e.accountId)}</select>`)}
    <div class="two">
      ${field(t('Date'), `<input type="date" name="date" value="${e.date}">`)}
      ${field(t('Note'), `<input name="note" value="${esc(e.note)}" placeholder="${t('ex. carburant, marché…')}">`)}
    </div>`, g => {
    const amount = toCents(g('amount'));
    if (!(amount > 0)) return t('Entre un montant valide.');
    const data = { type: 'expense', amount, envelopeId: g('envelopeId'), accountId: g('accountId'), date: g('date') || today(), note: g('note').trim() };
    if (preset.goalId) data.goalId = preset.goalId;
    const left = C.env[data.envelopeId] - amount + (x && x.envelopeId === data.envelopeId ? x.amount : 0);
    upsertTx(x, data);
    if (preset.goalId) { const goal = S.goals.find(y => y.id === preset.goalId); if (goal) { goal.purchased = true; goal.paid = amount; } }
    S.settings.lastAccount = data.accountId; S.settings.lastEnv = data.envelopeId;
    commit(left < 0 ? t('Attention : enveloppe à découvert de {x}', { x: money(-left) }) : (x ? t('Dépense modifiée') : t('Dépense enregistrée')));
  }, x ? { onDelete: () => deleteTx(x) } : {});
}

function openIncome(x) {
  if (!activeAccs().length) return toast(t("Ajoute d'abord un compte"));
  const e = x || { date: today(), amount: 0, fee: 0, source: S.settings.sources[0], accountId: activeAccs()[0].id, note: '' };
  const loss = e.amount < 0;
  const sources = [...new Set([...S.settings.sources, e.source].filter(Boolean))];
  const f = openModal(x ? t('Modifier le revenu') : t('Nouveau revenu'), `
    ${field(t('Source'), `<select name="source">${sources.map(s => `<option ${s === e.source ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>`)}
    <label class="check"><input type="checkbox" name="loss" ${loss ? 'checked' : ''}> ${t("C'est une perte (trading)")}</label>
    <div class="two">
      ${field(t('Montant reçu (brut)'), amountInput('amount', Math.abs(e.amount), 'autofocus'))}
      ${field(t('Frais'), amountInput('fee', e.fee), t('Commission Upwork, retrait…'))}
    </div>
    ${field(t('Reçu sur le compte'), `<select name="accountId">${accOptions(e.accountId)}</select>`)}
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
    upsertTx(x, data);
    commit(x ? t('Revenu modifié') : (isLoss ? t('Perte enregistrée') : t('+{x} enregistré', { x: money(txNet(data)) })));
    if (!x && !isLoss && chk('split') && C.unalloc > 0) return () => openAllocate(txNet(data));
  }, x ? { onDelete: () => deleteTx(x) } : {});
  const upd = () => {
    const a = toCents(f.elements.amount.value) || 0, fe = toCents(f.elements.fee.value) || 0, l = f.elements.loss.checked;
    f.elements.fee.disabled = l;
    $('#net-line').innerHTML = l ? `${t('Perte :')} <b class="neg">−${money(a)}</b>` : `${t('Net reçu :')} <b class="pos">${money(a - fe)}</b>`;
  };
  f.addEventListener('input', upd); upd();
}

function openTransfer(x) {
  if (activeAccs().length < 2) return toast(t('Il faut au moins deux comptes'));
  const e = x || { date: today(), amount: 0, fee: 0, accountId: activeAccs()[0].id, toAccountId: activeAccs()[1].id, note: '' };
  openModal(x ? t('Modifier le transfert') : t('Transfert entre comptes'), `
    <p class="hint">${t('Ex. retrait Upwork → mobile money, ou dépôt sur le compte de trading. Les frais sont déduits du compte de départ.')}</p>
    ${field(t('De'), `<select name="accountId">${accOptions(e.accountId)}</select>`)}
    ${field(t('Vers'), `<select name="toAccountId">${accOptions(e.toAccountId)}</select>`)}
    <div class="two">
      ${field(t('Montant arrivé'), amountInput('amount', e.amount, 'autofocus'))}
      ${field(t('Frais de transfert'), amountInput('fee', e.fee))}
    </div>
    <div class="two">
      ${field(t('Date'), `<input type="date" name="date" value="${e.date}">`)}
      ${field(t('Note'), `<input name="note" value="${esc(e.note)}">`)}
    </div>`, g => {
    const amount = toCents(g('amount')), fee = toCents(g('fee'));
    if (!(amount > 0)) return t('Entre un montant valide.');
    if (Number.isNaN(fee) || fee < 0) return t('Frais invalides.');
    if (g('accountId') === g('toAccountId')) return t('Choisis deux comptes différents.');
    upsertTx(x, { type: 'transfer', amount, fee, accountId: g('accountId'), toAccountId: g('toAccountId'), date: g('date') || today(), note: g('note').trim() });
    commit(x ? t('Transfert modifié') : t('Transfert enregistré'));
  }, x ? { onDelete: () => deleteTx(x) } : {});
}

function openAdjust(acc) {
  const cur = C.acc[acc.id];
  const f = openModal(t('Ajuster : {x}', { x: esc(acc.name) }), `
    <p class="hint">${t("Le solde dans l'app ne correspond pas à la réalité ? Entre le solde <b>réel</b> que tu vois (app Upwork, wallet, billets en poche…). L'écart sera enregistré comme « argent non tracé » : ça t'aide à voir combien t'échappe.")}</p>
    ${field(t("Solde dans l'app"), `<input value="${money(cur)}" disabled>`)}
    ${field(t('Solde réel'), amountInput('real', 0, 'autofocus'))}
    ${field(t('Explication (facultatif)'), `<input name="note" placeholder="${t('ex. dépenses non notées cette semaine')}">`)}
    <p class="hint" id="diff-line"></p>`, g => {
    const real = toCents(g('real'));
    if (Number.isNaN(real) || g('real').trim() === '') return t('Entre le solde réel.');
    const diff = real - cur;
    if (diff === 0) return () => toast(t('Le solde est déjà juste'));
    upsertTx(null, { type: 'adjust', accountId: acc.id, amount: diff, date: today(), note: g('note').trim() });
    commit(diff < 0 ? t('{x} non tracé — pense à tout noter !', { x: money(-diff) }) : t('Solde ajusté'));
  }, { submitLabel: t('Ajuster') });
  f.addEventListener('input', () => {
    const r = toCents(f.elements.real.value);
    $('#diff-line').innerHTML = Number.isNaN(r) || f.elements.real.value === '' ? '' : `${t('Écart :')} <b class="${r - cur < 0 ? 'neg' : 'pos'}">${signed(r - cur)}</b>`;
  });
}

function openAllocate(preAmount) {
  const avail = C.unalloc;
  if (avail <= 0 && preAmount === undefined) {
    return toast(avail < 0 ? t("Tu as réparti {x} de trop — retire de l'argent d'une enveloppe", { x: money(-avail) }) : t("Rien à répartir : enregistre d'abord un revenu"));
  }
  const allocM = monthStats(monthOf(today())).alloc;
  const envs = activeEnvs();
  let mode = monthlyNeeds() > 0 ? 'needs' : 'pct';
  const hints = {
    needs: t("Remplit d'abord le budget mensuel de chaque enveloppe (dans l'ordre de priorité : loyer, factures…), puis répartit le reste selon tes pourcentages. Idéal quand les revenus sont irréguliers."),
    pct: t('Répartit le montant selon les pourcentages de chaque enveloppe.'),
    manual: t('Tape toi-même les montants.'),
  };
  const needText = e => {
    if (!e.target) return `${e.percent || 0} %`;
    const need = e.target - (allocM[e.id] || 0);
    return need > 0 ? t('manque {x} ce mois · {p} %', { x: money(need), p: e.percent || 0 }) : t('budget du mois atteint · {p} %', { p: e.percent || 0 });
  };
  const f = openModal(t('Répartir mon argent'), `
    <div class="alert info">${icon('wallet-cards')}<span class="grow">${t('Disponible à répartir')}</span><b class="num">${money(avail)}</b></div>
    ${field(t('Montant à répartir'), amountInput('total', Math.max(0, Math.min(preAmount ?? avail, avail))))}
    <div class="seg">${Object.entries({ needs: t("Besoins d'abord"), pct: t('Pourcentages'), manual: t('Manuel') }).map(([k, v]) => `<button type="button" data-mode="${k}">${v}</button>`).join('')}</div>
    <p class="hint" id="mode-hint"></p>
    <div>${envs.map(e => `<div class="alloc-row">${tile(e.icon, e.color, 'sm')}<span class="ellipsis">${esc(e.name)}<small>${needText(e)}</small></span><input data-env="${e.id}" inputmode="decimal" placeholder="0.00"></div>`).join('')}</div>
    <div class="alloc-sum"><span>${t('Réparti :')} <b id="a-sum" class="num"></b></span><span>${t('Reste :')} <b id="a-left" class="num"></b></span></div>
  `, () => {
    const lines = [];
    for (const inp of $$('[data-env]', f)) {
      const v = toCents(inp.value);
      if (Number.isNaN(v)) return t('Un montant est invalide.');
      if (v) lines.push({ envelopeId: inp.dataset.env, amount: v });
    }
    const sum = lines.reduce((s, l) => s + l.amount, 0);
    if (sum <= 0) return t('Rien à répartir.');
    if (sum > avail) return t('Tu ne peux pas répartir plus que {x}.', { x: money(avail) });
    upsertTx(null, { type: 'alloc', date: today(), lines, note: '' });
    commit(t('{x} réparti dans {n} enveloppe(s)', { x: money(sum), n: lines.length }));
  }, { submitLabel: t('Répartir') });

  const sumUp = () => {
    const sum = $$('[data-env]', f).reduce((s, i) => s + (toCents(i.value) || 0), 0);
    $('#a-sum').textContent = money(sum);
    const left = avail - sum;
    $('#a-left').textContent = money(left);
    $('#a-left').className = 'num ' + (left < 0 ? 'neg' : '');
  };
  const compute = () => {
    $$('[data-mode]', f).forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    $('#mode-hint').textContent = hints[mode];
    if (mode !== 'manual') {
      const total = Math.max(0, toCents(f.elements.total.value) || 0);
      const out = mode === 'needs' ? splitNeeds(total, allocM) : splitPercent(total, envs);
      $$('[data-env]', f).forEach(i => { i.value = out[i.dataset.env] ? num(out[i.dataset.env]) : ''; });
    }
    sumUp();
  };
  $$('[data-mode]', f).forEach(b => b.onclick = () => { mode = b.dataset.mode; compute(); });
  f.elements.total.addEventListener('input', compute);
  $$('[data-env]', f).forEach(i => i.addEventListener('input', sumUp));
  compute();
}

function openMove(fromId) {
  const opts = sel => `<option value="">— ${t('Non réparti')} (${money(C.unalloc)}) —</option>` + envOptions(sel);
  openModal(t('Déplacer entre enveloppes'), `
    <p class="hint">${t("Une enveloppe est à découvert ou tu as trop mis quelque part ? Déplace l'argent. Choisir « Non réparti » rend l'argent disponible.")}</p>
    ${field(t('Prendre dans'), `<select name="from">${opts(fromId)}</select>`)}
    ${field(t('Mettre dans'), `<select name="to">${opts('')}</select>`)}
    ${field(t('Montant'), amountInput('amount', 0, 'autofocus'))}`, g => {
    const amount = toCents(g('amount'));
    const from = g('from'), to = g('to');
    if (!(amount > 0)) return t('Entre un montant valide.');
    if (from === to) return t('Choisis deux endroits différents.');
    if (!from && amount > C.unalloc) return t("Il n'y a que {x} de non réparti.", { x: money(C.unalloc) });
    const lines = [];
    if (from) lines.push({ envelopeId: from, amount: -amount });
    if (to) lines.push({ envelopeId: to, amount });
    upsertTx(null, { type: 'alloc', date: today(), lines, note: '', move: true });
    commit(t('Argent déplacé'));
  }, { submitLabel: t('Déplacer') });
}

function openAllocTx(x) {
  const body = x.lines.map(l => { const e = envById(l.envelopeId); return `<div class="alloc-row">${tile(e?.icon || 'folder', e?.color, 'sm')}<span>${esc(e?.name || t('Enveloppe supprimée'))}</span><b class="num ${l.amount < 0 ? 'neg' : ''}" style="text-align:right">${signed(l.amount)}</b></div>`; }).join('');
  openModal(t('{x} du {d}', { x: esc(txTitle(x)), d: dayLabel(x.date) }), body + `<p class="hint" style="margin-top:12px">${t("Supprimer annule cette répartition : l'argent revient dans « Non réparti ».")}</p>`, null,
    { onDelete: () => deleteTx(x), deleteLabel: t('Annuler la répartition'), confirmDelete: t('Annuler cette répartition ?') });
}

function openTx(x) {
  if (!x) return;
  ({
    expense: openExpense, income: openIncome, transfer: openTransfer, alloc: openAllocTx,
    adjust: y => openModal(t('Ajustement de solde'), `<p>${esc(accById(y.accountId)?.name)} : <b>${signed(y.amount)}</b></p><p class="muted">${esc(txTitle(y))}</p>`, null, { onDelete: () => deleteTx(y) }),
  })[x.type](x);
}

function openEnvelope(e) {
  const isNew = !e;
  e = e || { name: '', icon: 'folder', group: DEFAULT_GROUPS[1][L(LANG)], percent: 0, target: 0, kind: 'normal', priority: S.envelopes.length + 1, color: COLORS[S.envelopes.length % COLORS.length] };
  const used = !isNew && (S.tx.some(x => x.envelopeId === e.id || x.lines?.some(l => l.envelopeId === e.id)) || S.goals.some(g => g.envelopeId === e.id));
  const groups = [...new Set([...DEFAULT_GROUPS.map(d => d[L(LANG)]), ...S.envelopes.map(x => x.group)])];
  const f = openModal(isNew ? t('Nouvelle enveloppe') : t("Modifier l'enveloppe"), `
    ${field(t('Nom'), `<input name="name" value="${esc(e.name)}" autofocus>`)}
    <div class="field"><span>${t('Icône et couleur')}</span>${iconPicker(e.icon, e.color)}
      <div class="colors">${COLORS.map(c => `<label style="--c:${c}"><input type="radio" name="color" value="${c}" ${c === e.color ? 'checked' : ''}></label>`).join('')}</div></div>
    ${field(t('Groupe'), `<input name="group" list="groups" value="${esc(e.group)}"><datalist id="groups">${groups.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`)}
    <div class="two">
      ${field(t('Budget mensuel'), amountInput('target', e.target), t('Ce dont tu as besoin chaque mois (ex. loyer). 0 = pas de budget fixe.'))}
      ${field(t('% des revenus'), `<input name="percent" type="number" min="0" max="100" step="0.5" value="${e.percent || 0}">`, t('Part de ce qui reste après les besoins.'))}
    </div>
    <div class="two">
      ${field(t('Priorité'), `<input name="priority" type="number" min="1" value="${e.priority || 1}">`, t('1 = remplie en premier.'))}
      ${field(t('Type'), `<select name="kind">${Object.entries(KINDS()).map(([k, v]) => `<option value="${k}" ${k === e.kind ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
    </div>`, g => {
    const target = toCents(g('target'));
    if (!g('name').trim()) return t('Donne un nom.');
    if (Number.isNaN(target) || target < 0) return t('Budget invalide.');
    const data = { name: g('name').trim(), icon: g('icon') || 'folder', group: g('group').trim() || t('Autres'), target, percent: Math.max(0, +g('percent') || 0), priority: Math.max(1, +g('priority') || 1), kind: g('kind'), color: g('color') || e.color };
    if (isNew) S.envelopes.push({ id: uid(), ...data }); else Object.assign(e, data);
    commit(isNew ? t('Enveloppe créée') : t('Enveloppe modifiée'));
  }, isNew ? {} : used
    ? { onDelete: () => { if (C.env[e.id]) return toast(t("Vide d'abord l'enveloppe (Déplacer)")); e.archived = !e.archived; commit(e.archived ? t('Enveloppe archivée') : t('Enveloppe restaurée')); }, deleteLabel: e.archived ? t('Restaurer') : t('Archiver'), confirmDelete: e.archived ? t('Restaurer cette enveloppe ?') : t("Archiver ? Elle sera masquée mais l'historique est conservé.") }
    : { onDelete: () => { S.envelopes = S.envelopes.filter(y => y !== e); commit(t('Enveloppe supprimée')); } });
  // The icon preview takes the selected color.
  f.addEventListener('change', ev => { if (ev.target.name === 'color') $('.icon-pick', f).style.setProperty('--c', ev.target.value); });
}

function openAccount(a) {
  const isNew = !a;
  a = a || { name: '', icon: 'wallet', type: 'other', initial: 0 };
  const used = !isNew && S.tx.some(x => x.accountId === a.id || x.toAccountId === a.id);
  openModal(isNew ? t('Nouveau compte') : t('Modifier le compte'), `
    ${field(t('Nom'), `<input name="name" value="${esc(a.name)}" autofocus placeholder="${t('ex. Payoneer, M-Pesa, Binance…')}">`)}
    <div class="field"><span>${t('Icône')}</span>${iconPicker(a.icon)}</div>
    ${field(t('Type'), `<select name="type">${Object.entries(ACC_TYPES()).map(([k, v]) => `<option value="${k}" ${k === a.type ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
    ${field(t('Solde de départ'), amountInput('initial', a.initial), t("L'argent présent sur ce compte au moment où tu commences le suivi. Il arrive dans « Non réparti » pour que tu le répartisses."))}`, g => {
    const initial = toCents(g('initial'));
    if (!g('name').trim()) return t('Donne un nom.');
    if (Number.isNaN(initial)) return t('Solde invalide.');
    const data = { name: g('name').trim(), icon: g('icon') || 'wallet', type: g('type'), initial };
    if (isNew) S.accounts.push({ id: uid(), ...data }); else Object.assign(a, data);
    commit(isNew ? t('Compte ajouté') : t('Compte modifié'));
  }, isNew ? {} : used
    ? { onDelete: () => { if (C.acc[a.id]) return toast(t('Le solde doit être à 0 pour archiver (fais un transfert)')); a.archived = !a.archived; commit(a.archived ? t('Compte archivé') : t('Compte restauré')); }, deleteLabel: a.archived ? t('Restaurer') : t('Archiver'), confirmDelete: a.archived ? t('Restaurer ce compte ?') : t('Archiver ce compte ?') }
    : { onDelete: () => { S.accounts = S.accounts.filter(y => y !== a); commit(t('Compte supprimé')); } });
}

function openGoal(gl) {
  const isNew = !gl;
  const equip = DEFAULT_GROUPS.find(d => d[0] === 'Équipement');
  gl = gl || { name: '', envelopeId: activeEnvs().find(e => equip.includes(e.group))?.id || activeEnvs()[0]?.id, target: 0, priority: S.goals.length + 1 };
  openModal(isNew ? t('Nouvel objectif') : t("Modifier l'objectif"), `
    ${field(t('Quoi ?'), `<input name="name" value="${esc(gl.name)}" autofocus placeholder="${t('ex. Écran 27 pouces')}">`)}
    ${field(t('Prix / montant visé'), amountInput('target', gl.target))}
    ${field(t("Financé par l'enveloppe"), `<select name="envelopeId">${envOptions(gl.envelopeId)}</select>`, t("L'argent de l'enveloppe finance les objectifs dans l'ordre de priorité."))}
    ${field(t('Priorité'), `<input name="priority" type="number" min="1" value="${gl.priority || 1}">`, t('1 = acheté en premier.'))}`, g => {
    const target = toCents(g('target'));
    if (!g('name').trim()) return t('Donne un nom.');
    if (Number.isNaN(target) || target < 0) return t('Montant invalide.');
    const data = { name: g('name').trim(), target, envelopeId: g('envelopeId'), priority: Math.max(1, +g('priority') || 1) };
    if (isNew) S.goals.push({ id: uid(), purchased: false, ...data }); else Object.assign(gl, data);
    commit(isNew ? t('Objectif ajouté') : t('Objectif modifié'));
  }, isNew ? {} : { onDelete: () => { S.goals = S.goals.filter(y => y !== gl); S.tx.forEach(x => { if (x.goalId === gl.id) delete x.goalId; }); commit(t('Objectif supprimé')); } });
}

/* ---------- Charts ---------- */

function barsChart(hist, { link = false } = {}) {
  const W = 640, H = 260, B = 34, T = 10;
  const max = Math.max(1, ...hist.flatMap(h => [h.inc, h.exp]));
  const gw = W / hist.length, bw = Math.min(30, gw * 0.3), ph = H - T - B;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart ${hist.length > 8 ? 'dense' : ''}" role="img" aria-label="${t('Revenus et dépenses par mois')}">`;
  for (let i = 0; i <= 3; i++) { const y = T + ph * i / 3; s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" class="grid-line"/>`; }
  hist.forEach((h, i) => {
    const cx = gw * i + gw / 2;
    const hi = ph * Math.max(0, h.inc) / max, he = ph * h.exp / max;
    s += `<g ${link ? `data-act="open-month" data-m="${h.m}" class="clickable"` : ''} style="--d:${i * 40}ms">
      <rect x="${cx - gw / 2}" y="${T}" width="${gw}" height="${ph}" fill="transparent"/>
      <rect x="${cx - bw - 2}" y="${H - B - hi}" width="${bw}" height="${hi}" rx="4" class="b-inc"><title>${monthLabel(h.m)} — ${t('revenus')} ${money(h.inc)}</title></rect>
      <rect x="${cx + 2}" y="${H - B - he}" width="${bw}" height="${he}" rx="4" class="b-exp"><title>${monthLabel(h.m)} — ${t('dépenses')} ${money(h.exp)}</title></rect>
      <text x="${cx}" y="${H - 6}" text-anchor="middle" class="axis">${monthLabel(h.m, true)}</text></g>`;
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
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points.length - 1).toFixed(1)},${y(min)} L${x(0).toFixed(1)},${y(min)} Z`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart ${points.length > 8 ? 'dense' : ''}" role="img" aria-label="${t('Évolution du patrimoine')}">
    <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${min < 0 ? `<line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="grid-line"/>` : ''}
    <path d="${area}" fill="url(#lg)" class="area"/>
    <path d="${d}" class="line" pathLength="1"/>
    ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="4" class="dot"><title>${p.title}</title></circle><text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="axis">${p.label}</text>`).join('')}
  </svg>`;
}

function hbar(label, value, max, { right = money(value), over = false, color } = {}) {
  const w = max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0;
  return `<div class="hbar-row"><span class="ellipsis">${label}</span><span class="num">${right}</span>
    <div class="bar"><i class="${over ? 'over' : ''}" style="width:${w}%;${color && !over ? `background:${color}` : ''}"></i></div></div>`;
}

// Animated value (counter) when the view appears.
const countVal = (c, mode = 'money') => `<span data-count="${c}" data-mode="${mode}">${mode === 'signed' ? signed(c) : money(c)}</span>`;
function runCounters() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const el of $$('[data-count]')) {
    const to = +el.dataset.count, mode = el.dataset.mode, t0 = performance.now(), dur = 700;
    const fmt = v => (mode === 'signed' ? signed(v) : money(v));
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

function txRow(x) {
  const acc = id => esc(accById(id)?.name || '?');
  let ic, color, title, sub, amt, cls = '';
  switch (x.type) {
    case 'expense': { const e = envById(x.envelopeId); ic = e?.icon || 'arrow-up-right'; color = e?.color; title = x.note || e?.name; sub = `${esc(e?.name || '?')} · ${acc(x.accountId)}`; amt = '−' + money(x.amount); cls = 'neg'; break; }
    case 'income': { const n = txNet(x); ic = n < 0 ? 'trending-down' : 'arrow-down-left'; color = n < 0 ? '#ea580c' : '#16a34a'; title = x.note || x.source; sub = `${esc(x.source)} · ${acc(x.accountId)}${x.fee ? ` · ${t('frais')} ${money(x.fee)}` : ''}`; amt = signed(n); cls = n < 0 ? 'neg' : 'pos'; break; }
    case 'transfer': ic = 'arrow-left-right'; color = '#2563eb'; title = x.note || t('Transfert'); sub = `${acc(x.accountId)} → ${acc(x.toAccountId)}${x.fee ? ` · ${t('frais')} ${money(x.fee)}` : ''}`; amt = money(x.amount); break;
    case 'alloc': { const pos = x.lines.filter(l => l.amount > 0); ic = isMove(x) ? 'shuffle' : 'wallet-cards'; color = '#64748b'; title = txTitle(x); sub = t('{n} enveloppe(s)', { n: x.lines.length }); amt = money(pos.reduce((s, l) => s + l.amount, 0)); cls = 'muted'; break; }
    case 'adjust': ic = 'scale'; color = '#ca8a04'; title = txTitle(x); sub = `${t('Ajustement')} · ${acc(x.accountId)}`; amt = signed(x.amount); cls = x.amount < 0 ? 'neg' : 'pos'; break;
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

function viewDashboard() {
  const st = monthStats(curMonth);
  const needs = monthlyNeeds();
  const fm = firstMonth();
  const hist = [...Array(6)].map((_, i) => { const m = shiftMonth(curMonth, i - 5); const s = monthStats(m); return { m, inc: s.income, exp: s.expense }; });
  const known = hist.filter(h => fm && h.m >= fm && h.m <= monthOf(today()));
  const avg = known.length ? Math.round(known.reduce((s, h) => s + h.inc, 0) / known.length) : 0;
  const minInc = known.length ? Math.min(...known.map(h => h.inc)) : 0;
  const emergency = activeEnvs().filter(e => e.kind === 'emergency').reduce((s, e) => s + C.env[e.id], 0);
  const future = activeEnvs().filter(e => e.kind === 'saving' || e.kind === 'invest').reduce((s, e) => s + C.env[e.id], 0);
  const cover = needs > 0 ? emergency / needs : null;
  const balance = st.income - st.expense;
  const b = s => `<b>${s}</b>`;

  const alerts = [];
  if (!S.tx.length) alerts.push(`<div class="card welcome"><div class="card-head"><h2>${icon('sparkles')} ${t('Bienvenue ! Pour démarrer :')}</h2>${langSwitch()}</div><ol class="steps">
    <li>${t('<b>Comptes</b> : indique combien tu as maintenant sur chaque compte (Upwork, trading, espèces, mobile money…).')} <button class="btn sm" data-act="go" data-view="accounts">${t('Mes comptes')}</button></li>
    <li>${t('<b>Enveloppes</b> : mets le budget mensuel de chaque poste (loyer, factures, études…).')} <button class="btn sm" data-act="go" data-view="envelopes">${t('Mes enveloppes')}</button></li>
    <li>${t('<b>Répartis</b> ton argent actuel dans les enveloppes.')} <button class="btn sm" data-act="alloc">${t('Répartir')}</button></li>
    <li>${t('Ensuite, à <b>chaque</b> revenu et <b>chaque</b> dépense, appuie sur <b>+</b>. Même 1 centime.')}</li></ol>
    <p class="muted">${t("Besoin d'aide ?")} <a href="#guide" data-act="go" data-view="guide">${t('Lis le guide')}</a>.</p></div>`);
  if (C.unalloc > 0) alerts.push(alertBox('wallet-cards', t('{x} ne sont pas encore répartis. Donne une mission à chaque centime.', { x: b(money(C.unalloc)) }), 'info', `<button class="btn sm primary" data-act="alloc">${t('Répartir')}</button>`));
  if (C.unalloc < 0) alerts.push(alertBox('triangle-alert', t("Tu as réparti {x} de plus que ce que tu possèdes. Retire cet argent d'une enveloppe.", { x: b(money(-C.unalloc)) }), 'bad', `<button class="btn sm" data-act="move">${t('Déplacer')}</button>`));
  for (const e of activeEnvs()) {
    if (C.env[e.id] < 0) alerts.push(alertBox('triangle-alert', t('{e} est à découvert de {x}. Prends dans une autre enveloppe.', { e: b(esc(e.name)), x: b(money(-C.env[e.id])) }), 'bad', `<button class="btn sm" data-act="move">${t('Déplacer')}</button>`));
    else if (e.target && (st.byEnv[e.id] || 0) > e.target) alerts.push(alertBox('info', t('Budget {e} dépassé ce mois : {x} / {y}.', { e: b(esc(e.name)), x: money(st.byEnv[e.id]), y: money(e.target) })));
  }
  if (st.untracked) alerts.push(alertBox('scale', t("{x} d'argent non tracé ce mois (ajustements de solde). Note tes dépenses au moment où tu les fais.", { x: b(money(st.untracked)) }), 'bad'));
  if (needs && known.length >= 2 && avg < needs) alerts.push(alertBox('trending-down', t('Tes revenus moyens ({x}/mois) ne couvrent pas tes besoins mensuels ({y}). Réduis les budgets ou augmente les revenus.', { x: money(avg), y: money(needs) })));
  const daysSinceBackup = S.settings.lastBackup ? (Date.now() - S.settings.lastBackup) / 864e5 : Infinity;
  if (!syncOn() && S.tx.length >= 5 && daysSinceBackup > 7) alerts.push(alertBox('download', `${S.settings.lastBackup ? t('Dernière sauvegarde il y a {n} jours.', { n: Math.floor(daysSinceBackup) }) : t('Aucune sauvegarde encore.')} ${t('Tes données ne sont que sur cet appareil.')}`, '', `<button class="btn sm" data-act="go" data-view="settings">${t('Sauvegarder')}</button>`));

  const sources = Object.entries(st.bySource).sort((a, c) => c[1] - a[1]);
  const srcMax = Math.max(1, ...sources.map(s => Math.abs(s[1])));
  const spend = activeEnvs().map(e => ({ e, v: st.byEnv[e.id] || 0 })).filter(z => z.v > 0 || z.e.target > 0).sort((a, c) => c.v - a.v || c.e.target - a.e.target);
  const recent = sortedTx(S.tx).slice(0, 8);

  return `
  <div class="page-head"><h1>${t('Tableau de bord')}</h1>${monthNav()}</div>
  ${alerts.length ? `<div class="alerts">${alerts.join('')}</div>` : ''}
  <div class="grid kpis">
    <div class="card kpi"><div class="label">${icon('arrow-down-left')} ${t('Revenus nets du mois')}</div><div class="value pos">${countVal(st.income)}</div><div class="sub">${st.fees + st.transferFees ? `${t('frais payés')} ${money(st.fees + st.transferFees)} · ` : ''}${t('moy. {x}/mois', { x: money(avg) })}</div></div>
    <div class="card kpi"><div class="label">${icon('arrow-up-right')} ${t('Dépenses du mois')}</div><div class="value neg">${countVal(st.expense)}</div><div class="sub">${t('besoins prévus')} ${money(needs)}</div></div>
    <div class="card kpi"><div class="label">${icon('scale')} ${t('Solde du mois')}</div><div class="value ${balance < 0 ? 'neg' : ''}">${countVal(balance, 'signed')}</div><div class="sub">${st.income > 0 ? t('tu as gardé {p} % de tes revenus', { p: pct(balance, st.income) }) : t('revenus − dépenses')}</div></div>
    <div class="card kpi accent"><div class="label">${icon('landmark')} ${t('Patrimoine total')}</div><div class="value">${countVal(C.total)}</div><div class="sub">${t('dont épargne + invest.')} ${money(future)}</div></div>
    <div class="card kpi"><div class="label">${icon('life-buoy')} ${t('Coussin de sécurité')}</div><div class="value">${cover === null ? money(emergency) : t('{n} mois', { n: cover.toLocaleString(LOCALE, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) })}</div><div class="sub">${cover === null ? t('définis tes budgets mensuels') : `${money(emergency)} · ${t('objectif 3 à 6 mois')}`}</div></div>
  </div>
  <div class="grid cols-2">
    <div class="card"><div class="card-head"><h2>${t('Revenus vs dépenses')}</h2><button class="btn sm" data-act="go" data-view="reports">${icon('chart-column')} ${t('Rapport annuel')}</button></div>${barsChart(hist, { link: true })}
      <div class="legend"><span><i style="background:var(--inc)"></i>${t('Revenus nets')}</span><span><i style="background:var(--exp)"></i>${t('Dépenses')}</span></div>
      ${known.length ? `<p class="hint" style="margin-top:10px">${t('Revenus irréguliers : moyenne {x}, mois le plus faible {y}. Base ton train de vie sur le mois faible, pas sur la moyenne.', { x: b(money(avg)), y: b(money(minInc)) })}</p>` : ''}
    </div>
    <div class="card"><h2>${t('Revenus par source — {m}', { m: monthLabel(curMonth) })}</h2>
      ${sources.length ? sources.map(([s, v]) => hbar(esc(s), Math.abs(v), srcMax, { right: signed(v), over: v < 0 })).join('') : `<p class="muted">${t('Aucun revenu ce mois.')}</p>`}
      <div class="card-head" style="margin-top:18px"><h2>${t("Où va l'argent")}</h2><button class="btn sm" data-act="go" data-view="envelopes">${t('Enveloppes')}</button></div>
      ${spend.length ? spend.slice(0, 8).map(({ e, v }) => hbar(`${tile(e.icon, e.color, 'xs')} ${esc(e.name)}`, v, Math.max(e.target, v), { right: e.target ? `${money(v)} / ${money(e.target)}` : money(v), over: e.target && v > e.target, color: e.color })).join('') : `<p class="muted">${t('Aucune dépense ce mois.')}</p>`}
    </div>
  </div>
  <div class="card"><div class="card-head"><h2>${t('Dernières opérations')}</h2><button class="btn sm" data-act="go" data-view="tx">${t('Tout voir')}</button></div>${txList(recent)}</div>`;
}

function viewTx() {
  const types = { expense: t('Dépenses'), income: t('Revenus'), transfer: t('Transferts'), alloc: t('Répartitions'), adjust: t('Ajustements') };
  return `<div class="page-head"><h1>${t('Opérations')}</h1>${monthNav()}</div>
  <div class="card">
    <div class="filters">
      <input type="search" data-filter="q" placeholder="${t('Rechercher…')}" value="${esc(txFilter.q)}">
      <select data-filter="type"><option value="">${t('Tous les types')}</option>${Object.entries(types).map(([k, v]) => `<option value="${k}" ${txFilter.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select data-filter="env"><option value="">${t('Toutes les enveloppes')}</option>${S.envelopes.map(e => `<option value="${e.id}" ${txFilter.env === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
      <select data-filter="acc"><option value="">${t('Tous les comptes')}</option>${S.accounts.map(a => `<option value="${a.id}" ${txFilter.acc === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
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
  const inc = list.filter(x => x.type === 'income').reduce((s, x) => s + txNet(x), 0);
  const exp = list.filter(x => x.type === 'expense').reduce((s, x) => s + x.amount, 0);
  $('#tx-out').innerHTML = `<div class="totals"><span>${t('{n} opération(s)', { n: list.length })}</span><span>${t('Entrées')} <b class="pos">${money(inc)}</b></span><span>${t('Sorties')} <b class="neg">${money(exp)}</b></span></div>${txList(list)}`;
}

function viewEnvelopes() {
  const st = monthStats(monthOf(today()));
  const envs = activeEnvs();
  const pctSum = envs.reduce((s, e) => s + (+e.percent || 0), 0);
  const groups = [...new Set(envs.map(e => e.group || t('Autres')))];
  const archived = S.envelopes.filter(e => e.archived);
  const kinds = KINDS();
  const card = e => {
    const spent = st.byEnv[e.id] || 0, bal = C.env[e.id];
    return `<div class="card env lift" style="--c:${e.color}">
      <div class="top">${tile(e.icon, e.color)}<span class="name ellipsis">${esc(e.name)}</span>${e.kind !== 'normal' ? `<span class="chip">${kinds[e.kind]}</span>` : ''}<button class="icon-btn" data-act="env" data-id="${e.id}" aria-label="${t('Modifier')}">${icon('pencil')}</button></div>
      <div class="bal ${bal < 0 ? 'neg' : ''}">${money(bal)}</div>
      <div class="meta"><span>${t('Ce mois : reçu {x} · dépensé {y}', { x: money(st.alloc[e.id] || 0), y: money(spent) })}</span></div>
      ${e.target ? `<div class="bar"><i class="${spent > e.target ? 'over' : ''}" style="width:${Math.min(100, spent / e.target * 100)}%;${spent > e.target ? '' : `background:${e.color}`}"></i></div>
      <div class="meta"><span>${t('Budget {x}/mois', { x: money(e.target) })}</span><span>${spent > e.target ? `<b class="neg">+${money(spent - e.target)}</b>` : t('reste {x}', { x: money(e.target - spent) })}</span></div>` : `<div class="meta"><span>${t('Pas de budget mensuel')}</span><span>${t('{p} % des revenus', { p: e.percent || 0 })}</span></div>`}
      <div class="row-actions" style="margin-top:8px"><button class="btn sm" data-act="spend" data-id="${e.id}">${icon('minus')} ${t('Dépense')}</button><button class="btn sm ghost" data-act="move" data-id="${e.id}">${icon('shuffle')} ${t('Déplacer')}</button></div>
    </div>`;
  };
  return `<div class="page-head"><h1>${t('Enveloppes')}</h1><div class="row-actions"><button class="btn" data-act="move">${icon('shuffle')} ${t('Déplacer')}</button><button class="btn primary" data-act="alloc">${icon('wallet-cards')} ${t('Répartir')}</button></div></div>
  <div class="grid kpis">
    <div class="card kpi accent"><div class="label">${t('Non réparti')}</div><div class="value ${C.unalloc < 0 ? 'neg' : ''}">${countVal(C.unalloc)}</div></div>
    <div class="card kpi"><div class="label">${t('Dans les enveloppes')}</div><div class="value">${countVal(envs.reduce((s, e) => s + C.env[e.id], 0))}</div></div>
    <div class="card kpi"><div class="label">${t('Besoins mensuels')}</div><div class="value">${money(monthlyNeeds())}</div></div>
    <div class="card kpi"><div class="label">${t('Total des %')}</div><div class="value ${Math.abs(pctSum - 100) > 0.01 ? 'neg' : ''}">${pctSum} %</div><div class="sub">${Math.abs(pctSum - 100) > 0.01 ? t('idéalement 100 %') : t('parfait')}</div></div>
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
  const totalLeft = open.reduce((s, g) => s + Math.max(0, (g.target || 0) - (fund[g.id] || 0)), 0);
  const row = g => {
    const have = fund[g.id] || 0, w = g.target ? Math.min(100, have / g.target * 100) : 0;
    const ready = g.target && have >= g.target;
    return `<div class="goal"><div class="mid">
      <div class="card-head" style="margin-bottom:6px"><span class="t">${g.priority}. ${esc(g.name)}</span><span class="num">${g.target ? `${money(have)} / ${money(g.target)}` : `<span class="muted">${t('prix à définir')}</span>`}</span></div>
      <div class="bar"><i style="width:${w}%"></i></div></div>
      ${ready ? `<button class="btn sm primary" data-act="buy" data-id="${g.id}">${icon('check')} ${t('Acheter')}</button>` : ''}
      <button class="icon-btn" data-act="goal" data-id="${g.id}" aria-label="${t('Modifier')}">${icon('pencil')}</button></div>`;
  };
  return `<div class="page-head"><h1>${t('Objectifs')}</h1><button class="btn primary" data-act="goal">${icon('plus')} ${t('Objectif')}</button></div>
  <p class="muted lead">${t("Les objectifs sont financés par l'argent de leur enveloppe, dans l'ordre de priorité. Quand la barre est pleine, tu peux acheter <b>sans toucher au reste</b>.")}
  ${totalLeft ? t('Il manque encore {x} au total.', { x: `<b>${money(totalLeft)}</b>` }) : ''}</p>
  ${byEnv.map(id => { const e = envById(id); return `<div class="card" style="margin-bottom:14px"><div class="card-head"><h2 class="with-tile">${tile(e?.icon || 'folder', e?.color)} ${esc(e?.name || t('Enveloppe supprimée'))}</h2><span class="chip">${t('dispo {x}', { x: money(C.env[id] || 0) })}</span></div>${open.filter(g => g.envelopeId === id).sort((a, c) => a.priority - c.priority).map(row).join('')}</div>`; }).join('')}
  ${!open.length ? `<div class="card empty">${icon('target')}<p>${t('Aucun objectif en cours. Ajoute ce que tu veux acheter ou atteindre.')}</p></div>` : ''}
  ${done.length ? `<h3 class="group-title">${t('Achetés')}</h3><div class="card">${done.map(g => `<div class="goal done"><div class="mid"><span class="t">${esc(g.name)}</span></div><span class="num">${money(g.paid ?? g.target)}</span><button class="icon-btn" data-act="goal" data-id="${g.id}">${icon('pencil')}</button></div>`).join('')}</div>` : ''}`;
}

function viewAccounts() {
  const accs = activeAccs();
  const archived = S.accounts.filter(a => a.archived);
  const types = ACC_TYPES();
  return `<div class="page-head"><h1>${t('Comptes')}</h1><div class="row-actions"><button class="btn" data-act="transfer">${icon('arrow-left-right')} ${t('Transfert')}</button><button class="btn primary" data-act="acc">${icon('plus')} ${t('Compte')}</button></div></div>
  <p class="muted lead">${t('Où se trouve physiquement ton argent. Vérifie de temps en temps que les soldes correspondent à la réalité et utilise « Ajuster » si besoin.')}</p>
  <div class="grid kpis"><div class="card kpi accent"><div class="label">${icon('landmark')} ${t('Total')}</div><div class="value">${countVal(C.total)}</div></div></div>
  <div class="grid env-grid">${accs.map(a => `<div class="card lift">
    <div class="env-top">${tile(a.icon)}<span class="name ellipsis">${esc(a.name)}</span><button class="icon-btn" data-act="acc" data-id="${a.id}" aria-label="${t('Modifier')}">${icon('pencil')}</button></div>
    <div class="bal num">${money(C.acc[a.id])}</div>
    <div class="meta">${types[a.type] || ''} · ${t('départ {x}', { x: money(a.initial) })}</div>
    <div class="row-actions"><button class="btn sm" data-act="adjust" data-id="${a.id}">${icon('scale')} ${t('Ajuster')}</button><button class="btn sm ghost" data-act="acc-tx" data-id="${a.id}">${icon('receipt')} ${t('Opérations')}</button></div>
  </div>`).join('')}</div>
  ${archived.length ? `<h3 class="group-title">${t('Archivés')}</h3><div class="row-actions">${archived.map(a => `<button class="btn sm ghost" data-act="acc" data-id="${a.id}">${icon(a.icon)} ${esc(a.name)}</button>`).join('')}</div>` : ''}`;
}

/* ---------- Annual report ---------- */

function viewReports() {
  const y = curYear, ys = yearStats(y), prev = yearStats(y - 1);
  const now = monthOf(today());
  const months = [...Array(12)].map((_, i) => `${y}-${pad(i + 1)}`);
  const fm = firstMonth();
  const head = `<div class="page-head"><h1>${t('Rapport {y}', { y })}</h1><div class="row-actions">${navArrows(String(y), 'y-prev', 'y-next')}`;
  if (!S.tx.some(x => x.date.startsWith(y + '-'))) {
    return `${head}</div></div><div class="card empty">${icon('chart-column')}<p>${t('Aucune opération en {y}.', { y })}</p></div>`;
  }
  const rows = months.map(m => { const s = monthStats(m); return { m, inc: s.income, exp: s.expense }; });
  const active = rows.filter(r => fm && r.m >= fm && r.m <= now);
  const saved = ys.income - ys.expense;
  const avgInc = active.length ? Math.round(active.reduce((s, r) => s + r.inc, 0) / active.length) : 0;
  const avgExp = active.length ? Math.round(active.reduce((s, r) => s + r.exp, 0) / active.length) : 0;
  const best = active.length ? active.reduce((a, c) => (c.inc > a.inc ? c : a)) : null;
  const worst = active.length ? active.reduce((a, c) => (c.inc < a.inc ? c : a)) : null;
  const fees = ys.fees + ys.transferFees;
  const vs = (a, c, goodUp) => (c ? `<span class="${(a >= c) === goodUp ? 'pos' : 'neg'}">${a >= c ? '▲' : '▼'} ${Math.abs(pct(a - c, Math.abs(c)))} %</span> ${t('vs {y}', { y: y - 1 })}` : t('pas de données {y}', { y: y - 1 }));

  // Net worth at the end of each month.
  const initial = S.accounts.reduce((s, a) => s + (a.initial || 0), 0);
  const wealth = months.filter(m => fm && m >= fm && m <= now).map(m => {
    const end = m + '-31';
    const v = initial + S.tx.reduce((s, x) => (x.date <= end ? s + wealthFlow(x) : s), 0);
    return { label: monthLabel(m, true), v, title: `${monthLabel(m)} : ${money(v)}` };
  });

  const sources = Object.entries(ys.bySource).sort((a, c) => c[1] - a[1]);
  const envRows = S.envelopes.map(e => ({ e, v: ys.byEnv[e.id] || 0 })).filter(z => z.v > 0).sort((a, c) => c.v - a.v);
  const nbMonths = Math.max(1, active.length);
  const topExp = S.tx.filter(x => x.type === 'expense' && x.date.startsWith(y + '-')).sort((a, c) => c.amount - a.amount).slice(0, 10);
  let cumul = 0;

  return `${head}
    <button class="btn" data-act="print">${icon('printer')} ${t('Imprimer / PDF')}</button><button class="btn" data-act="csv-year">${icon('file-spreadsheet')} CSV</button></div></div>
  <div class="grid kpis">
    <div class="card kpi"><div class="label">${icon('arrow-down-left')} ${t('Revenus nets')}</div><div class="value pos">${countVal(ys.income)}</div><div class="sub">${vs(ys.income, prev.income, true)}</div></div>
    <div class="card kpi"><div class="label">${icon('arrow-up-right')} ${t('Dépenses')}</div><div class="value neg">${countVal(ys.expense)}</div><div class="sub">${vs(ys.expense, prev.expense, false)}</div></div>
    <div class="card kpi accent"><div class="label">${icon('piggy-bank')} ${t('Gardé (revenus − dépenses)')}</div><div class="value ${saved < 0 ? 'neg' : ''}">${countVal(saved, 'signed')}</div><div class="sub">${t("taux d'épargne {p} %", { p: pct(saved, ys.income) })}</div></div>
    <div class="card kpi"><div class="label">${icon('calendar')} ${t('Par mois (moyenne)')}</div><div class="value">${money(avgInc)}</div><div class="sub">${t('dépenses {x}/mois', { x: money(avgExp) })}</div></div>
    <div class="card kpi"><div class="label">${icon('hand-coins')} ${t('Frais payés')}</div><div class="value">${money(fees)}</div><div class="sub">${t('{p} % de tes revenus bruts', { p: pct(fees, ys.income + ys.fees) })}</div></div>
    <div class="card kpi"><div class="label">${icon('scale')} ${t('Argent non tracé')}</div><div class="value ${ys.untracked ? 'neg' : ''}">${money(ys.untracked)}</div><div class="sub">${ys.untracked ? t('à réduire à zéro') : t('bravo, tout est noté')}</div></div>
  </div>
  <div class="grid cols-2">
    <div class="card"><h2>${t('Revenus et dépenses par mois')}</h2>${barsChart(rows, { link: true })}
      <div class="legend"><span><i style="background:var(--inc)"></i>${t('Revenus nets')}</span><span><i style="background:var(--exp)"></i>${t('Dépenses')}</span><span>${t('Clique sur un mois pour le détail')}</span></div>
      ${best ? `<p class="hint" style="margin-top:10px">${t('Meilleur mois : {a} ({x}) · Plus faible : {b} ({y}).', { a: `<b>${monthLabel(best.m)}</b>`, x: money(best.inc), b: `<b>${monthLabel(worst.m)}</b>`, y: money(worst.inc) })}</p>` : ''}</div>
    <div class="card"><h2>${t('Évolution du patrimoine')}</h2>${wealth.length ? lineChart(wealth) : `<p class="muted">${t('Pas encore de données.')}</p>`}
      ${wealth.length ? `<p class="hint" style="margin-top:10px">${t('Fin {m} :', { m: wealth[wealth.length - 1].label })} <b>${money(wealth[wealth.length - 1].v)}</b></p>` : ''}</div>
  </div>
  <div class="grid cols-2">
    <div class="card"><h2>${t('Revenus par source')}</h2>
      ${sources.length ? sources.map(([s, v]) => hbar(`${esc(s)} <small class="muted">${pct(v, ys.income)} %${prev.bySource[s] ? ` · ${y - 1} : ${money(prev.bySource[s])}` : ''}</small>`, Math.abs(v), Math.max(...sources.map(z => Math.abs(z[1]))), { right: signed(v), over: v < 0 })).join('') : `<p class="muted">${t('Aucun revenu.')}</p>`}
      <p class="hint">${t("{n} rentrée(s) d'argent cette année.", { n: ys.incomeCount })}</p></div>
    <div class="card"><h2>${t('Dépenses par enveloppe')}</h2>
      <div class="table-wrap"><table class="table"><thead><tr><th>${t('Enveloppe')}</th><th>${t('Total')}</th><th>${t('Moy./mois')}</th><th>${t('Budget')}</th></tr></thead><tbody>
      ${envRows.map(({ e, v }) => { const avg = Math.round(v / nbMonths); return `<tr><td><span class="cell-name">${tile(e.icon, e.color, 'xs')}${esc(e.name)}</span></td><td class="num">${money(v)}</td><td class="num">${money(avg)}</td><td class="num ${e.target && avg > e.target ? 'neg' : ''}">${e.target ? money(e.target) : '—'}</td></tr>`; }).join('') || `<tr><td colspan="4" class="muted">${t('Aucune dépense.')}</td></tr>`}
      </tbody></table></div></div>
  </div>
  <div class="card" style="margin-bottom:14px"><h2>${t('Mois par mois')}</h2>
    <div class="table-wrap"><table class="table"><thead><tr><th>${t('Mois')}</th><th>${t('Revenus')}</th><th>${t('Dépenses')}</th><th>${t('Solde')}</th><th>${t('Cumul')}</th></tr></thead><tbody>
    ${rows.filter(r => r.inc || r.exp).map(r => { const bal = r.inc - r.exp; cumul += bal; return `<tr class="clickable" data-act="open-month" data-m="${r.m}"><td>${monthLabel(r.m)}</td><td class="num pos">${money(r.inc)}</td><td class="num neg">${money(r.exp)}</td><td class="num ${bal < 0 ? 'neg' : ''}">${signed(bal)}</td><td class="num">${signed(cumul)}</td></tr>`; }).join('')}
    </tbody></table></div></div>
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
  const cur = CURRENCIES.includes(s.currency) ? CURRENCIES : [s.currency, ...CURRENCIES];
  return `<div class="page-head"><h1>${t('Réglages')}</h1></div>
  <div class="grid cols-2">
    ${syncSection()}
    <div class="card"><h2>${icon('download')} ${t('Sauvegarde manuelle')}</h2>
      <p class="muted">${syncOn() ? t('Tes données sont stockées dans ce navigateur et synchronisées avec ton Google Drive.') : t('Tes données sont stockées dans ce navigateur, <b>uniquement sur cet appareil</b>.')}
      ${t('Tu peux aussi exporter un fichier de sauvegarde (Drive, clé USB, e-mail à toi-même).')}</p>
      <p class="muted">${t('Dernier export :')} <b>${s.lastBackup ? dateTime(s.lastBackup) : t('jamais')}</b></p>
      <div class="row-actions">
        <button class="btn primary" data-act="export">${icon('download')} ${t('Exporter (JSON)')}</button>
        <button class="btn" data-act="import">${icon('upload')} ${t('Importer')}</button>
        <button class="btn" data-act="csv">${icon('file-spreadsheet')} ${t('CSV (Excel)')}</button>
      </div>
    </div>
    <div class="card"><h2>${icon('settings')} ${t('Préférences')}</h2>
      <div class="field"><span>${t('Langue')}</span>${langSwitch()}<small>${t("Seule l'interface change : ce que tu as tapé reste tel quel.")}</small></div>
      ${field(t('Devise'), `<select data-set="currency">${cur.map(c => `<option ${c === s.currency ? 'selected' : ''}>${c}</option>`).join('')}</select>`, t('Utilise la devise dans laquelle tu penses ton budget.'))}
      ${field(t('Thème'), `<select data-set="theme">${Object.entries({ auto: t('Automatique'), light: t('Clair'), dark: t('Sombre') }).map(([k, v]) => `<option value="${k}" ${k === s.theme ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
      ${field(t('Sources de revenus (une par ligne)'), `<textarea data-set="sources" rows="4">${esc(s.sources.join('\n'))}</textarea>`)}
    </div>
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
function exportCSV(year) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const sep = LANG === 'fr' ? ';' : ',';
  const types = TX_TYPES();
  const rows = [[t('Date'), t('Type'), t('Montant'), t('Frais'), t('Source'), t('Enveloppe'), t('Compte'), t('Vers compte'), t('Note')]];
  const list = year ? S.tx.filter(x => x.date.startsWith(year + '-')) : S.tx;
  for (const x of sortedTx(list).reverse()) {
    if (x.type === 'alloc') {
      for (const l of x.lines) rows.push([x.date, types.alloc, num(l.amount), '', '', envById(l.envelopeId)?.name, '', '', txTitle(x)]);
      continue;
    }
    const amt = x.type === 'expense' ? -x.amount : x.amount;
    rows.push([x.date, types[x.type], num(amt), x.fee ? num(x.fee) : '', x.source, envById(x.envelopeId)?.name, accById(x.accountId)?.name, accById(x.toAccountId)?.name, x.type === 'adjust' ? txTitle(x) : x.note]);
  }
  download(`${t('mes-finances-operations')}-${year || today()}.csv`, '﻿' + rows.map(r => r.map(q).join(sep)).join('\r\n'), 'text/csv;charset=utf-8');
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
  const nav = NAV();
  const secondary = !nav.find(n => n[0] === view)?.[3];
  $('#nav').innerHTML = nav.map(([k, i, l, main]) => `<button class="${k === view ? 'on' : ''} ${main ? '' : 'secondary'}" data-act="go" data-view="${k}">${icon(i)}<span>${l}</span></button>`).join('')
    + `<button class="more ${secondary ? 'on' : ''}" data-act="more">${icon('ellipsis')}<span>${t('Plus')}</span></button>`;
  const main = $('#main');
  main.innerHTML = VIEWS[view]();
  main.classList.toggle('enter', entering);
  if (view === 'tx') renderTxList();
  if (entering) { runCounters(); entering = false; }
  updateSyncPill();
}

// Language, formats and theme.
function applyPrefs() {
  setLang(S.settings.lang);
  buildFmt();
  const th = S.settings.theme;
  if (th === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = th;
  document.title = t('Mes Finances');
  $$('.brand span').forEach(el => { el.textContent = t('Mes Finances'); });
  $('#fab').setAttribute('aria-label', t('Ajouter une opération'));
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

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act, id = b.dataset.id;
  if (b.tagName === 'A') e.preventDefault();
  if (handleSyncAction(act, b)) return;
  switch (act) {
    case 'go': go(b.dataset.view); break;
    case 'more': openMore(); break;
    case 'quick': openQuick(); break;
    case 'lang': changeLang(b.dataset.lang); break;
    case 'm-prev': curMonth = shiftMonth(curMonth, -1); render(); break;
    case 'm-next': curMonth = shiftMonth(curMonth, 1); render(); break;
    case 'y-prev': curYear--; entering = true; render(); break;
    case 'y-next': curYear++; entering = true; render(); break;
    case 'open-month': curMonth = b.dataset.m; go('dashboard'); break;
    case 'tx': openTx(S.tx.find(x => x.id === id)); break;
    case 'alloc': openAllocate(); break;
    case 'move': openMove(id); break;
    case 'transfer': openTransfer(); break;
    case 'spend': openExpense(null, { envelopeId: id }); break;
    case 'env': openEnvelope(envById(id)); break;
    case 'acc': openAccount(accById(id)); break;
    case 'adjust': openAdjust(accById(id)); break;
    case 'acc-tx': Object.assign(txFilter, { type: '', env: '', acc: id, q: '' }); go('tx'); break;
    case 'goal': openGoal(S.goals.find(g => g.id === id)); break;
    case 'buy': { const g = S.goals.find(y => y.id === id); openExpense(null, { goalId: g.id, envelopeId: g.envelopeId, amount: g.target, note: g.name }); break; }
    case 'export': exportJSON(); break;
    case 'csv': exportCSV(); break;
    case 'csv-year': exportCSV(curYear); break;
    case 'print': window.print(); break;
    case 'import': $('#import-file').click(); break;
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
  const k = e.target.dataset.set;
  if (!k) return;
  if (k === 'sources') {
    const list = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
    S.settings.sources = list.length ? [...new Set(list)] : [t('Autre')];
  } else S.settings[k] = e.target.value;
  applyPrefs(); commit(t('Réglage enregistré'));
});

$('#import-file').addEventListener('change', e => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ''; });
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v !== view) go(v); });
// If the app is open in another tab, stay in sync.
window.addEventListener('storage', e => { if (e.key === KEY) { S = load(); snap = snapshot(); applyPrefs(); render(); } });

applyPrefs();
view = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard';
render();
initSync();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
navigator.storage?.persist?.().catch(() => {});
