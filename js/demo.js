'use strict';
/*
 * Demo data: 6 months of realistic activity (income in USD, expenses in UGX).
 * It only lives in memory: never saved, never synced (see DEMO in app.js).
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

  const [upwork, trading, mobile, cash] = d.accounts;
  mobile.name = 'MTN Mobile Money';
  upwork.initial = usd(420);
  mobile.initial = ugx(380000);
  cash.initial = ugx(95000);
  const env = n => d.envelopes[n];
  const targets = { 0: 800000, 1: 160000, 2: 90000, 3: 650000, 4: 300000, 5: 120000, 11: 120000 };
  for (const [i, v] of Object.entries(targets)) env(+i).target = ugx(v);
  const goalPrices = [260000, 680000, 180000, 420000, 130000, 1250000];
  d.goals.forEach((g, i) => { g.target = ugx(goalPrices[i]); });

  const tx = [];
  let created = 1;
  const push = x => tx.push({ id: uid(), created: created++, ...x });
  const nowM = monthOf(today());
  const last = today();
  let rate = 3720;

  for (let k = 5; k >= 0; k--) {
    const m = shiftMonth(nowM, -k);
    const day = n => { const dt = `${m}-${pad(n)}`; return dt > last ? last : dt; };
    const allocUGX = {};
    const allocUSD = {};

    // Upwork income (USD, 10% commission) and trading.
    const jobs = [[L2('Site vitrine – client Kampala', 'Landing page – Kampala client'), 2], [L2('Logo et identité visuelle', 'Logo and brand identity'), 12], [L2('Maintenance WordPress', 'WordPress maintenance'), 22]];
    for (const [note, dd] of jobs.slice(0, 2 + (k % 2))) {
      const gross = usd(between(280, 1100));
      push({ type: 'income', source: 'Upwork', amount: gross, fee: Math.round(gross * 0.1), accountId: upwork.id, date: day(dd), note });
    }
    const pnl = usd(between(-180, 420));
    if (pnl) push({ type: 'income', source: 'Trading', amount: pnl, fee: 0, accountId: trading.id, date: day(18), note: pnl < 0 ? L2('Mauvaise semaine', 'Bad week') : L2('Swing EUR/USD', 'EUR/USD swing') });

    // Two USD → UGX exchanges per month, at the real rate (with fees).
    for (const dd of [4, 16]) {
      rate += between(-35, 30);
      const sent = usd(between(320, 480));
      push({ type: 'transfer', accountId: upwork.id, toAccountId: mobile.id, amount: sent, fee: usd(between(3, 7)), received: ugx(sent / 100 * rate), date: day(dd), note: L2('Retrait Upwork → MTN', 'Upwork withdrawal → MTN') });
    }

    // Allocation: UGX budgets first, then savings / investing / emergency fund in USD.
    for (const [i, v] of Object.entries(targets)) allocUGX[env(+i).id] = ugx(v);
    allocUGX[env(10).id] = ugx(150000); // setup
    allocUGX[env(12).id] = ugx(between(20000, 60000)); // events
    push({ type: 'alloc', date: day(4), lines: Object.entries(allocUGX).map(([envelopeId, amount]) => ({ envelopeId, amount })), note: '' });
    allocUSD[env(7).id] = usd(between(60, 110));
    allocUSD[env(8).id] = usd(between(40, 80));
    allocUSD[env(9).id] = usd(between(30, 60));
    push({ type: 'alloc', date: day(13), lines: Object.entries(allocUSD).map(([envelopeId, amount]) => ({ envelopeId, amount })), note: '' });

    // Everyday expenses in UGX.
    const spend = (n, v, dd, note, acc = mobile) => push({ type: 'expense', amount: ugx(v), envelopeId: env(n).id, accountId: acc.id, date: day(dd), note });
    spend(0, 800000, 5, L2('Loyer', 'Rent'));
    spend(1, between(70000, 95000), 7, 'UMEME');
    spend(1, between(25000, 40000), 8, 'NWSC');
    spend(1, 50000, 9, L2('Forfait internet', 'Internet bundle'));
    for (let i = 0; i < 9; i++) spend(3, between(18000, 75000), 3 + i * 3, [L2('Marché Nakasero', 'Nakasero market'), 'Boda boda', L2('Supermarché', 'Supermarket'), L2('Carburant', 'Fuel')][i % 4], i % 3 ? mobile : cash);
    spend(2, between(30000, 85000), 14, L2('Produits ménagers', 'Cleaning supplies'), cash);
    if (k % 2 === 0) spend(4, between(150000, 300000), 10, L2('Frais de cours en ligne', 'Online course fees'));
    if (k % 3 === 0) spend(5, between(80000, 130000), 20, L2('Vidange', 'Oil change'));
    spend(11, between(40000, 110000), 24, L2('Sortie entre amis', 'Night out with friends'), cash);
    if (k === 2) spend(6, 240000, 26, L2('Plaquettes de frein', 'Brake pads'));
    if (k === 3) spend(12, 90000, 21, L2('Anniversaire de ma sœur', "My sister's birthday"));
    // Expense paid in USD for a UGX envelope (online subscription).
    const subUSD = usd(15);
    push({ type: 'expense', amount: subUSD, envAmount: ugx(15 * rate), envelopeId: env(11).id, accountId: upwork.id, date: day(11), note: L2('Abonnement musique', 'Music subscription') });
  }

  // One goal already bought and a cash discrepancy, to show these features.
  const headset = d.goals[2];
  headset.purchased = true; headset.paid = ugx(175000);
  push({ type: 'expense', amount: ugx(175000), envelopeId: headset.envelopeId, accountId: mobile.id, date: `${shiftMonth(nowM, -1)}-15`, note: headset.name, goalId: headset.id });
  push({ type: 'adjust', accountId: cash.id, amount: ugx(-15000), date: `${shiftMonth(nowM, -2)}-28`, note: '' });

  d.tx = tx;
  d.settings.setupDone = true;
  return d;
}
