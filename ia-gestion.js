/* ===========================================================
   IA DE GESTION — extension du lexique et des intentions
   Le même moteur sémantique sert désormais deux interlocuteurs :
   les dirigeants étrangers (domaine « diplo ») et ton propre
   conseil de la Couronne (domaine « conseil »).
   =========================================================== */

Object.assign(LEX, {
  // --- construire / détruire ---
  bati:{batir:.9}, batir:{batir:1}, construi:{batir:1}, constru:{batir:.9}, erig:{batir:.8},
  edifi:{batir:.8}, chantier:{batir:.7}, demoli:{batir:.6, refus:.5}, ras:{batir:.5, refus:.4},
  ferme:{batir:.5, lieu:.3, nourriture:.9}, champ:{nourriture:.8, lieu:.4},
  mine:{batir:.5, materiau:.9}, carrier:{materiau:.8},
  usine:{batir:.5, argent:.6, industrie:.8}, manufactur:{industrie:.8, argent:.5},
  centrale:{batir:.5, energie:1}, universit:{batir:.5, science:1}, ecole:{science:.8},
  caserne:{batir:.5, force:.7}, port:{batir:.4, echange:.7},
  fortif:{batir:.6, force:.6, defense:.9}, rempart:{defense:.8}, mur:{defense:.6},
  // --- ressources & état interne ---
  nourritur:{nourriture:1}, bl:{nourriture:.5}, famin:{nourriture:.9, probleme:.8},
  grain:{nourriture:.7}, recolte:{nourriture:.7},
  materiau:{materiau:1}, bois:{materiau:.7}, pierre:{materiau:.6},
  energ:{energie:1}, electricit:{energie:.9}, penuri:{probleme:.8, energie:.4},
  bonheur:{bonheur:1}, moral:{bonheur:.8}, mecontent:{bonheur:.8, probleme:.8},
  content:{bonheur:.7}, revolte:{bonheur:.7, probleme:.9}, grond:{bonheur:.6, probleme:.7},
  populat:{population:1}, habitant:{population:.9}, ame:{population:.6}, demograph:{population:.8},
  impot:{impot:1}, taxe:{impot:1}, fiscal:{impot:.9}, taux:{impot:.6, quantite:.5},
  tresor:{argent:.9}, caisse:{argent:.8}, budget:{argent:.8, etat:.4}, revenu:{argent:.8, etat:.4},
  depens:{argent:.7}, deficit:{argent:.7, probleme:.8}, rentab:{argent:.7, conseil:.4},
  // --- armée & recherche ---
  recrut:{unite:1, force:.6}, lev:{unite:.7, force:.5}, enrol:{unite:.8},
  infanteri:{unite:.9, force:.6}, artilleri:{unite:.9, force:.6}, char:{unite:.9, force:.6},
  avion:{unite:.9, force:.6}, aviation:{unite:.9, force:.6}, marin:{unite:.9, force:.6},
  navire:{unite:.85, force:.5}, soldat:{unite:.6, force:.8},
  recherch:{science:1}, technolog:{science:.9}, science:{science:1}, etud:{science:.7},
  decouvert:{science:.7}, agronomi:{science:.6, nourriture:.5}, medecin:{science:.6, population:.5},
  industri:{science:.5, industrie:.8}, poudre:{science:.5, force:.6}, informatiqu:{science:.7},
  nucleair:{science:.6, force:.7}, navigation:{science:.5, echange:.5}, ecritur:{science:.6},
  // --- lieux / provinces ---
  provinc:{lieu:1}, region:{lieu:.8}, territoir:{lieu:.8, expansion:.5}, terre:{lieu:.6},
  capital:{lieu:.8, etat:.3}, ici:{lieu:.9}, selectionn:{lieu:.7}, celle:{lieu:.4},
  colonis:{lieu:.7, expansion:.9}, peupl:{lieu:.4, population:.6},
  montagn:{lieu:.5, materiau:.5}, plain:{lieu:.5, nourriture:.5}, foret:{lieu:.5, materiau:.4},
  cot:{lieu:.5, echange:.4}, desert:{lieu:.5},
  // --- intentions de dialogue ---
  pourquoi:{cause:1, question:.6}, cause:{cause:.9}, raison:{cause:.7},
  explique:{cause:.8, question:.5}, comprend:{cause:.6, question:.4},
  conseil:{conseil:1}, recommand:{conseil:.9}, suggest:{conseil:.8}, devrais:{conseil:.9},
  doi:{conseil:.7, ordre:.2}, dois:{conseil:.7}, devon:{conseil:.7}, priorit:{conseil:.9},
  important:{conseil:.6}, ensuite:{conseil:.5}, maintenant:{conseil:.4, temps:.4},
  quoi:{question:.6, conseil:.3}, meilleur:{conseil:.7, comparer:.5},
  faire:{conseil:.45, ordre:.3}, prioritair:{conseil:.7}, urgent:{conseil:.6, probleme:.6},
  mieux:{conseil:.6, comparer:.4}, optimis:{conseil:.7},
  prevision:{futur:1}, prevoi:{futur:.9}, futur:{futur:.9}, bientot:{futur:.6},
  dans:{futur:.25}, mois:{futur:.5, temps:.8}, annee:{futur:.5, temps:.8}, an:{futur:.3, temps:.6},
  ans:{futur:.35, temps:.7},              // trop court pour être racinisé : à inscrire tel quel
  deviendr:{futur:.6}, evolu:{futur:.6}, tiendr:{futur:.5},
  cout:{cout:1}, prix:{cout:.9}, combien:{quantite:.8, question:.7, cout:.5},
  temps:{temps:.8, cout:.35}, duree:{temps:.8, cout:.4}, delai:{temps:.8, cout:.4},
  longtemps:{temps:.7, futur:.4}, rapid:{temps:.5},
  vaut:{cout:.6, comparer:.5}, valeur:{cout:.6},
  compar:{comparer:1}, plus:{comparer:.35, quantite:.3}, fort:{comparer:.4, force:.6},
  puissan:{force:.8, comparer:.5}, superieur:{comparer:.8}, egal:{comparer:.6},
  serai:{futur:.8}, sera:{futur:.7}, seron:{futur:.7}, aurai:{futur:.7}, dici:{futur:.6},
  faible:{comparer:.4, probleme:.5}, chance:{comparer:.6, futur:.4}, gagn:{comparer:.5, guerre:.4},
  battre:{comparer:.4, guerre:.7}, vaincr:{guerre:.7, comparer:.4},
  ou:{lieu:.6, question:.5}, endroit:{lieu:.8}, place:{lieu:.8},
  mettr:{lieu:.75}, met:{lieu:.5}, plac:{lieu:.8}, pos:{lieu:.5}, install:{lieu:.75},
  fais:{ordre:.9}, vas:{ordre:.4}, ordre:{ordre:.9}, execute:{ordre:.9}, lance:{ordre:.7},
  arrete:{ordre:.5, refus:.4}, annul:{ordre:.5, refus:.6},
  aide:{aide:.7}, assist:{aide:.6},
  etat:{etat:1}, situation:{etat:.9}, rapport:{etat:.8}, bilan:{etat:.9, argent:.3},
  resum:{etat:.7}, tout:{etat:.25},
});

CLES_LEX = Object.keys(LEX);        // le lexique de gestion entre aussi dans la correspondance floue

/* --- intentions de gestion (domaine « conseil ») --- */
Object.assign(ACTES, {
  G_BATIR:      {batir:1, lieu:.4},
  G_RECRUTER:   {unite:1, force:.4},
  G_RECHERCHE:  {science:1},
  G_IMPOT:      {impot:1},
  G_FORTIFIER:  {defense:1, batir:.4},
  G_COLONISER:  {expansion:1, lieu:.6},
  G_ATTAQUER:   {guerre:.9, ordre:.5, force:.5},
  G_DIAGNOSTIC: {cause:1, probleme:.5},
  G_CONSEIL:    {conseil:1},
  G_PREVISION:  {futur:1},
  G_COUT:       {cout:1, quantite:.4},
  G_COMPARER:   {comparer:1, force:.4},
  G_OU:         {lieu:1, question:.6},
  G_RAPPORT:    {etat:1, question:.3},
});

/* --- à quel domaine appartient chaque acte --- */
const DOMAINES = {
  diplo: ['PAIX','GUERRE','PACTE','ALLIANCE','COMMERCE','AIDE_GUERRE','MENACE','INSULTE','EXCUSE',
          'COMPLIMENT','SALUT','OFFRE_OR','DEMANDE_OR','ETAT','AVIS','ACCORD','REFUS','QUESTION'],
  conseil: ['G_BATIR','G_RECRUTER','G_RECHERCHE','G_IMPOT','G_FORTIFIER','G_COLONISER','G_ATTAQUER',
            'G_DIAGNOSTIC','G_CONSEIL','G_PREVISION','G_COUT','G_COMPARER','G_OU','G_RAPPORT',
            'SALUT','ACCORD','REFUS','QUESTION','AVIS'],
};

/* --- entités du jeu reconnues dans une phrase --- */
const SYNO_BATIMENTS = {ferme:['ferme','champ','agricole','grange'], mine:['mine','carriere','mineur'],
  port:['port','quai','dock','maritime'], usine:['usine','manufacture','industrie','atelier'],
  centrale:['centrale','energie','electricite','generateur'], universite:['universite','ecole','academie','savant'],
  caserne:['caserne','garnison','militaire']};
const SYNO_UNITES = {infanterie:['infanterie','soldat','fantassin','homme','piquier'],
  artillerie:['artillerie','canon','bombarde','mortier'], chars:['char','tank','blinde','cuirasse'],
  avions:['avion','aviation','aerien','chasseur'], navires:['navire','marine','bateau','flotte','vaisseau']};

function trouverEntite(txt, table){
  const t = ' ' + sansAccents(txt) + ' ';
  let best = null, score = 0;
  for(const [cle, mots] of Object.entries(table)){
    for(const m of mots){
      if(t.includes(' ' + m)) { if(1 > score){ score = 1; best = cle; } }
      else for(const mot of t.trim().split(/\s+/)){
        if(mot.length < 5) continue;                       // les petits mots créent trop de faux positifs
        const d = dice(radical(mot), radical(m));
        const seuil = mot.length >= 8 ? 0.79 : 0.88;       // plus le mot est long, plus la faute est pardonnable
        if(d > seuil && d > score){ score = d; best = cle; }
      }
    }
  }
  return best;
}
function trouverTech(txt){
  const t = sansAccents(txt);
  let best = null, score = 0.72;
  for(const k of Object.keys(TECHS)){
    const n = sansAccents(TECHS[k].nom);
    if(t.includes(n.split(' ')[0])) return k;
    for(const mot of t.split(/\s+/)){
      const d = dice(radical(mot), radical(n.split(' ')[0]));
      if(d > score){ score = d; best = k; }
    }
  }
  return best;
}

/* ===========================================================
   EXTENSION — couverture des questions restantes
   Le Conseil sait désormais relire le passé, expliquer les
   règles, inventorier, lister, classer, décrire une province,
   résumer la diplomatie et dater une échéance.
   =========================================================== */

Object.assign(LEX, {
  // --- le passé : chronique du règne ---
  passe:{histoire:.9}, histoir:{histoire:1}, chroniqu:{histoire:.9}, journal:{histoire:.8},
  recemment:{histoire:.8, temps:.4}, dernierement:{histoire:.8}, evenement:{histoire:.8},
  even:{histoire:.8},                     // « événements » se racinise en « even »
  royaum:{etat:.75},                      // « où en est le royaume ? » est un rapport
  depuis:{histoire:.4, temps:.5},
  souvien:{histoire:.7}, rappel:{histoire:.7}, resumeprec:{histoire:1},
  // --- les règles : à quoi sert quoi ---
  sert:{regles:.8}, servent:{regles:.8}, utilit:{regles:.8}, effet:{regles:.6},
  fonctionn:{regles:.7}, marche2:{regles:.6}, regle:{regles:.9}, mecaniqu:{regles:.8},
  aquoisert:{regles:1}, commentmarche:{regles:1}, cestquoi:{regles:.9, question:.5},
  signifi:{regles:.7}, definition:{regles:.8},
  // --- inventaire : ce que je possède ---
  possed:{inventaire:.9}, mes:{inventaire:.6}, mon:{inventaire:.45}, ma:{inventaire:.4},
  dispos:{inventaire:.6, liste:.5}, nos:{inventaire:.4}, notr:{inventaire:.35},
  jai:{inventaire:.9}, inventair:{inventaire:1}, stock:{inventaire:.7},
  effectif:{inventaire:.7, unite:.5}, garnison2:{inventaire:.6, unite:.5},
  // --- listes : ce qui est disponible ---
  list:{liste:1}, disponibl:{liste:.8}, accessibl:{liste:.7}, possibl:{liste:.6},
  option:{liste:.8}, choix:{liste:.7}, catalogu:{liste:.8}, quels:{liste:.55, question:.5},
  quelles:{liste:.55, question:.5},
  // --- classement : superlatifs ---
  plusgrand:{classer:1}, meilleur2:{classer:.9}, pire:{classer:.9}, laquelle:{classer:.7, question:.6},
  class:{classer:.8}, rang:{classer:.7}, superlatif:{classer:1},
  rich:{classer:.35, argent:.7}, peupl2:{classer:.3, population:.7},
  // --- diplomatie vue du Conseil ---
  diplomat:{diplo:1}, relation:{diplo:.8}, allie:{diplo:.8, union:.5}, alliance2:{diplo:.7},
  relat:{diplo:.8},                       // « relations » se racinise en « relat »
  voisin:{diplo:.7, etat:.3}, ennemi2:{diplo:.7, guerre:.5}, traite2:{diplo:.7},
  pacte2:{diplo:.7}, avecqui:{diplo:.8, question:.6},
  // --- échéance : quand ? ---
  quand:{quand:1, question:.6}, dequandy:{quand:1}, atteindr:{quand:.6, futur:.5},
  delai2:{quand:.6, temps:.6},
  // --- province décrite ---
  decri:{province:.8, question:.3}, parlemoide:{province:.9, question:.4},
  // formes racinisées des jetons ci-dessus : radical() les ampute avant la recherche
  commentmarch:{regles:1}, parlemoid:{province:.9, question:.4},
  // radicaux des pluriels courants, que la dérivation ne produit pas d'elle-même
  batiment:{batir:.7, liste:.2}, construction:{batir:.8}, edifice:{batir:.7},
});

/* --- expressions propres au Conseil, appliquées avant la vectorisation --- */
const EXPRESSIONS_CONSEIL = [
  [/\ba quoi (sert|servent)\b/g, 'aquoisert'], [/\bcomment (marche|fonctionne|ca marche)\b/g, 'commentmarche'],
  [/\bc est quoi\b/g, 'cestquoi'], [/\bqu est ce que c est\b/g, 'cestquoi'],
  [/\bqu est ce qu?e? ?\b/g, ' '],
  [/\bcombien (j ai|jai|ai je|on a)\b/g, 'jai inventaire'],
  [/\b(j ai|jai|ai je)\b/g, 'jai'],
  [/\bla plus\b/g, 'plusgrand'], [/\ble plus\b/g, 'plusgrand'],
  [/\bla moins\b/g, 'plusgrand'], [/\ble moins\b/g, 'plusgrand'],
  [/\b(la|le) (meilleure?|pire)\b/g, 'plusgrand'],
  [/\bavec qui\b/g, 'avecqui'], [/\b(mes|nos) (allies|alliances|amis|ennemis)\b/g, 'diplomat'],
  [/\bou en (est|sont|suis|sommes)\b/g, 'etat'], [/\bpactes\b/g, 'diplomat'],
  [/\bque s est il passe\b/g, 'resumeprec'], [/\bqu est il arrive\b/g, 'resumeprec'],
  [/\bces derniers\b/g, 'recemment'], [/\bderniers mois\b/g, 'recemment mois'],
  [/\bs est passe\b/g, 'resumeprec'], [/\b(le|du|ce) passe\b/g, 'histoir'],
  [/\bces dernieres annees\b/g, 'recemment'], [/\bjusqu (a )?(ici|maintenant|present)\b/g, 'histoir'],
  [/\bparle moi de\b/g, 'parlemoide'], [/\bquand (aurai|aurais|atteindrai|seront?|sera)\b/g, 'dequandy'],
  [/\bdans combien de temps\b/g, 'dequandy'],
  [/\bqui est\b/g, 'diplomat'], [/\ben guerre\b/g, 'guerre diplomat'],
  // un pluriel interrogatif demande un catalogue : « quels bâtiments… », « quelles unités… »
  [/\bquel(le)?s\b/g, 'list'],
];

Object.assign(ACTES, {
  G_HISTOIRE:   {histoire:1},
  G_REGLES:     {regles:1},
  G_INVENTAIRE: {inventaire:1},
  G_LISTE:      {liste:1},
  G_CLASSER:    {classer:1},
  G_DIPLO_ETAT: {diplo:1},
  G_QUAND:      {quand:1, futur:.5},
  G_PROVINCE:   {province:1, lieu:.5},
});
DOMAINES.conseil.push('G_HISTOIRE','G_REGLES','G_INVENTAIRE','G_LISTE','G_CLASSER',
                      'G_DIPLO_ETAT','G_QUAND','G_PROVINCE');
CLES_LEX = Object.keys(LEX);

/* --- dimensions de classement reconnues : « la province la plus … » --- */
const DIMENSIONS = {
  riche:      {mots:['rich','or','rentabl','lucrat','produc'],     nom:'riche'},
  peuplee:    {mots:['peupl','populat','habitant','ame','grand'],  nom:'peuplée'},
  nourriciere:{mots:['nourri','fertil','agricol','ferme','food'],  nom:'nourricière'},
  exposee:    {mots:['expos','vulnerabl','danger','menac','faibl','frontier'], nom:'exposée'},
  fortifiee:  {mots:['fortif','defend','solid','rempart','sure'],  nom:'fortifiée'},
  puissante:  {mots:['puissan','fort','arme','militair'],          nom:'puissante'},
};
function trouverDimension(propre){
  const mots = propre.trim().split(/\s+/).map(radical);
  for(const [cle, d] of Object.entries(DIMENSIONS))
    for(const m of d.mots) if(mots.some(x => x.startsWith(m))) return cle;
  return null;
}
// « la MOINS riche », « la PIRE » : le classement s'inverse
const inverseClassement = propre => /\b(la moins|le moins|pire|plus faible|plus pauvre|moins bonne?)\b/.test(propre);

/* ===========================================================
   CASCADE DE DÉCISION DU DOMAINE « CONSEIL »
   Appelée par comprendre() : elle remplit les créneaux (slots)
   puis tranche entre les intentions de gestion.
   =========================================================== */
function acteConseil(base, G){
  const propre = base.propre, interro = base.interro;
  const slots = {
    batiment: trouverEntite(propre, SYNO_BATIMENTS),
    unite:    trouverEntite(propre, SYNO_UNITES),
    tech:     trouverTech(propre),
    ressource: trouverRessource(propre),
    dimension: trouverDimension(propre),
    inverse:  inverseClassement(propre),
    montant:  base.montant,
    quantite: base.quantite,
    pourcent: base.pourcent,
    ici: /\b(ici|cette provinc\w*|cette region|selectionn\w*|celle la|celle ci)\b/.test(propre),
    capitale: /\bcapital/.test(propre),
    cible: base.cible,
    horizon: base.horizon,
  };
  if(slots.horizon){
    const nb = +slots.horizon[1];
    slots.mois = /an/.test(slots.horizon[2]) ? nb*12 : nb;
  }
  return {...base, ...cascadeConseil(base, slots, G), slots};
}

/* --- l'arbitrage seul : rejouable une fois les créneaux complétés par le contexte --- */
function cascadeConseil(base, slots, G){
  const interro = base.interro;
  let acte = base.acte, regle = null;

  // --- 0. questions sans ambiguïté : elles priment sur tout ordre, sinon
  //        « à quoi servent les fortifications ? » bâtirait des remparts ---
  if(G('regles') > .5)                     { acte='G_REGLES';    regle='question sur une mécanique'; }
  else if(G('quand') > .5)                 { acte='G_QUAND';     regle='question d\'échéance'; }
  else if(G('histoire') > .5 && G('histoire') >= G('futur'))
                                           { acte='G_HISTOIRE';  regle='demande sur le passé'; }
  else if(G('inventaire') > .5 && G('ordre') < .5 && G('cout') < .4
          && G('diplo') < .6 && G('liste') < .6)
                                           { acte='G_INVENTAIRE'; regle='question de possession'; }

  // --- 1. ordres explicites : ils l'emportent sur les questions restantes ---
  else if(G('defense') > .55)              { acte='G_FORTIFIER'; regle='fortification demandée'; }
  else if(slots.tech && (G('cout') > .3 || G('temps') > .3))
                                           { acte='G_COUT';      regle='coût ou délai d\'une technologie'; }
  else if(slots.tech && G('science') > .5) { acte='G_RECHERCHE'; regle='technologie nommée'; }
  else if(G('ordre') > .5 && slots.batiment && G('science') < .5) { acte='G_BATIR'; regle='ordre de construction'; }
  else if(G('ordre') > .5 && slots.unite)  { acte='G_RECRUTER';  regle='ordre de recrutement'; }
  else if(G('expansion') > .55)            { acte='G_COLONISER'; regle='colonisation demandée'; }

  // --- 2. familles de questions restantes ---
  else if(G('classer') > .5)               { acte='G_CLASSER';    regle='superlatif'; }
  // une nation nommée + une idée de force : c'est une comparaison, pas un catalogue
  else if(slots.cible && (G('comparer') > .3 || G('guerre') > .3 || G('force') > .4))
                                           { acte='G_COMPARER';   regle='comparaison avec une nation nommée'; }
  else if(G('diplo') > .6 && G('comparer') < .5) { acte='G_DIPLO_ETAT'; regle='état des relations'; }
  else if(G('liste') > .5 && G('diplo') < .6) { acte='G_LISTE';   regle='demande de catalogue'; }
  else if(G('diplo') > .6)                 { acte='G_DIPLO_ETAT'; regle='état des relations'; }
  else if(G('province') > .35 || (slots.ici && !slots.batiment && G('batir') < .5))
                                           { acte='G_PROVINCE';   regle='description d\'une province'; }

  // --- 3. familles préexistantes ---
  else if((slots.batiment || slots.unite) && (G('cout') > .4 || G('temps') > .4))
                                           { acte='G_COUT';       regle='question de prix'; }
  else if(slots.pourcent !== null && G('impot') > .3) { acte='G_IMPOT'; regle='consigne fiscale chiffrée'; }
  else if(G('lieu') >= .55 && slots.batiment && G('ordre') < .5) { acte='G_OU'; regle='question de placement'; }
  else if(G('cause') > .5)                 { acte='G_DIAGNOSTIC'; regle='demande d\'explication'; }
  else if(G('futur') > .5 && G('cout') < .5) { acte='G_PREVISION'; regle='demande de projection'; }
  else if(G('comparer') > .5 || (G('guerre') > .5 && interro)) { acte='G_COMPARER'; regle='comparaison de forces'; }
  else if(G('batir') > .5 && slots.batiment) { acte='G_BATIR';    regle='construction évoquée'; }
  else if(G('unite') > .5)                 { acte='G_RECRUTER';   regle='unités évoquées'; }
  else if(G('science') > .6 && (slots.tech || G('ordre') > .3))
                                           { acte='G_RECHERCHE';  regle='recherche évoquée'; }
  else if(G('conseil') > .5)               { acte='G_CONSEIL';    regle='demande de conseil'; }
  // une ressource nommée sans ordre ni objet chiffrable : c'est une question d'inventaire.
  // Sans cela « mon armée » partait en assaut et « combien de nourriture » en question de prix.
  else if(slots.ressource && G('ordre') < .5 && !slots.batiment && !slots.unite && !slots.tech)
                                           { acte='G_INVENTAIRE'; regle='ressource nommée'; }
  else if(G('etat') > .5 && !slots.batiment && !slots.unite) { acte='G_RAPPORT'; regle='question sur le royaume'; }

  return {acte, regle};
}

/* --- ressources nommées, pour l'inventaire et les échéances --- */
const SYNO_RESSOURCES = {
  or:['or','tresor','piece','argent','caisse','budget'],
  materiaux:['materiau','bois','pierre','ressource'],
  nourriture:['nourriture','ble','grain','vivre','recolte'],
  energie:['energie','electricite','courant'],
  recherche:['recherche','science','savoir','point'],
  bonheur:['bonheur','moral','humeur','contentement'],
  population:['population','habitant','ame','peuple','demographie'],
  provinces:['province','territoire','region','terre'],
  armee:['armee','troupe','unite','soldat','militaire','force'],
};
function trouverRessource(txt){
  const t = ' ' + sansAccents(txt) + ' ';
  for(const [cle, mots] of Object.entries(SYNO_RESSOURCES))
    for(const m of mots) if(t.includes(' ' + m)) return cle;
  return null;
}


/* ===========================================================
   EXTENSION DIPLOMATIQUE — trois questions que l'on pose
   naturellement à un dirigeant et auxquelles il ne savait
   pas répondre.
   =========================================================== */

Object.assign(LEX, {
  // « que veux-tu de moi ? », « que puis-je t'offrir ? »
  veuxtu:{attente:1, question:.5}, attend:{attente:.8, question:.4},
  souhait:{attente:.8}, desir:{attente:.7}, interess:{attente:.7},
  faudrait:{attente:.6, demande:.3},
  contentera:{attente:.7}, satisfer:{attente:.7},
  // « es-tu en guerre ? », « qui sont tes ennemis ? »
  conflit:{guerres:.8, guerre:.6}, campagn:{guerres:.6, guerre:.5},
  // « ennemis » se raciniserait en « ennemi », déjà pris par l'hostilité : jeton dédié
  mesennemis9:{guerres:1}, front2:{guerres:.6},
  // « que t'ai-je donné ? », « souviens-toi »
  souvenir:{rappel:1}, souven:{rappel:1}, memoir:{rappel:.9}, oublie:{rappel:.6, refus:.3},
  faudr:{attente:.6, demande:.3},
});

Object.assign(ACTES, {
  ATTENTE: {attente:1, question:.4},
  GUERRES: {guerres:1, question:.4},
  RAPPEL:  {rappel:1, question:.3},
});
DOMAINES.diplo.push('ATTENTE','GUERRES','RAPPEL');
CLES_LEX = Object.keys(LEX);

/* --- tournures diplomatiques, appliquées avant la vectorisation --- */
const EXPRESSIONS_DIPLO = [
  [/\bque (veux|voudrais) tu\b/g, 'veuxtu'], [/\bqu attends tu\b/g, 'attend'],
  [/\bque puis je (t )?(offrir|proposer|faire)\b/g, 'veuxtu'],
  [/\bqu est ce qui t interesse\b/g, 'veuxtu interess'],
  [/\bce qu il te faudrait\b/g, 'faudrait'],
  [/\bqui sont tes ennemis\b/g, 'mesennemis9'], [/\bes tu en guerre\b/g, 'conflit'],
  [/\b(tes|vos) ennemis\b/g, 'mesennemis9'], [/\bcontre qui\b/g, 'conflit'],
  [/\bcontre qui (te bats|combats|es) tu\b/g, 'conflit'],
  // « donne-moi » est une demande, pas un don : sans cela le sens s'inverse
  [/\b(donne|offre|prete|verse) (moi|nous)\b/g, 'demand argent'],
  [/\bque t ai je (donne|offert)\b/g, 'souvenir'], [/\b(souviens|rappelle) toi\b/g, 'souvenir'],
  [/\bnotre passe\b/g, 'souvenir'], [/\bentre nous\b/g, 'souvenir'],
  [/\bte souviens tu\b/g, 'souvenir'],
];


/* ===========================================================
   CONVERSATION ORDINAIRE — on ne parle pas qu'affaires.
   Sans ces actes, tout ce qui n'était pas une proposition
   tombait dans « je ne te suis pas ».
   =========================================================== */

Object.assign(LEX, {
  projet:{projets:1}, plan:{projets:.8}, intention:{projets:.8}, ambition:{projets:.8},
  avenir:{projets:.6, futur:.5}, comptes:{projets:.4}, ferastu:{projets:.9},
  penses2:{opinion:.8, avis:.5}, opinion:{opinion:.9}, jugement:{opinion:.7},
  demoi:{opinion:1}, memprises:{opinion:.8}, vauxje:{opinion:.9},
  merci:{gratitude:.9, politesse:.6}, remerci:{gratitude:.9}, reconnaissant:{gratitude:.8},
  adieu:{adieu:1}, revoir:{adieu:.9}, plustard:{adieu:.6}, quitte:{adieu:.7},
  bonnejournee:{adieu:.8, politesse:.5}, aplustard:{adieu:.9},
});

Object.assign(ACTES, {
  PROJETS:   {projets:1, question:.4},
  OPINION:   {opinion:1, question:.4},
  GRATITUDE: {gratitude:1, politesse:.5},
  ADIEU:     {adieu:1},
});
DOMAINES.diplo.push('PROJETS','OPINION','GRATITUDE','ADIEU');
CLES_LEX = Object.keys(LEX);

EXPRESSIONS_DIPLO.push(
  [/\bquels? (sont|est) (tes|ton) (projets?|plans?|intentions?|ambitions?)\b/g, 'projet'],
  [/\bque (comptes|vas) tu faire\b/g, 'ferastu'],
  [/\bque (penses|pensez) tu de moi\b/g, 'demoi'],
  // EXPRESSIONS global transforme déjà « que penses-tu » en « avis » : on rattrape
  [/\bavis (de|sur) moi\b/g, 'demoi'], [/\bavis me\b/g, 'demoi'],
  [/\bcomment me (vois|juges) tu\b/g, 'demoi'],
  [/\bque vaut? je\b/g, 'vauxje'],
  [/\bme prends tu pour\b/g, 'memprises'],
  [/\bau revoir\b/g, 'revoir'], [/\ba (plus tard|bientot)\b/g, 'aplustard'],
  [/\bbonne (journee|soiree|chance)\b/g, 'bonnejournee'],
  [/\bje te (remercie|suis reconnaissant)\b/g, 'remerci'],
);


/* ===========================================================
   CONVERSATION ÉLARGIE — dix familles que le moteur ratait,
   dont certaines qu'il interprétait à l'envers : « tu es un
   menteur » concluait une alliance, « es-tu riche ? » lui
   faisait empocher ton or.
   =========================================================== */

Object.assign(LEX, {
  // --- menacer sans chiffrer ---
  ras:{menace:.8, guerre:.6}, raser:{menace:.9, guerre:.7}, aneant:{menace:.9, guerre:.8},
  mour:{menace:.8, guerre:.5}, mort:{menace:.6, guerre:.5}, tuer:{menace:.8, guerre:.6},
  consequenc:{menace:.7}, regrett2:{menace:.6}, prevenu:{menace:.6}, avert:{menace:.7},
  interet:{menace:.35}, obeis:{menace:.7}, ordre2:{menace:.5},
  ecras2:{menace:.8, guerre:.6}, balay:{menace:.7, guerre:.5},
  // --- promettre ---
  promet:{promesse:1}, promesse:{promesse:1}, jure:{promesse:.9}, serment:{promesse:.8},
  parole2:{promesse:.7, confiance:.5}, engag:{promesse:.7}, garantis:{promesse:.8},
  comptesurmoi:{promesse:.9}, jamaisattaqu:{promesse:.9, paix:.4},
  // --- s'informer sur lui ---
  combien2:{info:.6, question:.7}, population2:{info:.8}, soldat2:{info:.6, force:.4},
  technolog2:{info:.8}, capitale2:{info:.7}, regne:{info:.7}, ancien:{info:.5},
  possedes:{info:.7, question:.4}, richesse2:{info:.6, argent:.4},
  dismoi:{info:.5, question:.5}, renseign:{info:.8},
  // --- marchander ---
  moitie:{marchand:1}, moitiemoitie:{marchand:1}, poirendeux:{marchand:1},
  dernierprix:{marchand:.9}, rabais:{marchand:.8}, remise:{marchand:.8},
  partag2:{marchand:.6, echange:.5}, compromis:{marchand:.8, accord:.4},
  milieu:{marchand:.6}, effort:{marchand:.5},
  // --- affection et compassion ---
  appreci:{affection:.9}, estim2:{affection:.7}, manqu:{affection:.7},
  attach:{affection:.7}, cher2:{affection:.5}, amiti2:{affection:.8, union:.3},
  condoleanc:{compassion:1}, compat:{compassion:.9}, desole2:{compassion:.6, excuse:.4},
  peine2:{compassion:.7}, courage:{compassion:.6},
  // --- reprocher ---
  trahi2:{reproche:1, hostilite:.5}, menteur:{reproche:.9, hostilite:.4},
  ment2:{reproche:.8}, vol:{reproche:.8, hostilite:.4}, voleur:{reproche:.9},
  parjure:{reproche:.9}, exager:{reproche:.6}, assezdetoi:{reproche:.8, hostilite:.5},
  faute:{reproche:.6}, deçu:{reproche:.6}, decu:{reproche:.6}, honte:{reproche:.6},
  tenuparole:{reproche:.9},
  // --- partager les dépouilles ---
  partageons:{partage:1}, depouill:{partage:.8}, butin:{partage:.8},
  sesterres:{partage:.8}, entrenous2:{partage:.5},
  // --- méta ---
  quepeuxtu:{meta:1}, regles2:{meta:.9}, repete:{meta:.9}, expliquetoi:{meta:.8},
  capable:{meta:.6}, sujets:{meta:.6},
  // --- correctifs de faux positifs ---
  dirigeant:{politesse:.5}, souverain2:{politesse:.5}, grand2:{politesse:.6},
  passage9:{passage:1}, travers:{passage:.7}, territoire2:{passage:.4},
});

Object.assign(ACTES, {
  PROMESSE:   {promesse:1, confiance:.4},
  INFO:       {info:1, question:.5},
  MARCHANDE:  {marchand:1},
  AFFECTION:  {affection:1, politesse:.3},
  COMPASSION: {compassion:1},
  REPROCHE:   {reproche:1, hostilite:.3},
  PARTAGE:    {partage:1, union:.4},
  META:       {meta:1, question:.4},
  PASSAGE:    {passage:1, demande:.4},
});
DOMAINES.diplo.push('PROMESSE','INFO','MARCHANDE','AFFECTION','COMPASSION',
                    'REPROCHE','PARTAGE','META','PASSAGE');
CLES_LEX = Object.keys(LEX);

EXPRESSIONS_DIPLO.push(
  // menaces
  [/\bprepare toi\b/g, 'menac'], [/\bsubis? les consequences\b/g, 'consequenc'],
  [/\btu (vas|va) le regretter\b/g, 'regrett2'], [/\bpas deux fois\b/g, 'avert'],
  [/\btu as interet\b/g, 'interet menac'], [/\bton or ou ton sang\b/g, 'menac argent'],
  [/\b(paie|paye) ou meurs\b/g, 'menac argent'],
  // promesses
  [/\btu as ma parole\b/g, 'parole2 promet'], [/\bje (te )?(promets|jure)\b/g, 'promet'],
  [/\bcompte sur moi\b/g, 'comptesurmoi'], [/\bje ne te trahirai jamais\b/g, 'promet'],
  [/\bne jamais t attaquer\b/g, 'jamaisattaqu'],
  // informations
  [/\bcombien as tu\b/g, 'combien2'], [/\bquelle est ta population\b/g, 'population2'],
  [/\bquelles technologies\b/g, 'technolog2'], [/\bou est ta capitale\b/g, 'capitale2'],
  [/\bdepuis quand (regnes|tu regnes)\b/g, 'regne'], [/\bes tu riche\b/g, 'richesse2'],
  [/\bque possedes tu\b/g, 'possedes'],
  // marchandage
  [/\bla moitie\b/g, 'moitie'], [/\bmoitie moitie\b/g, 'moitiemoitie'],
  [/\bcoupons la poire en deux\b/g, 'poirendeux'], [/\bdernier prix\b/g, 'dernierprix'],
  [/\bcoupons la (poire|difference)\b/g, 'poirendeux'],
  // affection, compassion
  [/\btu me manques\b/g, 'manqu'], [/\bje t apprecie\b/g, 'appreci'],
  [/\btoutes mes condoleances\b/g, 'condoleanc'], [/\bje compatis\b/g, 'compat'],
  // reproches
  [/\btu m as trahi\b/g, 'trahi2'], [/\btu es un menteur\b/g, 'menteur'],
  [/\btu n as pas tenu (ta )?parole\b/g, 'tenuparole'], [/\btu m as vole\b/g, 'vol'],
  [/\bj en ai assez de toi\b/g, 'assezdetoi'], [/\btu exageres\b/g, 'exager'],
  // partage
  [/\bpartageons (ses|leurs|les) terres\b/g, 'partageons'],
  [/\bpartageons le butin\b/g, 'partageons butin'],
  // méta
  [/\bque peux tu faire\b/g, 'quepeuxtu'], [/\bquelles sont les regles\b/g, 'regles2'],
  [/\bexplique toi\b/g, 'expliquetoi'], [/\bde quoi peut on parler\b/g, 'quepeuxtu'],
  // passage
  [/\blaisse moi passer\b/g, 'passage9'], [/\bdroit de passage\b/g, 'passage9'],
  [/\b(passer|traverser) (sur|par) tes (terres|territoires)\b/g, 'passage9'],
  // « comment vas-tu » porte sur lui, pas sur son pays
  [/\bcomment (vas|va) tu\b/g, 'sante etat'],
  // politesse mal lue
  [/\bgrand (dirigeant|souverain|roi|homme)\b/g, 'grand2 dirigeant'],
);

/* --- formes racinisées : radical() ampute ces mots avant la recherche.
       Sans ces entrées, ils ne survivaient que par correspondance floue,
       au poids affaibli — et parfois vers le mauvais concept. --- */
Object.assign(LEX, {
  arret:{ordre:.5, refus:.4},                   // ← arrete
  aven:{projets:.6, futur:.5},                  // ← avenir
  batt:{comparer:.4, guerre:.7},                // ← battre
  bonnejourne:{adieu:.8, politesse:.5},         // ← bonnejournee
  capabl:{meta:.6},                             // ← capable
  casern:{batir:.5, force:.7},                  // ← caserne
  central:{batir:.5, energie:1},                // ← centrale
  clas:{classer:.8},                            // ← class
  coloni:{lieu:.7, expansion:.9},               // ← colonis
  depen:{argent:.7},                            // ← depens
  depui:{histoire:.4, temps:.5},                // ← depuis
  dirige:{politesse:.5},                        // ← dirigeant
  dispo:{inventaire:.6, liste:.5},              // ← dispos
  expliqu:{cause:.8, question:.5},              // ← explique
  faibl:{comparer:.4, probleme:.5},             // ← faible
  fair:{conseil:.45, ordre:.3},                 // ← faire
  ferm:{batir:.5, lieu:.3, nourriture:.9},      // ← ferme
  import:{conseil:.6},                          // ← important
  longtemp:{temps:.7, futur:.4},                // ← longtemps
  moiti:{marchand:1},                           // ← moitie
  navi:{unite:.85, force:.5},                   // ← navire
  nuclea:{science:.6, force:.7},                // ← nucleair
  parju:{reproche:.9},                          // ← parjure
  partage:{partage:1},                          // ← partageons
  quell:{liste:.55, question:.5},               // ← quelles
  sesterr:{partage:.8},                         // ← sesterres
  souh:{attente:.8},                            // ← souhait
  souven:{rappel:1},                            // ← souvenir
  temp:{temps:.8, cout:.35},                    // ← temps
  tenuparol:{reproche:.9},                      // ← tenuparole
  usin:{batir:.5, argent:.6, industrie:.8},     // ← usine
});
CLES_LEX = Object.keys(LEX);
