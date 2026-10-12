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
      <p><b>Which currency?</b><br>Pick it in Settings. If you earn in USD but spend in another currency, choose the one you think your budget in and convert when you record.</p>
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
      <p><b>Dans quelle devise ?</b><br>Choisis-la dans Réglages. Si tu reçois en USD mais dépenses en CDF, choisis la devise dans laquelle tu penses ton budget et convertis au moment de noter.</p>
      <p><b>Si je change de langue, mes données sont-elles traduites ?</b><br>Non : ce que tu as tapé reste tel quel. Seuls les noms par défaut que tu n'as jamais modifiés suivent la langue.</p>`],
  ];
}
