/* ===========================================================
   TUTORIEL
   Un guide pas à pas, découpé en chapitres qu'on peut rejouer.
   Deux sortes d'étapes :
     • « info »   : on lit, puis « Suivant » ;
     • « action » : le joueur fait lui-même le geste demandé,
                    le tutoriel le détecte et le félicite.
   Un projecteur éclaire la zone concernée. Le temps du royaume
   est arrêté pendant tout le tutoriel, mais les actions restent
   permises (voir actionPermise dans game.js) : aucune pression.
   =========================================================== */

const TUTO = {
  actif: false,
  etapes: [],
  i: 0,
  base: {},              // mesures prises à l'entrée d'une étape « action »
  minuteur: null,
  CLE: 'nation-tuto-fait',
  reussie: false,
};

/* --- mesures utiles pour savoir si le joueur a agi --- */
const T_ = {
  p:          ()=> S.player,
  provinces:  ()=> tuilesDe(S.player).length,
  ouvrages:   ()=> tuilesDe(S.player).reduce((s,t)=> s + nbBatiments(t), 0),
  unites:     ()=> nbUnites(S.player.armee),
  mesMsgs:    id => (S.nations[id] && S.nations[id].chat || []).filter(m=>m.de==='moi').length,
  msgsConseil:()=> (typeof etatConseil === 'function' ? etatConseil().chat : []).filter(m=>m.de==='moi').length,
  voisinLibre:()=> tuilesDe(S.player).some(t => voisins(t).some(v => v.owner === null && v.terr !== 'ocean')),
  couleur:    ()=> `<i class="flag" style="background:${S.player.col}"></i>`,
};

/* ===========================================================
   LE CONTENU — chapitre par chapitre
   cible : sélecteur CSS de la zone à éclairer (facultatif)
   dit   : ce que la petite voix prononce (facultatif)
   fait  : condition de réussite d'une étape « action »
   entree: ce qu'on prépare en arrivant sur l'étape
   =========================================================== */
const CHAPITRES = [
{
  nom: 'Les bases', icone: '🌍',
  etapes: [
    { titre: 'Bienvenue, souverain !', dit: 'Bienvenue dans Nation !',
      texte: ()=> `Tu diriges <b>${S.player.nom}</b> ${T_.couleur()}, un tout petit pays qui ne possède encore que sa capitale.
        <br><br>Je vais te montrer <b>tout</b> le jeu, pas à pas. Pendant le tutoriel, <b>le temps est arrêté</b> :
        rien ne peut t'arriver, prends ton temps.
        <br><br>Tu peux quitter à tout moment avec <b>✕</b>, et rejouer n'importe quel chapitre avec le bouton <b>🎓</b> en haut.` },
    { titre: 'La carte du monde', cible: '#map',
      texte: ()=> `Chaque <b>case hexagonale</b> est une province. Sa couleur montre à qui elle appartient :
        la tienne est ${T_.couleur()}. Les cases sans couleur sont des <b>terres libres</b>, le bleu est la mer.
        <br><br>🖱️ <b>Molette</b> (ou deux doigts) pour zoomer, <b>glisser</b> pour te déplacer.` },
    { type: 'action', titre: 'Clique sur ta capitale', cible: '#map', dit: 'Clique sur ta capitale.',
      entree: ()=> { S.sel = null; if(S.player.capitale) centrer(S.player.capitale, true); },
      texte: ()=> `J'ai centré la caméra sur ta capitale ${T_.couleur()} (au milieu de l'écran).
        <br><br>👉 <b>Clique dessus</b> pour l'ouvrir.`,
      fait: ()=> S.sel && S.sel.owner === S.player.id },
    { titre: 'Le panneau Province', cible: '#side',
      texte: `Ici s'affiche la province choisie : son <b>terrain</b>, sa <b>population</b>, ce qu'elle produit
        et ses <b>ouvrages</b> (les bâtiments). Ta capitale a déjà une <b>ferme</b>.
        <br><br>Plus une province est peuplée, plus elle peut porter d'ouvrages : de 1 sur une montagne vide à 5 sur une plaine peuplée.` },
    { titre: 'Tes ressources', cible: '#resBar',
      texte: ()=> `La barre du haut, c'est la santé de ton pays :
        <ul><li>${ic('or')} <b>Or</b> : pour tout acheter. Vient des impôts.</li>
        <li>${ic('mat')} <b>Matériaux</b> : pour construire et recruter.</li>
        <li>${ic('food')} <b>Nourriture</b> : fait grandir la population. Une famine rend le peuple malheureux.</li>
        <li>${ic('pop')} <b>Population</b>, ${ic('energie')} <b>Énergie</b>, ${ic('recherche')} <b>Recherche</b>,
          ${ic('bonheur')} <b>Bonheur</b>, ${ic('infanterie')} <b>Armée</b> et ${ic('temps')} les mois restants.</li></ul>
        Le petit chiffre <span style="color:#4ad991">vert</span> ou <span style="color:#ff6b6b">rouge</span>
        montre ce que tu gagnes ou perds <b>chaque mois</b>.` },
    { titre: 'La mini-carte et le journal', cible: '#log',
      texte: `En bas, le <b>journal</b> raconte tout ce qui se passe : constructions, batailles, messages, événements.
        <br><br>En coin de carte, la <b>mini-carte</b> montre le monde entier (touche <kbd>M</kbd> pour la masquer).` },
  ]
},
{
  nom: 'Construire et s\'agrandir', icone: '🏗️',
  etapes: [
    { type: 'action', titre: 'Construis un ouvrage', cible: '#side', dit: 'Construis un bâtiment.',
      entree: ()=> { if(!S.sel || S.sel.owner !== S.player.id){ S.sel = S.player.capitale; ongletActif('province'); majUI(); } },
      texte: `Dans le panneau, sous <b>Construire</b>, choisis un ouvrage. Je te conseille une deuxième
        <b>🌾 Ferme</b> (60 or) : plus de nourriture = plus d'habitants = plus d'impôts.
        <br><br>Les boutons grisés sont trop chers ou demandent une technologie.`,
      fait: b => T_.ouvrages() > b.ouvrages },
    { titre: 'Le secret de la spécialisation', cible: '#side',
      texte: `Une province <b>dédiée</b> à un même métier devient plus efficace : trois mines ensemble
        valent plus que trois mines éparpillées, jusqu'à <b>+45 %</b> de rendement.
        <br><br>Le bouton <b>−1</b> démolit un ouvrage, <b>Fortifier</b> (80 or) ajoute +10 % de défense.` },
    { type: 'action', titre: 'Colonise une terre libre', cible: '#map', dit: 'Colonise une terre libre.',
      passerSi: ()=> !T_.voisinLibre(),
      texte: `Ton pays grandit en <b>colonisant</b> les terres libres (sans couleur) <b>collées à ton territoire</b>.
        <br><br>👉 Clique sur une case libre à côté de ta capitale, puis sur <b>Coloniser cette terre</b> (120 or).`,
      fait: b => T_.provinces() > b.provinces },
    { type: 'action', titre: 'L\'onglet Pays', cible: '.tab[data-tab="pays"]',
      texte: `👉 Ouvre l'onglet <b>Pays</b>.`,
      fait: ()=> S.tab === 'pays' },
    { type: 'action', titre: 'Les impôts', cible: '#side', dit: 'Règle les impôts.',
      texte: `Voici l'état de ton pays : revenus, dépenses, <b>bonheur</b>… Tu peux même le renommer !
        <br><br>👉 Bouge le curseur des <b>impôts</b>. Plus d'impôts = plus d'or, mais un peuple moins heureux.
        Si le bonheur s'effondre, le pays s'effondre avec lui.`,
      fait: b => Math.abs(S.player.taxe - b.taxe) > 0.001 },
  ]
},
{
  nom: 'La recherche', icone: '🔬',
  etapes: [
    { type: 'action', titre: 'L\'onglet Recherche', cible: '.tab[data-tab="tech"]',
      texte: `👉 Ouvre l'onglet <b>Recherche</b>.`, fait: ()=> S.tab === 'tech' },
    { type: 'action', titre: 'Lance une recherche', cible: '#side', dit: 'Choisis une technologie.',
      texte: `Les technologies débloquent des <b>bâtiments</b> (Université, Port, Usine…), des <b>unités</b>
        (Chars, Aviation…) ou donnent des <b>bonus</b>. Certaines en demandent d'autres avant (🔒).
        <br><br>👉 Choisis <b>Écriture</b> : elle débloque l'Université, qui produit encore plus de recherche.`,
      fait: ()=> !!S.player.rech || S.player.tech.size > 0 },
  ]
},
{
  nom: 'L\'armée et la guerre', icone: '⚔️',
  etapes: [
    { type: 'action', titre: 'L\'onglet Armée', cible: '.tab[data-tab="armee"]',
      texte: `👉 Ouvre l'onglet <b>Armée</b>.`, fait: ()=> S.tab === 'armee' },
    { type: 'action', titre: 'Recrute un soldat', cible: '#side', dit: 'Recrute une unité.',
      texte: `Chaque unité a une <b>attaque</b>, une <b>défense</b>, un prix et une <b>solde</b> à payer chaque mois.
        Attention : si ton trésor tombe à zéro, des soldats désertent !
        <br><br>👉 Clique sur <b>+1</b> à côté de l'<b>Infanterie</b> (45 or).`,
      fait: b => T_.unites() > b.unites },
    { titre: 'Le rapport de puissance', cible: '#side',
      texte: `En bas de l'onglet, les barres comparent ta puissance à celle de chaque nation :
        <span style="color:#4ad991">vert</span> = tu es plus fort, <span style="color:#ff6b6b">rouge</span> = méfiance.
        <br><br><b>Infanterie</b> : solide en défense · <b>Artillerie</b> : frappe fort · <b>Chars</b> : offensives ·
        <b>Aviation</b> : ignore une partie des fortifications · <b>Marine</b> : transporte tes troupes et attaque les côtes.` },
    { titre: 'Comment on fait la guerre', cible: '#map',
      texte: `Pour attaquer, tu dois être <b>en guerre</b> (onglet Diplomatie). Clique ensuite une province ennemie
        <b>voisine</b> de la tienne : le panneau propose d'<b>engager 25, 50 ou 100 %</b> de tes forces.
        <br><br>Une province ne tombe pas d'un coup : chaque victoire fait <b>avancer le front</b>, une jauge
        se remplit, et à 100 % elle est à toi. Une <b>lunette de bataille</b> te montre chaque assaut.
        <br><br>⚠️ Si tu perds ta <b>capitale</b>, ton peuple est sous le choc pendant des mois.` },
  ]
},
{
  nom: 'La diplomatie', icone: '🤝',
  etapes: [
    { type: 'action', titre: 'L\'onglet Diplomatie', cible: '.tab[data-tab="diplo"]',
      texte: `👉 Ouvre l'onglet <b>Diplomatie</b>.`, fait: ()=> S.tab === 'diplo' },
    { titre: 'Les nations du monde', cible: '#side',
      texte: `Chaque nation a une <b>barre de relation</b> avec toi (de −100 à +100). Tu peux :
        <ul><li>💰 <b>Offrir 150 or</b> : la relation monte.</li>
        <li>📜 <b>Pacte de non-agression</b> (relation 15+) : elle ne t'attaquera pas.</li>
        <li>🛡️ <b>Alliance</b> (relation 55+) : ton allié se bat avec toi.</li>
        <li>⚔️ <b>Déclarer la guerre</b> : ses alliés se joignent à elle, et le monde s'en souvient !</li></ul>
        Clique sur un <b>nom</b> pour voir sa capitale sur la carte.` },
  ]
},
{
  nom: 'Parler aux dirigeants', icone: '💬',
  etapes: [
    { type: 'action', titre: 'L\'onglet Messages', cible: '#tabChat', dit: 'Voici le cœur du jeu.',
      entree: ()=> { S.chatOuvert = null; if(typeof oublierRendu === 'function') oublierRendu(); },
      texte: `C'est <b>le cœur du jeu</b> : tu peux écrire aux autres dirigeants comme à de vraies personnes.
        <br><br>👉 Ouvre l'onglet <b>Messages</b>.`,
      fait: ()=> S.tab === 'chat' },
    { type: 'action', titre: 'Choisis un dirigeant', cible: '#side',
      texte: `Chaque dirigeant a un <b>caractère</b> (marchand, prudent, belliqueux, honorable…) et se souvient
        de tout ce que tu fais.
        <br><br>👉 Clique sur une <b>nation</b> de la liste (pas sur le Conseil pour l'instant).`,
      fait: ()=> S.chatOuvert !== null && S.chatOuvert !== -1 },
    { type: 'action', titre: 'Écris-lui !', cible: '#side', dit: 'Écris-lui un message.',
      entree: b => { b.msgs = T_.mesMsgs(S.chatOuvert); b.qui = S.chatOuvert; },
      texte: `👉 Tape un message en bas et appuie sur <b>Entrée</b>. Par exemple :
        <ul><li>« <i>Bonjour !</i> » ou « <i>slt ça va ?</i> »</li>
        <li>« <i>On signe un pacte ?</i> »</li>
        <li>« <i>Que veux-tu de moi ?</i> »</li></ul>
        Il comprend le langage de tous les jours, les fautes de frappe et même l'argot.`,
      fait: b => S.chatOuvert === b.qui && T_.mesMsgs(b.qui) > b.msgs },
    { titre: 'Négocier comme un pro', cible: '#side',
      texte: `Tu peux tout lui dire :
        <ul><li><b>Proposer</b> la paix, un pacte, une alliance, du commerce.</li>
        <li><b>Marchander</b> : s'il donne un prix, réponds « <i>d'accord</i> », « <i>trop cher, 100 or ?</i> » ou « <i>laisse tomber</i> ».</li>
        <li><b>Offrir</b> : « <i>je te donne 200 or si tu signes la paix</i> ».</li>
        <li><b>Menacer</b> : « <i>200 or ou je t'attaque</i> ». Mais une menace sans suite te fait perdre ta crédibilité !</li></ul>
        Les <b>boutons au-dessus</b> de la zone de texte t'aident à composer une offre sans rien écrire.` },
    { titre: 'Les alliances se méritent',
      texte: `Une alliance se <b>plaide</b> : donne de vraies raisons (« <i>nous avons un ennemi commun</i> ») et
        le prix baisse. Mais attention, <b>c'est vérifié</b> : un argument faux fait monter le prix !
        <br><br>Une alliance dure <b>60 mois</b>. La rompre avant, c'est une trahison : ta tête est mise à prix
        et tout le monde voudra t'attaquer.` },
  ]
},
{
  nom: 'Le Conseil de la Couronne', icone: '👑',
  etapes: [
    { type: 'action', titre: 'Ton conseiller', cible: '#side', dit: 'Ouvre le Conseil.',
      entree: ()=> { ongletActif('chat'); S.chatOuvert = null; if(typeof oublierRendu === 'function') oublierRendu(); majUI(); },
      texte: `Tu n'es pas seul : le <b>Conseil de la Couronne</b> t'aide à gérer ton pays.
        <br><br>👉 Clique sur <b>Conseil de la Couronne</b>, en haut de la liste.`,
      fait: ()=> S.chatOuvert === -1 },
    { type: 'action', titre: 'Pose-lui une question', cible: '#side',
      entree: b => { b.msgs = T_.msgsConseil(); },
      texte: `👉 Clique sur une des <b>suggestions</b> (par exemple « <i>Que dois-je faire en priorité ?</i> »)
        ou écris ta propre question.`,
      fait: b => T_.msgsConseil() > b.msgs },
    { titre: 'Il obéit aussi aux ordres',
      texte: `Le Conseil répond aux questions (« <i>Pourquoi mon peuple est mécontent ?</i> », « <i>Puis-je battre Valoria ?</i> »,
        « <i>Où en serai-je dans 24 mois ?</i> »)… et <b>exécute tes ordres</b> :
        <ul><li>« <i>Construis une ferme</i> »</li><li>« <i>Recrute 5 soldats</i> »</li>
        <li>« <i>Monte les impôts à 40 %</i> »</li><li>« <i>Recherche la navigation</i> »</li></ul>` },
  ]
},
{
  nom: 'La mer', icone: '⛵',
  etapes: [
    { titre: 'Traverser la mer',
      texte: `Le monde est fait de plusieurs <b>îles</b>. Sans flotte, impossible d'aller sur une autre île !
        <br><br>Il te faut :
        <ul><li>🔬 la technologie <b>Navigation</b> ;</li>
        <li>🏖️ une province au bord de la mer ;</li>
        <li>⛵ des <b>navires</b> (onglet Armée) : chacun transporte 3 unités.</li></ul>
        Tu pourras alors fonder un <b>comptoir outre-mer</b> sur une terre libre, ou <b>débarquer</b> chez un ennemi.
        Mais les troupes débarquées ne frappent qu'à 70 % de leur force.` },
  ]
},
{
  nom: 'Le temps et la partie', icone: '⏱️',
  etapes: [
    { titre: 'Le temps', cible: '.timectl',
      texte: `Le temps passe <b>mois par mois</b>. Ici tu règles la vitesse (<b>0,5×</b> à <b>4×</b>) ou tu mets
        en <b>pause</b> (touche <kbd>Espace</kbd>).
        <br><br>En pause, tu peux discuter et recruter, mais pas construire : sinon ce serait trop facile !` },
    { titre: 'Les boutons de la partie', cible: '.outils',
      texte: `De gauche à droite : <b>sauvegarder</b>, <b>charger</b>, <b>nouvelle partie</b>, <b>règles</b> (<kbd>H</kbd>),
        <b>tutoriel</b> 🎓 et <b>son</b> 🔊 (clique pour couper la voix, puis tout le son).
        <br><br>La partie est aussi sauvegardée toute seule chaque 1<sup>er</sup> janvier.` },
    { titre: 'Les raccourcis',
      texte: `<ul><li><kbd>Espace</kbd> : pause</li><li><kbd>C</kbd> : revenir à ta capitale</li>
        <li><kbd>F</kbd> : voir tout le monde</li><li><kbd>flèches</kbd> ou <kbd>WASD</kbd> : déplacer la carte</li>
        <li><kbd>M</kbd> : mini-carte</li><li><kbd>H</kbd> : règles du jeu</li></ul>` },
    { titre: 'Comment gagner',
      texte: ()=> `${S.finMois
          ? `Ta partie dure <b>${Math.round(S.finMois/12)} ans</b> : s'il n'y a pas eu de victoire avant, le meilleur <b>score de civilisation</b> gagne (territoire, économie, savoir, puissance, prospérité, diplomatie).`
          : `Tu joues une <b>partie longue</b> : pas d'horloge, seulement des victoires.`}
        <br><br>🏆 <b>Cinq victoires anticipées</b>, pour toi comme pour l'IA : <b>domination</b> (la moitié des terres),
        <b>savoir</b> (toutes les technologies), <b>richesse</b> (15 000 or), <b>diplomatie</b> (alliés de la moitié du monde, sans guerre)
        et <b>âge d'or</b> (24 mois de prospérité). Ta progression est dans l'onglet <b>Pays</b>.
        <br><br>💡 <b>Mes conseils :</b>
        <ul><li>Colonise vite les terres libres au début.</li>
        <li>Garde toujours de la nourriture et un bonheur au-dessus de 50.</li>
        <li>Fais des pactes avec tes voisins forts, attaque les faibles.</li>
        <li>Demande conseil au Conseil quand tu hésites !</li></ul>` },
    { type: 'action', titre: 'À toi de régner !', cible: '#btnPause', dit: 'À toi de jouer !',
      texte: `Tu sais tout ! 👉 Appuie sur <kbd>Espace</kbd> ou sur le bouton <b>▶</b> pour lancer le temps.
        <br><br>Bonne chance, souverain. 👑`,
      fait: ()=> !S.paused, fin: true },
  ]
},
];

/* ===========================================================
   MÉCANIQUE
   =========================================================== */

function tutoElements(){
  if(document.getElementById('tutoHalo')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="tutoVoile" class="hidden"></div>
    <div id="tutoHalo" class="hidden"></div>
    <div id="tutoBulle" class="hidden">
      <div class="tutotete">
        <span class="tutoguide">🦉</span>
        <div class="tutotitres"><span id="tutoChap"></span><b id="tutoTitre"></b></div>
        <button id="tutoX" title="Quitter le tutoriel">✕</button>
      </div>
      <div class="tutoprog"><i id="tutoProg"></i></div>
      <div id="tutoTexte"></div>
      <div id="tutoAction" class="hidden"><span class="tutopulse"></span> À toi de jouer…</div>
      <div class="tutobtns">
        <button id="tutoPrec" class="btn mini">‹ Retour</button>
        <button id="tutoPasser" class="tutolien">Passer cette étape</button>
        <button id="tutoSuiv" class="btn mini">Suivant ›</button>
      </div>
    </div>
    <div id="tutoMenu" class="hidden"><div class="tutomenubox">
      <button id="tutoMenuX" class="aideX" title="Fermer">✕</button>
      <h2>🎓 Tutoriel</h2>
      <p class="muted" id="tutoMenuNote">Suis tout le tutoriel, ou révise un seul chapitre.</p>
      <button class="btn" id="tutoTout">▶ Tout le tutoriel (environ 5 minutes)</button>
      <div id="tutoListe"></div>
    </div></div>`);

  document.getElementById('tutoX').onclick = ()=> tutoFin(false);
  document.getElementById('tutoSuiv').onclick = ()=> tutoAller(TUTO.i + 1);
  document.getElementById('tutoPrec').onclick = ()=> tutoAller(TUTO.i - 1);
  document.getElementById('tutoPasser').onclick = ()=> tutoAller(TUTO.i + 1);
  document.getElementById('tutoMenuX').onclick = ()=> document.getElementById('tutoMenu').classList.add('hidden');
  document.getElementById('tutoTout').onclick = ()=> tutoDemarrer(0);
  // les touches du jeu ne s'appliquent pas pendant qu'on lit une bulle… sauf Espace à la dernière étape
  window.addEventListener('resize', ()=> TUTO.actif && tutoPlacer());
}

/* --- menu des chapitres (bouton 🎓) --- */
function tutoMenu(){
  tutoElements();
  const enPartie = document.getElementById('accueil').classList.contains('hidden') && S.player;
  document.getElementById('tutoMenuNote').innerHTML = enPartie
    ? 'Suis tout le tutoriel, ou révise un seul chapitre.'
    : 'Lance d\'abord une partie : le tutoriel te sera proposé dès le début.';
  let h = '';
  CHAPITRES.forEach((c, k) => {
    h += `<button class="btn tutochap" data-chap="${k}" ${enPartie?'':'disabled'}>
      <span>${c.icone}</span> ${k+1}. ${c.nom}<span class="cost">${c.etapes.length} étape${c.etapes.length>1?'s':''}</span></button>`;
  });
  document.getElementById('tutoListe').innerHTML = h;
  document.getElementById('tutoTout').disabled = !enPartie;
  document.querySelectorAll('.tutochap').forEach(b => b.onclick = ()=> tutoDemarrer(+b.dataset.chap, true));
  document.getElementById('tutoMenu').classList.remove('hidden');
}

/* --- proposition au lancement : juste après l'introduction ---
   À la toute première partie, on propose tout le tutoriel ; ensuite, le même
   menu revient pour réviser un chapitre, et se ferme d'un clic. */
function tutoProposer(apresIntro){
  let fait = false;
  try{ fait = !!localStorage.getItem(TUTO.CLE); }catch(e){}
  if(fait && !apresIntro) return;
  tutoElements();
  tutoMenu();
  document.getElementById('tutoMenuNote').innerHTML = fait
    ? '<b>Ton pays est né.</b> Envie de revoir les bases ? Choisis un chapitre, ou ferme avec ✕ pour jouer.'
    : '<b>C\'est ta première partie ?</b> Je te montre tout, pas à pas. Le temps reste arrêté pendant le tutoriel.';
  if(typeof SON !== 'undefined') SON.jouer('tuto');
}

function tutoDemarrer(chap, seul){
  document.getElementById('tutoMenu').classList.add('hidden');
  const chapitres = seul ? [CHAPITRES[chap]] : CHAPITRES.slice(chap);
  TUTO.etapes = [];
  chapitres.forEach(c => c.etapes.forEach((e, k) =>
    TUTO.etapes.push({...e, chap: c, num: k+1, type: e.type || 'info'})));
  // un chapitre rejoué seul ne se termine pas par « lance le temps »
  if(seul) TUTO.etapes = TUTO.etapes.filter(e => !e.fin);
  TUTO.actif = true;
  TUTO.pauseAvant = S.paused;
  S.paused = true; majVitesse();
  fermerAide && fermerAide();
  document.body.classList.add('entuto');
  tutoAller(0);
}

function tutoAller(i){
  if(i < 0) i = 0;
  if(i >= TUTO.etapes.length) return tutoFin(true);
  TUTO.i = i;
  TUTO.reussie = false;
  const e = TUTO.etapes[i];
  // si le joueur a relancé le temps entre deux étapes, on le fige de nouveau
  if(!S.paused){ S.paused = true; majVitesse(); }
  // une étape d'action impossible dans ce monde (plus de terre libre…) est sautée
  if(e.type === 'action' && e.passerSi && e.passerSi()) return tutoAller(i + 1);

  TUTO.base = {ouvrages: T_.ouvrages(), provinces: T_.provinces(), unites: T_.unites(), taxe: S.player.taxe};
  if(e.entree) e.entree(TUTO.base);
  // la dernière étape demande de relancer le temps : on ne le fige plus
  if(e.fin){ S.paused = true; majVitesse(); }

  const txt = typeof e.texte === 'function' ? e.texte() : e.texte;
  const chapIndex = CHAPITRES.indexOf(e.chap);
  document.getElementById('tutoChap').textContent =
    `${e.chap.icone} Chapitre ${chapIndex+1} · ${e.chap.nom} — ${e.num}/${e.chap.etapes.length}`;
  document.getElementById('tutoTitre').textContent = e.titre;
  document.getElementById('tutoTexte').innerHTML = txt;
  document.getElementById('tutoProg').style.width = `${Math.round((i+1)/TUTO.etapes.length*100)}%`;
  document.getElementById('tutoPrec').style.visibility = i > 0 ? 'visible' : 'hidden';
  const action = e.type === 'action';
  document.getElementById('tutoSuiv').classList.toggle('hidden', action);
  document.getElementById('tutoPasser').classList.toggle('hidden', !action);
  document.getElementById('tutoAction').classList.toggle('hidden', !action);
  document.getElementById('tutoSuiv').textContent = i === TUTO.etapes.length-1 ? 'Terminer ✓' : 'Suivant ›';

  ['tutoBulle','tutoHalo','tutoVoile'].forEach(id => document.getElementById(id).classList.remove('hidden'));
  document.getElementById('tutoBulle').classList.remove('bravo');
  document.getElementById('tutoBulle').classList.add('neuf');
  setTimeout(()=> document.getElementById('tutoBulle').classList.remove('neuf'), 350);
  tutoPlacer();

  if(typeof SON !== 'undefined'){
    SON.jouer('tuto');
    if(e.dit) SON.dire(e.dit, true);
  }

  clearInterval(TUTO.minuteur);
  TUTO.minuteur = setInterval(tutoSurveiller, 250);
}

/* --- surveille le geste attendu, et suit la zone éclairée si elle bouge --- */
function tutoSurveiller(){
  if(!TUTO.actif) return clearInterval(TUTO.minuteur);
  const e = TUTO.etapes[TUTO.i];
  tutoPlacer();
  if(e.type !== 'action' || TUTO.reussie) return;
  let ok = false;
  try{ ok = e.fait(TUTO.base); }catch(err){ ok = false; }
  if(!ok) return;
  TUTO.reussie = true;
  document.getElementById('tutoBulle').classList.add('bravo');
  document.getElementById('tutoAction').innerHTML = '✅ Bravo !';
  if(typeof SON !== 'undefined'){ SON.jouer('reussi'); if(!e.fin) SON.direUn(PHRASES.bravo, true); }
  setTimeout(()=>{
    document.getElementById('tutoAction').innerHTML = '<span class="tutopulse"></span> À toi de jouer…';
    if(TUTO.actif && TUTO.etapes[TUTO.i] === e) tutoAller(TUTO.i + 1);
  }, 2200);
}

/* --- projecteur et bulle : la bulle se pose là où elle ne cache pas la cible --- */
function tutoPlacer(){
  const e = TUTO.etapes[TUTO.i];
  const halo = document.getElementById('tutoHalo');
  const voile = document.getElementById('tutoVoile');
  const bulle = document.getElementById('tutoBulle');
  const cible = e && e.cible ? document.querySelector(e.cible) : null;
  const r = cible && cible.offsetParent !== null ? cible.getBoundingClientRect() : null;
  const W = innerWidth, H = innerHeight, marge = 12;

  if(r && r.width > 0){
    const pad = 6;
    Object.assign(halo.style, {left:(r.left-pad)+'px', top:(r.top-pad)+'px',
      width:(r.width+pad*2)+'px', height:(r.height+pad*2)+'px'});
    halo.classList.remove('centre');
    voile.classList.add('hidden');
  } else {
    halo.classList.add('centre');
    voile.classList.remove('hidden');
  }

  const bw = Math.min(380, W - marge*2);
  bulle.style.width = bw + 'px';
  const bh = bulle.offsetHeight || 260;
  let x, y;
  if(!r || !r.width){
    x = (W - bw)/2; y = Math.max(marge, (H - bh)/2);
  } else {
    // on essaie à gauche, à droite, dessous, dessus ; sinon dans le coin le plus libre
    const essais = [
      [r.left - bw - 18, r.top + r.height/2 - bh/2],
      [r.right + 18,     r.top + r.height/2 - bh/2],
      [r.left + r.width/2 - bw/2, r.bottom + 18],
      [r.left + r.width/2 - bw/2, r.top - bh - 18],
    ];
    const tient = ([a,b]) => a >= marge && b >= marge && a + bw <= W - marge && b + bh <= H - marge;
    const bon = essais.find(tient);
    if(bon){ [x, y] = bon; }
    else {
      // la cible occupe une grande zone (la carte) : on se pose dans le coin opposé au centre de la cible
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      x = cx > W/2 ? marge : W - bw - marge;
      y = cy > H/2 ? marge + 56 : H - bh - marge;
      if(r.width > W*0.5 && r.height > H*0.5){ x = marge; y = H - bh - marge; }
    }
  }
  bulle.style.left = Math.round(Math.max(marge, Math.min(W - bw - marge, x))) + 'px';
  bulle.style.top  = Math.round(Math.max(marge, Math.min(H - bh - marge, y))) + 'px';
}

function tutoFin(complet){
  TUTO.actif = false;
  clearInterval(TUTO.minuteur);
  ['tutoBulle','tutoHalo','tutoVoile'].forEach(id => document.getElementById(id).classList.add('hidden'));
  document.body.classList.remove('entuto');
  try{ localStorage.setItem(TUTO.CLE, '1'); }catch(e){}
  const derniere = TUTO.etapes[TUTO.etapes.length-1];
  // un chapitre révisé seul rend la partie dans l'état où on l'avait trouvée
  if(!(complet && derniere && derniere.fin)) S.paused = TUTO.pauseAvant !== undefined ? TUTO.pauseAvant : S.paused;
  if(complet){
    if(typeof SON !== 'undefined'){
      SON.jouer('victoire');
      SON.dire(derniere && derniere.fin ? 'Bravo ! Tu as terminé le tutoriel. Bon règne !' : 'Chapitre terminé. Bravo !', true);
    }
  }
  majVitesse();
}

/* --- Espace ne relance le temps qu'à la dernière étape, celle qui le demande --- */
window.addEventListener('keydown', e => {
  if(!TUTO.actif || e.code !== 'Space') return;
  if(/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) return;
  const etape = TUTO.etapes[TUTO.i];
  if(etape && etape.fin) return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);

/* --- branchements --- */
(()=>{
  const b = document.getElementById('btnTuto');
  if(b) b.onclick = tutoMenu;
})();
