'use strict';
// App version, version history, developer, contact and support.

const APP_VERSION = '2.0.0';

const DEV = {
  name: 'Sbit/>',
  email: 'samuelbitingingwa@gmail.com',
  whatsapp: '243978775490',
  github: 'https://github.com/Samuel11s',
};

// Support options ("Buy me a coffee"). No number = offer to email the developer.
const SUPPORT = () => [
  { id: 'airtel-cd', label: t('Airtel Money · Congo (RDC)'), number: '+243 978 775 490', name: 'Samuel Bulangalizi Bitingingwa', icon: 'smartphone', color: '#dc2626' },
  { id: 'mpesa-cd', label: t('M-Pesa · Congo (RDC)'), number: '+243 837 614 618', name: 'Samuel Bulangalizi Bitingingwa', icon: 'smartphone', color: '#16a34a' },
  { id: 'mtn-ug', label: t('MTN Mobile Money · Ouganda'), number: '+256 785 409 257', name: 'Samuel Bulangalizi Bitingingwa', icon: 'smartphone', color: '#ca8a04' },
  { id: 'airtel-ug', label: t('Airtel Money · Ouganda'), number: '+256 703 920 505', name: 'Sadam Kasule', icon: 'smartphone', color: '#dc2626' },
  { id: 'crypto', label: t('Crypto'), icon: 'bitcoin', color: '#f59e0b' },
  { id: 'bank', label: t('Virement bancaire'), icon: 'landmark', color: '#2563eb' },
];

const CHANGELOG = [
  {
    v: '2.0.0', date: '2026-10-14',
    fr: [
      'Plusieurs devises : chaque compte et enveloppe a sa devise (ex. revenus en USD, dépenses en UGX), avec les vrais taux de change enregistrés.',
      'Rapports par période : mois, 3 mois, 6 mois, année ou dates personnalisées, comparés à la période précédente.',
      'Graphiques : toucher une barre ou un point affiche son détail.',
      'Tri des comptes (nom, solde, type, devise) et listes déroulantes avec icônes.',
      'Mode démo pour découvrir l\'app sans toucher à ses données.',
      'Écran de démarrage, icônes iPhone, aperçu des liens sur les réseaux sociaux, section À propos.',
      'Corrigé : doublons d\'enveloppes et d\'objectifs avec la synchro, défilement horizontal dans les fenêtres, zoom automatique sur téléphone.',
    ],
    en: [
      'Multiple currencies: each account and envelope has its own currency (e.g. income in USD, expenses in UGX), with real exchange rates recorded.',
      'Reports by period: month, 3 months, 6 months, year or custom dates, compared with the previous period.',
      'Charts: tap a bar or point to see its details.',
      'Account sorting (name, balance, type, currency) and dropdowns with icons.',
      'Demo mode to explore the app without touching your data.',
      'Launch screen, iPhone icons, link previews on social networks, About section.',
      'Fixed: duplicated envelopes and goals with sync, horizontal scrolling in dialogs, automatic zoom on phones.',
    ],
  },
  {
    v: '1.2.0', date: '2026-10-13',
    fr: ['Interface en français et en anglais, sans service de traduction (fonctionne hors ligne). Ce que tu tapes n\'est jamais traduit.'],
    en: ['French and English interface, with no translation service (works offline). What you type is never translated.'],
  },
  {
    v: '1.1.0', date: '2026-10-13',
    fr: ['Synchronisation téléphone ⇄ PC et sauvegardes automatiques (Google Drive + e-mail).', 'Guide intégré, nouvelles icônes, animations, rapport annuel.'],
    en: ['Phone ⇄ computer sync and automatic backups (Google Drive + email).', 'Built-in guide, new icons, animations, annual report.'],
  },
  {
    v: '1.0.0', date: '2026-10-12',
    fr: ['Première version : enveloppes, comptes, objectifs, tableau de bord, revenus irréguliers, export.'],
    en: ['First release: envelopes, accounts, goals, dashboard, irregular income, export.'],
  },
];

const mailto = (subject, body = '') => `mailto:${DEV.email}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`;
const waLink = (text = '') => `https://wa.me/${DEV.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

function aboutSection() {
  const dateFmt = d => new Date(d + 'T12:00:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
  return `<div class="card about"><h2>${icon('info')} ${t('À propos')}</h2>
    <div class="about-app">${`<img src="icon.svg" alt="" width="44" height="44">`}<div><b>${t('Mes Finances')}</b><div class="muted">${t('Version {v}', { v: APP_VERSION })}</div></div></div>
    <details class="changelog"><summary>${icon('history')} ${t('Historique des versions')}${icon('chevron-down', 'chev')}</summary>
      ${CHANGELOG.map(r => `<div class="cl-item"><div class="cl-head"><span class="chip">v${r.v}</span><small class="muted">${dateFmt(r.date)}</small></div>
        <ul>${(LANG === 'en' ? r.en : r.fr).map(li => `<li>${esc(li)}</li>`).join('')}</ul></div>`).join('')}
    </details>
    <div class="dev">${tile('user')}<div><b>${esc(DEV.name)}</b><div class="muted">${t('Développeur')}</div></div></div>
    <div class="row-actions">
      <a class="btn sm" href="${mailto(t('Mes Finances — contact'))}">${icon('mail')} ${t('E-mail')}</a>
      <a class="btn sm" href="${waLink()}" target="_blank" rel="noopener">${icon('message-circle')} WhatsApp</a>
      <a class="btn sm" href="${DEV.github}" target="_blank" rel="noopener">${icon('github')} GitHub</a>
    </div>
    <div class="row-actions" style="margin-top:8px">
      <button class="btn sm" data-act="feedback">${icon('message-square-text')} ${t('Suggestion / bug')}</button>
      <button class="btn sm primary" data-act="coffee">${icon('coffee')} ${t('Offrir un café')}</button>
    </div>
  </div>`;
}

function openFeedback() {
  const kinds = { idea: ['lightbulb', t('Suggestion')], bug: ['bug', t('Bug')], feature: ['sparkles', t('Fonctionnalité')] };
  let kind = 'idea';
  const f = openModal(t('Suggestion / bug'), `
    <p class="hint">${t("Une idée, un problème, une fonctionnalité qui te manque ? Écris-le ici puis envoie-le par e-mail ou WhatsApp.")}</p>
    <div class="seg">${Object.entries(kinds).map(([k, [ic, l]]) => `<button type="button" data-kind="${k}" class="${k === kind ? 'on' : ''}">${icon(ic)} ${l}</button>`).join('')}</div>
    ${field(t('Message'), `<textarea name="msg" rows="6" autofocus placeholder="${t('Décris ton idée ou le problème (ce que tu faisais, ce qui s\'est passé)…')}"></textarea>`)}`, null,
  { extra: `<button type="button" class="btn" data-send="wa">${icon('message-circle')} WhatsApp</button><button type="button" class="btn primary" data-send="mail">${icon('send')} ${t('E-mail')}</button>` });
  $$('[data-kind]', f).forEach(b => b.onclick = () => { kind = b.dataset.kind; $$('[data-kind]', f).forEach(x => x.classList.toggle('on', x === b)); });
  $$('[data-send]', f).forEach(b => b.onclick = () => {
    const msg = f.elements.msg.value.trim();
    if (!msg) return toast(t('Écris d\'abord ton message'));
    const head = `[${t('Mes Finances')} ${APP_VERSION}] ${kinds[kind][1]}`;
    const body = `${msg}\n\n— ${t('Version')} ${APP_VERSION} · ${LANG.toUpperCase()}`;
    window.open(b.dataset.send === 'mail' ? mailto(head, body) : waLink(`${head}\n\n${body}`), '_blank');
    $('#modal').close();
  });
}

function openCoffee() {
  const list = SUPPORT();
  const f = openModal(t('Offrir un café'), `
    <p class="hint">${t("Merci de soutenir l'app ! Choisis un moyen de paiement :")}</p>
    <div class="pay-list">${list.map(p => `<button type="button" class="pay-opt" data-pay="${p.id}">${tile(p.icon, p.color, 'sm')}<span>${esc(p.label)}</span>${icon('chevron-right', 'chev')}</button>`).join('')}</div>
    <div id="pay-detail"></div>`, null);
  $$('[data-pay]', f).forEach(b => b.onclick = () => {
    const p = list.find(x => x.id === b.dataset.pay);
    $$('[data-pay]', f).forEach(x => x.classList.toggle('on', x === b));
    $('#pay-detail').innerHTML = p.number
      ? `<div class="pay-card">${tile(p.icon, p.color)}<div class="grow"><small class="muted">${esc(p.label)}</small>
          <div class="pay-num">${esc(p.number)}</div><div>${t('Nom enregistré :')} <b>${esc(p.name)}</b></div></div>
          <button type="button" class="btn sm" data-copy="${esc(p.number.replace(/\s/g, ''))}">${icon('copy')} ${t('Copier')}</button></div>`
      : `<div class="pay-card">${tile(p.icon, p.color)}<div class="grow">${t("Écris-moi et je t'envoie {x}.", { x: p.id === 'crypto' ? t("l'adresse crypto") : t('les coordonnées bancaires') })}</div>
          <a class="btn sm primary" href="${mailto(t('Mes Finances — soutien par {x}', { x: p.label }))}">${icon('mail')} ${t('Écris-moi')}</a></div>`;
    const c = $('[data-copy]', f);
    if (c) c.onclick = () => navigator.clipboard?.writeText(c.dataset.copy).then(() => toast(t('Numéro copié')), () => {});
  });
}
