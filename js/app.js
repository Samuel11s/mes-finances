'use strict';
/*
 * Mes Finances (My Finances) — personal finance tracking for irregular income.
 * Envelope method: every income lands in "Unassigned", then it is assigned
 * to envelopes (rent, studies, emergency fund…). Every expense comes out of an envelope.
 * Data stays on the device (localStorage); Google sync is optional (sync.js).
 * Amounts are stored in cents (integers).
 */

const KEY = 'mes-finances-v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthOf = d => d.slice(0, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function shiftMonth(m, k) {
  let [y, mo] = m.split('-').map(Number);
  mo += k;
  while (mo > 12) { mo -= 12; y++; }
  while (mo < 1) { mo += 12; y--; }
  return `${y}-${pad(mo)}`;
}
const monthLabel = (m, short) => { const [y, mo] = m.split('-').map(Number); return short ? MONTHS_SHORT[mo - 1] : `${MONTHS[mo - 1]} ${y}`; };
const dayLabel = d => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const GROUPS = ['Charges fixes', 'Vie courante', 'Études', 'Voiture', 'Sécurité', 'Avenir', 'Équipement', 'Loisirs'];
const COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#9333ea', '#dc2626', '#4f46e5', '#65a30d', '#c026d3'];
const KINDS = { normal: 'Normale', emergency: "Fonds d'urgence", saving: 'Épargne', invest: 'Investissement' };
const ACC_TYPES = { platform: 'Plateforme (Upwork, Payoneer…)', trading: 'Compte de trading', cash: 'Espèces', mobile: 'Mobile money', bank: 'Banque', crypto: 'Portefeuille crypto', other: 'Autre' };
const CURRENCIES = ['USD', 'EUR', 'CDF', 'XAF', 'XOF', 'RWF', 'BIF', 'UGX', 'KES', 'TZS', 'NGN', 'GHS', 'ZAR', 'MAD', 'CAD', 'GBP', 'CHF'];
const COLS = ['accounts', 'envelopes', 'goals', 'tx'];
const SHARED_SETTINGS = ['currency', 'sources'];
// Older versions: emojis → Lucide icons.
const EMOJI_MAP = { '🏠': 'house', '💡': 'lightbulb', '🧹': 'spray-can', '🛒': 'shopping-cart', '🎓': 'graduation-cap', '🚗': 'car', '🔧': 'wrench', '🛟': 'life-buoy', '🏦': 'piggy-bank', '📈': 'trending-up', '💻': 'laptop', '🎯': 'ticket', '🎉': 'party-popper', '💼': 'briefcase', '📊': 'chart-candlestick', '💵': 'banknote', '📱': 'smartphone', '💳': 'credit-card', '📁': 'folder' };

/* ---------- Icons ---------- */

const icon = (n, cls = '') => ICONS[n]
  ? `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`
  : `<span class="i i-txt ${cls}">${esc(n || '')}</span>`;
const tile = (n, color, cls = '') => `<span class="tile ${cls}" style="--c:${color || 'var(--accent)'}">${icon(n)}</span>`;

/* ---------- Data ---------- */

function defaults() {
  const envs = [
    ['Loyer', 'house', 'Charges fixes', 20, 'normal'],
    ['Factures (eau, électricité, internet)', 'lightbulb', 'Charges fixes', 8, 'normal'],
    ['Maison (entretien, ménage)', 'spray-can', 'Charges fixes', 6, 'normal'],
    ['Besoins courants (nourriture, transport)', 'shopping-cart', 'Vie courante', 15, 'normal'],
    ['Études (frais, livres, cours)', 'graduation-cap', 'Études', 10, 'normal'],
    ['Entretien voiture', 'car', 'Voiture', 5, 'normal'],
    ['Urgence mécanique', 'wrench', 'Voiture', 3, 'normal'],
    ["Fonds d'urgence", 'life-buoy', 'Sécurité', 10, 'emergency'],
    ['Épargne', 'piggy-bank', 'Avenir', 7, 'saving'],
    ['Investissement', 'trending-up', 'Avenir', 5, 'invest'],
    ['Setup (écran, disque, casque…)', 'laptop', 'Équipement', 6, 'normal'],
    ['Activités & sorties', 'ticket', 'Loisirs', 3, 'normal'],
    ['Événements (anniversaires, fêtes)', 'party-popper', 'Loisirs', 2, 'normal'],
  ].map(([name, icon, group, percent, kind], i) => ({ id: uid() + i, name, icon, group, percent, kind, target: 0, priority: i + 1, color: COLORS[i % COLORS.length] }));
  const setup = envs[10].id;
  const accounts = [
    ['Upwork', 'briefcase', 'platform'], ['Compte de trading', 'chart-candlestick', 'trading'], ['Espèces', 'banknote', 'cash'], ['Mobile money', 'smartphone', 'mobile'],
  ].map(([name, icon, type], i) => ({ id: uid() + 'a' + i, name, icon, type, initial: 0 }));
  const goals = ['Disque dur externe', 'Écran externe', 'Casque', 'Table / bureau', 'Clavier', 'Téléphone']
    .map((name, i) => ({ id: uid() + 'g' + i, name, envelopeId: setup, target: 0, priority: i + 1, purchased: false }));
  return {
    version: 2,
    settings: { currency: 'USD', sources: ['Upwork', 'Trading', 'Autre'], theme: 'auto', lastBackup: null, lastAccount: null, lastEnv: null },
    accounts, envelopes: envs, goals, tx: [], deleted: {},
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { console.error(e); }
  return defaults();
}
function migrate(d) {
  const base = defaults();
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
  catch (e) { toast('Erreur de sauvegarde : ' + e.message); }
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
  buildFmt(); render();
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
  try { NF = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: S.settings.currency, currencyDisplay: 'narrowSymbol' }); }
  catch {
    const nf = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    NF = { format: v => nf.format(v) + ' ' + S.settings.currency };
  }
}
const money = c => NF.format((c || 0) / 100);
const signed = c => (c > 0 ? '+' : c < 0 ? '−' : '') + money(Math.abs(c));
const num = c => (c / 100).toFixed(2);
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
function toCents(v) {
  const s = String(v ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  if (s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/* ---------- Calculations ---------- */

const envById = id => S.envelopes.find(e => e.id === id);
const accById = id => S.accounts.find(a => a.id === id);
const activeEnvs = () => S.envelopes.filter(e => !e.archived).sort((a, b) => (a.priority || 99) - (b.priority || 99));
const activeAccs = () => S.accounts.filter(a => !a.archived);
const txNet = t => t.amount - (t.fee || 0);

// Effect of a transaction on total net worth.
function wealthFlow(t) {
  switch (t.type) {
    case 'income': return txNet(t);
    case 'expense': return -t.amount;
    case 'transfer': return -(t.fee || 0);
    case 'adjust': return t.amount;
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
  for (const t of S.tx) {
    switch (t.type) {
      case 'income': add(acc, t.accountId, txNet(t)); unalloc += txNet(t); break;
      case 'expense': add(acc, t.accountId, -t.amount); add(env, t.envelopeId, -t.amount); break;
      case 'transfer': add(acc, t.accountId, -(t.amount + (t.fee || 0))); add(acc, t.toAccountId, t.amount); unalloc -= t.fee || 0; break;
      case 'adjust': add(acc, t.accountId, t.amount); unalloc += t.amount; break;
      case 'alloc': for (const l of t.lines) { add(env, l.envelopeId, l.amount); unalloc -= l.amount; } break;
    }
  }
  const total = Object.values(acc).reduce((s, v) => s + v, 0);
  return { acc, env, unalloc, total };
}

function statsFor(test) {
  const r = { income: 0, fees: 0, bySource: {}, expense: 0, byEnv: {}, alloc: {}, transferFees: 0, untracked: 0, incomeCount: 0 };
  for (const t of S.tx) {
    if (!test(t.date)) continue;
    if (t.type === 'income') {
      r.income += txNet(t); r.fees += t.fee || 0; r.incomeCount++;
      r.bySource[t.source] = (r.bySource[t.source] || 0) + txNet(t);
    } else if (t.type === 'expense') {
      r.expense += t.amount; r.byEnv[t.envelopeId] = (r.byEnv[t.envelopeId] || 0) + t.amount;
    } else if (t.type === 'alloc') {
      for (const l of t.lines) r.alloc[l.envelopeId] = (r.alloc[l.envelopeId] || 0) + l.amount;
    } else if (t.type === 'transfer') r.transferFees += t.fee || 0;
    else if (t.type === 'adjust' && t.amount < 0) r.untracked -= t.amount;
  }
  return r;
}
const monthStats = m => statsFor(d => monthOf(d) === m);
const yearStats = y => statsFor(d => d.startsWith(y + '-'));

const monthlyNeeds = () => activeEnvs().reduce((s, e) => s + (e.target || 0), 0);
const firstMonth = () => S.tx.reduce((m, t) => (!m || t.date < m ? t.date : m), null)?.slice(0, 7);

function sortedTx(list = S.tx) {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.created || 0) - (a.created || 0)));
}

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
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2800);
}

function openModal(title, body, onSubmit, opts = {}) {
  const d = $('#modal');
  d.innerHTML = `<form class="modal-card" novalidate>
    <header><h2>${title}</h2><button type="button" class="icon-btn" data-close aria-label="Fermer">${icon('x')}</button></header>
    <div class="modal-body">${body}</div>
    <div class="err" hidden></div>
    <footer>
      ${opts.onDelete ? `<button type="button" class="btn danger" data-del>${opts.deleteLabel || 'Supprimer'}</button>` : ''}
      <span class="spacer"></span>${opts.extra || ''}
      <button type="button" class="btn ghost" data-close>${onSubmit ? 'Annuler' : 'Fermer'}</button>
      ${onSubmit ? `<button class="btn primary">${opts.submitLabel || 'Enregistrer'}</button>` : ''}
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
  if (del) del.onclick = () => { if (confirm(opts.confirmDelete || 'Supprimer définitivement ?')) { d.close(); opts.onDelete(); } };
  d.showModal();
  const first = $('[autofocus]', d);
  if (first) setTimeout(() => first.focus(), 30);
  return f;
}

const field = (label, inner, hint = '') => `<label class="field"><span>${label}</span>${inner}${hint ? `<small>${hint}</small>` : ''}</label>`;
const amountInput = (name, v, attrs = '') => `<input name="${name}" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${v ? num(v) : ''}" ${attrs}>`;

function envOptions(sel, { withBal = true } = {}) {
  let h = '';
  for (const grp of [...new Set(activeEnvs().map(e => e.group || 'Autres'))]) {
    h += `<optgroup label="${esc(grp)}">` + activeEnvs().filter(e => (e.group || 'Autres') === grp).map(e =>
      `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${esc(e.name)}${withBal ? ' — ' + money(C.env[e.id]) : ''}</option>`).join('') + '</optgroup>';
  }
  const s = envById(sel);
  if (s?.archived) h += `<option value="${s.id}" selected>${esc(s.name)} (archivée)</option>`;
  return h;
}
function accOptions(sel) {
  let h = activeAccs().map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)} — ${money(C.acc[a.id])}</option>`).join('');
  const s = accById(sel);
  if (s?.archived) h += `<option value="${s.id}" selected>${esc(s.name)} (archivé)</option>`;
  return h;
}
function iconPicker(sel, color) {
  const list = ICON_PICK.includes(sel) || !ICONS[sel] ? ICON_PICK : [sel, ...ICON_PICK];
  return `<div class="icon-pick" style="--c:${color || 'var(--accent)'}">${list.map(n => `<label title="${n}"><input type="radio" name="icon" value="${n}" ${n === sel ? 'checked' : ''}>${icon(n)}</label>`).join('')}</div>`;
}

function upsertTx(t, data) {
  if (t) Object.assign(t, data);
  else S.tx.push({ id: uid(), created: Date.now(), ...data });
}
function deleteTx(t) {
  if (t.goalId) { const g = S.goals.find(x => x.id === t.goalId); if (g) { g.purchased = false; delete g.paid; } }
  S.tx = S.tx.filter(x => x !== t);
  commit('Opération supprimée');
}

/* ---------- Forms ---------- */

function openQuick() {
  openModal('Ajouter', `<div class="quick">
    <button type="button" data-q="expense">${tile('arrow-up-right', '#ea580c')}Dépense</button>
    <button type="button" data-q="income">${tile('arrow-down-left', '#16a34a')}Revenu</button>
    <button type="button" data-q="alloc">${tile('wallet-cards', '#0f766e')}Répartir</button>
    <button type="button" data-q="transfer">${tile('arrow-left-right', '#2563eb')}Transfert</button>
  </div>`, null);
  $$('[data-q]', $('#modal')).forEach(b => b.onclick = () => {
    $('#modal').close();
    setTimeout(() => ({ expense: openExpense, income: openIncome, alloc: openAllocate, transfer: openTransfer })[b.dataset.q](), 30);
  });
}

function openExpense(t, preset = {}) {
  if (!activeAccs().length) return toast("Ajoute d'abord un compte");
  const last = accById(S.settings.lastAccount);
  const e = t || {
    date: today(), amount: preset.amount || 0, note: preset.note || '',
    accountId: last && !last.archived ? last.id : activeAccs()[0].id,
    envelopeId: preset.envelopeId || S.settings.lastEnv,
  };
  openModal(t ? 'Modifier la dépense' : (preset.goalId ? 'Acheter : ' + esc(preset.note) : 'Nouvelle dépense'), `
    ${field('Montant', amountInput('amount', e.amount, 'autofocus'))}
    ${field('Enveloppe (pour quoi ?)', `<select name="envelopeId">${envOptions(e.envelopeId)}</select>`, "Le montant affiché est ce qu'il reste dans chaque enveloppe.")}
    ${field('Payé depuis', `<select name="accountId">${accOptions(e.accountId)}</select>`)}
    <div class="two">
      ${field('Date', `<input type="date" name="date" value="${e.date}">`)}
      ${field('Note', `<input name="note" value="${esc(e.note)}" placeholder="ex. carburant, marché…">`)}
    </div>`, g => {
    const amount = toCents(g('amount'));
    if (!(amount > 0)) return 'Entre un montant valide.';
    const data = { type: 'expense', amount, envelopeId: g('envelopeId'), accountId: g('accountId'), date: g('date') || today(), note: g('note').trim() };
    if (preset.goalId) data.goalId = preset.goalId;
    const left = C.env[data.envelopeId] - amount + (t && t.envelopeId === data.envelopeId ? t.amount : 0);
    upsertTx(t, data);
    if (preset.goalId) { const goal = S.goals.find(x => x.id === preset.goalId); if (goal) { goal.purchased = true; goal.paid = amount; } }
    S.settings.lastAccount = data.accountId; S.settings.lastEnv = data.envelopeId;
    commit(left < 0 ? `Attention : enveloppe à découvert de ${money(-left)}` : (t ? 'Dépense modifiée' : 'Dépense enregistrée'));
  }, t ? { onDelete: () => deleteTx(t) } : {});
}

function openIncome(t) {
  if (!activeAccs().length) return toast("Ajoute d'abord un compte");
  const e = t || { date: today(), amount: 0, fee: 0, source: S.settings.sources[0], accountId: activeAccs()[0].id, note: '' };
  const loss = e.amount < 0;
  const sources = [...new Set([...S.settings.sources, e.source].filter(Boolean))];
  const f = openModal(t ? 'Modifier le revenu' : 'Nouveau revenu', `
    ${field('Source', `<select name="source">${sources.map(s => `<option ${s === e.source ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>`)}
    <label class="check"><input type="checkbox" name="loss" ${loss ? 'checked' : ''}> C'est une perte (trading)</label>
    <div class="two">
      ${field('Montant reçu (brut)', amountInput('amount', Math.abs(e.amount), 'autofocus'))}
      ${field('Frais', amountInput('fee', e.fee), 'Commission Upwork, retrait…')}
    </div>
    ${field('Reçu sur le compte', `<select name="accountId">${accOptions(e.accountId)}</select>`)}
    <div class="two">
      ${field('Date', `<input type="date" name="date" value="${e.date}">`)}
      ${field('Note / client', `<input name="note" value="${esc(e.note)}" placeholder="ex. Projet logo – client X">`)}
    </div>
    <p class="hint" id="net-line"></p>
    ${t ? '' : '<label class="check"><input type="checkbox" name="split" checked> Répartir dans mes enveloppes juste après</label>'}
  `, (g, chk) => {
    const amount = toCents(g('amount')); const fee = toCents(g('fee'));
    if (!(amount > 0)) return 'Entre un montant valide.';
    if (Number.isNaN(fee) || fee < 0) return 'Frais invalides.';
    const isLoss = chk('loss');
    if (!isLoss && fee > amount) return 'Les frais dépassent le montant.';
    const data = { type: 'income', source: g('source'), amount: isLoss ? -amount : amount, fee: isLoss ? 0 : fee, accountId: g('accountId'), date: g('date') || today(), note: g('note').trim() };
    upsertTx(t, data);
    commit(t ? 'Revenu modifié' : (isLoss ? 'Perte enregistrée' : `+${money(txNet(data))} enregistré`));
    if (!t && !isLoss && chk('split') && C.unalloc > 0) return () => openAllocate(txNet(data));
  }, t ? { onDelete: () => deleteTx(t) } : {});
  const upd = () => {
    const a = toCents(f.elements.amount.value) || 0, fe = toCents(f.elements.fee.value) || 0, l = f.elements.loss.checked;
    f.elements.fee.disabled = l;
    $('#net-line').innerHTML = l ? `Perte : <b class="neg">−${money(a)}</b>` : `Net reçu : <b class="pos">${money(a - fe)}</b>`;
  };
  f.addEventListener('input', upd); upd();
}

function openTransfer(t) {
  if (activeAccs().length < 2) return toast('Il faut au moins deux comptes');
  const e = t || { date: today(), amount: 0, fee: 0, accountId: activeAccs()[0].id, toAccountId: activeAccs()[1].id, note: '' };
  openModal(t ? 'Modifier le transfert' : 'Transfert entre comptes', `
    <p class="hint">Ex. retrait Upwork → mobile money, ou dépôt sur le compte de trading. Les frais sont déduits du compte de départ.</p>
    ${field('De', `<select name="accountId">${accOptions(e.accountId)}</select>`)}
    ${field('Vers', `<select name="toAccountId">${accOptions(e.toAccountId)}</select>`)}
    <div class="two">
      ${field('Montant arrivé', amountInput('amount', e.amount, 'autofocus'))}
      ${field('Frais de transfert', amountInput('fee', e.fee))}
    </div>
    <div class="two">
      ${field('Date', `<input type="date" name="date" value="${e.date}">`)}
      ${field('Note', `<input name="note" value="${esc(e.note)}">`)}
    </div>`, g => {
    const amount = toCents(g('amount')), fee = toCents(g('fee'));
    if (!(amount > 0)) return 'Entre un montant valide.';
    if (Number.isNaN(fee) || fee < 0) return 'Frais invalides.';
    if (g('accountId') === g('toAccountId')) return 'Choisis deux comptes différents.';
    upsertTx(t, { type: 'transfer', amount, fee, accountId: g('accountId'), toAccountId: g('toAccountId'), date: g('date') || today(), note: g('note').trim() });
    commit(t ? 'Transfert modifié' : 'Transfert enregistré');
  }, t ? { onDelete: () => deleteTx(t) } : {});
}

function openAdjust(acc) {
  const cur = C.acc[acc.id];
  const f = openModal(`Ajuster : ${esc(acc.name)}`, `
    <p class="hint">Le solde dans l'app ne correspond pas à la réalité ? Entre le solde <b>réel</b> que tu vois (app Upwork, wallet, billets en poche…).
    L'écart sera enregistré comme « argent non tracé » : ça t'aide à voir combien t'échappe.</p>
    ${field("Solde dans l'app", `<input value="${money(cur)}" disabled>`)}
    ${field('Solde réel', amountInput('real', 0, 'autofocus'))}
    ${field('Explication (facultatif)', '<input name="note" placeholder="ex. dépenses non notées cette semaine">')}
    <p class="hint" id="diff-line"></p>`, g => {
    const real = toCents(g('real'));
    if (Number.isNaN(real) || g('real').trim() === '') return 'Entre le solde réel.';
    const diff = real - cur;
    if (diff === 0) return () => toast('Le solde est déjà juste');
    upsertTx(null, { type: 'adjust', accountId: acc.id, amount: diff, date: today(), note: g('note').trim() || (diff < 0 ? 'Argent non tracé' : 'Argent retrouvé') });
    commit(diff < 0 ? `${money(-diff)} non tracé — pense à tout noter !` : 'Solde ajusté');
  }, { submitLabel: 'Ajuster' });
  f.addEventListener('input', () => {
    const r = toCents(f.elements.real.value);
    $('#diff-line').innerHTML = Number.isNaN(r) || f.elements.real.value === '' ? '' : `Écart : <b class="${r - cur < 0 ? 'neg' : 'pos'}">${signed(r - cur)}</b>`;
  });
}

function openAllocate(preAmount) {
  const avail = C.unalloc;
  if (avail <= 0 && preAmount === undefined) {
    return toast(avail < 0 ? `Tu as réparti ${money(-avail)} de trop — retire de l'argent d'une enveloppe` : "Rien à répartir : enregistre d'abord un revenu");
  }
  const allocM = monthStats(monthOf(today())).alloc;
  const envs = activeEnvs();
  let mode = monthlyNeeds() > 0 ? 'needs' : 'pct';
  const hints = {
    needs: "Remplit d'abord le budget mensuel de chaque enveloppe (dans l'ordre de priorité : loyer, factures…), puis répartit le reste selon tes pourcentages. Idéal quand les revenus sont irréguliers.",
    pct: 'Répartit le montant selon les pourcentages de chaque enveloppe.',
    manual: 'Tape toi-même les montants.',
  };
  const needText = e => {
    if (!e.target) return `${e.percent || 0} %`;
    const need = e.target - (allocM[e.id] || 0);
    return need > 0 ? `manque ${money(need)} ce mois · ${e.percent || 0} %` : `budget du mois atteint · ${e.percent || 0} %`;
  };
  const f = openModal('Répartir mon argent', `
    <div class="alert info">${icon('wallet-cards')}<span class="grow">Disponible à répartir</span><b class="num">${money(avail)}</b></div>
    ${field('Montant à répartir', amountInput('total', Math.max(0, Math.min(preAmount ?? avail, avail))))}
    <div class="seg">${Object.entries({ needs: "Besoins d'abord", pct: 'Pourcentages', manual: 'Manuel' }).map(([k, v]) => `<button type="button" data-mode="${k}">${v}</button>`).join('')}</div>
    <p class="hint" id="mode-hint"></p>
    <div>${envs.map(e => `<div class="alloc-row">${tile(e.icon, e.color, 'sm')}<span class="ellipsis">${esc(e.name)}<small>${needText(e)}</small></span><input data-env="${e.id}" inputmode="decimal" placeholder="0,00"></div>`).join('')}</div>
    <div class="alloc-sum"><span>Réparti : <b id="a-sum" class="num"></b></span><span>Reste : <b id="a-left" class="num"></b></span></div>
  `, () => {
    const lines = [];
    for (const inp of $$('[data-env]', f)) {
      const v = toCents(inp.value);
      if (Number.isNaN(v)) return 'Un montant est invalide.';
      if (v) lines.push({ envelopeId: inp.dataset.env, amount: v });
    }
    const sum = lines.reduce((s, l) => s + l.amount, 0);
    if (sum <= 0) return 'Rien à répartir.';
    if (sum > avail) return `Tu ne peux pas répartir plus que ${money(avail)}.`;
    upsertTx(null, { type: 'alloc', date: today(), lines, note: 'Répartition' });
    commit(`${money(sum)} réparti dans ${lines.length} enveloppe(s)`);
  }, { submitLabel: 'Répartir' });

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
  const opts = sel => `<option value="">— Non réparti (${money(C.unalloc)}) —</option>` + envOptions(sel);
  openModal('Déplacer entre enveloppes', `
    <p class="hint">Une enveloppe est à découvert ou tu as trop mis quelque part ? Déplace l'argent. Choisir « Non réparti » rend l'argent disponible.</p>
    ${field('Prendre dans', `<select name="from">${opts(fromId)}</select>`)}
    ${field('Mettre dans', `<select name="to">${opts('')}</select>`)}
    ${field('Montant', amountInput('amount', 0, 'autofocus'))}`, g => {
    const amount = toCents(g('amount'));
    const from = g('from'), to = g('to');
    if (!(amount > 0)) return 'Entre un montant valide.';
    if (from === to) return 'Choisis deux endroits différents.';
    if (!from && amount > C.unalloc) return `Il n'y a que ${money(C.unalloc)} de non réparti.`;
    const lines = [];
    if (from) lines.push({ envelopeId: from, amount: -amount });
    if (to) lines.push({ envelopeId: to, amount });
    upsertTx(null, { type: 'alloc', date: today(), lines, note: 'Déplacement' });
    commit('Argent déplacé');
  }, { submitLabel: 'Déplacer' });
}

function openAllocTx(t) {
  const body = t.lines.map(l => { const e = envById(l.envelopeId); return `<div class="alloc-row">${tile(e?.icon || 'folder', e?.color, 'sm')}<span>${esc(e?.name || 'Enveloppe supprimée')}</span><b class="num ${l.amount < 0 ? 'neg' : ''}" style="text-align:right">${signed(l.amount)}</b></div>`; }).join('');
  openModal(`${esc(t.note || 'Répartition')} du ${dayLabel(t.date)}`, body + '<p class="hint" style="margin-top:12px">Supprimer annule cette répartition : l\'argent revient dans « Non réparti ».</p>', null,
    { onDelete: () => deleteTx(t), deleteLabel: 'Annuler la répartition', confirmDelete: 'Annuler cette répartition ?' });
}

function openTx(t) {
  if (!t) return;
  ({
    expense: openExpense, income: openIncome, transfer: openTransfer, alloc: openAllocTx,
    adjust: x => openModal('Ajustement de solde', `<p>${esc(accById(x.accountId)?.name)} : <b>${signed(x.amount)}</b></p><p class="muted">${esc(x.note)}</p>`, null, { onDelete: () => deleteTx(x) }),
  })[t.type](t);
}

function openEnvelope(e) {
  const isNew = !e;
  e = e || { name: '', icon: 'folder', group: 'Vie courante', percent: 0, target: 0, kind: 'normal', priority: S.envelopes.length + 1, color: COLORS[S.envelopes.length % COLORS.length] };
  const used = !isNew && (S.tx.some(t => t.envelopeId === e.id || t.lines?.some(l => l.envelopeId === e.id)) || S.goals.some(g => g.envelopeId === e.id));
  const groups = [...new Set([...GROUPS, ...S.envelopes.map(x => x.group)])];
  const f = openModal(isNew ? 'Nouvelle enveloppe' : "Modifier l'enveloppe", `
    ${field('Nom', `<input name="name" value="${esc(e.name)}" autofocus>`)}
    <div class="field"><span>Icône et couleur</span>${iconPicker(e.icon, e.color)}
      <div class="colors">${COLORS.map(c => `<label style="--c:${c}"><input type="radio" name="color" value="${c}" ${c === e.color ? 'checked' : ''}></label>`).join('')}</div></div>
    ${field('Groupe', `<input name="group" list="groups" value="${esc(e.group)}"><datalist id="groups">${groups.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`)}
    <div class="two">
      ${field('Budget mensuel', amountInput('target', e.target), 'Ce dont tu as besoin chaque mois (ex. loyer). 0 = pas de budget fixe.')}
      ${field('% des revenus', `<input name="percent" type="number" min="0" max="100" step="0.5" value="${e.percent || 0}">`, 'Part de ce qui reste après les besoins.')}
    </div>
    <div class="two">
      ${field('Priorité', `<input name="priority" type="number" min="1" value="${e.priority || 1}">`, '1 = remplie en premier.')}
      ${field('Type', `<select name="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${k === e.kind ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
    </div>`, g => {
    const target = toCents(g('target'));
    if (!g('name').trim()) return 'Donne un nom.';
    if (Number.isNaN(target) || target < 0) return 'Budget invalide.';
    const data = { name: g('name').trim(), icon: g('icon') || 'folder', group: g('group').trim() || 'Autres', target, percent: Math.max(0, +g('percent') || 0), priority: Math.max(1, +g('priority') || 1), kind: g('kind'), color: g('color') || e.color };
    if (isNew) S.envelopes.push({ id: uid(), ...data }); else Object.assign(e, data);
    commit(isNew ? 'Enveloppe créée' : 'Enveloppe modifiée');
  }, isNew ? {} : used
    ? { onDelete: () => { if (C.env[e.id]) return toast("Vide d'abord l'enveloppe (Déplacer)"); e.archived = !e.archived; commit(e.archived ? 'Enveloppe archivée' : 'Enveloppe restaurée'); }, deleteLabel: e.archived ? 'Restaurer' : 'Archiver', confirmDelete: e.archived ? 'Restaurer cette enveloppe ?' : "Archiver ? Elle sera masquée mais l'historique est conservé." }
    : { onDelete: () => { S.envelopes = S.envelopes.filter(x => x !== e); commit('Enveloppe supprimée'); } });
  // The icon preview takes the selected color.
  f.addEventListener('change', ev => { if (ev.target.name === 'color') $('.icon-pick', f).style.setProperty('--c', ev.target.value); });
}

function openAccount(a) {
  const isNew = !a;
  a = a || { name: '', icon: 'wallet', type: 'other', initial: 0 };
  const used = !isNew && S.tx.some(t => t.accountId === a.id || t.toAccountId === a.id);
  openModal(isNew ? 'Nouveau compte' : 'Modifier le compte', `
    ${field('Nom', `<input name="name" value="${esc(a.name)}" autofocus placeholder="ex. Payoneer, M-Pesa, Binance…">`)}
    <div class="field"><span>Icône</span>${iconPicker(a.icon)}</div>
    ${field('Type', `<select name="type">${Object.entries(ACC_TYPES).map(([k, v]) => `<option value="${k}" ${k === a.type ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
    ${field('Solde de départ', amountInput('initial', a.initial), "L'argent présent sur ce compte au moment où tu commences le suivi. Il arrive dans « Non réparti » pour que tu le répartisses.")}`, g => {
    const initial = toCents(g('initial'));
    if (!g('name').trim()) return 'Donne un nom.';
    if (Number.isNaN(initial)) return 'Solde invalide.';
    const data = { name: g('name').trim(), icon: g('icon') || 'wallet', type: g('type'), initial };
    if (isNew) S.accounts.push({ id: uid(), ...data }); else Object.assign(a, data);
    commit(isNew ? 'Compte ajouté' : 'Compte modifié');
  }, isNew ? {} : used
    ? { onDelete: () => { if (C.acc[a.id]) return toast('Le solde doit être à 0 pour archiver (fais un transfert)'); a.archived = !a.archived; commit(a.archived ? 'Compte archivé' : 'Compte restauré'); }, deleteLabel: a.archived ? 'Restaurer' : 'Archiver', confirmDelete: a.archived ? 'Restaurer ce compte ?' : 'Archiver ce compte ?' }
    : { onDelete: () => { S.accounts = S.accounts.filter(x => x !== a); commit('Compte supprimé'); } });
}

function openGoal(gl) {
  const isNew = !gl;
  gl = gl || { name: '', envelopeId: activeEnvs().find(e => e.group === 'Équipement')?.id || activeEnvs()[0]?.id, target: 0, priority: S.goals.length + 1 };
  openModal(isNew ? 'Nouvel objectif' : "Modifier l'objectif", `
    ${field('Quoi ?', `<input name="name" value="${esc(gl.name)}" autofocus placeholder="ex. Écran 27 pouces">`)}
    ${field('Prix / montant visé', amountInput('target', gl.target))}
    ${field("Financé par l'enveloppe", `<select name="envelopeId">${envOptions(gl.envelopeId)}</select>`, "L'argent de l'enveloppe finance les objectifs dans l'ordre de priorité.")}
    ${field('Priorité', `<input name="priority" type="number" min="1" value="${gl.priority || 1}">`, '1 = acheté en premier.')}`, g => {
    const target = toCents(g('target'));
    if (!g('name').trim()) return 'Donne un nom.';
    if (Number.isNaN(target) || target < 0) return 'Montant invalide.';
    const data = { name: g('name').trim(), target, envelopeId: g('envelopeId'), priority: Math.max(1, +g('priority') || 1) };
    if (isNew) S.goals.push({ id: uid(), purchased: false, ...data }); else Object.assign(gl, data);
    commit(isNew ? 'Objectif ajouté' : 'Objectif modifié');
  }, isNew ? {} : { onDelete: () => { S.goals = S.goals.filter(x => x !== gl); S.tx.forEach(t => { if (t.goalId === gl.id) delete t.goalId; }); commit('Objectif supprimé'); } });
}

/* ---------- Charts ---------- */

function barsChart(hist, { link = false } = {}) {
  const W = 640, H = 260, B = 34, T = 10;
  const max = Math.max(1, ...hist.flatMap(h => [h.inc, h.exp]));
  const gw = W / hist.length, bw = Math.min(30, gw * 0.3), ph = H - T - B;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart ${hist.length > 8 ? 'dense' : ''}" role="img" aria-label="Revenus et dépenses par mois">`;
  for (let i = 0; i <= 3; i++) { const y = T + ph * i / 3; s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" class="grid-line"/>`; }
  hist.forEach((h, i) => {
    const cx = gw * i + gw / 2;
    const hi = ph * Math.max(0, h.inc) / max, he = ph * h.exp / max;
    s += `<g ${link ? `data-act="open-month" data-m="${h.m}" class="clickable"` : ''} style="--d:${i * 40}ms">
      <rect x="${cx - gw / 2}" y="${T}" width="${gw}" height="${ph}" fill="transparent"/>
      <rect x="${cx - bw - 2}" y="${H - B - hi}" width="${bw}" height="${hi}" rx="4" class="b-inc"><title>${monthLabel(h.m)} — revenus ${money(h.inc)}</title></rect>
      <rect x="${cx + 2}" y="${H - B - he}" width="${bw}" height="${he}" rx="4" class="b-exp"><title>${monthLabel(h.m)} — dépenses ${money(h.exp)}</title></rect>
      <text x="${cx}" y="${H - 6}" text-anchor="middle" class="axis">${monthLabel(h.m, true)}</text></g>`;
  });
  return s + '</svg>';
}

function lineChart(points) {
  const W = 640, H = 220, B = 30, T = 16, L = 26;
  const vals = points.map(p => p.v);
  const max = Math.max(...vals, 0), min = Math.min(...vals, 0);
  const span = max - min || 1;
  const x = i => L + (W - 2 * L) * (points.length === 1 ? 0.5 : i / (points.length - 1));
  const y = v => T + (H - T - B) * (1 - (v - min) / span);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points.length - 1).toFixed(1)},${y(min)} L${x(0).toFixed(1)},${y(min)} Z`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Évolution du patrimoine">
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

const navArrows = (label, prev, next) => `<div class="month-nav"><button class="icon-btn" data-act="${prev}" aria-label="Précédent">${icon('chevron-left')}</button><span>${label}</span><button class="icon-btn" data-act="${next}" aria-label="Suivant">${icon('chevron-right')}</button></div>`;
const monthNav = () => navArrows(monthLabel(curMonth), 'm-prev', 'm-next');

function txRow(t) {
  const acc = id => esc(accById(id)?.name || '?');
  let ic, color, title, sub, amt, cls = '';
  switch (t.type) {
    case 'expense': { const e = envById(t.envelopeId); ic = e?.icon || 'arrow-up-right'; color = e?.color; title = t.note || e?.name; sub = `${esc(e?.name || '?')} · ${acc(t.accountId)}`; amt = '−' + money(t.amount); cls = 'neg'; break; }
    case 'income': { const n = txNet(t); ic = n < 0 ? 'trending-down' : 'arrow-down-left'; color = n < 0 ? '#ea580c' : '#16a34a'; title = t.note || t.source; sub = `${esc(t.source)} · ${acc(t.accountId)}${t.fee ? ` · frais ${money(t.fee)}` : ''}`; amt = signed(n); cls = n < 0 ? 'neg' : 'pos'; break; }
    case 'transfer': ic = 'arrow-left-right'; color = '#2563eb'; title = t.note || 'Transfert'; sub = `${acc(t.accountId)} → ${acc(t.toAccountId)}${t.fee ? ` · frais ${money(t.fee)}` : ''}`; amt = money(t.amount); break;
    case 'alloc': { const pos = t.lines.filter(l => l.amount > 0); ic = t.note === 'Déplacement' ? 'shuffle' : 'wallet-cards'; color = '#64748b'; title = t.note || 'Répartition'; sub = `${t.lines.length} enveloppe(s)`; amt = money(pos.reduce((s, l) => s + l.amount, 0)); cls = 'muted'; break; }
    case 'adjust': ic = 'scale'; color = '#ca8a04'; title = t.note || 'Ajustement'; sub = `Ajustement · ${acc(t.accountId)}`; amt = signed(t.amount); cls = t.amount < 0 ? 'neg' : 'pos'; break;
  }
  return `<button class="tx" data-act="tx" data-id="${t.id}">${tile(ic, color)}<span class="mid"><div class="t ellipsis">${esc(title)}</div><div class="s ellipsis">${sub}</div></span><span class="amt ${cls}">${amt}</span></button>`;
}

function txList(list) {
  if (!list.length) return `<div class="empty">${icon('receipt')}<p>Aucune opération.</p></div>`;
  let h = '', day = '';
  for (const t of sortedTx(list)) {
    if (t.date !== day) { day = t.date; h += `<div class="tx-day">${dayLabel(day)}</div>`; }
    h += txRow(t);
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

  const alerts = [];
  if (!S.tx.length) alerts.push(`<div class="card welcome"><h2>${icon('sparkles')} Bienvenue ! Pour démarrer :</h2><ol class="steps">
    <li><b>Comptes</b> : indique combien tu as maintenant sur chaque compte (Upwork, trading, espèces, mobile money…). <button class="btn sm" data-act="go" data-view="accounts">Mes comptes</button></li>
    <li><b>Enveloppes</b> : mets le budget mensuel de chaque poste (loyer, factures, études…). <button class="btn sm" data-act="go" data-view="envelopes">Mes enveloppes</button></li>
    <li><b>Répartis</b> ton argent actuel dans les enveloppes. <button class="btn sm" data-act="alloc">Répartir</button></li>
    <li>Ensuite, à <b>chaque</b> revenu et <b>chaque</b> dépense, appuie sur <b>+</b>. Même 1 centime.</li></ol>
    <p class="muted">Besoin d'aide ? <a href="#guide" data-act="go" data-view="guide">Lis le guide</a>.</p></div>`);
  if (C.unalloc > 0) alerts.push(alertBox('wallet-cards', `<b>${money(C.unalloc)}</b> ne sont pas encore répartis. Donne une mission à chaque centime.`, 'info', '<button class="btn sm primary" data-act="alloc">Répartir</button>'));
  if (C.unalloc < 0) alerts.push(alertBox('triangle-alert', `Tu as réparti <b>${money(-C.unalloc)}</b> de plus que ce que tu possèdes. Retire cet argent d'une enveloppe.`, 'bad', '<button class="btn sm" data-act="move">Déplacer</button>'));
  for (const e of activeEnvs()) {
    if (C.env[e.id] < 0) alerts.push(alertBox('triangle-alert', `<b>${esc(e.name)}</b> est à découvert de <b>${money(-C.env[e.id])}</b>. Prends dans une autre enveloppe.`, 'bad', '<button class="btn sm" data-act="move">Déplacer</button>'));
    else if (e.target && (st.byEnv[e.id] || 0) > e.target) alerts.push(alertBox('info', `Budget <b>${esc(e.name)}</b> dépassé ce mois : ${money(st.byEnv[e.id])} / ${money(e.target)}.`));
  }
  if (st.untracked) alerts.push(alertBox('scale', `<b>${money(st.untracked)}</b> d'argent non tracé ce mois (ajustements de solde). Note tes dépenses au moment où tu les fais.`, 'bad'));
  if (needs && known.length >= 2 && avg < needs) alerts.push(alertBox('trending-down', `Tes revenus moyens (${money(avg)}/mois) ne couvrent pas tes besoins mensuels (${money(needs)}). Réduis les budgets ou augmente les revenus.`));
  const daysSinceBackup = S.settings.lastBackup ? (Date.now() - S.settings.lastBackup) / 864e5 : Infinity;
  if (!syncOn() && S.tx.length >= 5 && daysSinceBackup > 7) alerts.push(alertBox('download', `${S.settings.lastBackup ? `Dernière sauvegarde il y a ${Math.floor(daysSinceBackup)} jours.` : 'Aucune sauvegarde encore.'} Tes données ne sont que sur cet appareil.`, '', '<button class="btn sm" data-act="go" data-view="settings">Sauvegarder</button>'));

  const sources = Object.entries(st.bySource).sort((a, b) => b[1] - a[1]);
  const srcMax = Math.max(1, ...sources.map(s => Math.abs(s[1])));
  const spend = activeEnvs().map(e => ({ e, v: st.byEnv[e.id] || 0 })).filter(x => x.v > 0 || x.e.target > 0).sort((a, b) => b.v - a.v || b.e.target - a.e.target);
  const recent = sortedTx(S.tx).slice(0, 8);

  return `
  <div class="page-head"><h1>Tableau de bord</h1>${monthNav()}</div>
  ${alerts.length ? `<div class="alerts">${alerts.join('')}</div>` : ''}
  <div class="grid kpis">
    <div class="card kpi"><div class="label">${icon('arrow-down-left')} Revenus nets du mois</div><div class="value pos">${countVal(st.income)}</div><div class="sub">${st.fees + st.transferFees ? `frais payés ${money(st.fees + st.transferFees)} · ` : ''}moy. ${money(avg)}/mois</div></div>
    <div class="card kpi"><div class="label">${icon('arrow-up-right')} Dépenses du mois</div><div class="value neg">${countVal(st.expense)}</div><div class="sub">besoins prévus ${money(needs)}</div></div>
    <div class="card kpi"><div class="label">${icon('scale')} Solde du mois</div><div class="value ${balance < 0 ? 'neg' : ''}">${countVal(balance, 'signed')}</div><div class="sub">${st.income > 0 ? `tu as gardé ${pct(balance, st.income)} % de tes revenus` : 'revenus − dépenses'}</div></div>
    <div class="card kpi accent"><div class="label">${icon('landmark')} Patrimoine total</div><div class="value">${countVal(C.total)}</div><div class="sub">dont épargne + invest. ${money(future)}</div></div>
    <div class="card kpi"><div class="label">${icon('life-buoy')} Coussin de sécurité</div><div class="value">${cover === null ? money(emergency) : cover.toFixed(1) + ' mois'}</div><div class="sub">${cover === null ? 'définis tes budgets mensuels' : `${money(emergency)} · objectif 3 à 6 mois`}</div></div>
  </div>
  <div class="grid cols-2">
    <div class="card"><div class="card-head"><h2>Revenus vs dépenses</h2><button class="btn sm" data-act="go" data-view="reports">${icon('chart-column')} Rapport annuel</button></div>${barsChart(hist, { link: true })}
      <div class="legend"><span><i style="background:var(--inc)"></i>Revenus nets</span><span><i style="background:var(--exp)"></i>Dépenses</span></div>
      ${known.length ? `<p class="hint" style="margin-top:10px">Revenus irréguliers : moyenne <b>${money(avg)}</b>, mois le plus faible <b>${money(minInc)}</b>. Base ton train de vie sur le mois faible, pas sur la moyenne.</p>` : ''}
    </div>
    <div class="card"><h2>Revenus par source — ${monthLabel(curMonth)}</h2>
      ${sources.length ? sources.map(([s, v]) => hbar(esc(s), Math.abs(v), srcMax, { right: signed(v), over: v < 0 })).join('') : '<p class="muted">Aucun revenu ce mois.</p>'}
      <div class="card-head" style="margin-top:18px"><h2>Où va l'argent</h2><button class="btn sm" data-act="go" data-view="envelopes">Enveloppes</button></div>
      ${spend.length ? spend.slice(0, 8).map(({ e, v }) => hbar(`${tile(e.icon, e.color, 'xs')} ${esc(e.name)}`, v, Math.max(e.target, v), { right: e.target ? `${money(v)} / ${money(e.target)}` : money(v), over: e.target && v > e.target, color: e.color })).join('') : '<p class="muted">Aucune dépense ce mois.</p>'}
    </div>
  </div>
  <div class="card"><div class="card-head"><h2>Dernières opérations</h2><button class="btn sm" data-act="go" data-view="tx">Tout voir</button></div>${txList(recent)}</div>`;
}

function viewTx() {
  return `<div class="page-head"><h1>Opérations</h1>${monthNav()}</div>
  <div class="card">
    <div class="filters">
      <input type="search" data-filter="q" placeholder="Rechercher…" value="${esc(txFilter.q)}">
      <select data-filter="type"><option value="">Tous les types</option>${Object.entries({ expense: 'Dépenses', income: 'Revenus', transfer: 'Transferts', alloc: 'Répartitions', adjust: 'Ajustements' }).map(([k, v]) => `<option value="${k}" ${txFilter.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select data-filter="env"><option value="">Toutes les enveloppes</option>${S.envelopes.map(e => `<option value="${e.id}" ${txFilter.env === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
      <select data-filter="acc"><option value="">Tous les comptes</option>${S.accounts.map(a => `<option value="${a.id}" ${txFilter.acc === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
    </div>
    <div id="tx-out"></div>
    <div class="row-actions" style="margin-top:12px"><button class="btn sm" data-act="csv">${icon('file-spreadsheet')} Exporter en CSV (Excel)</button></div>
  </div>`;
}
function renderTxList() {
  const q = txFilter.q.trim().toLowerCase();
  const list = S.tx.filter(t => monthOf(t.date) === curMonth
    && (!txFilter.type || t.type === txFilter.type)
    && (!txFilter.env || t.envelopeId === txFilter.env || t.lines?.some(l => l.envelopeId === txFilter.env))
    && (!txFilter.acc || t.accountId === txFilter.acc || t.toAccountId === txFilter.acc)
    && (!q || [t.note, t.source, envById(t.envelopeId)?.name, accById(t.accountId)?.name].join(' ').toLowerCase().includes(q)));
  const inc = list.filter(t => t.type === 'income').reduce((s, t) => s + txNet(t), 0);
  const exp = list.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  $('#tx-out').innerHTML = `<div class="totals"><span>${list.length} opération(s)</span><span>Entrées <b class="pos">${money(inc)}</b></span><span>Sorties <b class="neg">${money(exp)}</b></span></div>${txList(list)}`;
}

function viewEnvelopes() {
  const st = monthStats(monthOf(today()));
  const envs = activeEnvs();
  const pctSum = envs.reduce((s, e) => s + (+e.percent || 0), 0);
  const groups = [...new Set(envs.map(e => e.group || 'Autres'))];
  const archived = S.envelopes.filter(e => e.archived);
  const card = e => {
    const spent = st.byEnv[e.id] || 0, bal = C.env[e.id];
    return `<div class="card env lift" style="--c:${e.color}">
      <div class="top">${tile(e.icon, e.color)}<span class="name ellipsis">${esc(e.name)}</span>${e.kind !== 'normal' ? `<span class="chip">${KINDS[e.kind]}</span>` : ''}<button class="icon-btn" data-act="env" data-id="${e.id}" aria-label="Modifier">${icon('pencil')}</button></div>
      <div class="bal ${bal < 0 ? 'neg' : ''}">${money(bal)}</div>
      <div class="meta"><span>Ce mois : reçu ${money(st.alloc[e.id] || 0)} · dépensé ${money(spent)}</span></div>
      ${e.target ? `<div class="bar"><i class="${spent > e.target ? 'over' : ''}" style="width:${Math.min(100, spent / e.target * 100)}%;${spent > e.target ? '' : `background:${e.color}`}"></i></div>
      <div class="meta"><span>Budget ${money(e.target)}/mois</span><span>${spent > e.target ? `<b class="neg">+${money(spent - e.target)}</b>` : `reste ${money(e.target - spent)}`}</span></div>` : `<div class="meta"><span>Pas de budget mensuel</span><span>${e.percent || 0} % des revenus</span></div>`}
      <div class="row-actions" style="margin-top:8px"><button class="btn sm" data-act="spend" data-id="${e.id}">${icon('minus')} Dépense</button><button class="btn sm ghost" data-act="move" data-id="${e.id}">${icon('shuffle')} Déplacer</button></div>
    </div>`;
  };
  return `<div class="page-head"><h1>Enveloppes</h1><div class="row-actions"><button class="btn" data-act="move">${icon('shuffle')} Déplacer</button><button class="btn primary" data-act="alloc">${icon('wallet-cards')} Répartir</button></div></div>
  <div class="grid kpis">
    <div class="card kpi accent"><div class="label">Non réparti</div><div class="value ${C.unalloc < 0 ? 'neg' : ''}">${countVal(C.unalloc)}</div></div>
    <div class="card kpi"><div class="label">Dans les enveloppes</div><div class="value">${countVal(envs.reduce((s, e) => s + C.env[e.id], 0))}</div></div>
    <div class="card kpi"><div class="label">Besoins mensuels</div><div class="value">${money(monthlyNeeds())}</div></div>
    <div class="card kpi"><div class="label">Total des %</div><div class="value ${Math.abs(pctSum - 100) > 0.01 ? 'neg' : ''}">${pctSum} %</div><div class="sub">${Math.abs(pctSum - 100) > 0.01 ? 'idéalement 100 %' : 'parfait'}</div></div>
  </div>
  ${groups.map(g => `<h3 class="group-title">${esc(g)}</h3><div class="grid env-grid">${envs.filter(e => (e.group || 'Autres') === g).map(card).join('')}</div>`).join('')}
  <div class="row-actions" style="margin-top:20px"><button class="btn" data-act="env">${icon('plus')} Nouvelle enveloppe</button></div>
  ${archived.length ? `<h3 class="group-title">Archivées</h3><div class="row-actions">${archived.map(e => `<button class="btn sm ghost" data-act="env" data-id="${e.id}">${icon(e.icon)} ${esc(e.name)}</button>`).join('')}</div>` : ''}`;
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
      <div class="card-head" style="margin-bottom:6px"><span class="t">${g.priority}. ${esc(g.name)}</span><span class="num">${g.target ? `${money(have)} / ${money(g.target)}` : '<span class="muted">prix à définir</span>'}</span></div>
      <div class="bar"><i style="width:${w}%"></i></div></div>
      ${ready ? `<button class="btn sm primary" data-act="buy" data-id="${g.id}">${icon('check')} Acheter</button>` : ''}
      <button class="icon-btn" data-act="goal" data-id="${g.id}" aria-label="Modifier">${icon('pencil')}</button></div>`;
  };
  return `<div class="page-head"><h1>Objectifs</h1><button class="btn primary" data-act="goal">${icon('plus')} Objectif</button></div>
  <p class="muted lead">Les objectifs sont financés par l'argent de leur enveloppe, dans l'ordre de priorité. Quand la barre est pleine, tu peux acheter <b>sans toucher au reste</b>.
  ${totalLeft ? ` Il manque encore <b>${money(totalLeft)}</b> au total.` : ''}</p>
  ${byEnv.map(id => { const e = envById(id); return `<div class="card" style="margin-bottom:14px"><div class="card-head"><h2 class="with-tile">${tile(e?.icon || 'folder', e?.color)} ${esc(e?.name || 'Enveloppe supprimée')}</h2><span class="chip">dispo ${money(C.env[id] || 0)}</span></div>${open.filter(g => g.envelopeId === id).sort((a, b) => a.priority - b.priority).map(row).join('')}</div>`; }).join('')}
  ${!open.length ? `<div class="card empty">${icon('target')}<p>Aucun objectif en cours. Ajoute ce que tu veux acheter ou atteindre.</p></div>` : ''}
  ${done.length ? `<h3 class="group-title">Achetés</h3><div class="card">${done.map(g => `<div class="goal done"><div class="mid"><span class="t">${esc(g.name)}</span></div><span class="num">${money(g.paid ?? g.target)}</span><button class="icon-btn" data-act="goal" data-id="${g.id}">${icon('pencil')}</button></div>`).join('')}</div>` : ''}`;
}

function viewAccounts() {
  const accs = activeAccs();
  const archived = S.accounts.filter(a => a.archived);
  return `<div class="page-head"><h1>Comptes</h1><div class="row-actions"><button class="btn" data-act="transfer">${icon('arrow-left-right')} Transfert</button><button class="btn primary" data-act="acc">${icon('plus')} Compte</button></div></div>
  <p class="muted lead">Où se trouve physiquement ton argent. Vérifie de temps en temps que les soldes correspondent à la réalité et utilise « Ajuster » si besoin.</p>
  <div class="grid kpis"><div class="card kpi accent"><div class="label">${icon('landmark')} Total</div><div class="value">${countVal(C.total)}</div></div></div>
  <div class="grid env-grid">${accs.map(a => `<div class="card lift">
    <div class="env-top">${tile(a.icon)}<span class="name ellipsis">${esc(a.name)}</span><button class="icon-btn" data-act="acc" data-id="${a.id}" aria-label="Modifier">${icon('pencil')}</button></div>
    <div class="bal num">${money(C.acc[a.id])}</div>
    <div class="meta">${ACC_TYPES[a.type] || ''} · départ ${money(a.initial)}</div>
    <div class="row-actions"><button class="btn sm" data-act="adjust" data-id="${a.id}">${icon('scale')} Ajuster</button><button class="btn sm ghost" data-act="acc-tx" data-id="${a.id}">${icon('receipt')} Opérations</button></div>
  </div>`).join('')}</div>
  ${archived.length ? `<h3 class="group-title">Archivés</h3><div class="row-actions">${archived.map(a => `<button class="btn sm ghost" data-act="acc" data-id="${a.id}">${icon(a.icon)} ${esc(a.name)}</button>`).join('')}</div>` : ''}`;
}

/* ---------- Annual report ---------- */

function viewReports() {
  const y = curYear, ys = yearStats(y), prev = yearStats(y - 1);
  const now = monthOf(today());
  const months = [...Array(12)].map((_, i) => `${y}-${pad(i + 1)}`);
  const fm = firstMonth();
  const rows = months.map(m => { const s = monthStats(m); return { m, inc: s.income, exp: s.expense, untracked: s.untracked }; });
  const active = rows.filter(r => fm && r.m >= fm && r.m <= now);
  const saved = ys.income - ys.expense;
  const avgInc = active.length ? Math.round(active.reduce((s, r) => s + r.inc, 0) / active.length) : 0;
  const avgExp = active.length ? Math.round(active.reduce((s, r) => s + r.exp, 0) / active.length) : 0;
  const best = active.length ? active.reduce((a, b) => (b.inc > a.inc ? b : a)) : null;
  const worst = active.length ? active.reduce((a, b) => (b.inc < a.inc ? b : a)) : null;
  const fees = ys.fees + ys.transferFees;
  const evo = (a, b) => (b ? `<span class="${a >= b ? 'pos' : 'neg'}">${a >= b ? '▲' : '▼'} ${Math.abs(pct(a - b, Math.abs(b)))} %</span> vs ${y - 1}` : `pas de données ${y - 1}`);
  const evoExp = (a, b) => (b ? `<span class="${a <= b ? 'pos' : 'neg'}">${a >= b ? '▲' : '▼'} ${Math.abs(pct(a - b, b))} %</span> vs ${y - 1}` : `pas de données ${y - 1}`);

  // Net worth at the end of each month.
  const initial = S.accounts.reduce((s, a) => s + (a.initial || 0), 0);
  const wealth = months.filter(m => fm && m >= fm && m <= now).map(m => {
    const end = m + '-31';
    const v = initial + S.tx.reduce((s, t) => (t.date <= end ? s + wealthFlow(t) : s), 0);
    return { label: monthLabel(m, true), v, title: `${monthLabel(m)} : ${money(v)}` };
  });

  const sources = Object.entries(ys.bySource).sort((a, b) => b[1] - a[1]);
  const envRows = S.envelopes.map(e => ({ e, v: ys.byEnv[e.id] || 0 })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  const nbMonths = Math.max(1, active.length);
  const topExp = S.tx.filter(t => t.type === 'expense' && t.date.startsWith(y + '-')).sort((a, b) => b.amount - a.amount).slice(0, 10);
  let cumul = 0;

  if (!S.tx.some(t => t.date.startsWith(y + '-'))) {
    return `<div class="page-head"><h1>Rapport ${y}</h1>${navArrows(String(y), 'y-prev', 'y-next')}</div>
      <div class="card empty">${icon('chart-column')}<p>Aucune opération en ${y}.</p></div>`;
  }

  return `<div class="page-head"><h1>Rapport ${y}</h1><div class="row-actions">${navArrows(String(y), 'y-prev', 'y-next')}
    <button class="btn" data-act="print">${icon('printer')} Imprimer / PDF</button><button class="btn" data-act="csv-year">${icon('file-spreadsheet')} CSV</button></div></div>
  <div class="grid kpis">
    <div class="card kpi"><div class="label">${icon('arrow-down-left')} Revenus nets</div><div class="value pos">${countVal(ys.income)}</div><div class="sub">${evo(ys.income, prev.income)}</div></div>
    <div class="card kpi"><div class="label">${icon('arrow-up-right')} Dépenses</div><div class="value neg">${countVal(ys.expense)}</div><div class="sub">${evoExp(ys.expense, prev.expense)}</div></div>
    <div class="card kpi accent"><div class="label">${icon('piggy-bank')} Gardé (revenus − dépenses)</div><div class="value ${saved < 0 ? 'neg' : ''}">${countVal(saved, 'signed')}</div><div class="sub">taux d'épargne ${pct(saved, ys.income)} %</div></div>
    <div class="card kpi"><div class="label">${icon('calendar')} Par mois (moyenne)</div><div class="value">${money(avgInc)}</div><div class="sub">dépenses ${money(avgExp)}/mois</div></div>
    <div class="card kpi"><div class="label">${icon('hand-coins')} Frais payés</div><div class="value">${money(fees)}</div><div class="sub">${pct(fees, ys.income + ys.fees)} % de tes revenus bruts</div></div>
    <div class="card kpi"><div class="label">${icon('scale')} Argent non tracé</div><div class="value ${ys.untracked ? 'neg' : ''}">${money(ys.untracked)}</div><div class="sub">${ys.untracked ? 'à réduire à zéro' : 'bravo, tout est noté'}</div></div>
  </div>
  <div class="grid cols-2">
    <div class="card"><h2>Revenus et dépenses par mois</h2>${barsChart(rows.map(r => ({ m: r.m, inc: r.inc, exp: r.exp })), { link: true })}
      <div class="legend"><span><i style="background:var(--inc)"></i>Revenus nets</span><span><i style="background:var(--exp)"></i>Dépenses</span><span>Clique sur un mois pour le détail</span></div>
      ${best ? `<p class="hint" style="margin-top:10px">Meilleur mois : <b>${monthLabel(best.m)}</b> (${money(best.inc)}) · Plus faible : <b>${monthLabel(worst.m)}</b> (${money(worst.inc)}).</p>` : ''}</div>
    <div class="card"><h2>Évolution du patrimoine</h2>${wealth.length ? lineChart(wealth) : '<p class="muted">Pas encore de données.</p>'}
      ${wealth.length ? `<p class="hint" style="margin-top:10px">Fin ${wealth[wealth.length - 1].label} : <b>${money(wealth[wealth.length - 1].v)}</b></p>` : ''}</div>
  </div>
  <div class="grid cols-2">
    <div class="card"><h2>Revenus par source</h2>
      ${sources.length ? sources.map(([s, v]) => hbar(`${esc(s)} <small class="muted">${pct(v, ys.income)} %${prev.bySource[s] ? ` · ${y - 1} : ${money(prev.bySource[s])}` : ''}</small>`, Math.abs(v), Math.max(...sources.map(x => Math.abs(x[1]))), { right: signed(v), over: v < 0 })).join('') : '<p class="muted">Aucun revenu.</p>'}
      <p class="hint">${ys.incomeCount} rentrée(s) d'argent cette année.</p></div>
    <div class="card"><h2>Dépenses par enveloppe</h2>
      <div class="table-wrap"><table class="table"><thead><tr><th>Enveloppe</th><th>Total</th><th>Moy./mois</th><th>Budget</th></tr></thead><tbody>
      ${envRows.map(({ e, v }) => { const avg = Math.round(v / nbMonths); return `<tr><td><span class="cell-name">${tile(e.icon, e.color, 'xs')}${esc(e.name)}</span></td><td class="num">${money(v)}</td><td class="num">${money(avg)}</td><td class="num ${e.target && avg > e.target ? 'neg' : ''}">${e.target ? money(e.target) : '—'}</td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">Aucune dépense.</td></tr>'}
      </tbody></table></div></div>
  </div>
  <div class="card" style="margin-bottom:14px"><h2>Mois par mois</h2>
      <div class="table-wrap"><table class="table"><thead><tr><th>Mois</th><th>Revenus</th><th>Dépenses</th><th>Solde</th><th>Cumul</th></tr></thead><tbody>
      ${rows.filter(r => r.inc || r.exp).map(r => { const b = r.inc - r.exp; cumul += b; return `<tr class="clickable" data-act="open-month" data-m="${r.m}"><td>${monthLabel(r.m)}</td><td class="num pos">${money(r.inc)}</td><td class="num neg">${money(r.exp)}</td><td class="num ${b < 0 ? 'neg' : ''}">${signed(b)}</td><td class="num">${signed(cumul)}</td></tr>`; }).join('')}
      </tbody></table></div></div>
  <div class="card"><h2>Plus grosses dépenses</h2>${topExp.length ? topExp.map(txRow).join('') : '<p class="muted">Aucune dépense.</p>'}</div>`;
}

/* ---------- Guide ---------- */

function viewGuide() {
  const sec = (ic, title, body, open = false) => `<details class="card guide" ${open ? 'open' : ''}><summary>${tile(ic)}<h2>${title}</h2>${icon('chevron-right', 'chev')}</summary><div class="guide-body">${body}</div></details>`;
  return `<div class="page-head"><h1>Guide</h1></div>
  <p class="muted lead">Tout ce qu'il faut savoir pour suivre chaque centime, même avec des revenus irréguliers.</p>
  ${sec('lightbulb', 'Le principe : les enveloppes', `
    <p>Imagine que tu ranges ton argent dans des enveloppes : une pour le loyer, une pour les études, une pour le fonds d'urgence…</p>
    <ol class="steps">
      <li><b>Un revenu arrive</b> (Upwork, trading…) : il va dans « Non réparti ».</li>
      <li><b>Tu le répartis</b> dans tes enveloppes. Le mode <b>« Besoins d'abord »</b> remplit d'abord les budgets essentiels du mois (loyer, factures…), puis partage le reste selon tes pourcentages.</li>
      <li><b>Chaque dépense sort d'une enveloppe.</b> Si une enveloppe est vide, tu le vois tout de suite et tu dois décider consciemment où prendre l'argent (bouton « Déplacer »).</li>
    </ol>
    <p>Résultat : chaque centime a une mission, et tu sais exactement combien tu peux dépenser pour chaque chose.</p>`, true)}
  ${sec('sparkles', 'Bien démarrer (10 minutes)', `
    <ol class="steps">
      <li><b>Comptes</b> : crée un compte pour chaque endroit où se trouve ton argent (Upwork, Payoneer, mobile money, espèces, trading…) avec son <b>solde actuel</b>.</li>
      <li><b>Enveloppes</b> : adapte la liste à ta vie, puis indique le <b>budget mensuel</b> de chaque poste fixe (loyer, factures, études…) et un <b>pourcentage</b> pour le reste (épargne, investissement, loisirs…).</li>
      <li><b>Répartis</b> l'argent que tu as déjà (il est dans « Non réparti »).</li>
      <li><b>Objectifs</b> : ajoute ce que tu veux acheter (écran, casque…) avec son prix.</li>
    </ol>`)}
  ${sec('receipt', 'Au quotidien', `
    <ul class="steps">
      <li>Appuie sur <b>+</b> à chaque dépense, <b>au moment où tu la fais</b>. 10 secondes, même pour 1 centime.</li>
      <li>À chaque paiement reçu : <b>+ → Revenu</b>, avec les <b>frais</b> (commission Upwork, retrait). Puis répartis.</li>
      <li>Retrait Upwork vers mobile money, dépôt sur le compte de trading : <b>+ → Transfert</b>. Ce n'est ni un revenu ni une dépense.</li>
      <li>Perte de trading : <b>+ → Revenu</b> en cochant « C'est une perte ».</li>
      <li>Une fois par semaine : <b>Comptes → Ajuster</b> pour vérifier que les soldes correspondent à la réalité. L'écart s'affiche comme « argent non tracé ».</li>
    </ul>`)}
  ${sec('trending-up', 'Conseils pour des revenus irréguliers', `
    <ul class="steps">
      <li><b>Vis sur ton mois le plus faible</b>, pas sur ta moyenne. Le tableau de bord t'affiche les deux.</li>
      <li><b>Fonds d'urgence d'abord</b> : vise 3 à 6 mois de besoins. L'indicateur « Coussin de sécurité » te dit où tu en es.</li>
      <li>Les bons mois, <b>remplis d'avance</b> les budgets du mois suivant plutôt que de dépenser plus.</li>
      <li>Regarde le <b>rapport annuel</b> : frais payés, argent non tracé, enveloppes qui dépassent souvent.</li>
    </ul>`)}
  ${sec('cloud', 'Synchroniser téléphone et PC + sauvegardes automatiques', `
    <p>Gratuit, avec un petit script dans <b>ton propre compte Google</b>. Personne d'autre ne voit tes données. Le script :</p>
    <ul class="steps"><li>garde tes données dans Google Drive, dossier <b>« Mes Finances »</b> ;</li><li>fait une <b>copie chaque jour</b> (les 30 dernières) ;</li><li>t'envoie ta sauvegarde <b>par e-mail chaque dimanche</b>.</li></ul>
    <h3>Installation sur le premier appareil</h3>
    <ol class="steps">
      <li>Dans l'app : <b>Réglages → Synchronisation → Copier mon script</b>. Il contient une clé secrète unique, générée pour toi.</li>
      <li>Va sur <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com</a> (connecté à ton compte Google). Un nouveau projet s'ouvre : <b>efface tout</b>, colle le script, puis clique sur l'icône <b>Enregistrer</b>.</li>
      <li>En haut, choisis la fonction <code>setup</code> puis clique sur <b>Exécuter</b>. Google demande une autorisation :
        <b>Examiner les autorisations</b> → ton compte → <b>Paramètres avancés</b> → <b>Accéder au projet (non sécurisé)</b> → <b>Autoriser</b>.
        <br><small class="muted">Ce message apparaît parce que c'est ton propre script, non vérifié par Google. C'est normal.</small></li>
      <li>Clique sur <b>Déployer → Nouveau déploiement</b>. Type : <b>Application Web</b>. Exécuter en tant que : <b>Moi</b>. Qui a accès : <b>Tout le monde</b>. Clique sur <b>Déployer</b> et <b>copie l'URL</b> de l'application Web.</li>
      <li>Reviens dans l'app, colle l'URL et clique sur <b>Connecter</b>.</li>
    </ol>
    <h3>Ajouter ton téléphone (ou un autre PC)</h3>
    <ol class="steps"><li>Sur le premier appareil : <b>Réglages → Ajouter un appareil</b> → copie le code.</li><li>Sur le nouvel appareil : ouvre l'app → <b>Réglages → Synchronisation → J'ai déjà configuré</b> → colle le code → Connecter.</li></ol>
    <h3>Comment ça marche hors ligne</h3>
    <p>Tout est d'abord enregistré sur l'appareil, donc l'app marche sans internet. Les changements sont envoyés dès que la connexion revient. Si tu as modifié des choses sur deux appareils en même temps, <b>tout est fusionné</b> : rien n'est perdu. L'indicateur en haut affiche l'état (synchronisé, en attente, hors ligne).</p>
    <p class="muted">« Tout le monde » signifie que l'adresse est joignable, mais le script refuse toute demande sans ta clé secrète. Ne partage jamais ton script ni ton code de connexion.</p>`)}
  ${sec('smartphone', "Installer l'app sur ton téléphone", `
    <ul class="steps">
      <li><b>Android (Chrome)</b> : ouvre l'adresse de l'app → menu ⋮ → <b>Ajouter à l'écran d'accueil</b> (ou « Installer l'application »).</li>
      <li><b>iPhone (Safari)</b> : bouton Partager → <b>Sur l'écran d'accueil</b>.</li>
      <li><b>PC (Chrome / Edge)</b> : icône d'installation dans la barre d'adresse.</li>
    </ul>
    <p>Une fois installée, elle s'ouvre comme une vraie application et fonctionne sans internet.</p>`)}
  ${sec('shield-check', 'Confidentialité : qui voit mes données ?', `
    <ul class="steps">
      <li>Le site ne contient <b>que le programme</b>, aucune donnée. Chaque personne qui l'ouvre a sa propre app vide, dans son propre navigateur.</li>
      <li>Tes données sont dans <b>ton navigateur</b>, et dans <b>ton Google Drive</b> si tu actives la synchro. Rien ne passe par un serveur tiers.</li>
      <li>Les fichiers d'export ne contiennent pas ta clé de synchronisation.</li>
      <li>Garde ton téléphone verrouillé : quelqu'un qui a ton appareil déverrouillé peut ouvrir l'app.</li>
    </ul>`)}
  ${sec('users', "Utiliser l'app pour toi aussi (amis, famille)", `
    <p>Tu peux partager l'adresse de l'app sans crainte : chacun obtient <b>sa propre app vide</b>, sans accès aux données des autres.</p>
    <ol class="steps">
      <li>Ouvre le lien et installe l'app sur ton téléphone (voir plus haut).</li>
      <li>Suis « Bien démarrer », puis configure ta propre synchronisation avec <b>ton</b> compte Google si tu veux.</li>
      <li>Pour héberger ta propre copie : télécharge le dossier de l'app et dépose-le sur <a href="https://app.netlify.com/drop" target="_blank" rel="noopener">Netlify Drop</a>, GitHub Pages ou Cloudflare Pages (gratuit).</li>
    </ol>`)}
  ${sec('circle-help', 'Questions fréquentes', `
    <p><b>J'ai changé de téléphone, je perds tout ?</b><br>Non : avec la synchro, connecte le nouveau téléphone avec ton code. Sans synchro, importe ta dernière sauvegarde (Réglages → Importer).</p>
    <p><b>Je me suis trompé dans une opération.</b><br>Touche-la dans la liste pour la modifier ou la supprimer.</p>
    <p><b>Une enveloppe est en négatif.</b><br>Tu as dépensé plus que prévu. Utilise « Déplacer » pour prendre l'argent dans une autre enveloppe : c'est là que tu vois ce que coûte vraiment cette dépense.</p>
    <p><b>Dans quelle devise ?</b><br>Choisis-la dans Réglages. Si tu reçois en USD mais dépenses en CDF, choisis la devise dans laquelle tu penses ton budget et convertis au moment de noter.</p>`)}`;
}

/* ---------- Settings ---------- */

function viewSettings() {
  const s = S.settings;
  const cur = CURRENCIES.includes(s.currency) ? CURRENCIES : [s.currency, ...CURRENCIES];
  return `<div class="page-head"><h1>Réglages</h1></div>
  <div class="grid cols-2">
    ${syncSection()}
    <div class="card"><h2>${icon('download')} Sauvegarde manuelle</h2>
      <p class="muted">Tes données sont stockées dans ce navigateur${syncOn() ? ' et synchronisées avec ton Google Drive' : ', <b>uniquement sur cet appareil</b>'}.
      Tu peux aussi exporter un fichier de sauvegarde (Drive, clé USB, e-mail à toi-même).</p>
      <p class="muted">Dernier export : <b>${s.lastBackup ? new Date(s.lastBackup).toLocaleString('fr-FR') : 'jamais'}</b></p>
      <div class="row-actions">
        <button class="btn primary" data-act="export">${icon('download')} Exporter (JSON)</button>
        <button class="btn" data-act="import">${icon('upload')} Importer</button>
        <button class="btn" data-act="csv">${icon('file-spreadsheet')} CSV (Excel)</button>
      </div>
    </div>
    <div class="card"><h2>${icon('settings')} Préférences</h2>
      ${field('Devise', `<select data-set="currency">${cur.map(c => `<option ${c === s.currency ? 'selected' : ''}>${c}</option>`).join('')}</select>`, 'Utilise la devise dans laquelle tu penses ton budget.')}
      ${field('Thème', `<select data-set="theme">${Object.entries({ auto: 'Automatique', light: 'Clair', dark: 'Sombre' }).map(([k, v]) => `<option value="${k}" ${k === s.theme ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
      ${field('Sources de revenus (une par ligne)', `<textarea data-set="sources" rows="4">${esc(s.sources.join('\n'))}</textarea>`)}
    </div>
    <div class="card"><h2>${icon('triangle-alert')} Zone dangereuse</h2>
      <p class="muted">Efface toutes les données et repars de zéro. Exporte d'abord une sauvegarde !${syncOn() ? ' <b>Avec la synchro active, l\'effacement sera aussi appliqué à tes autres appareils.</b>' : ''}</p>
      <button class="btn danger" data-act="reset">${icon('trash-2')} Tout effacer</button>
    </div>
  </div>`;
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
  download(`mes-finances-sauvegarde-${today()}.json`, JSON.stringify(S, null, 1), 'application/json');
  commit('Sauvegarde exportée');
}
function exportCSV(year) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const types = { expense: 'Dépense', income: 'Revenu', transfer: 'Transfert', alloc: 'Répartition', adjust: 'Ajustement' };
  const rows = [['Date', 'Type', 'Montant', 'Frais', 'Source', 'Enveloppe', 'Compte', 'Vers compte', 'Note']];
  const list = year ? S.tx.filter(t => t.date.startsWith(year + '-')) : S.tx;
  for (const t of sortedTx(list).reverse()) {
    if (t.type === 'alloc') {
      for (const l of t.lines) rows.push([t.date, types.alloc, num(l.amount), '', '', envById(l.envelopeId)?.name, '', '', t.note]);
      continue;
    }
    const amt = t.type === 'expense' ? -t.amount : t.amount;
    rows.push([t.date, types[t.type], num(amt), t.fee ? num(t.fee) : '', t.source, envById(t.envelopeId)?.name, accById(t.accountId)?.name, accById(t.toAccountId)?.name, t.note]);
  }
  download(`mes-finances-operations-${year || today()}.csv`, '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  toast('CSV exporté');
}
function importJSON(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.tx) || !Array.isArray(d.envelopes) || !Array.isArray(d.accounts)) throw new Error('fichier non reconnu');
      if (!confirm(`Importer cette sauvegarde (${d.tx.length} opérations) ? Les données actuelles seront remplacées${syncOn() ? ', aussi sur tes autres appareils synchronisés' : ''}.`)) return;
      const keep = { theme: S.settings.theme };
      S = migrate(d); Object.assign(S.settings, keep);
      buildFmt(); applyTheme(); commit('Sauvegarde importée');
    } catch (e) { toast('Import impossible : ' + e.message); }
  };
  r.readAsText(file);
}

/* ---------- Rendering & events ---------- */

// [view, icon, label, shown in the bottom bar on mobile]
const NAV = [
  ['dashboard', 'layout-dashboard', 'Accueil', 1], ['tx', 'receipt', 'Opérations', 1], ['envelopes', 'wallet-cards', 'Enveloppes', 1], ['reports', 'chart-column', 'Rapports', 1],
  ['goals', 'target', 'Objectifs'], ['accounts', 'landmark', 'Comptes'], ['settings', 'settings', 'Réglages'], ['guide', 'book-open', 'Guide'],
];
const VIEWS = { dashboard: viewDashboard, tx: viewTx, envelopes: viewEnvelopes, reports: viewReports, goals: viewGoals, accounts: viewAccounts, settings: viewSettings, guide: viewGuide };

function render() {
  C = calc();
  const secondary = !NAV.find(n => n[0] === view)?.[3];
  $('#nav').innerHTML = NAV.map(([k, i, l, main]) => `<button class="${k === view ? 'on' : ''} ${main ? '' : 'secondary'}" data-act="go" data-view="${k}">${icon(i)}<span>${l}</span></button>`).join('')
    + `<button class="more ${secondary ? 'on' : ''}" data-act="more">${icon('ellipsis')}<span>Plus</span></button>`;
  const main = $('#main');
  main.innerHTML = VIEWS[view]();
  main.classList.toggle('enter', entering);
  if (view === 'tx') renderTxList();
  if (entering) { runCounters(); entering = false; }
  updateSyncPill();
}

function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

function go(v) {
  view = VIEWS[v] ? v : 'dashboard';
  if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
  entering = true;
  render(); window.scrollTo(0, 0);
}

function openMore() {
  openModal('Menu', `<div class="quick">${NAV.filter(n => !n[3]).map(([k, i, l]) => `<button type="button" data-go="${k}">${tile(i)}${l}</button>`).join('')}</div>`, null);
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
    case 'm-prev': curMonth = shiftMonth(curMonth, -1); render(); break;
    case 'm-next': curMonth = shiftMonth(curMonth, 1); render(); break;
    case 'y-prev': curYear--; entering = true; render(); break;
    case 'y-next': curYear++; entering = true; render(); break;
    case 'open-month': curMonth = b.dataset.m; go('dashboard'); break;
    case 'tx': openTx(S.tx.find(t => t.id === id)); break;
    case 'alloc': openAllocate(); break;
    case 'move': openMove(id); break;
    case 'transfer': openTransfer(); break;
    case 'spend': openExpense(null, { envelopeId: id }); break;
    case 'env': openEnvelope(envById(id)); break;
    case 'acc': openAccount(accById(id)); break;
    case 'adjust': openAdjust(accById(id)); break;
    case 'acc-tx': Object.assign(txFilter, { type: '', env: '', acc: id, q: '' }); go('tx'); break;
    case 'goal': openGoal(S.goals.find(g => g.id === id)); break;
    case 'buy': { const g = S.goals.find(x => x.id === id); openExpense(null, { goalId: g.id, envelopeId: g.envelopeId, amount: g.target, note: g.name }); break; }
    case 'export': exportJSON(); break;
    case 'csv': exportCSV(); break;
    case 'csv-year': exportCSV(curYear); break;
    case 'print': window.print(); break;
    case 'import': $('#import-file').click(); break;
    case 'reset':
      if (prompt('Tape EFFACER pour tout supprimer définitivement :') === 'EFFACER') { const theme = S.settings.theme; S = defaults(); S.settings.theme = theme; buildFmt(); applyTheme(); commit('Données effacées'); }
      break;
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
    S.settings.sources = list.length ? [...new Set(list)] : ['Autre'];
  } else S.settings[k] = e.target.value;
  buildFmt(); applyTheme(); commit('Réglage enregistré');
});

$('#import-file').addEventListener('change', e => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ''; });
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v !== view) go(v); });
// If the app is open in another tab, stay in sync.
window.addEventListener('storage', e => { if (e.key === KEY) { S = load(); snap = snapshot(); buildFmt(); render(); } });

buildFmt();
applyTheme();
view = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard';
render();
initSync();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
navigator.storage?.persist?.().catch(() => {});
