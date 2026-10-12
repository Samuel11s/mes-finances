'use strict';
/*
 * Mes Finances (My Finances) — personal finance tracking for irregular income.
 * Envelope method: every income lands in "Unassigned", then it is assigned
 * to envelopes (rent, studies, emergency fund…). Every expense comes out of an envelope.
 * All data stays on the device (localStorage). Amounts are stored in cents (integers).
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

/* ---------- Data ---------- */

function defaults() {
  const envs = [
    ['Loyer', '🏠', 'Charges fixes', 20, 'normal'],
    ['Factures (eau, électricité, internet)', '💡', 'Charges fixes', 8, 'normal'],
    ['Maison (entretien, ménage)', '🧹', 'Charges fixes', 6, 'normal'],
    ['Besoins courants (nourriture, transport)', '🛒', 'Vie courante', 15, 'normal'],
    ['Études (frais, livres, cours)', '🎓', 'Études', 10, 'normal'],
    ['Entretien voiture', '🚗', 'Voiture', 5, 'normal'],
    ['Urgence mécanique', '🔧', 'Voiture', 3, 'normal'],
    ["Fonds d'urgence", '🛟', 'Sécurité', 10, 'emergency'],
    ['Épargne', '🏦', 'Avenir', 7, 'saving'],
    ['Investissement', '📈', 'Avenir', 5, 'invest'],
    ['Setup (écran, disque, casque…)', '💻', 'Équipement', 6, 'normal'],
    ['Activités & sorties', '🎯', 'Loisirs', 3, 'normal'],
    ['Événements (anniversaires, fêtes)', '🎉', 'Loisirs', 2, 'normal'],
  ].map(([name, icon, group, percent, kind], i) => ({ id: uid() + i, name, icon, group, percent, kind, target: 0, priority: i + 1, color: COLORS[i % COLORS.length] }));
  const setup = envs[10].id;
  const accounts = [
    ['Upwork', '💼', 'platform'], ['Compte de trading', '📊', 'trading'], ['Espèces', '💵', 'cash'], ['Mobile money', '📱', 'mobile'],
  ].map(([name, icon, type], i) => ({ id: uid() + 'a' + i, name, icon, type, initial: 0 }));
  const goals = ['Disque dur externe', 'Écran externe', 'Casque', 'Table / bureau', 'Clavier', 'Téléphone']
    .map((name, i) => ({ id: uid() + 'g' + i, name, envelopeId: setup, target: 0, priority: i + 1, purchased: false }));
  return {
    version: 1,
    settings: { currency: 'USD', sources: ['Upwork', 'Trading', 'Autre'], theme: 'auto', lastBackup: null, lastAccount: null, lastEnv: null },
    accounts, envelopes: envs, goals, tx: [],
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
  for (const k of ['accounts', 'envelopes', 'goals', 'tx']) if (!Array.isArray(d[k])) d[k] = [];
  return d;
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Erreur de sauvegarde : ' + e.message); }
}
function commit(msg) { persist(); render(); if (msg) toast(msg); }

let S = load();
let C = null;              // computed balances
let view = 'dashboard';
let curMonth = monthOf(today());
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

function monthStats(m) {
  const r = { income: 0, fees: 0, bySource: {}, expense: 0, byEnv: {}, alloc: {}, transferFees: 0, untracked: 0 };
  for (const t of S.tx) {
    if (monthOf(t.date) !== m) continue;
    if (t.type === 'income') {
      r.income += txNet(t); r.fees += t.fee || 0;
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
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2600);
}

function openModal(title, body, onSubmit, opts = {}) {
  const d = $('#modal');
  d.innerHTML = `<form class="modal-card" novalidate>
    <header><h2>${title}</h2><button type="button" class="icon-btn" data-close aria-label="Fermer">✕</button></header>
    <div class="modal-body">${body}</div>
    <div class="err" hidden></div>
    <footer>
      ${opts.onDelete ? `<button type="button" class="btn danger" data-del>${opts.deleteLabel || 'Supprimer'}</button>` : ''}
      ${opts.extra || ''}<span class="spacer"></span>
      <button type="button" class="btn ghost" data-close>${onSubmit ? 'Annuler' : 'Fermer'}</button>
      ${onSubmit ? `<button class="btn primary">${opts.submitLabel || 'Enregistrer'}</button>` : ''}
    </footer></form>`;
  const f = d.querySelector('form');
  const err = d.querySelector('.err');
  const g = n => f.elements.namedItem(n)?.value ?? '';
  const chk = n => !!f.elements.namedItem(n)?.checked;
  f.onsubmit = e => {
    e.preventDefault();
    if (!onSubmit) return d.close();
    const r = onSubmit(g, chk, f);
    if (typeof r === 'string') { err.textContent = r; err.hidden = false; return; }
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

function envOptions(sel, { withBal = true, extra = '' } = {}) {
  let h = extra;
  for (const grp of [...new Set(activeEnvs().map(e => e.group || 'Autres'))]) {
    h += `<optgroup label="${esc(grp)}">` + activeEnvs().filter(e => (e.group || 'Autres') === grp).map(e =>
      `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${e.icon} ${esc(e.name)}${withBal ? ' — ' + money(C.env[e.id]) : ''}</option>`).join('') + '</optgroup>';
  }
  // if the selected envelope is archived, keep it visible
  const s = envById(sel);
  if (s?.archived) h += `<option value="${s.id}" selected>${s.icon} ${esc(s.name)} (archivée)</option>`;
  return h;
}
function accOptions(sel) {
  let h = activeAccs().map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${a.icon} ${esc(a.name)} — ${money(C.acc[a.id])}</option>`).join('');
  const s = accById(sel);
  if (s?.archived) h += `<option value="${s.id}" selected>${s.icon} ${esc(s.name)} (archivé)</option>`;
  return h;
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
    <button type="button" data-q="expense"><b>💸</b>Dépense</button>
    <button type="button" data-q="income"><b>💰</b>Revenu</button>
    <button type="button" data-q="alloc"><b>✉️</b>Répartir</button>
    <button type="button" data-q="transfer"><b>🔁</b>Transfert</button>
  </div>`, null);
  $$('[data-q]', $('#modal')).forEach(b => b.onclick = () => {
    $('#modal').close();
    setTimeout(() => ({ expense: openExpense, income: openIncome, alloc: openAllocate, transfer: openTransfer })[b.dataset.q](), 30);
  });
}

function openExpense(t, preset = {}) {
  if (!activeAccs().length) return toast("Ajoute d'abord un compte");
  const e = t || {
    date: today(), amount: preset.amount || 0, note: preset.note || '',
    accountId: accById(S.settings.lastAccount) && !accById(S.settings.lastAccount).archived ? S.settings.lastAccount : activeAccs()[0].id,
    envelopeId: preset.envelopeId || S.settings.lastEnv,
  };
  openModal(t ? 'Modifier la dépense' : (preset.goalId ? 'Acheter : ' + esc(preset.note) : 'Nouvelle dépense'), `
    ${field('Montant', amountInput('amount', e.amount, 'autofocus'))}
    ${field('Enveloppe (pour quoi ?)', `<select name="envelopeId">${envOptions(e.envelopeId)}</select>`, 'Le montant affiché est ce qu\'il reste dans chaque enveloppe.')}
    ${field('Payé depuis', `<select name="accountId">${accOptions(e.accountId)}</select>`)}
    <div class="two">
      ${field('Date', `<input type="date" name="date" value="${e.date}">`)}
      ${field('Note', `<input name="note" value="${esc(e.note)}" placeholder="ex. carburant, marché…">`)}
    </div>`, g => {
    const amount = toCents(g('amount'));
    if (!(amount > 0)) return 'Entre un montant valide.';
    const data = { type: 'expense', amount, envelopeId: g('envelopeId'), accountId: g('accountId'), date: g('date') || today(), note: g('note').trim() };
    if (preset.goalId) data.goalId = preset.goalId;
    upsertTx(t, data);
    if (preset.goalId) { const goal = S.goals.find(x => x.id === preset.goalId); if (goal) { goal.purchased = true; goal.paid = amount; } }
    S.settings.lastAccount = data.accountId; S.settings.lastEnv = data.envelopeId;
    const left = C.env[data.envelopeId] - amount + (t && t.envelopeId === data.envelopeId ? t.amount : 0);
    commit(left < 0 ? `⚠️ Enveloppe à découvert de ${money(-left)}` : (t ? 'Dépense modifiée' : 'Dépense enregistrée'));
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
    ${field('Explication (facultatif)', `<input name="note" placeholder="ex. dépenses non notées cette semaine">`)}
    <p class="hint" id="diff-line"></p>`, g => {
    const real = toCents(g('real'));
    if (Number.isNaN(real) || g('real').trim() === '') return 'Entre le solde réel.';
    const diff = real - cur;
    if (diff === 0) return () => toast('Le solde est déjà juste 👍');
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
  const m = monthOf(today());
  const allocM = monthStats(m).alloc;
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
    return need > 0 ? `manque ${money(need)} ce mois · ${e.percent || 0} %` : `budget du mois atteint ✓ · ${e.percent || 0} %`;
  };
  const f = openModal('Répartir mon argent', `
    <div class="alert info"><span class="grow">Disponible à répartir</span><b class="num">${money(avail)}</b></div><br>
    ${field('Montant à répartir', amountInput('total', Math.max(0, Math.min(preAmount ?? avail, avail))))}
    <div class="seg">${Object.entries({ needs: "Besoins d'abord", pct: 'Pourcentages', manual: 'Manuel' }).map(([k, v]) => `<button type="button" data-mode="${k}">${v}</button>`).join('')}</div>
    <p class="hint" id="mode-hint"></p>
    <div>${envs.map(e => `<div class="alloc-row"><span class="ellipsis">${e.icon} ${esc(e.name)}<small>${needText(e)}</small></span><input data-env="${e.id}" inputmode="decimal" placeholder="0,00"></div>`).join('')}</div>
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
    const lines = [];
    if (from) lines.push({ envelopeId: from, amount: -amount });
    if (to) lines.push({ envelopeId: to, amount });
    if (!from && amount > C.unalloc) return `Il n'y a que ${money(C.unalloc)} de non réparti.`;
    upsertTx(null, { type: 'alloc', date: today(), lines, note: 'Déplacement' });
    commit('Argent déplacé');
  }, { submitLabel: 'Déplacer' });
}

function openAllocTx(t) {
  const body = t.lines.map(l => { const e = envById(l.envelopeId); return `<div class="alloc-row"><span>${e?.icon || ''} ${esc(e?.name || 'Enveloppe supprimée')}</span><b class="num ${l.amount < 0 ? 'neg' : ''}" style="text-align:right">${signed(l.amount)}</b></div>`; }).join('');
  openModal(`${esc(t.note || 'Répartition')} du ${dayLabel(t.date)}`, body + '<p class="hint" style="margin-top:12px">Supprimer annule cette répartition : l\'argent revient dans « Non réparti ».</p>', null,
    { onDelete: () => deleteTx(t), deleteLabel: 'Annuler la répartition', confirmDelete: 'Annuler cette répartition ?' });
}

function openTx(t) {
  ({ expense: openExpense, income: openIncome, transfer: openTransfer, alloc: openAllocTx, adjust: x => openModal('Ajustement de solde', `<p>${esc(accById(x.accountId)?.name)} : <b>${signed(x.amount)}</b></p><p class="muted">${esc(x.note)}</p>`, null, { onDelete: () => deleteTx(x) }) })[t.type](t);
}

function openEnvelope(e) {
  const isNew = !e;
  e = e || { name: '', icon: '📁', group: 'Vie courante', percent: 0, target: 0, kind: 'normal', priority: S.envelopes.length + 1, color: COLORS[S.envelopes.length % COLORS.length] };
  const used = !isNew && (S.tx.some(t => t.envelopeId === e.id || t.lines?.some(l => l.envelopeId === e.id)) || S.goals.some(g => g.envelopeId === e.id));
  const groups = [...new Set([...GROUPS, ...S.envelopes.map(x => x.group)])];
  openModal(isNew ? 'Nouvelle enveloppe' : 'Modifier l\'enveloppe', `
    <div class="two" style="grid-template-columns:80px 1fr">
      ${field('Icône', `<input name="icon" value="${esc(e.icon)}" maxlength="4">`)}
      ${field('Nom', `<input name="name" value="${esc(e.name)}" autofocus>`)}
    </div>
    ${field('Groupe', `<input name="group" list="groups" value="${esc(e.group)}"><datalist id="groups">${groups.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`)}
    <div class="two">
      ${field('Budget mensuel', amountInput('target', e.target), 'Ce dont tu as besoin chaque mois (ex. loyer). 0 = pas de budget fixe.')}
      ${field('% des revenus', `<input name="percent" type="number" min="0" max="100" step="0.5" value="${e.percent || 0}">`, 'Part de ce qui reste après les besoins.')}
    </div>
    <div class="two">
      ${field('Priorité', `<input name="priority" type="number" min="1" value="${e.priority || 1}">`, '1 = remplie en premier.')}
      ${field('Type', `<select name="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${k === e.kind ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
    </div>
    ${field('Couleur', `<input name="color" type="color" value="${e.color}" style="width:60px;height:36px;border:0;background:none">`)}`, g => {
    const target = toCents(g('target'));
    if (!g('name').trim()) return 'Donne un nom.';
    if (Number.isNaN(target) || target < 0) return 'Budget invalide.';
    const data = { name: g('name').trim(), icon: g('icon').trim() || '📁', group: g('group').trim() || 'Autres', target, percent: Math.max(0, +g('percent') || 0), priority: Math.max(1, +g('priority') || 1), kind: g('kind'), color: g('color') };
    if (isNew) S.envelopes.push({ id: uid(), ...data }); else Object.assign(e, data);
    commit(isNew ? 'Enveloppe créée' : 'Enveloppe modifiée');
  }, isNew ? {} : used
    ? { onDelete: () => { if (C.env[e.id]) return toast("Vide d'abord l'enveloppe (Déplacer)"); e.archived = !e.archived; commit(e.archived ? 'Enveloppe archivée' : 'Enveloppe restaurée'); }, deleteLabel: e.archived ? 'Restaurer' : 'Archiver', confirmDelete: e.archived ? 'Restaurer cette enveloppe ?' : 'Archiver ? Elle sera masquée mais l\'historique est conservé.' }
    : { onDelete: () => { S.envelopes = S.envelopes.filter(x => x !== e); commit('Enveloppe supprimée'); } });
}

function openAccount(a) {
  const isNew = !a;
  a = a || { name: '', icon: '💳', type: 'other', initial: 0 };
  const used = !isNew && S.tx.some(t => t.accountId === a.id || t.toAccountId === a.id);
  openModal(isNew ? 'Nouveau compte' : 'Modifier le compte', `
    <div class="two" style="grid-template-columns:80px 1fr">
      ${field('Icône', `<input name="icon" value="${esc(a.icon)}" maxlength="4">`)}
      ${field('Nom', `<input name="name" value="${esc(a.name)}" autofocus placeholder="ex. Payoneer, M-Pesa, Binance…">`)}
    </div>
    ${field('Type', `<select name="type">${Object.entries(ACC_TYPES).map(([k, v]) => `<option value="${k}" ${k === a.type ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
    ${field('Solde de départ', amountInput('initial', a.initial, 'data-allow-neg'), "L'argent présent sur ce compte au moment où tu commences le suivi. Il arrive dans « Non réparti » pour que tu le répartisses.")}`, g => {
    const initial = toCents(g('initial'));
    if (!g('name').trim()) return 'Donne un nom.';
    if (Number.isNaN(initial)) return 'Solde invalide.';
    const data = { name: g('name').trim(), icon: g('icon').trim() || '💳', type: g('type'), initial };
    if (isNew) S.accounts.push({ id: uid(), ...data }); else Object.assign(a, data);
    commit(isNew ? 'Compte ajouté' : 'Compte modifié');
  }, isNew ? {} : used
    ? { onDelete: () => { if (C.acc[a.id]) return toast("Le solde doit être à 0 pour archiver (fais un transfert)"); a.archived = !a.archived; commit(a.archived ? 'Compte archivé' : 'Compte restauré'); }, deleteLabel: a.archived ? 'Restaurer' : 'Archiver', confirmDelete: a.archived ? 'Restaurer ce compte ?' : 'Archiver ce compte ?' }
    : { onDelete: () => { S.accounts = S.accounts.filter(x => x !== a); commit('Compte supprimé'); } });
}

function openGoal(gl) {
  const isNew = !gl;
  gl = gl || { name: '', envelopeId: activeEnvs().find(e => e.group === 'Équipement')?.id || activeEnvs()[0]?.id, target: 0, priority: S.goals.length + 1 };
  openModal(isNew ? 'Nouvel objectif' : "Modifier l'objectif", `
    ${field('Quoi ?', `<input name="name" value="${esc(gl.name)}" autofocus placeholder="ex. Écran 27 pouces">`)}
    ${field('Prix / montant visé', amountInput('target', gl.target))}
    ${field('Financé par l\'enveloppe', `<select name="envelopeId">${envOptions(gl.envelopeId)}</select>`, "L'argent de l'enveloppe finance les objectifs dans l'ordre de priorité.")}
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

function barsChart(hist) {
  const W = 640, H = 260, B = 34, T = 10;
  const max = Math.max(1, ...hist.flatMap(h => [h.inc, h.exp]));
  const gw = W / hist.length, bw = Math.min(30, gw * 0.3), ph = H - T - B;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Revenus et dépenses des derniers mois">`;
  for (let i = 0; i <= 3; i++) { const y = T + ph * i / 3; s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" class="grid-line"/>`; }
  hist.forEach((h, i) => {
    const cx = gw * i + gw / 2;
    const hi = ph * Math.max(0, h.inc) / max, he = ph * h.exp / max;
    s += `<rect x="${cx - bw - 2}" y="${H - B - hi}" width="${bw}" height="${hi}" rx="4" class="b-inc"><title>${monthLabel(h.m)} — revenus ${money(h.inc)}</title></rect>`;
    s += `<rect x="${cx + 2}" y="${H - B - he}" width="${bw}" height="${he}" rx="4" class="b-exp"><title>${monthLabel(h.m)} — dépenses ${money(h.exp)}</title></rect>`;
    s += `<text x="${cx}" y="${H - 6}" text-anchor="middle" class="axis">${monthLabel(h.m, true)}</text>`;
  });
  return s + '</svg>';
}

function hbar(label, value, max, { right = money(value), over = false, color } = {}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0;
  return `<div class="hbar-row"><span class="ellipsis">${label}</span><span class="num">${right}</span>
    <div class="bar"><i class="${over ? 'over' : ''}" style="width:${pct}%;${color && !over ? `background:${color}` : ''}"></i></div></div>`;
}

/* ---------- Views ---------- */

const monthNav = () => `<div class="month-nav"><button class="icon-btn" data-act="m-prev" aria-label="Mois précédent">‹</button><span>${monthLabel(curMonth)}</span><button class="icon-btn" data-act="m-next" aria-label="Mois suivant">›</button></div>`;

function txRow(t) {
  const acc = id => esc(accById(id)?.name || '?');
  let icon, title, sub, amt, cls = '';
  switch (t.type) {
    case 'expense': { const e = envById(t.envelopeId); icon = e?.icon || '💸'; title = t.note || e?.name; sub = `${esc(e?.name || '?')} · ${acc(t.accountId)}`; amt = '−' + money(t.amount); cls = 'neg'; break; }
    case 'income': { const n = txNet(t); icon = n < 0 ? '📉' : '💰'; title = t.note || t.source; sub = `${esc(t.source)} · ${acc(t.accountId)}${t.fee ? ` · frais ${money(t.fee)}` : ''}`; amt = signed(n); cls = n < 0 ? 'neg' : 'pos'; break; }
    case 'transfer': icon = '🔁'; title = t.note || 'Transfert'; sub = `${acc(t.accountId)} → ${acc(t.toAccountId)}${t.fee ? ` · frais ${money(t.fee)}` : ''}`; amt = money(t.amount); break;
    case 'alloc': { const pos = t.lines.filter(l => l.amount > 0); icon = '✉️'; title = t.note || 'Répartition'; sub = t.lines.map(l => envById(l.envelopeId)?.icon || '').join(' '); amt = money(pos.reduce((s, l) => s + l.amount, 0)); cls = 'muted'; break; }
    case 'adjust': icon = '⚖️'; title = t.note || 'Ajustement'; sub = `Ajustement · ${acc(t.accountId)}`; amt = signed(t.amount); cls = t.amount < 0 ? 'neg' : 'pos'; break;
  }
  return `<button class="tx" data-act="tx" data-id="${t.id}"><span class="ico">${icon}</span><span class="mid"><div class="t ellipsis">${esc(title)}</div><div class="s ellipsis">${sub}</div></span><span class="amt ${cls}">${amt}</span></button>`;
}

function txList(list) {
  if (!list.length) return '<div class="empty">Aucune opération.</div>';
  let h = '', day = '';
  for (const t of sortedTx(list)) {
    if (t.date !== day) { day = t.date; h += `<div class="tx-day">${dayLabel(day)}</div>`; }
    h += txRow(t);
  }
  return h;
}

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
  if (!S.tx.length) alerts.push(`<div class="card" style="margin-bottom:14px"><h2>👋 Bienvenue ! Pour démarrer :</h2><br><ol class="steps">
    <li><b>Comptes</b> : indique combien tu as maintenant sur Upwork, ton compte de trading, en espèces, en mobile money… <button class="btn sm" data-act="go" data-view="accounts">Mes comptes</button></li>
    <li><b>Enveloppes</b> : mets le budget mensuel de chaque poste (loyer, factures, études…). <button class="btn sm" data-act="go" data-view="envelopes">Mes enveloppes</button></li>
    <li><b>Répartis</b> ton argent actuel dans les enveloppes. <button class="btn sm" data-act="alloc">Répartir</button></li>
    <li>Ensuite, à <b>chaque</b> revenu et <b>chaque</b> dépense, appuie sur <b>+</b>. Même 1 centime.</li></ol></div>`);
  if (C.unalloc > 0) alerts.push(`<div class="alert info"><span>✉️</span><span class="grow"><b>${money(C.unalloc)}</b> ne sont pas encore répartis. Donne une mission à chaque centime.</span><button class="btn sm primary" data-act="alloc">Répartir</button></div>`);
  if (C.unalloc < 0) alerts.push(`<div class="alert bad"><span>⚠️</span><span class="grow">Tu as réparti <b>${money(-C.unalloc)}</b> de plus que ce que tu possèdes. Retire cet argent d'une enveloppe.</span><button class="btn sm" data-act="move">Déplacer</button></div>`);
  for (const e of activeEnvs()) {
    if (C.env[e.id] < 0) alerts.push(`<div class="alert bad"><span>${e.icon}</span><span class="grow"><b>${esc(e.name)}</b> est à découvert de <b>${money(-C.env[e.id])}</b>. Prends dans une autre enveloppe.</span><button class="btn sm" data-act="move">Déplacer</button></div>`);
    else if (e.target && (st.byEnv[e.id] || 0) > e.target) alerts.push(`<div class="alert"><span>${e.icon}</span><span class="grow">Budget <b>${esc(e.name)}</b> dépassé ce mois : ${money(st.byEnv[e.id])} / ${money(e.target)}.</span></div>`);
  }
  if (st.untracked) alerts.push(`<div class="alert bad"><span>🕳️</span><span class="grow"><b>${money(st.untracked)}</b> d'argent non tracé ce mois (ajustements de solde). Note tes dépenses au moment où tu les fais.</span></div>`);
  if (needs && known.length >= 2 && avg < needs) alerts.push(`<div class="alert"><span>📉</span><span class="grow">Tes revenus moyens (${money(avg)}/mois) ne couvrent pas tes besoins mensuels (${money(needs)}). Réduis les budgets ou augmente les revenus.</span></div>`);
  const daysSinceBackup = S.settings.lastBackup ? (Date.now() - S.settings.lastBackup) / 864e5 : Infinity;
  if (S.tx.length >= 5 && daysSinceBackup > 7) alerts.push(`<div class="alert"><span>💾</span><span class="grow">${S.settings.lastBackup ? `Dernière sauvegarde il y a ${Math.floor(daysSinceBackup)} jours.` : 'Aucune sauvegarde encore.'} Tes données ne sont que sur cet appareil.</span><button class="btn sm" data-act="export">Sauvegarder</button></div>`);

  const sources = Object.entries(st.bySource).sort((a, b) => b[1] - a[1]);
  const srcMax = Math.max(1, ...sources.map(s => Math.abs(s[1])));
  const spend = activeEnvs().map(e => ({ e, v: st.byEnv[e.id] || 0 })).filter(x => x.v > 0 || x.e.target > 0).sort((a, b) => b.v - a.v || b.e.target - a.e.target);
  const recent = sortedTx(S.tx).slice(0, 8);

  return `
  <div class="page-head"><h1>Tableau de bord</h1>${monthNav()}</div>
  ${alerts.length ? `<div class="alerts">${alerts.join('')}</div>` : ''}
  <div class="grid kpis">
    <div class="card kpi"><div class="label">Revenus nets du mois</div><div class="value pos">${money(st.income)}</div><div class="sub">${st.fees ? `frais payés ${money(st.fees + st.transferFees)} · ` : ''}moy. ${money(avg)}/mois</div></div>
    <div class="card kpi"><div class="label">Dépenses du mois</div><div class="value neg">${money(st.expense)}</div><div class="sub">besoins prévus ${money(needs)}</div></div>
    <div class="card kpi"><div class="label">Solde du mois</div><div class="value ${balance < 0 ? 'neg' : ''}">${signed(balance)}</div><div class="sub">${st.income > 0 ? `tu as gardé ${Math.round(balance / st.income * 100)} % de tes revenus` : 'revenus − dépenses'}</div></div>
    <div class="card kpi accent"><div class="label">Patrimoine total</div><div class="value">${money(C.total)}</div><div class="sub">dont épargne + invest. ${money(future)}</div></div>
    <div class="card kpi"><div class="label">Coussin de sécurité</div><div class="value">${cover === null ? money(emergency) : cover.toFixed(1) + ' mois'}</div><div class="sub">${cover === null ? 'définis tes budgets mensuels' : `${money(emergency)} · objectif 3 à 6 mois`}</div></div>
  </div>
  <div class="grid cols-2">
    <div class="card"><h2>Revenus vs dépenses</h2>${barsChart(hist)}
      <div class="legend"><span><i style="background:var(--inc)"></i>Revenus nets</span><span><i style="background:var(--exp)"></i>Dépenses</span></div>
      ${known.length ? `<p class="hint" style="margin-top:10px">Revenus irréguliers : moyenne <b>${money(avg)}</b>, mois le plus faible <b>${money(minInc)}</b>. Base ton train de vie sur le mois faible, pas sur la moyenne.</p>` : ''}
    </div>
    <div class="card"><h2>Revenus par source — ${monthLabel(curMonth)}</h2>
      ${sources.length ? sources.map(([s, v]) => hbar(esc(s), Math.abs(v), srcMax, { right: signed(v), over: v < 0 })).join('') : '<div class="empty">Aucun revenu ce mois.</div>'}
      <div class="card-head" style="margin-top:18px"><h2>Où va l'argent</h2><button class="btn sm" data-act="go" data-view="envelopes">Enveloppes</button></div>
      ${spend.length ? spend.slice(0, 8).map(({ e, v }) => hbar(`${e.icon} ${esc(e.name)}`, v, Math.max(e.target, v), { right: e.target ? `${money(v)} / ${money(e.target)}` : money(v), over: e.target && v > e.target, color: e.color })).join('') : '<div class="empty">Aucune dépense ce mois.</div>'}
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
      <select data-filter="env"><option value="">Toutes les enveloppes</option>${S.envelopes.map(e => `<option value="${e.id}" ${txFilter.env === e.id ? 'selected' : ''}>${e.icon} ${esc(e.name)}</option>`).join('')}</select>
      <select data-filter="acc"><option value="">Tous les comptes</option>${S.accounts.map(a => `<option value="${a.id}" ${txFilter.acc === a.id ? 'selected' : ''}>${a.icon} ${esc(a.name)}</option>`).join('')}</select>
    </div>
    <div id="tx-out"></div>
    <div class="row-actions" style="margin-top:12px"><button class="btn sm" data-act="csv">Exporter en CSV (Excel)</button></div>
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
  const pct = envs.reduce((s, e) => s + (+e.percent || 0), 0);
  const groups = [...new Set(envs.map(e => e.group || 'Autres'))];
  const archived = S.envelopes.filter(e => e.archived);
  const card = e => {
    const spent = st.byEnv[e.id] || 0, bal = C.env[e.id];
    return `<div class="card env" style="--c:${e.color}">
      <div class="top"><span>${e.icon}</span><span class="name ellipsis">${esc(e.name)}</span>${e.kind !== 'normal' ? `<span class="chip">${KINDS[e.kind]}</span>` : ''}<button class="icon-btn" data-act="env" data-id="${e.id}" aria-label="Modifier">✏️</button></div>
      <div class="bal ${bal < 0 ? 'neg' : ''}">${money(bal)}</div>
      <div class="meta"><span>Ce mois : reçu ${money(st.alloc[e.id] || 0)} · dépensé ${money(spent)}</span></div>
      ${e.target ? `<div class="bar"><i class="${spent > e.target ? 'over' : ''}" style="width:${Math.min(100, spent / e.target * 100)}%;${spent > e.target ? '' : `background:${e.color}`}"></i></div>
      <div class="meta"><span>Budget ${money(e.target)}/mois</span><span>${spent > e.target ? `<b class="neg">+${money(spent - e.target)}</b>` : `reste ${money(e.target - spent)}`}</span></div>` : `<div class="meta"><span>Pas de budget mensuel</span><span>${e.percent || 0} % des revenus</span></div>`}
      <div class="row-actions" style="margin-top:8px"><button class="btn sm" data-act="spend" data-id="${e.id}">− Dépense</button><button class="btn sm ghost" data-act="move" data-id="${e.id}">Déplacer</button></div>
    </div>`;
  };
  return `<div class="page-head"><h1>Enveloppes</h1><div class="row-actions"><button class="btn" data-act="move">Déplacer</button><button class="btn primary" data-act="alloc">Répartir</button></div></div>
  <div class="summary-bar">
    <div class="card kpi accent"><div class="label">Non réparti</div><div class="value ${C.unalloc < 0 ? 'neg' : ''}">${money(C.unalloc)}</div></div>
    <div class="card kpi"><div class="label">Dans les enveloppes</div><div class="value">${money(envs.reduce((s, e) => s + C.env[e.id], 0))}</div></div>
    <div class="card kpi"><div class="label">Besoins mensuels</div><div class="value">${money(monthlyNeeds())}</div></div>
    <div class="card kpi"><div class="label">Total des %</div><div class="value ${Math.abs(pct - 100) > 0.01 ? 'neg' : ''}">${pct} %</div><div class="sub">${Math.abs(pct - 100) > 0.01 ? 'idéalement 100 %' : 'parfait'}</div></div>
  </div>
  ${groups.map(g => `<h3 class="group-title">${esc(g)}</h3><div class="grid env-grid">${envs.filter(e => (e.group || 'Autres') === g).map(card).join('')}</div>`).join('')}
  <div class="row-actions" style="margin-top:20px"><button class="btn" data-act="env">+ Nouvelle enveloppe</button></div>
  ${archived.length ? `<h3 class="group-title">Archivées</h3><div class="row-actions">${archived.map(e => `<button class="btn sm ghost" data-act="env" data-id="${e.id}">${e.icon} ${esc(e.name)}</button>`).join('')}</div>` : ''}`;
}

function viewGoals() {
  const fund = goalFunding();
  const open = S.goals.filter(g => !g.purchased);
  const done = S.goals.filter(g => g.purchased);
  const byEnv = [...new Set(open.map(g => g.envelopeId))];
  const totalLeft = open.reduce((s, g) => s + Math.max(0, (g.target || 0) - (fund[g.id] || 0)), 0);
  const row = g => {
    const have = fund[g.id] || 0, pct = g.target ? Math.min(100, have / g.target * 100) : 0;
    const ready = g.target && have >= g.target;
    return `<div class="goal"><div class="mid">
      <div class="card-head" style="margin-bottom:4px"><span class="t">${g.priority}. ${esc(g.name)}</span><span class="num">${g.target ? `${money(have)} / ${money(g.target)}` : '<span class="muted">prix à définir</span>'}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div></div>
      ${ready ? `<button class="btn sm primary" data-act="buy" data-id="${g.id}">Acheter ✓</button>` : ''}
      <button class="icon-btn" data-act="goal" data-id="${g.id}" aria-label="Modifier">✏️</button></div>`;
  };
  return `<div class="page-head"><h1>Objectifs</h1><button class="btn primary" data-act="goal">+ Objectif</button></div>
  <p class="muted" style="margin-top:-8px">Les objectifs sont financés par l'argent de leur enveloppe, dans l'ordre de priorité. Quand la barre est pleine, tu peux acheter <b>sans toucher au reste</b>.
  ${totalLeft ? ` Il manque encore <b>${money(totalLeft)}</b> au total.` : ''}</p>
  ${byEnv.map(id => { const e = envById(id); return `<div class="card" style="margin-bottom:14px"><div class="card-head"><h2>${e?.icon || ''} ${esc(e?.name || 'Enveloppe supprimée')}</h2><span class="chip">dispo ${money(C.env[id] || 0)}</span></div>${open.filter(g => g.envelopeId === id).sort((a, b) => a.priority - b.priority).map(row).join('')}</div>`; }).join('')}
  ${!open.length ? '<div class="card empty">Aucun objectif en cours. Ajoute ce que tu veux acheter ou atteindre.</div>' : ''}
  ${done.length ? `<h3 class="group-title">Achetés</h3><div class="card">${done.map(g => `<div class="goal done"><div class="mid"><span class="t">${esc(g.name)}</span></div><span class="num">${money(g.paid ?? g.target)}</span><button class="icon-btn" data-act="goal" data-id="${g.id}">✏️</button></div>`).join('')}</div>` : ''}`;
}

function viewAccounts() {
  const accs = activeAccs();
  const archived = S.accounts.filter(a => a.archived);
  return `<div class="page-head"><h1>Comptes</h1><div class="row-actions"><button class="btn" data-act="transfer">🔁 Transfert</button><button class="btn primary" data-act="acc">+ Compte</button></div></div>
  <p class="muted" style="margin-top:-8px">Où se trouve physiquement ton argent. Vérifie de temps en temps que les soldes correspondent à la réalité et utilise « Ajuster » si besoin.</p>
  <div class="grid kpis"><div class="card kpi accent"><div class="label">Total</div><div class="value">${money(C.total)}</div></div></div>
  <div class="grid env-grid">${accs.map(a => `<div class="card">
    <div class="env"><div class="top" style="border:0"><span>${a.icon}</span><span class="name ellipsis">${esc(a.name)}</span><button class="icon-btn" data-act="acc" data-id="${a.id}" aria-label="Modifier">✏️</button></div></div>
    <div class="bal num" style="font-size:1.4rem;font-weight:700">${money(C.acc[a.id])}</div>
    <div class="meta muted" style="font-size:.8rem;margin:4px 0 10px">${ACC_TYPES[a.type] || ''} · départ ${money(a.initial)}</div>
    <div class="row-actions"><button class="btn sm" data-act="adjust" data-id="${a.id}">⚖️ Ajuster</button><button class="btn sm ghost" data-act="acc-tx" data-id="${a.id}">Opérations</button></div>
  </div>`).join('')}</div>
  ${archived.length ? `<h3 class="group-title">Archivés</h3><div class="row-actions">${archived.map(a => `<button class="btn sm ghost" data-act="acc" data-id="${a.id}">${a.icon} ${esc(a.name)}</button>`).join('')}</div>` : ''}`;
}

function viewSettings() {
  const s = S.settings;
  const cur = CURRENCIES.includes(s.currency) ? CURRENCIES : [s.currency, ...CURRENCIES];
  return `<div class="page-head"><h1>Réglages</h1></div>
  <div class="grid cols-2">
    <div class="card"><h2>Préférences</h2>
      ${field('Devise', `<select data-set="currency">${cur.map(c => `<option ${c === s.currency ? 'selected' : ''}>${c}</option>`).join('')}</select>`, 'Utilise la devise dans laquelle tu penses ton budget.')}
      ${field('Thème', `<select data-set="theme">${Object.entries({ auto: 'Automatique', light: 'Clair', dark: 'Sombre' }).map(([k, v]) => `<option value="${k}" ${k === s.theme ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
      ${field('Sources de revenus (une par ligne)', `<textarea data-set="sources" rows="4">${esc(s.sources.join('\n'))}</textarea>`)}
    </div>
    <div class="card"><h2>Sauvegarde</h2>
      <p class="muted">Tes données sont stockées <b>uniquement dans ce navigateur</b>, sur cet appareil. Rien n'est envoyé sur internet.
      Exporte une sauvegarde régulièrement (Google Drive, clé USB, e-mail à toi-même) : si tu vides le navigateur ou changes de téléphone, c'est elle qui te sauve.</p>
      <p class="muted">Dernière sauvegarde : <b>${s.lastBackup ? new Date(s.lastBackup).toLocaleString('fr-FR') : 'jamais'}</b></p>
      <div class="row-actions">
        <button class="btn primary" data-act="export">💾 Exporter (JSON)</button>
        <button class="btn" data-act="import">📂 Importer</button>
        <button class="btn" data-act="csv">📄 CSV (Excel)</button>
      </div>
      <p class="muted" style="margin-top:14px">Pour utiliser l'app sur un autre appareil : exporte ici, puis importe le fichier là-bas.</p>
    </div>
    <div class="card"><h2>Zone dangereuse</h2>
      <p class="muted">Efface toutes les données de cet appareil et repart de zéro. Exporte d'abord une sauvegarde !</p>
      <button class="btn danger" data-act="reset">Tout effacer</button>
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
function exportCSV() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const types = { expense: 'Dépense', income: 'Revenu', transfer: 'Transfert', alloc: 'Répartition', adjust: 'Ajustement' };
  const rows = [['Date', 'Type', 'Montant', 'Frais', 'Source', 'Enveloppe', 'Compte', 'Vers compte', 'Note']];
  for (const t of sortedTx(S.tx).reverse()) {
    if (t.type === 'alloc') {
      for (const l of t.lines) rows.push([t.date, types.alloc, num(l.amount), '', '', envById(l.envelopeId)?.name, '', '', t.note]);
      continue;
    }
    const amt = t.type === 'expense' ? -t.amount : t.amount;
    rows.push([t.date, types[t.type], num(amt), t.fee ? num(t.fee) : '', t.source, envById(t.envelopeId)?.name, accById(t.accountId)?.name, accById(t.toAccountId)?.name, t.note]);
  }
  download(`mes-finances-operations-${today()}.csv`, '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  toast('CSV exporté');
}
function importJSON(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.tx) || !Array.isArray(d.envelopes) || !Array.isArray(d.accounts)) throw new Error('fichier non reconnu');
      if (!confirm(`Importer cette sauvegarde (${d.tx.length} opérations) ? Les données actuelles de cet appareil seront remplacées.`)) return;
      S = migrate(d); buildFmt(); applyTheme(); commit('Sauvegarde importée');
    } catch (e) { toast('Import impossible : ' + e.message); }
  };
  r.readAsText(file);
}

/* ---------- Rendering & events ---------- */

const NAV = [['dashboard', '📊', 'Accueil'], ['tx', '🧾', 'Opérations'], ['envelopes', '✉️', 'Enveloppes'], ['goals', '🎯', 'Objectifs'], ['accounts', '🏦', 'Comptes'], ['settings', '⚙️', 'Réglages']];
const VIEWS = { dashboard: viewDashboard, tx: viewTx, envelopes: viewEnvelopes, goals: viewGoals, accounts: viewAccounts, settings: viewSettings };

function render() {
  C = calc();
  $('#nav').innerHTML = NAV.map(([k, i, l]) => `<button class="${k === view ? 'on' : ''}" data-act="go" data-view="${k}"><span class="ico">${i}</span>${l}</button>`).join('');
  $('#main').innerHTML = VIEWS[view]();
  if (view === 'tx') renderTxList();
}

function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

function go(v) {
  view = VIEWS[v] ? v : 'dashboard';
  if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
  render(); window.scrollTo(0, 0);
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const id = b.dataset.id;
  switch (b.dataset.act) {
    case 'go': go(b.dataset.view); break;
    case 'quick': openQuick(); break;
    case 'm-prev': curMonth = shiftMonth(curMonth, -1); render(); break;
    case 'm-next': curMonth = shiftMonth(curMonth, 1); render(); break;
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
    case 'import': $('#import-file').click(); break;
    case 'reset':
      if (prompt('Tape EFFACER pour tout supprimer définitivement :') === 'EFFACER') { S = defaults(); buildFmt(); applyTheme(); commit('Données effacées'); }
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
window.addEventListener('hashchange', () => go(location.hash.slice(1)));
// If the app is open in another tab, stay in sync.
window.addEventListener('storage', e => { if (e.key === KEY) { S = load(); buildFmt(); render(); } });

buildFmt();
applyTheme();
view = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard';
render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
navigator.storage?.persist?.().catch(() => {});
