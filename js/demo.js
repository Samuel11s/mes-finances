'use strict';
/*
 * Demo data: 6 months of realistic activity (income in USD, expenses in UGX).
 * It only lives in memory: never saved, never synced (see DEMO in app.js).
 * The money flow is balanced like a careful user would keep it: one exchange per month covers the
 * UGX budgets, every cent is assigned (except this month's USD income), no envelope or account goes negative.
 */

function buildDemo(lang) {
  const en = lang === 'en';
  const L2 = (fr, e) => (en ? e : fr);
  const d = defaults(lang);
  applyCurrencySetup(d, 'USD', 'UGX');
  d.settings.lastBackup = Date.now();

  // Reproducible pseudo-random generator: the demo is always the same.
  let seed = 42;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const between = (a, b) => a + (b - a) * rnd();
  const usd = v => Math.round(v) * 100;
  const ugx = v => Math.round(v / 500) * 500 * 100;

  const [upwork, trading, cash, mobile] = d.accounts;
  mobile.name = 'MTN Mobile Money';
  upwork.initial = usd(420);
  mobile.initial = ugx(380000);
  cash.initial = ugx(150000);
  const env = n => d.envelopes[n];
  // Monthly UGX budgets (envelope index → amount).
  const targets = { 0: 800000, 1: 190000, 2: 90000, 3: 650000, 4: 300000, 5: 120000, 6: 60000, 10: 150000, 11: 170000, 12: 40000 };
  for (const [i, v] of Object.entries(targets)) env(+i).target = ugx(v);
  const needUGX = Object.values(targets).reduce((s, v) => s + ugx(v), 0);
  const goalPrices = [260000, 680000, 180000, 420000, 130000, 1250000];
  d.goals.forEach((g, i) => { g.target = ugx(goalPrices[i]); });

  const tx = [];
  let created = 1;
  const nowM = monthOf(today());
  const last = today();
  // Transactions dated after today are skipped (the current month is still in progress).
  const push = x => { if (x.date && x.date <= last) tx.push({ id: uid(), created: created++, ...x }); return x.date && x.date <= last; };
  // Unassigned money per currency, tracked to assign it like a careful user would.
  let usdUn = upwork.initial, ugxUn = mobile.initial + cash.initial;
  let rate = 3720;

  for (let k = 5; k >= 0; k--) {
    const m = shiftMonth(nowM, -k);
    const day = n => `${m}-${pad(n)}`;

    // Upwork income (USD, 10% commission) and trading.
    const jobs = [[L2('Site vitrine – client Kampala', 'Landing page – Kampala client'), 2], [L2('Logo et identité visuelle', 'Logo and brand identity'), 12], [L2('Maintenance WordPress', 'WordPress maintenance'), 22]];
    for (const [note, dd] of jobs.slice(0, 2 + (k % 2))) {
      const gross = usd(between(380, 1100)), fee = Math.round(gross * 0.1);
      if (push({ type: 'income', source: 'Upwork', amount: gross, fee, accountId: upwork.id, date: day(dd), note })) usdUn += gross - fee;
    }
    const pnl = usd(between(-120, 380));
    if (pnl && push({ type: 'income', source: 'Trading', amount: pnl, fee: 0, accountId: trading.id, date: day(18), note: pnl < 0 ? L2('Mauvaise semaine', 'Bad week') : L2('Swing EUR/USD', 'EUR/USD swing') })) usdUn += pnl;

    // One USD → UGX exchange, sized to cover this month's UGX budgets, at the real rate (with fees).
    rate += between(-40, 30);
    if (k === 2 && push({ type: 'adjust', accountId: cash.id, amount: ugx(-15000), date: day(2), note: '' })) ugxUn -= ugx(15000);
    const sent = Math.max(usd(250), Math.ceil(Math.max(0, needUGX - ugxUn) / 100 / rate / 10) * 10 * 100), xFee = usd(5);
    const received = ugx(sent / 100 * rate);
    if (push({ type: 'transfer', accountId: upwork.id, toAccountId: mobile.id, amount: sent, fee: xFee, received, date: day(3), note: L2('Retrait Upwork → MTN', 'Upwork withdrawal → MTN') })) { usdUn -= sent + xFee; ugxUn += received; }
    // Monthly cash withdrawal (same currency, small fee).
    if (push({ type: 'transfer', accountId: mobile.id, toAccountId: cash.id, amount: ugx(300000), fee: ugx(2500), date: day(4), note: L2('Retrait en espèces', 'Cash withdrawal') })) ugxUn -= ugx(2500);

    // Assign every UGX shilling: budgets first, the rest to Setup.
    const lines = Object.entries(targets).map(([i, v]) => ({ envelopeId: env(+i).id, amount: ugx(v) }));
    const extra = ugxUn - lines.reduce((s, l) => s + l.amount, 0);
    if (extra > 0) lines.find(l => l.envelopeId === env(10).id).amount += extra;
    if (push({ type: 'alloc', date: day(4), lines, note: '' })) ugxUn = 0;

    // Everyday expenses in UGX.
    const spend = (n, v, dd, note, acc = mobile) => push({ type: 'expense', amount: ugx(v), envelopeId: env(n).id, accountId: acc.id, date: day(dd), note });
    spend(0, 800000, 5, L2('Loyer', 'Rent'));
    spend(1, between(70000, 95000), 7, 'UMEME');
    spend(1, between(25000, 40000), 8, 'NWSC');
    spend(1, 50000, 9, L2('Forfait internet', 'Internet bundle'));
    for (let i = 0; i < 9; i++) spend(3, between(18000, 75000), 3 + i * 3, [L2('Marché Nakasero', 'Nakasero market'), 'Boda boda', L2('Supermarché', 'Supermarket'), L2('Carburant', 'Fuel')][i % 4], i % 3 ? mobile : cash);
    spend(2, between(30000, 85000), 14, L2('Produits ménagers', 'Cleaning supplies'), cash);
    if (k % 2 === 0) spend(4, between(150000, 300000), 10, L2('Frais de cours en ligne', 'Online course fees'));
    if (k % 3 === 0) spend(5, between(80000, 120000), 20, L2('Vidange', 'Oil change'));
    spend(11, between(40000, 110000), 24, L2('Sortie entre amis', 'Night out with friends'), cash);
    if (k === 2) spend(6, 240000, 26, L2('Plaquettes de frein', 'Brake pads'));
    if (k === 3) spend(12, 90000, 21, L2('Anniversaire de ma sœur', "My sister's birthday"));
    if (k === 1) {
      // One goal bought from the Setup envelope.
      const headset = d.goals[2];
      if (spend(10, 175000, 15, headset.name)) { headset.purchased = true; headset.paid = ugx(175000); tx[tx.length - 1].goalId = headset.id; }
    }
    // Expense paid in USD for a UGX envelope (online subscription).
    const subUSD = usd(15), subUGX = ugx(15 * rate);
    if (push({ type: 'expense', amount: subUSD, envAmount: subUGX, envelopeId: env(11).id, accountId: upwork.id, date: day(11), note: L2('Abonnement musique', 'Music subscription') })) { usdUn -= subUSD; ugxUn += subUGX; }

    // Assign most of the USD left: emergency fund, savings, investing (not yet for the current month).
    if (k > 0 && usdUn > 0) {
      const amount = Math.floor(usdUn * 0.9 / 100) * 100;
      const parts = [[7, 0.45], [8, 0.3], [9, 0.25]].map(([i, p]) => ({ envelopeId: env(i).id, amount: Math.floor(amount * p / 100) * 100 }));
      if (push({ type: 'alloc', date: day(25), lines: parts, note: '' })) usdUn -= parts.reduce((s, l) => s + l.amount, 0);
    }
  }

  d.tx = tx;
  d.settings.setupDone = true;
  return d;
}
