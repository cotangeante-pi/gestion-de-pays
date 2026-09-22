/* ===========================================================
   IA DIPLOMATIQUE — 1/3 : COMPRÉHENSION
   Pas de liste de questions : le texte est découpé, chaque mot
   est projeté dans un espace de concepts, et l'acte de langage
   est trouvé par similarité cosinus avec des prototypes.
   Les mots inconnus sont rapprochés par similarité de forme.
   =========================================================== */

/* ---------- normalisation & radicaux ---------- */
const sansAccents = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

const FINALES = ['issements','issement','erions','eriez','erons','eront','aient','asses','ions','iez',
                 'ements','ement','ateur','ation','ances','ance','ences','ence','eurs','euse','eux',
                 'ais','ait','ant','ons','ont','ez','er','ir','re','es','s','e'];
function radical(m){
  if(m.length <= 4) return m;
  for(const f of FINALES){
    if(m.length - f.length >= 4 && m.endsWith(f)) return m.slice(0, -f.length);
  }
  return m;
}
function bigrammes(m){
  const s = ' ' + m + ' ', out = [];
  for(let i=0;i<s.length-1;i++) out.push(s.slice(i,i+2));
  return out;
}
function dice(a, b){                       // similarité de forme (fautes de frappe, variantes)
  const A = bigrammes(a), B = new Set(bigrammes(b));
  let c = 0; for(const g of A) if(B.has(g)) c++;
  return 2*c / (A.length + B.size);
}

/* ---------- lexique : mot → concepts pondérés ----------
   CONCEPTS : paix guerre menace argent don demande echange
   union confiance hostilite aide question etat avis moi toi
   temps quantite politesse insulte excuse accord refus force  */
const LEX = {
  // paix / fin des hostilités
  paix:{paix:1, accord:.4}, armistice:{paix:1}, treve:{paix:.9}, cessez:{paix:.8},
  reconcili:{paix:.8, union:.4}, depos:{paix:.6}, apais:{paix:.7}, hostilit:{guerre:.6},
  arret:{paix:.55}, cess:{paix:.6}, fini:{paix:.4}, stopp:{paix:.5},
  battr:{guerre:.8}, bat:{guerre:.6}, ruin:{guerre:.3, argent:.4}, epuis:{guerre:.4},
  sang:{guerre:.6}, massacr:{guerre:.7}, fossoyeur:{guerre:.4},
  // guerre
  guerre:{guerre:1}, bataill:{guerre:.8}, combat:{guerre:.8}, envah:{guerre:.9, menace:.5},
  attaqu:{guerre:.8, menace:.6}, detru:{guerre:.7, menace:.8}, ecras:{guerre:.7, menace:.8},
  arme:{force:.8, guerre:.4}, troup:{force:.9}, soldat:{force:.9}, legion:{force:.8},
  frontier:{menace:.45, etat:.2}, reflech:{menace:.3}, mobilis:{force:.7, menace:.4},
  canon:{force:.7}, invasion:{guerre:.9},
  // menace / soumission
  menac:{menace:1}, ultimatum:{menace:.9, demande:.4}, sinon:{menace:.6, echange:.3},
  capitul:{menace:.7, force:.4}, soumet:{menace:.8}, rend:{menace:.5}, obei:{menace:.6},
  crain:{menace:.4}, peur:{menace:.4}, prevenir:{menace:.3},
  // argent
  or:{argent:1}, piec:{argent:.8}, tresor:{argent:.8}, riches:{argent:.7}, payer:{argent:.8, don:.4},
  pay:{argent:.7}, vers:{argent:.6, don:.5}, tribut:{argent:.8, menace:.4}, financ:{argent:.7},
  pret:{argent:.7, demande:.5}, dette:{argent:.6}, coffre:{argent:.6}, subside:{argent:.7, don:.4},
  // donner / demander
  donn:{don:.9}, offr:{don:.9}, cadeau:{don:1}, present:{don:.6}, generos:{don:.7},
  tiens:{don:.9}, voici:{don:.8}, prend:{demande:.2, don:.3}, demand:{demande:.9},
  besoin:{demande:.85}, veux:{demande:.5},
  voudrais:{demande:.6}, exig:{demande:.9, menace:.4}, reclam:{demande:.8},
  // échange / condition
  echang:{echange:.9}, contre:{echange:.7}, si:{echange:.5}, retour:{echange:.6},
  condition:{echange:.7}, marche:{echange:.6, accord:.5}, negoci:{echange:.8},
  commerc:{echange:.8, argent:.5}, route:{echange:.4}, port:{echange:.3}, marchand:{echange:.6, argent:.5},
  // union / traités
  pact:{union:.8, paix:.55}, nonagression:{union:.85, paix:.8}, cessezlefeu:{paix:1},
  alliance:{union:1, aide:.65, confiance:.4}, alli:{union:.9, aide:.5}, banniere:{union:.7, aide:.5},
  unir:{union:.85, aide:.35}, uniss:{union:.85, aide:.35}, union:{union:.9},
  ensemble:{union:.6, aide:.5}, traite:{union:.7, accord:.5},
  daccord:{accord:1}, declareguerre:{guerre:1, hostilite:.6}, enechange:{echange:.85},
  agression:{union:.4, guerre:.4}, neutralit:{union:.6, paix:.4}, front:{guerre:.6},
  // aide
  aide:{aide:1}, aid:{aide:.9}, secour:{aide:.8}, soutien:{aide:.8}, renfort:{aide:.7, force:.4},
  rejoign:{aide:.7, union:.5}, rejoins:{aide:.7, union:.5}, epaule:{aide:.6},
  // confiance / hostilité
  confian:{confiance:.9}, fidel:{confiance:.8}, loyaut:{confiance:.8}, ami:{confiance:.7, union:.4},
  parole:{confiance:.7}, honneur:{confiance:.6, politesse:.4}, trahi:{hostilite:.9, confiance:-.8},
  mensong:{hostilite:.6, confiance:-.6}, ennemi:{hostilite:.8}, hai:{hostilite:.9}, mepris:{hostilite:.7},
  // politesse / insulte / excuse
  bonjour:{salutation:1}, salut:{salutation:.9}, bonsoir:{salutation:.9}, hello:{salutation:.8},
  majest:{politesse:.6, salutation:.3}, seigneur:{politesse:.5, salutation:.2},
  merci:{politesse:.8, accord:.3}, respect:{politesse:.8, confiance:.4}, admir:{politesse:.9},
  felicit:{politesse:.8}, bravo:{politesse:.7}, sagess:{politesse:.6}, remarquabl:{politesse:.8},
  magnifiqu:{politesse:.7}, impressionn:{politesse:.7}, noble:{politesse:.6},
  idiot:{insulte:1}, imbecil:{insulte:1}, stupid:{insulte:.9}, lache:{insulte:.9},
  minabl:{insulte:.9}, vermin:{insulte:.9}, chien:{insulte:.7}, bouffon:{insulte:.9},
  incapabl:{insulte:.8}, pourri:{insulte:.8}, ferme:{insulte:.5},
  desol:{excuse:1}, excus:{excuse:1}, pardon:{excuse:1}, regrett:{excuse:.9}, tort:{excuse:.7},
  emport:{excuse:.5},
  // accord / refus
  accord:{accord:.9}, accept:{accord:.9}, entendu:{accord:.8}, conclu:{accord:.8},
  oui:{accord:.7}, soit:{accord:.5}, top:{accord:.6}, va:{accord:.2},
  non:{refus:.9}, jamais:{refus:.9}, refus:{refus:1}, hors:{refus:.5}, oubli:{refus:.6},
  laiss:{refus:.4}, tomb:{refus:.3}, cher:{refus:.4, argent:.5}, trop:{refus:.5, quantite:.4},
  moins:{refus:.3, quantite:.5}, baiss:{refus:.4, quantite:.5},
  // questions / état / avis
  comment:{question:.8}, pourquoi:{question:.8}, quand:{question:.7}, combien:{question:.7, quantite:.6},
  qui:{question:.5}, quel:{question:.6}, pens:{question:.5, avis:.8}, avis:{avis:1},
  sais:{question:.5, avis:.4}, parl:{question:.4, avis:.5}, situation:{etat:.9},
  etat:{etat:.9}, pays:{etat:.6, toi:.3}, peuple:{etat:.6}, provinc:{etat:.6},
  nouvelle:{etat:.5}, sante:{etat:.7}, porte:{etat:.35}, royaum:{etat:.5},
  nation:{etat:.5}, unir:{union:.85}, uniss:{union:.85}, union:{union:.9},
  sign:{accord:.55, union:.3}, parchemin:{accord:.4, union:.3},
};
let CLES_LEX = Object.keys(LEX);   // réindexé après chaque extension du lexique

/* ---------- vecteur de concepts d'une phrase ---------- */
function vectoriser(mots){
  const v = {};
  for(const brut of mots){
    const m = radical(brut);
    let poids = LEX[m];
    if(!poids){                                  // mot inconnu : plus proche voisin de forme
      let best = null, bs = 0;
      for(const c of CLES_LEX){
        if(Math.abs(c.length - m.length) > 4) continue;
        const s = dice(m, c);
        if(s > bs){ bs = s; best = c; }
      }
      if(bs > 0.62) poids = Object.fromEntries(Object.entries(LEX[best]).map(([k,x])=>[k, x*bs]));
    }
    if(poids) for(const [c,x] of Object.entries(poids)) v[c] = (v[c]||0) + x;
  }
  return v;
}
const cos = (a,b) => {
  let d=0, na=0, nb=0;
  for(const k in a){ na += a[k]*a[k]; if(b[k]) d += a[k]*b[k]; }
  for(const k in b) nb += b[k]*b[k];
  return (na && nb) ? d/Math.sqrt(na*nb) : 0;
};

/* ---------- prototypes d'actes de langage ---------- */
const ACTES = {
  PAIX:        {paix:1, accord:.25, guerre:.35},
  GUERRE:      {guerre:1, hostilite:.4},
  PACTE:       {union:.85, paix:.75},
  ALLIANCE:    {union:1, aide:.8, confiance:.3},
  COMMERCE:    {echange:1, argent:.6},
  AIDE_GUERRE: {aide:1, guerre:.6, union:.3},
  MENACE:      {menace:1, force:.55},
  INSULTE:     {insulte:1},
  EXCUSE:      {excuse:1},
  COMPLIMENT:  {politesse:1, confiance:.35},
  SALUT:       {salutation:1},
  OFFRE_OR:    {don:1, argent:.9},
  DEMANDE_OR:  {demande:1, argent:.9},
  ETAT:        {etat:1, question:.5},
  AVIS:        {avis:1, question:.5},
  ACCORD:      {accord:1},
  REFUS:       {refus:1},
  QUESTION:    {question:1},
};

/* ---------- analyse complète d'un message ---------- */
const EXPRESSIONS = [
  [/\bnon ?-? ?agression\b/g, 'nonagression'], [/\bcessez le feu\b/g, 'cessezlefeu'],
  [/\ben echange\b/g, 'enechange'], [/\bd accord\b/g, 'daccord'],
  [/\bmarche conclu\b/g, 'daccord'], [/\bhors de question\b/g, 'refuse'],
  [/\bcote a cote\b/g, 'alliance'], [/\broute commerciale\b/g, 'commerce'],
  [/\bdeclare la guerre\b/g, 'declareguerre'], [/\bque penses tu\b/g, 'avis'],
  [/\bton avis\b/g, 'avis'], [/\bqu en penses tu\b/g, 'avis'],
];
/* ---------- rattacher un nombre au nom qu'il qualifie ---------- */
// « recrute 3 chars » → 3 ; « 3 chars contre 500 or » → 3, pas 500
function nombreAccole(mots, motif){
  for(let i=0;i<mots.length;i++){
    if(!motif.test(radical(mots[i]))) continue;
    for(let d=1; d<=2; d++){
      if(i-d >= 0 && /^\d{1,4}$/.test(mots[i-d])) return +mots[i-d];
      if(i+d < mots.length && /^\d{1,4}$/.test(mots[i+d])) return +mots[i+d];
    }
  }
  return null;
}

function comprendre(txt, n, domaine, sansDecoupe){
  let propre = ' ' + sansAccents(txt).replace(/[^a-z0-9%?!]+/g,' ') + ' ';
  for(const [ex, rem] of EXPRESSIONS) propre = propre.replace(ex, rem);
  // tournures propres au Conseil : « a quoi sert », « combien j ai », « la plus riche »…
  if(domaine === 'conseil' && typeof EXPRESSIONS_CONSEIL !== 'undefined')
    for(const [ex, rem] of EXPRESSIONS_CONSEIL) propre = propre.replace(ex, rem);
  if(domaine !== 'conseil' && typeof EXPRESSIONS_DIPLO !== 'undefined')
    for(const [ex, rem] of EXPRESSIONS_DIPLO) propre = propre.replace(ex, rem);
  const mots = propre.trim().split(/\s+/).filter(Boolean);

  // fragments : « je te donne 300 or SI tu signes un pacte » → deux volets
  const coupures = /\b(si|contre|en echange|sinon|mais|puis|et ensuite|a condition)\b/;
  const volets = propre.split(coupures).filter(f => f && !coupures.test(' '+f.trim()+' '))
                       .map(f => f.trim().split(/\s+/).filter(Boolean));
  const conditionnel = coupures.test(propre);

  // questions composées : « combien coûte une usine ET où la mettre ? » → deux analyses
  let sousQuestions = null;
  if(domaine === 'conseil' && !sansDecoupe){
    const sep = /\s(?:et(?:\s+aussi)?|puis(?!\s+je)|ensuite|egalement)\s/;
    const parts = propre.trim().split(sep).map(f=>f.trim()).filter(f => f.split(/\s+/).length >= 2);
    if(parts.length >= 2 && parts.length <= 3){
      const sous = parts.map(f => comprendre(f, n, domaine, true));
      // on ne scinde que si les fragments parlent réellement de choses différentes
      const distincts = new Set(sous.filter(a => a.score > 0.3).map(a => a.acte));
      if(distincts.size >= 2) sousQuestions = sous;
    }
  }

  // négation portée sur la phrase
  const negation = /\b(ne|n|pas|jamais|aucun|aucune|plus|sans|refuse|nullement)\b/.test(propre)
                 && /\b(pas|jamais|aucun|aucune|plus|sans|nullement|refuse)\b/.test(propre);

  // entités — chaque nombre est rattaché à ce qu'il qualifie
  const pourcentM = propre.match(/(\d{1,3})\s*%/);
  const horizonM  = propre.match(/\b(\d{1,3})\s*(mois|ans?|annees?)\b/);
  const consommes = new Set();                      // nombres déjà interprétés
  if(pourcentM) consommes.add(+pourcentM[1]);
  if(horizonM)  consommes.add(+horizonM[1]);

  const chiffres = (propre.match(/\b\d{1,9}\b/g) || []).map(Number);
  const libres   = chiffres.filter(x => !consommes.has(x));
  // un montant d'or est le plus grand nombre libre ; une quantité est celle collée au nom
  const montant  = libres.length ? Math.max(...libres) : null;
  const quantite = nombreAccole(mots, /^(infanteri|soldat|fantassin|artilleri|canon|char|tank|blinde|avion|chasseur|navire|bateau|flotte|vaisseau|ferme|mine|port|usine|centrale|universit|ecole|caserne|province|unite)/);

  const cible    = S.nations.find(o => o !== n && !o.joueur &&
                     propre.includes(' ' + sansAccents(o.nom) + ' '));
  const interro  = /\?/.test(txt) || /\b(comment|pourquoi|combien|quand|quel|quelle|qui|que|est ce)\b/.test(propre);

  // classement par similarité, restreint au domaine de l'interlocuteur
  const v = vectoriser(mots);
  const permis = (typeof DOMAINES !== 'undefined' && domaine) ? DOMAINES[domaine] : null;
  const scores = Object.entries(ACTES)
      .filter(([a]) => !permis || permis.includes(a))
      .map(([a, proto]) => ({acte:a, score: cos(v, proto)}))
      .sort((x,y) => y.score - x.score);
  const top = scores[0], second = scores[1];
  const confiance = top.score - (second ? second.score*0.6 : 0);

  // volets (pour les offres conditionnelles) : acte dominant de chaque fragment
  const actesVolets = volets.length > 1 ? volets.map(f => {
    const s = Object.entries(ACTES).filter(([a]) => !permis || permis.includes(a))
                    .map(([a,p])=>({acte:a, score:cos(vectoriser(f), p)}))
                    .sort((x,y)=>y.score-x.score)[0];
    return s && s.score > 0.25 ? s.acte : null;
  }).filter(Boolean) : [];

  let acte = top.acte, score = top.score, regle = null;
  const G = k => v[k] || 0;
  const pourcent = pourcentM ? pourcentM[1] : undefined;

  // --- domaine « conseil » : la cascade de règles vit dans ia-gestion.js ---
  if(domaine === 'conseil'){
    const base = {mots, propre, vecteur:v, scores, acte, score, confiance, regle:null,
                  montant, quantite, cible, negation, conditionnel, interro, actesVolets,
                  sousQuestions,
                  pourcent: pourcent !== undefined ? +pourcent : null,
                  horizon: horizonM,
                  politesse:G('politesse')+G('salutation'), agressivite:0};
    return acteConseil(base, G);
  }

  // --- interprétation : le sens naît de la combinaison des concepts ---
  if(G('guerre') > .3 && G('paix') > .3)                     { acte='PAIX';   regle='guerre + cessation → demande de paix'; }
  else if(G('guerre') > .4 && negation && G('menace') < .5)  { acte='PAIX';   regle='guerre niée → refus d\'en découdre'; }
  else if(G('force') > .7 && G('guerre') < .6 && G('paix') < .3 && G('union') < .4)
                                                             { acte='MENACE'; regle='étalage de forces sans projet de paix'; }
  if(interro && G('etat') > .3 && G('avis') < .5)            { acte='ETAT';   regle='question sur son pays'; }
  if(interro && G('avis') > .4 && cible)                     { acte='AVIS';   regle='question sur un tiers'; }
  if(G('don') > .5 && G('argent') > .4 && !conditionnel)     { acte='OFFRE_OR';   regle='don explicite'; }
  if(G('demande') > .6 && G('argent') > .5)                  { acte='DEMANDE_OR'; regle='demande portant sur de l\'or'; }
  if(G('union') > .5 && cible && G('aide') > .2)             { acte='AIDE_GUERRE'; regle='union proposée contre un tiers'; }

  // offre à deux volets : « X or SI tu signes Y »
  const traite = actesVolets.find(a => ['PAIX','PACTE','ALLIANCE','COMMERCE','AIDE_GUERRE'].includes(a));
  let volet = null;
  if(conditionnel && traite && (G('don') > .3 || montant !== null)){
    acte = 'CONDITION'; volet = traite; regle = 'offre à deux volets : or contre traité';
  }

  return {mots, propre, vecteur:v, scores, acte, score, confiance, regle, volet,
          montant, quantite, cible, negation, conditionnel, interro, actesVolets,
          politesse: G('politesse') + G('salutation'),
          agressivite: G('insulte') + G('menace') + G('hostilite')};
}

/* ===========================================================
   IA DIPLOMATIQUE — 2/3 : RAISONNEMENT
   L'IA ne suit pas des seuils écrits à la main : elle mesure
   l'état du monde, projette l'état qui résulterait de chaque
   option, et choisit celle qui maximise son utilité. Le prix
   d'une contre-proposition est son point d'indifférence.
   =========================================================== */

/* ---------- ce à quoi chaque dirigeant tient ---------- */
function poidsObjectifs(n){
  const k = perso(n);
  const w = {
    survie:    0.30 + (1-k.agressivite)*0.25 + (n.bonheur < 40 ? 0.1 : 0),
    richesse:  0.15 + k.cupidite*0.40,
    expansion: 0.10 + k.agressivite*0.35,
    standing:  0.10 + k.loyaute*0.25 + k.chaleur*0.15,
    rancune:   0.05 + k.rancune*0.30,
  };
  const s = Object.values(w).reduce((a,b)=>a+b,0);
  for(const c in w) w[c] /= s;                 // normalisé : ce sont des priorités relatives
  return w;
}

/* ---------- mesure de l'état du monde, vu par n ---------- */
function mesurer(n){
  const p = S.player;
  const b = bilan(n);
  const vivantes = S.nations.filter(o => tuilesDe(o).length > 0);
  const moyProv = vivantes.reduce((s,o)=>s+tuilesDe(o).length,0) / Math.max(1,vivantes.length);

  // menace : puissance des nations hostiles, pondérée par la guerre, la frontière et la confiance
  let menace = 0;
  const detail = [];
  for(const o of vivantes){
    if(o === n) continue;
    let coef = 0;
    if(n.guerre.has(o.id)) coef = 1;
    else if(n.allies.has(o.id)) coef = -0.35;
    else if(n.pacte.has(o.id)) coef = 0.12 * (1 - (o.joueur ? n.croyances.fiabilite : 0.7));
    else coef = 0.45 - rel(n,o)/300;
    if(frontiereCommune(n, o)) coef *= 1.55;
    if(o.joueur) coef *= 0.7 + n.croyances.menacePercue*0.8;
    const m = coef * ratioForce(o, n);
    menace += m;
    if(Math.abs(m) > 0.12) detail.push({nation:o, part:m});
  }

  const cout = n.guerre.size ? coutGuerre(n) : 0;
  return {
    securite:  1/(1 + Math.max(0, menace)),
    richesse:  Math.tanh((n.or/900) + b.net/45),
    expansion: Math.tanh(tuilesDe(n).length / Math.max(1,moyProv) - 1) * 0.5 + 0.5,
    standing:  clamp((moyenneRelations(n) + 100)/200 + n.allies.size*0.06, 0, 1),
    rancune:   clamp(-rel(n, p)/100, 0, 1),
    menace, coutGuerre:cout, detail, revenu:b.net, or:n.or,
  };
}

function frontiereCommune(a, b){
  for(const t of S.tiles.values()){
    if(t.owner !== a.id) continue;
    for(const d of DIRS){ const v = T(t.q+d[0], t.r+d[1]); if(v && v.owner === b.id) return true; }
  }
  return false;
}
function moyenneRelations(n){
  const autres = S.nations.filter(o => o !== n && tuilesDe(o).length);
  return autres.length ? autres.reduce((s,o)=>s+rel(n,o),0)/autres.length : 0;
}
function coutGuerre(n){
  // ce que la guerre lui coûte chaque mois : entretien + production perdue sur le front
  let perdu = 0;
  for(const t of S.tiles.values())
    if(t.owner === n.id && t.occ) perdu += t.occ.val * (TERRAIN[t.terr].food + 3);
  return Math.round(coutUp(n.armee)*0.5 + perdu*2 + n.guerre.size*6);
}

/* ---------- utilité globale ---------- */
function utilite(m, w){
  return w.survie*m.securite + w.richesse*m.richesse + w.expansion*m.expansion
       + w.standing*m.standing - w.rancune*m.rancune*0.6;
}

/* ---------- projection : à quoi ressemblerait le monde après X ---------- */
function projeterAction(n, action, par){
  const p = S.player, m = {...mesurer(n)}, k = perso(n), c = n.croyances;
  const f = [];                                    // facteurs explicatifs du calcul
  const conf = 0.35 + c.fiabilite*0.65;            // crédit accordé à la parole du joueur

  const menaceJoueur = ratioForce(p, n) * (n.guerre.has(p.id) ? 1 : 0.45) * (0.7 + c.menacePercue*0.8);

  switch(action){
    case 'PAIX': {
      m.menace -= menaceJoueur * conf;
      m.richesse = Math.tanh((n.or/900) + (m.revenu + m.coutGuerre)/45);
      f.push({quoi:'coutGuerre', pour:true, valeur:m.coutGuerre, texte:`cette guerre me coûte ${m.coutGuerre} or chaque mois`});
      f.push({quoi:'menaceLevee', pour:true, valeur:menaceJoueur, texte:`elle lèverait la menace que tu fais peser sur mes frontières`});
      if(gagneLaGuerre(n, p) > 0.6){
        m.expansion += 0.12;                        // il pense pouvoir gagner : la paix lui coûte des conquêtes
        f.push({quoi:'avantageMilitaire', pour:false, valeur:gagneLaGuerre(n,p),
                texte:`mes troupes tiennent l'avantage sur le terrain`});
      }
      break;
    }
    case 'PACTE': {
      m.menace -= menaceJoueur * 0.55 * conf;
      f.push({quoi:'fiabilite', pour: c.fiabilite > 0.5, valeur:c.fiabilite,
              texte:`je t'estime fiable à ${Math.round(c.fiabilite*100)}%`});
      f.push({quoi:'menaceReduite', pour:true, valeur:menaceJoueur*0.55, texte:`ma frontière avec toi deviendrait sûre`});
      break;
    }
    case 'ALLIANCE': {
      m.menace -= menaceJoueur * 0.8 * conf;
      m.menace -= ratioForce(p, n) * 0.25 * conf;   // sa force devient la mienne
      for(const e of p.guerre) if(!n.guerre.has(e))  // mais j'hérite de ses ennemis
        m.menace += ratioForce(S.nations[e], n) * 0.5;
      m.standing += 0.08;
      f.push({quoi:'appui', pour:true, valeur:ratioForce(p,n), texte:`ta puissance vaut ${ratioForce(p,n).toFixed(2)} fois la mienne et viendrait l'appuyer`});
      if(p.guerre.size) f.push({quoi:'heriteGuerres', pour:false, valeur:p.guerre.size,
              texte:`j'hériterais de ${p.guerre.size} de tes guerres`});
      break;
    }
    case 'COMMERCE': {
      const gain = bilan(n).gold * 0.08;
      m.richesse = Math.tanh((n.or/900) + (m.revenu + gain)/45);
      m.menace -= menaceJoueur * 0.12;
      f.push({quoi:'gainCommerce', pour:true, valeur:Math.round(gain),
              texte: gain >= 1.5 ? `cela rapporterait environ ${Math.round(gain)} or par mois à mes marchands`
                     : `mes marchands y gagneraient, même modestement`});
      break;
    }
    case 'AIDE_GUERRE': {
      const c2 = par.cible;
      m.menace += ratioForce(c2, n) * 0.85;
      m.standing += 0.05;
      if(rel(n, c2) < -30){ m.rancune = Math.max(0, m.rancune - 0.2);
        f.push({quoi:'vieilleHaine', pour:true, valeur:rel(n,c2), texte:`j'ai mes propres comptes à régler avec ${c2.nom}`}); }
      f.push({quoi:'risqueGuerre', pour:false, valeur:ratioForce(c2,n),
              texte:`${c2.nom} pèse ${(ratioForce(c2,n)).toFixed(2)} fois ma puissance`});
      break;
    }
    case 'GUERRE': {
      m.menace += menaceJoueur * 1.3;
      m.expansion += 0.10 * (gagneLaGuerre(n, p) - 0.4);
      f.push({quoi:'prixGuerre', pour:false, valeur:menaceJoueur, texte:`une guerre contre toi me coûterait plus qu'elle ne me rapporterait`});
      break;
    }
    case 'DON_RECU': break;
  }
  m.securite = 1/(1 + Math.max(0, m.menace));
  return {m, f};
}

// probabilité subjective de l'emporter (0..1)
function gagneLaGuerre(n, o){
  const fortif = 1.15;                                   // défendre est plus facile
  const a = puissance(n)*fortif, b = puissance(o);
  return clamp(a/(a+b), 0.02, 0.98);
}

/* ---------- valeur marginale de l'or, pour chiffrer une offre ---------- */
function valeurOr(n, w){
  const m = mesurer(n);
  const apres = Math.tanh((n.or + 100)/900 + m.revenu/45);
  return w.richesse * (apres - m.richesse) / 100;        // gain d'utilité par pièce d'or
}

/* ---------- évaluation complète d'une proposition ---------- */
function evaluer(n, action, par = {}){
  const w = poidsObjectifs(n);
  const base = utilite(mesurer(n), w);
  const {m, f} = projeterAction(n, action, par);
  let dU = utilite(m, w) - base;

  // biais relationnels : on n'accorde pas la même chose à un ami et à un rival
  const r = rel(n, S.player);
  const biais = (r/100) * 0.035 * (action === 'GUERRE' ? -1 : 1);
  dU += biais;
  if(r > 40) f.push({quoi:'relation', pour:true, valeur:r, texte:`nos relations sont bonnes — ${Math.round(r)} points`});
  if(r < -30) f.push({quoi:'relation', pour:false, valeur:r, texte:`nos relations sont exécrables — ${Math.round(r)} points`});

  const vOr = valeurOr(n, w);
  const k = perso(n);
  const marge = 1.15 + k.cupidite*0.55;                  // il ne vend jamais à prix coûtant
  const prixReserve = dU >= 0 ? 0 : Math.round((-dU / Math.max(vOr, 1e-6)) * marge / 10) * 10;

  return {dU, facteurs:f, prixReserve, valeurOr:vOr, w};
}

/* ===========================================================
   IA DIPLOMATIQUE — 3/3 : CROYANCES, DÉCISION, PAROLE
   =========================================================== */

/* ---------- ce que l'IA croit de toi (et qui évolue) ---------- */
function initCroyances(n){
  n.croyances = n.croyances || {fiabilite:0.5, menacePercue:0.3, armeeVue:0, provincesVues:0, mois:0};
}
function majCroyances(n){
  const p = S.player, c = n.croyances;
  const armee = nbUnites(p.armee), prov = tuilesDe(p).length;

  // un voisin qui arme vite et conquiert devient inquiétant
  const poussee = (armee - c.armeeVue)/Math.max(6, c.armeeVue) + (prov - c.provincesVues)*0.06;
  c.menacePercue = clamp(c.menacePercue*0.94 + clamp(poussee,0,1)*0.22
                       + (frontiereCommune(n,p) ? 0.03 : 0), 0, 1);
  c.armeeVue = armee; c.provincesVues = prov;

  // la parole tenue se reconstruit lentement
  if(n.pacte.has(p.id) && !n.guerre.has(p.id)) c.fiabilite = clamp(c.fiabilite + 0.006, 0, 1);
  else c.fiabilite = clamp(c.fiabilite + 0.002, 0, 1);
}
// une trahison se sait : toute la carte en entend parler
function signalerTrahison(victime){
  const p = S.player;
  for(const o of S.nations){
    if(o.joueur || !o.croyances) continue;
    const proche = o === victime ? 1 : (rel(o, victime) > 20 ? 0.5 : 0.25);
    o.croyances.fiabilite = clamp(o.croyances.fiabilite * (1 - 0.7*proche), 0, 1);
    o.croyances.menacePercue = clamp(o.croyances.menacePercue + 0.25*proche, 0, 1);
    o.rel[p.id] = clamp(o.rel[p.id] - 30*proche, -100, 100);
    if(o.memoire) o.memoire.trahisons++;
  }
  logue(`${ic('guerre')} Ta trahison fait le tour du monde connu — toutes les cours t'en tiennent rigueur.`,'bad');
}

/* ---------- la meilleure chose qu'il aurait à te proposer ---------- */
function meilleureAlternative(n, exclure){
  const p = S.player, options = [];
  const test = (a, cond, par) => { if(cond){ const e = evaluer(n, a, par||{}); options.push({action:a, ...e}); } };
  test('PAIX',     n.guerre.has(p.id));
  test('PACTE',    !n.pacte.has(p.id) && !n.guerre.has(p.id));
  test('COMMERCE', !(n.commerce && n.commerce.has(p.id)) && !n.guerre.has(p.id));
  test('ALLIANCE', !n.allies.has(p.id) && !n.guerre.has(p.id));
  return options.filter(o => o.action !== exclure && o.dU > 0.012)
                .sort((a,b)=>b.dU-a.dU)[0] || null;
}

/* ===========================================================
   GÉNÉRATION DE PAROLE — le texte est construit à partir de
   la trace de raisonnement, pas choisi dans une liste.
   =========================================================== */

const REGISTRES = {
  conquerant:  'brutal', marchand:'marchand', prudent:'mesure',
  opportuniste:'retors', honorable:'formel',
};
const MOTS = {
  accepte: {brutal:["j'accepte","je signe","va pour"], marchand:["j'accepte","je signe","je conclus"],
            mesure:["j'accepte","je consens à","j'approuve"], retors:["j'accepte","je veux bien de","je prends"],
            formel:["je donne mon accord à","je consens à","j'accepte"]},
  refuse:  {brutal:["je refuse","je rejette","pas question de"], marchand:["je décline","je refuse","je ne prends pas"],
            mesure:["je décline","je ne peux accepter","je refuse"], retors:["je décline","je laisse passer","je refuse"],
            formel:["je dois refuser","je ne puis accepter","je décline"]},
  exige:   {brutal:["je veux","exige"], marchand:["mon prix est","cela se paie"],
            mesure:["il me faudrait","je demanderais"], retors:["mettons","disons"],
            formel:["je demanderais","j'attendrais de toi"]},
  objets:  {PAIX:["la paix","cet armistice","la fin des hostilités"],
            PACTE:["ce pacte","ce pacte de non-agression","cette trêve écrite"],
            ALLIANCE:["cette alliance","cette alliance en règle","ce serment commun"],
            COMMERCE:["cet accord commercial","cette route commerciale","cette ouverture de nos marchés"],
            AIDE_GUERRE:["cette campagne commune","ton appel à l'aide"],
            GUERRE:["la guerre"], DEMANDE_OR:["ce prêt"], PRET:["ce prêt"], DON:["ton présent"]},
  liaisonCause: ["car","parce que",": ","— ","et pour cause :"],
  liaisonOpp:   ["mais","en revanche","cela dit","pourtant"],
  liaisonAjout: ["et","de plus","par ailleurs"],
};
const choix = a => a[Math.floor(Math.random()*a.length)];
const majuscule = s => s.charAt(0).toUpperCase() + s.slice(1);

/* — planification du contenu : que dire, dans quel ordre — */
function planifier(n, an, dec){
  const plan = [];
  plan.push({t:'decision', dec});
  const sens = dec.issue === 'accepte' || dec.issue === 'conclu';
  const f = (dec.facteurs || [])
      .filter(x => x.pour === undefined || x.pour === sens)          // arguments cohérents
      .sort((a,b)=>Math.abs(b.valeur)-Math.abs(a.valeur));
  const nbCauses = dec.issue === 'accepte' ? (Math.random()<.55?1:0)
                 : dec.issue === 'refuse' || dec.issue === 'contre' ? (Math.random()<.8?1:0) + (Math.random()<.3?1:0)
                 : 0;
  for(let i=0;i<Math.min(nbCauses, f.length); i++) plan.push({t:'cause', f:f[i]});
  if(dec.prix) plan.push({t:'prix', prix:dec.prix});
  if(dec.alternative && Math.random() < 0.75) plan.push({t:'alternative', alt:dec.alternative});
  if(dec.effets && dec.effets.length) plan.push({t:'effet', effets:dec.effets});
  return plan;
}

/* — réalisation : chaque brique devient une phrase — */
function realiser(n, an, p, reg){
  const j = S.player;
  switch(p.t){
    case 'decision': {
      const d = p.dec, obj = MOTS.objets[d.action] ? choix(MOTS.objets[d.action]) : 'cela';
      if(d.issue === 'accepte') return `${majuscule(choix(MOTS.accepte[reg]))} ${obj}.`;
      if(d.issue === 'contre')  return `${majuscule(choix(MOTS.accepte[reg]))} ${obj} — à un prix.`;
      if(d.issue === 'refuse')  return `${majuscule(choix(MOTS.refuse[reg]))} ${obj}.`;
      return d.phrase || '';
    }
    case 'cause': {
      const c = choix(MOTS.liaisonCause);
      return c === ': ' || c === '— ' ? `${c}${p.f.texte}.` : `${c} ${p.f.texte}.`;
    }
    case 'prix':
      return choix([`${majuscule(choix(MOTS.exige[reg]))} ${p.prix} or.`,
                    `Mon prix : ${p.prix} or.`,
                    `${p.prix} or, et l'accord est signé.`]);
    case 'alternative': {
      const a = p.alt, obj = choix(MOTS.objets[a.action] || ['autre chose']);
      return `${majuscule(choix(MOTS.liaisonOpp))}, ${obj} m'intéresserait davantage — propose-le-moi.`;
    }
    case 'effet': return '';
    default: return '';
  }
}

function parler(n, an, dec){
  const reg = REGISTRES[n.perso] || 'mesure';
  const plan = planifier(n, an, dec);
  let txt = plan.map(p => realiser(n, an, p, reg)).filter(Boolean).join(' ');
  // ouverture d'humeur et chute de caractère, ajoutées avec parcimonie
  if(Math.random() < 0.45) txt = ouverture(n) + ' ' + txt;
  if(Math.random() < 0.22 + perso(n).agressivite*0.15) txt += ' ' + choix(VOIX[n.perso].chutes);
  // ponctuation et majuscules de début de phrase
  return txt.replace(/\s+/g,' ').replace(/ \./g,'.')
            .replace(/\.\s*([:—])\s*/g, ' $1 ')      // une liaison ponctuée ne suit pas un point
            .replace(/([.!?]\s+)([a-zà-ÿ])/g, (m,a,b)=> a + b.toUpperCase())
            .replace(/^([a-zà-ÿ])/, m => m.toUpperCase())
            .trim();
}
