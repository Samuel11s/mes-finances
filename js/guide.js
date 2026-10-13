'use strict';
// Guide content, per language: [icon, title, html].

function guideSections(lang) {
  if (lang === 'en') return [
    ['lightbulb', 'The idea: envelopes', `
      <p>Picture your money sorted into envelopes: one for rent, one for studies, one for your emergency fund…</p>
      <ol class="steps">
        <li><b>Income comes in</b> (Upwork, trading…): it lands in “Unassigned”.</li>
        <li><b>You assign it</b> to your envelopes. The <b>“Needs first”</b> mode fills this month's essential budgets first (rent, bills…), then splits the rest by your percentages.</li>
        <li><b>Every expense comes out of an envelope.</b> When an envelope is empty you see it right away and must consciously decide where to take the money from (“Move” button).</li>
      </ol>
      <p>Result: every cent has a job, and you always know how much you can spend on each thing.</p>`],
    ['sparkles', 'Getting started (10 minutes)', `
      <ol class="steps">
        <li><b>Currencies</b>: on first launch, say which currency you earn in and which one you spend in (e.g. USD and UGX).</li>
        <li><b>Accounts</b>: create one account for each place your money lives (Upwork, Payoneer, mobile money, cash, trading…) with its <b>current balance</b>.</li>
        <li><b>Envelopes</b>: adapt the list to your life, set a <b>monthly budget</b> for fixed costs (rent, bills, studies…) and a <b>percentage</b> for the rest (savings, investing, leisure…).</li>
        <li><b>Assign</b> the money you already have (it's in “Unassigned”).</li>
        <li><b>Goals</b>: add what you want to buy (monitor, headset…) with its price.</li>
      </ol>`],
    ['receipt', 'Day to day', `
      <ul class="steps">
        <li>Tap <b>+</b> for every expense, <b>right when you make it</b>. 10 seconds, even for 1 cent.</li>
        <li>For every payment received: <b>+ → Income</b>, with the <b>fees</b> (Upwork commission, withdrawal). Then assign it.</li>
        <li>Upwork withdrawal to mobile money, deposit to your trading account: <b>+ → Transfer</b>. It's neither income nor an expense.</li>
        <li>Trading loss: <b>+ → Income</b> and tick “This is a loss”.</li>
        <li>Once a week: <b>Accounts → Adjust</b> to check balances match reality. The gap shows up as “untracked money”.</li>
        <li><b>Accounts</b>: sort them by name, balance, type or currency with “Sort by”.</li>
      </ul>`],
    ['coins', 'Multiple currencies (e.g. USD and UGX)', `
      <p>If you earn in one currency and spend in another (e.g. Upwork income in <b>USD</b>, bills in <b>UGX</b>), the app keeps <b>two separate pockets</b>, just like real life.</p>
      <ul class="steps">
        <li><b>Each account and envelope has its own currency</b>: Upwork in USD, mobile money in UGX; rent in UGX, emergency fund in USD… (Settings → Currencies → Manage currencies).</li>
        <li><b>One “Unassigned” per currency</b>: USD income is assigned to USD envelopes.</li>
        <li><b>Exchange</b>: a transfer between a USD account and a UGX account is an exchange. Enter what you sent and what you <b>actually received</b>: the rate is recorded, with fees.</li>
        <li><b>“How much to exchange?”</b>: the dashboard tells you how much UGX you're missing for this month's budgets, and the USD equivalent at your last rate. The <b>Exchange</b> button prepares the transfer. When you assign USD with “Needs first”, the app keeps that amount aside for the exchange.</li>
        <li><b>Paying a UGX expense with USD</b> (e.g. an online subscription): the app asks for both amounts so the envelope stays accurate.</li>
        <li><b>Amounts are never recalculated</b>: changing an account's currency converts nothing, and your history doesn't move when the rate changes. Totals in the main currency are marked ≈.</li>
        <li><b>See today's rate</b> button (in an exchange): shows a reference rate when you're online, to compare with the one you got. Optional.</li>
      </ul>`],
    ['chart-column', 'Reports by period', `
      <ul class="steps">
        <li>Pick the period: <b>Month, 3 months, 6 months, Year</b> or <b>Custom</b> (start and end dates). The arrows move to the previous or next period.</li>
        <li>Every figure is compared with the <b>previous period</b> of the same length.</li>
        <li><b>Tap a bar, a point or a line</b> in a chart to see its details.</li>
        <li>You'll also find income by source, expenses by envelope vs budget, currency exchanges (average rate, fees) and the largest expenses.</li>
        <li><b>Print / PDF</b> and <b>CSV</b> export the period on screen.</li>
      </ul>`],
    ['flask-conical', 'Try the demo', `
      <p>Settings → <b>Demo → Start the demo</b>: the app fills up with 6 months of sample data (income in USD, expenses in UGX) so you can see every feature.</p>
      <ul class="steps">
        <li>Your real data is <b>neither changed nor synced</b>.</li>
        <li>Try anything: nothing is saved.</li>
        <li>Leave with the <b>Exit</b> button in the purple banner.</li>
      </ul>`],
    ['trending-up', 'Tips for irregular income', `
      <ul class="steps">
        <li><b>Live on your weakest month</b>, not your average. The dashboard shows both.</li>
        <li><b>Emergency fund first</b>: aim for 3 to 6 months of needs. The “Safety cushion” tells you where you stand.</li>
        <li>In good months, <b>pre-fill</b> next month's budgets instead of spending more.</li>
        <li>Check the <b>annual report</b>: fees paid, untracked money, envelopes that often overflow.</li>
      </ul>`],
    ['cloud', 'Sync phone and computer + automatic backups', `
      <p>Free, using a small script in <b>your own Google account</b>. Nobody else sees your data. The script:</p>
      <ul class="steps"><li>keeps your data in Google Drive, folder <b>“Mes Finances”</b>;</li><li>makes a <b>copy every day</b> (keeps the last 30);</li><li>emails you your backup <b>every Sunday</b>.</li></ul>
      <h3>Setup on your first device</h3>
      <ol class="steps">
        <li>In the app: <b>Settings → Sync → Copy my script</b>. It contains a unique secret key generated for you.</li>
        <li>Go to <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com</a> (signed in to your Google account). A new project opens: <b>delete everything</b>, paste the script, then click the <b>Save</b> icon.</li>
        <li>At the top, pick the <code>setup</code> function and click <b>Run</b>. Google asks for permission:
          <b>Review permissions</b> → your account → <b>Advanced</b> → <b>Go to project (unsafe)</b> → <b>Allow</b>.
          <br><small class="muted">This warning appears because it's your own script, not verified by Google. That's expected.</small></li>
        <li>Click <b>Deploy → New deployment</b>. Type: <b>Web app</b>. Execute as: <b>Me</b>. Who has access: <b>Anyone</b>. Click <b>Deploy</b> and <b>copy the Web app URL</b>.</li>
        <li>Back in the app, paste the URL and click <b>Connect</b>.</li>
      </ol>
      <h3>Add your phone (or another computer)</h3>
      <ol class="steps"><li>On the first device: <b>Settings → Add a device</b> → copy the code.</li><li>On the new device: open the app → <b>Settings → Sync → Already set up</b> → paste the code → Connect.</li></ol>
      <h3>How it works offline</h3>
      <p>Everything is saved on the device first, so the app works without internet. Changes are sent as soon as the connection is back. If you changed things on two devices at the same time, <b>everything is merged</b>: nothing is lost. The indicator at the top shows the status (synced, pending, offline).</p>
      <p class="muted">“Anyone” means the address can be reached, but the script rejects every request without your secret key. Never share your script or your connection code.</p>`],
    ['smartphone', 'Install the app on your phone', `
      <ul class="steps">
        <li><b>Android (Chrome)</b>: open the app's address → menu ⋮ → <b>Add to Home screen</b> (or “Install app”).</li>
        <li><b>iPhone (Safari)</b>: Share button → <b>Add to Home Screen</b>.</li>
        <li><b>Computer (Chrome / Edge)</b>: install icon in the address bar.</li>
      </ul>
      <p>Once installed, it opens like a real app and works without internet.</p>`],
    ['shield-check', 'Privacy: who can see my data?', `
      <ul class="steps">
        <li>The website only contains <b>the program</b>, no data. Everyone who opens it gets their own empty app, in their own browser.</li>
        <li>Your data lives in <b>your browser</b>, and in <b>your Google Drive</b> if you turn on sync. Nothing goes through a third-party server.</li>
        <li>Export files don't contain your sync key.</li>
        <li>Keep your phone locked: anyone holding your unlocked device can open the app.</li>
      </ul>`],
    ['users', 'Using the app yourself (friends, family)', `
      <p>You can share the app's address safely: everyone gets <b>their own empty app</b>, with no access to anyone else's data.</p>
      <ol class="steps">
        <li>Open the link and install the app on your phone (see above).</li>
        <li>Follow “Getting started”, then set up your own sync with <b>your</b> Google account if you want.</li>
        <li>To host your own copy: download the app folder and drop it on <a href="https://app.netlify.com/drop" target="_blank" rel="noopener">Netlify Drop</a>, GitHub Pages or Cloudflare Pages (free).</li>
      </ol>`],
    ['circle-help', 'FAQ', `
      <p><b>I changed phones, do I lose everything?</b><br>No: with sync, connect the new phone with your code. Without sync, import your latest backup (Settings → Import).</p>
      <p><b>I made a mistake in a transaction.</b><br>Tap it in the list to edit or delete it.</p>
      <p><b>An envelope is negative.</b><br>You spent more than planned. Use “Move” to take money from another envelope: that's where you see what the expense really costs.</p>
      <p><b>I earn in USD but spend in UGX (or CDF…)?</b><br>See “Multiple currencies” above: each account and envelope has its own currency, and exchanges are recorded at the real rate.</p>
      <p><b>Found a bug or have an idea?</b><br>Settings → About → <b>Suggestion / bug</b>, by email or WhatsApp.</p>
      <p><b>If I switch language, is my data translated?</b><br>No: what you typed stays as you typed it. Only the default names you never edited follow the language.</p>`],
  ];

  return [
    ['lightbulb', 'Le principe : les enveloppes', `
      <p>Imagine que tu ranges ton argent dans des enveloppes : une pour le loyer, une pour les études, une pour le fonds d'urgence…</p>
      <ol class="steps">
        <li><b>Un revenu arrive</b> (Upwork, trading…) : il va dans « Non réparti ».</li>
        <li><b>Tu le répartis</b> dans tes enveloppes. Le mode <b>« Besoins d'abord »</b> remplit d'abord les budgets essentiels du mois (loyer, factures…), puis partage le reste selon tes pourcentages.</li>
        <li><b>Chaque dépense sort d'une enveloppe.</b> Si une enveloppe est vide, tu le vois tout de suite et tu dois décider consciemment où prendre l'argent (bouton « Déplacer »).</li>
      </ol>
      <p>Résultat : chaque centime a une mission, et tu sais exactement combien tu peux dépenser pour chaque chose.</p>`],
    ['sparkles', 'Bien démarrer (10 minutes)', `
      <ol class="steps">
        <li><b>Devises</b> : à la première ouverture, indique dans quelle devise tu reçois tes revenus et dans laquelle tu dépenses (ex. USD et UGX).</li>
        <li><b>Comptes</b> : crée un compte pour chaque endroit où se trouve ton argent (Upwork, Payoneer, mobile money, espèces, trading…) avec son <b>solde actuel</b>.</li>
        <li><b>Enveloppes</b> : adapte la liste à ta vie, puis indique le <b>budget mensuel</b> de chaque poste fixe (loyer, factures, études…) et un <b>pourcentage</b> pour le reste (épargne, investissement, loisirs…).</li>
        <li><b>Répartis</b> l'argent que tu as déjà (il est dans « Non réparti »).</li>
        <li><b>Objectifs</b> : ajoute ce que tu veux acheter (écran, casque…) avec son prix.</li>
      </ol>`],
    ['receipt', 'Au quotidien', `
      <ul class="steps">
        <li>Appuie sur <b>+</b> à chaque dépense, <b>au moment où tu la fais</b>. 10 secondes, même pour 1 centime.</li>
        <li>À chaque paiement reçu : <b>+ → Revenu</b>, avec les <b>frais</b> (commission Upwork, retrait). Puis répartis.</li>
        <li>Retrait Upwork vers mobile money, dépôt sur le compte de trading : <b>+ → Transfert</b>. Ce n'est ni un revenu ni une dépense.</li>
        <li>Perte de trading : <b>+ → Revenu</b> en cochant « C'est une perte ».</li>
        <li>Une fois par semaine : <b>Comptes → Ajuster</b> pour vérifier que les soldes correspondent à la réalité. L'écart s'affiche comme « argent non tracé ».</li>
        <li><b>Comptes</b> : trie-les par nom, solde, type ou devise avec « Trier par ».</li>
      </ul>`],
    ['coins', 'Plusieurs devises (ex. USD et UGX)', `
      <p>Si tu gagnes dans une devise et dépenses dans une autre (ex. revenus Upwork en <b>USD</b>, charges en <b>UGX</b>), l'app garde <b>deux poches séparées</b>, comme dans la vraie vie.</p>
      <ul class="steps">
        <li><b>Chaque compte et chaque enveloppe a sa devise</b> : Upwork en USD, mobile money en UGX ; loyer en UGX, fonds d'urgence en USD… (Réglages → Devises → Gérer les devises).</li>
        <li><b>Un « Non réparti » par devise</b> : un revenu en USD se répartit dans les enveloppes en USD.</li>
        <li><b>Le change</b> : un transfert entre un compte USD et un compte UGX est un change. Tu indiques ce que tu as envoyé et ce que tu as <b>réellement reçu</b> : le taux est enregistré, avec les frais.</li>
        <li><b>« Combien changer ? »</b> : l'accueil te dit combien il te manque en UGX pour les budgets du mois, et l'équivalent en USD selon ton dernier taux. Le bouton <b>Changer</b> prépare le transfert. En répartissant tes USD avec « Besoins d'abord », l'app garde cette somme de côté pour le change.</li>
        <li><b>Payer en USD une dépense en UGX</b> (ex. abonnement en ligne) : l'app demande les deux montants, l'enveloppe reste juste.</li>
        <li><b>Les montants ne sont jamais recalculés</b> : changer la devise d'un compte ne convertit rien, et ton historique ne bouge pas quand le cours change. Les totaux en devise principale sont indiqués par ≈.</li>
        <li>Bouton <b>Voir le taux du jour</b> (dans un change) : affiche un taux de référence si tu es en ligne, pour comparer avec celui qu'on t'a donné. Facultatif.</li>
      </ul>`],
    ['chart-column', 'Rapports par période', `
      <ul class="steps">
        <li>Choisis la période : <b>Mois, 3 mois, 6 mois, Année</b> ou <b>Personnalisé</b> (dates de début et de fin). Les flèches passent à la période précédente ou suivante.</li>
        <li>Chaque chiffre est comparé à la <b>période précédente</b> de même durée.</li>
        <li><b>Touche une barre, un point ou une ligne</b> d'un graphique pour voir son détail.</li>
        <li>Tu y trouves aussi : revenus par source, dépenses par enveloppe comparées au budget, changes de devises (taux moyen, frais) et plus grosses dépenses.</li>
        <li><b>Imprimer / PDF</b> et <b>CSV</b> exportent la période affichée.</li>
      </ul>`],
    ['flask-conical', 'Essayer la démo', `
      <p>Réglages → <b>Démo → Lancer la démo</b> : l'app se remplit de 6 mois d'exemple (revenus en USD, dépenses en UGX) pour voir toutes les fonctions.</p>
      <ul class="steps">
        <li>Tes vraies données ne sont <b>ni modifiées ni synchronisées</b>.</li>
        <li>Tu peux tout essayer : rien n'est enregistré.</li>
        <li>Quitte avec le bouton <b>Quitter</b> du bandeau violet.</li>
      </ul>`],
    ['trending-up', 'Conseils pour des revenus irréguliers', `
      <ul class="steps">
        <li><b>Vis sur ton mois le plus faible</b>, pas sur ta moyenne. Le tableau de bord t'affiche les deux.</li>
        <li><b>Fonds d'urgence d'abord</b> : vise 3 à 6 mois de besoins. L'indicateur « Coussin de sécurité » te dit où tu en es.</li>
        <li>Les bons mois, <b>remplis d'avance</b> les budgets du mois suivant plutôt que de dépenser plus.</li>
        <li>Regarde le <b>rapport annuel</b> : frais payés, argent non tracé, enveloppes qui dépassent souvent.</li>
      </ul>`],
    ['cloud', 'Synchroniser téléphone et PC + sauvegardes automatiques', `
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
      <p class="muted">« Tout le monde » signifie que l'adresse est joignable, mais le script refuse toute demande sans ta clé secrète. Ne partage jamais ton script ni ton code de connexion.</p>`],
    ['smartphone', "Installer l'app sur ton téléphone", `
      <ul class="steps">
        <li><b>Android (Chrome)</b> : ouvre l'adresse de l'app → menu ⋮ → <b>Ajouter à l'écran d'accueil</b> (ou « Installer l'application »).</li>
        <li><b>iPhone (Safari)</b> : bouton Partager → <b>Sur l'écran d'accueil</b>.</li>
        <li><b>PC (Chrome / Edge)</b> : icône d'installation dans la barre d'adresse.</li>
      </ul>
      <p>Une fois installée, elle s'ouvre comme une vraie application et fonctionne sans internet.</p>`],
    ['shield-check', 'Confidentialité : qui voit mes données ?', `
      <ul class="steps">
        <li>Le site ne contient <b>que le programme</b>, aucune donnée. Chaque personne qui l'ouvre a sa propre app vide, dans son propre navigateur.</li>
        <li>Tes données sont dans <b>ton navigateur</b>, et dans <b>ton Google Drive</b> si tu actives la synchro. Rien ne passe par un serveur tiers.</li>
        <li>Les fichiers d'export ne contiennent pas ta clé de synchronisation.</li>
        <li>Garde ton téléphone verrouillé : quelqu'un qui a ton appareil déverrouillé peut ouvrir l'app.</li>
      </ul>`],
    ['users', "Utiliser l'app pour toi aussi (amis, famille)", `
      <p>Tu peux partager l'adresse de l'app sans crainte : chacun obtient <b>sa propre app vide</b>, sans accès aux données des autres.</p>
      <ol class="steps">
        <li>Ouvre le lien et installe l'app sur ton téléphone (voir plus haut).</li>
        <li>Suis « Bien démarrer », puis configure ta propre synchronisation avec <b>ton</b> compte Google si tu veux.</li>
        <li>Pour héberger ta propre copie : télécharge le dossier de l'app et dépose-le sur <a href="https://app.netlify.com/drop" target="_blank" rel="noopener">Netlify Drop</a>, GitHub Pages ou Cloudflare Pages (gratuit).</li>
      </ol>`],
    ['circle-help', 'Questions fréquentes', `
      <p><b>J'ai changé de téléphone, je perds tout ?</b><br>Non : avec la synchro, connecte le nouveau téléphone avec ton code. Sans synchro, importe ta dernière sauvegarde (Réglages → Importer).</p>
      <p><b>Je me suis trompé dans une opération.</b><br>Touche-la dans la liste pour la modifier ou la supprimer.</p>
      <p><b>Une enveloppe est en négatif.</b><br>Tu as dépensé plus que prévu. Utilise « Déplacer » pour prendre l'argent dans une autre enveloppe : c'est là que tu vois ce que coûte vraiment cette dépense.</p>
      <p><b>Je gagne en USD mais je dépense en UGX (ou CDF…) ?</b><br>Voir « Plusieurs devises » plus haut : chaque compte et enveloppe a sa devise, et les changes sont enregistrés au vrai taux.</p>
      <p><b>Un bug, une idée ?</b><br>Réglages → À propos → <b>Suggestion / bug</b>, par e-mail ou WhatsApp.</p>
      <p><b>Si je change de langue, mes données sont-elles traduites ?</b><br>Non : ce que tu as tapé reste tel quel. Seuls les noms par défaut que tu n'as jamais modifiés suivent la langue.</p>`],
  ];
}
