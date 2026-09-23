/* ===========================================================
   CONSEIL DE LA COURONNE — l'IA qui gère ton pays avec toi.
   Elle mesure, diagnostique, projette, classe les actions par
   rendement, planifie les guerres, et exécute tes ordres.
   =========================================================== */

const CONSEIL = {id:-1, nom:'Conseil de la Couronne', col:'#7ee0d0', conseil:true};

/* ---------- prix fictifs : ce que vaut une unité de chaque
     ressource compte tenu de la situation du moment ---------- */
function valeurs(){
  const p = S.player, b = bilan(p);
  const v = {
    nourriture: 1, or: 1, materiaux: 0.6, energie: 0.8, recherche: 0.9, bonheur: 1.2, defense: 0.7,
  };
  if(b.netFood < 0)            v.nourriture = 4.5;
  else if(p.nourriture < 60)   v.nourriture = 2.6;
  else if(b.netFood > 12)      v.nourriture = 0.45;
  if(b.net < 0)                v.or = 3.2;
  else if(p.or < 200)          v.or = 2.0;
  if(b.energie < 0)            v.energie = 3.5;
  else if(b.energie < 4)       v.energie = 1.4;
  if(p.bonheur < 35)           v.bonheur = 4.0;
  else if(p.bonheur < 50)      v.bonheur = 2.2;
  if(p.mat < 80)               v.materiaux = 1.6;
  if(p.guerre.size)            v.defense = 1.8;
  if(p.rech)                   v.recherche = 1.3;
  return v;
}

/* ---------- diagnostic : d'où vient vraiment le problème ---------- */
function diagnostic(sujet){
  const p = S.player, b = bilan(p), lignes = [];

  if(sujet === 'bonheur'){
    const cible = 55 - (p.taxe-0.3)*120 + b.bonus + (p.nourriture>40?8:0) - p.guerre.size*7
                - (p.nourriture<0?30:0) - (b.penurieEnergie?10:0) - (p.or<0?15:0)
                - malusCapitale(p);
    lignes.push({quoi:'base', v:55, txt:'humeur de fond du peuple'});
    lignes.push({quoi:'impots', v:-(p.taxe-0.3)*120,
      txt:`impôts à ${(p.taxe*100).toFixed(0)}% (${p.taxe>0.3?'au-dessus':'en dessous'} du seuil de tolérance de 30%)`});
    if(b.bonus)            lignes.push({quoi:'universites', v:b.bonus, txt:'universités'});
    if(p.nourriture>40)    lignes.push({quoi:'greniers', v:8, txt:'greniers pleins'});
    if(p.guerre.size)      lignes.push({quoi:'guerre', v:-7*p.guerre.size, txt:`${p.guerre.size} guerre(s) en cours`});
    if(p.nourriture<0)     lignes.push({quoi:'famine', v:-30, txt:'FAMINE'});
    if(b.penurieEnergie)   lignes.push({quoi:'energie', v:-10, txt:'pénurie d\'énergie'});
    if(p.or<0)             lignes.push({quoi:'faillite', v:-15, txt:'trésor à découvert'});
    if(malusCapitale(p) > 0.5) lignes.push({quoi:'capitale', v:-malusCapitale(p),
      txt:`capitale perdue — le pays s'en remet encore `
        + `(${Math.max(0, DEUIL_CAPITALE - (S.mois - p.chocCapitale.depuis))} mois)`});
    return {sujet, valeur:p.bonheur, cible, lignes, unite:''};
  }

  if(sujet === 'or'){
    const parPop = b.pop * p.taxe * 0.55 * (aTech(p,'fiscalite')?1.25:1);
    lignes.push({quoi:'impots', v:parPop, txt:`impôts sur ${b.pop.toFixed(0)}k habitants à ${(p.taxe*100).toFixed(0)}%`});
    const parBat = b.gold - parPop;
    if(Math.abs(parBat) > 0.5) lignes.push({quoi:'batiments', v:parBat, txt:'usines, ports et accords commerciaux'});
    lignes.push({quoi:'entretien', v:-(b.upkeep - coutUp(p.armee)), txt:'entretien des bâtiments'});
    lignes.push({quoi:'solde', v:-coutUp(p.armee), txt:`solde de ${nbUnites(p.armee)} unités`});
    if(b.penurieEnergie) lignes.push({quoi:'penurie', v:-b.gold*0.4/0.6, txt:'pénurie d\'énergie (−40% de revenus)'});
    return {sujet, valeur:b.net, cible:null, lignes, unite:' or/mois'};
  }

  if(sujet === 'nourriture'){
    let terres = 0, fermes = 0;
    for(const t of tuilesDe(p)){
      terres += TERRAIN[t.terr].food + t.pop*0.05;
      fermes += effetsProvince(t, p).food - TERRAIN[t.terr].food - t.pop*0.05;
    }
    lignes.push({quoi:'terres', v:terres, txt:'rendement naturel des provinces'});
    if(fermes) lignes.push({quoi:'fermes', v:fermes, txt:`fermes${aTech(p,'agronomie')?' (+50% agronomie)':''}`});
    lignes.push({quoi:'consommation', v:-b.conso, txt:`consommation de ${b.pop.toFixed(0)}k habitants`});
    return {sujet, valeur:b.netFood, cible:null, lignes, unite:' nourriture/mois'};
  }

  if(sujet === 'energie'){
    let prod = 0, conso = 0;
    for(const t of tuilesDe(p)){
      const e = effetsProvince(t, p);
      if(e.energie > 0) prod += e.energie; else conso -= e.energie;
    }
    lignes.push({quoi:'centrales', v:prod, txt:'centrales'});
    lignes.push({quoi:'usines', v:-conso, txt:'usines'});
    return {sujet, valeur:b.energie, cible:null, lignes, unite:' énergie'};
  }
  return null;
}

/* ---------- projection : l'avenir si rien ne change ---------- */
function projeterEtat(mois = 12){
  const p = S.player, b = bilan(p);
  const fisc = aTech(p,'fiscalite')?1.25:1;
  const orPop  = b.pop * p.taxe * 0.55 * fisc * (p.commerce && p.commerce.size ? 1+0.08*p.commerce.size : 1);
  const foodPop = b.pop * 0.05, consoPop = b.conso;
  const e = {or:p.or, mat:p.mat, nourriture:p.nourriture, bonheur:p.bonheur, sci:p.sci, popM:1};
  const evts = [], traj = [];

  for(let m = 1; m <= mois; m++){
    const gold  = (b.gold - orPop) + orPop*e.popM;
    const food  = (b.food - foodPop) + foodPop*e.popM;
    const conso = consoPop*e.popM;
    const net   = gold - b.upkeep;

    e.or += net;
    e.mat += b.mat;
    e.nourriture = clamp(e.nourriture + food - conso, -50, 400);
    e.sci += b.sci;

    // le deuil de la capitale se dissipe au fil de la projection
    const deuil = p.chocCapitale
      ? p.chocCapitale.force * Math.max(0, 1 - (S.mois + m - p.chocCapitale.depuis)/DEUIL_CAPITALE) : 0;
    const cible = 55 - (p.taxe-0.3)*120 + b.bonus + (e.nourriture>40?8:0) - p.guerre.size*7
                - (e.nourriture<0?30:0) - (b.penurieEnergie?10:0) - (e.or<0?15:0) - deuil;
    e.bonheur = clamp(e.bonheur + clamp(cible - e.bonheur, -3, 3), 0, 100);

    const croiss = (e.nourriture > 0 ? 0.006 : -0.02) * (aTech(p,'medecine')?1.5:1) * (e.bonheur>50?1:0.5);
    e.popM *= (1 + croiss);

    if(e.nourriture < 0 && !evts.find(x=>x.q==='famine')) evts.push({q:'famine', m, txt:'famine'});
    if(e.or < 0 && !evts.find(x=>x.q==='faillite'))       evts.push({q:'faillite', m, txt:'trésor à découvert'});
    if(e.bonheur < 25 && !evts.find(x=>x.q==='revolte'))  evts.push({q:'revolte', m, txt:'peuple au bord de la révolte'});
    if(p.rech && e.sci >= TECHS[p.rech].cout && !evts.find(x=>x.q==='tech'))
      evts.push({q:'tech', m, txt:`fin de la recherche « ${TECHS[p.rech].nom} »`});

    traj.push({m, or:e.or, mat:e.mat, nourriture:e.nourriture, bonheur:e.bonheur,
               recherche:e.sci, population:b.pop*e.popM});
  }
  return {mois, ...e, pop: b.pop*e.popM, evts, traj};
}

/* ---------- placement : la meilleure province pour un bâtiment ---------- */
function meilleurEmplacement(type){
  const p = S.player, B = BUILDINGS[type], out = [];
  for(const t of tuilesDe(p)){
    if(!placeLibre(t)) continue;
    if(B.cote && t.terr !== 'cote') continue;
    let score = 0, raisons = [];
    const T0 = TERRAIN[t.terr];
    if(type === 'ferme'){
      const cap = 10 + T0.hab*22 + 15;
      score = T0.food*1.2 + t.pop*0.25 + (t.terr==='plaine'?3:0) + (cap - t.pop)*0.08;
      raisons.push(`${T0.nom.toLowerCase()} (${T0.food} de rendement naturel)`);
    } else if(type === 'mine'){
      score = T0.mat*2 + (t.terr==='montagne'?4:0);
      raisons.push(`${T0.nom.toLowerCase()} (${T0.mat} de matériaux)`);
    } else if(type === 'usine' || type === 'centrale'){
      score = t.pop*0.4 + (t.terr==='plaine'||t.terr==='cote'?2:0) + 4;
      raisons.push(`${t.pop.toFixed(1)}k habitants sur place`);
    } else if(type === 'universite'){
      score = t.pop*0.5 + 3; raisons.push(`population de ${t.pop.toFixed(1)}k`);
    } else if(type === 'caserne'){
      const expose = voisins(t).some(v => v.owner !== null && v.owner !== p.id &&
                       (p.guerre.has(v.owner) || rel(p, S.nations[v.owner]) < 0));
      score = (expose?8:1) + T0.def*0.1;
      if(expose) raisons.push('province frontalière exposée');
    } else if(type === 'port'){
      score = 6 + t.pop*0.2; raisons.push('province côtière');
    }
    // sécurité : on évite de bâtir sous le nez d'un ennemi
    const danger = voisins(t).filter(v => v.owner !== null && v.owner !== p.id && p.guerre.has(v.owner)).length;
    if(danger && type !== 'caserne'){ score -= danger*3; raisons.push('mais exposée à l\'ennemi'); }
    // regrouper le même ouvrage au même endroit paie : c'est la spécialisation
    const deja = batiments(t).filter(k => k === type).length;
    if(deja){
      const apres = (deja + 1) / (nbBatiments(t) + 1);
      score += 3 + apres*4;
      raisons.push(`déjà ${deja} ${BUILDINGS[type].nom.toLowerCase()}${deja>1?'s':''} sur place — la province s'y spécialise`);
    }
    out.push({tuile:t, score, raisons});
  }
  return out.sort((a,b)=>b.score-a.score)[0] || null;
}

/* ---------- le catalogue d'actions possibles, chiffrées ---------- */
function actionsPossibles(){
  const p = S.player, b = bilan(p), v = valeurs(), out = [];
  const gain = d => (d.nourriture||0)*v.nourriture + (d.or||0)*v.or + (d.materiaux||0)*v.materiaux
                  + (d.energie||0)*v.energie + (d.recherche||0)*v.recherche + (d.bonheur||0)*v.bonheur;

  // --- bâtiments ---
  for(const [k, B] of Object.entries(BUILDINGS)){
    if(B.tech && !aTech(p, B.tech)) continue;
    const place = meilleurEmplacement(k);
    if(!place) continue;
    const d = {};
    for(const [q, x] of Object.entries(B.eff)){
      if(q === 'food') d.nourriture = x * (aTech(p,'agronomie')?1.5:1);
      else if(q === 'mat') d.materiaux = x;
      else if(q === 'gold') d.or = x;
      else if(q === 'sci') d.recherche = x;
      else if(q === 'energie') d.energie = x + (k==='centrale' && aTech(p,'electricite')?6:0);
      else if(q === 'bonheur') d.bonheur = x;
    }
    const brut = gain(d) - B.up * v.or;
    const abordable = p.or >= B.or && p.mat >= B.mat;
    out.push({type:'batir', cle:k, cible:place.tuile, valeur:brut, cout:{or:B.or, mat:B.mat},
      abordable, effets:d, retour: brut > 0 ? Math.round(B.or / Math.max(0.5, brut)) : null,
      libelle:`${BUILDINGS[k].nom} sur la province ${nomTuile(place.tuile)}`,
      pourquoi: place.raisons[0] || null});
  }

  // --- fiscalité ---
  for(const delta of [-0.10, -0.05, 0.05, 0.10]){
    const nt = clamp(p.taxe + delta, 0, 0.8);
    if(Math.abs(nt - p.taxe) < 0.01) continue;
    const dOr = b.pop * 0.55 * (nt - p.taxe) * (aTech(p,'fiscalite')?1.25:1);
    const dBonheur = -(nt - p.taxe) * 120;
    const val = dOr*v.or + dBonheur*v.bonheur*0.35;
    out.push({type:'impot', valeur:val, taux:nt, abordable:true,
      effets:{or:dOr, bonheur:dBonheur}, cout:{},
      libelle:`${delta>0?'monter':'baisser'} les impôts à ${(nt*100).toFixed(0)}%`});
  }

  // --- recherche ---
  if(!p.rech){
    for(const [k, T2] of Object.entries(TECHS)){
      if(p.tech.has(k) || !T2.req.every(r=>p.tech.has(r))) continue;
      let pertinence = 1;
      if(k==='agronomie' && b.netFood < 4) pertinence = 3.2;
      if(k==='fiscalite' && b.net < 6) pertinence = 2.8;
      if(k==='industrie') pertinence = 2.2;
      if(k==='medecine' && b.netFood > 6) pertinence = 1.8;
      if((k==='poudre'||k==='nucleaire') && p.guerre.size) pertinence = 2.6;
      if(k==='electricite' && b.energie < 6) pertinence = 2.2;
      const mois = Math.max(1, Math.ceil(T2.cout / Math.max(0.6, b.sci)));
      out.push({type:'recherche', cle:k, valeur: pertinence*2.2 - mois*0.05, abordable:true, cout:{},
        libelle:`lancer la recherche « ${T2.nom} »`, delai:mois,
        pourquoi:T2.desc});
    }
  }

  // --- armée ---
  const menaceMax = menacePrincipale();
  if(menaceMax){
    for(const k of CLES_UNITES){
      if(!uniteDispo(p, k)) continue;
      const U = UNITES[k];
      const val = (U.att + U.def)/2 * v.defense * 0.09 - U.up*v.or;
      out.push({type:'recruter', cle:k, valeur:val * (menaceMax.gravite), abordable: p.or >= U.or && p.mat >= U.mat,
        cout:{or:U.or, mat:U.mat}, libelle:`recruter 1 ${U.nom.toLowerCase()}`,
        pourquoi:`${menaceMax.nation.nom} pèse ${menaceMax.ratio.toFixed(2)} fois ta puissance`});
    }
  }

  // --- colonisation ---
  const libres = tuilesDe(p).flatMap(voisins).filter(t => t && t.owner === null && t.terr !== 'ocean');
  if(libres.length && p.or >= 120){
    const best = libres.sort((a,b2)=> (TERRAIN[b2.terr].food+TERRAIN[b2.terr].mat) - (TERRAIN[a.terr].food+TERRAIN[a.terr].mat))[0];
    out.push({type:'coloniser', cible:best, valeur: 2.4 + TERRAIN[best.terr].food*0.4, abordable:true,
      cout:{or:120}, libelle:`coloniser la terre ${nomTuile(best)}`,
      pourquoi:`${TERRAIN[best.terr].nom.toLowerCase()} inoccupé${TERRAIN[best.terr].nom.endsWith('e')?'e':''}`});
  }

  // --- colonisation outre-mer, quand la terre ferme est épuisée ---
  if(typeof coloniesNavales === 'function' && !obstacleNaval(p) && p.or >= COUT_COLONIE_MER){
    const c = coloniesNavales(p)[0];
    if(c && !libres.length)
      out.push({type:'colonisermer', cible:c.tuile, valeur: 2.0 + TERRAIN[c.tuile.terr].food*0.4,
        abordable:true, cout:{or:COUT_COLONIE_MER},
        libelle:`fonder un comptoir outre-mer sur ${nomTuile(c.tuile)}`,
        pourquoi:`${c.distance} case${c.distance>1?'s':''} de mer, plus aucune terre libre à ta frontière`});
  }

  return out.sort((a,b)=> b.valeur - a.valeur);
}

function nomTuile(t){
  const p = S.player;
  if(p.capitale === t) return 'capitale';
  return `${TERRAIN[t.terr].nom.toLowerCase()} (${t.q},${t.r})`;
}

/* ---------- qui te menace le plus ---------- */
function menacePrincipale(){
  const p = S.player, out = [];
  for(const o of S.nations){
    if(o.joueur || tuilesDe(o).length === 0) continue;
    const ratio = ratioForce(o, p);
    let g = ratio * (p.guerre.has(o.id) ? 2.2 : 1) * (frontiereCommune(p, o) ? 1.5 : 0.6);
    if(p.allies.has(o.id)) g *= 0.25;
    else if(p.pacte.has(o.id)) g *= 0.55;
    g *= 1 + Math.max(0, -rel(o, p))/120;
    out.push({nation:o, ratio, gravite:clamp(g, 0.2, 3)});
  }
  return out.sort((a,b)=>b.gravite-a.gravite)[0] || null;
}

/* ---------- plan de guerre ---------- */
function planDeGuerre(ennemi){
  const p = S.player;
  const fronts = [];
  const mer = typeof atteignablesParMer === 'function' ? atteignablesParMer(p) : new Map();
  for(const t of S.tiles.values()){
    if(t.owner !== ennemi.id) continue;
    const parTerre = voisins(t).some(v => v.owner === p.id);
    const traversee = parTerre ? 0 : mer.get(t);
    if(!parTerre && traversee === undefined) continue;
    const fortif = TERRAIN[t.terr].def + (aBatiment(t,'caserne')?20:0) + t.fort;
    const def = (forceDef(ennemi.armee, ennemi) + 25) * (1 + fortif/100);
    // une côte lointaine coûte plus cher qu'une frontière : on la classe après
    fronts.push({tuile:t, fortif, def, naval:!parTerre, traversee:traversee || 0,
                 rang: def * (parTerre ? 1 : 1.45)});
  }
  fronts.sort((a,b)=>a.rang-b.rang);
  const cible = fronts[0];
  if(!cible) return {possible:false, ennemi,
    raison: mer.size ? 'aucune de ses provinces n\'est à portée' : 'ni frontière ni portée navale'};

  // un débarquement n'engage que ce que la flotte peut porter, et frappe à 70%
  const att = cible.naval
    ? forceAtt(corpsDebarquement(p, 1), p) * 0.70
    : forceAtt(p.armee, p);
  const ratio = att / cible.def;
  const proba = clamp((ratio - 0.70) / 0.75, 0, 1);         // bornes réelles du tirage de bataille
  const manque = Math.max(0, cible.def*1.25 - att);
  const parChar = UNITES.chars.att * multMilitaire(p);
  const renforts = manque > 0 ? Math.ceil(manque / Math.max(1, parChar)) : 0;
  return {possible:true, ennemi, cible:cible.tuile, fortif:cible.fortif, def:cible.def,
          att, ratio, proba, renforts, naval:cible.naval, traversee:cible.traversee,
          occ: cible.tuile.occ ? cible.tuile.occ.val : 0};
}

/* ---------- exécution réelle des ordres ---------- */
// le Conseil ne contourne pas la pause : sinon il suffirait de lui donner
// les ordres que l'interface refuse
const ORDRES_EN_PAUSE = {recruter:1};
function executer(a){
  const p = S.player;
  if(S.paused && !ORDRES_EN_PAUSE[a.type])
    return {ok:false, txt:`le temps est arrêté — relance la partie et je m'en charge aussitôt`};
  switch(a.type){
    case 'batir': {
      const B = BUILDINGS[a.cle], t = a.cible;
      if(!t) return {ok:false, txt:'désigne une province'};
      if(!placeLibre(t)) return {ok:false, txt:`${nomTuile(t)} porte déjà ${nbBatiments(t)} ouvrages, `
        + `c'est tout ce que sa population supporte`};
      if(B.tech && !aTech(p, B.tech)) return {ok:false, txt:`il faut d'abord la technologie « ${TECHS[B.tech].nom} »`};
      if(B.cote && t.terr !== 'cote') return {ok:false, txt:'un port exige une province côtière'};
      if(p.or < B.or || p.mat < B.mat)
        return {ok:false, txt:`il manque ${Math.max(0, Math.ceil(B.or-p.or))} or et ${Math.max(0, Math.ceil(B.mat-p.mat))} matériaux`};
      p.or -= B.or; p.mat -= B.mat; ajouterBatiment(t, a.cle);
      return {ok:true, txt:`${B.nom} bâtie sur ${nomTuile(t)} (−${B.or} or, −${B.mat} matériaux)`};
    }
    case 'recruter': {
      const U = UNITES[a.cle], q = a.quantite || 1;
      if(!uniteDispo(p, a.cle)) return {ok:false, txt:`il faut la technologie « ${TECHS[U.tech].nom} »`};
      if(p.or < U.or*q || p.mat < U.mat*q)
        return {ok:false, txt:`il manque ${Math.max(0,Math.ceil(U.or*q-p.or))} or et ${Math.max(0,Math.ceil(U.mat*q-p.mat))} matériaux`};
      p.or -= U.or*q; p.mat -= U.mat*q; p.armee[a.cle] += q;
      return {ok:true, txt:`${q} ${U.nom.toLowerCase()} recrutée(s) (−${U.or*q} or, ${(U.hommes*q).toLocaleString('fr-FR')} hommes)`};
    }
    case 'impot': {
      const avant = p.taxe; p.taxe = clamp(a.taux, 0, 0.8);
      return {ok:true, txt:`impôts portés de ${(avant*100).toFixed(0)}% à ${(p.taxe*100).toFixed(0)}%`};
    }
    case 'recherche': {
      if(p.tech.has(a.cle)) return {ok:false, txt:'cette technologie est déjà acquise'};
      if(!TECHS[a.cle].req.every(r=>p.tech.has(r)))
        return {ok:false, txt:`il faut d'abord : ${TECHS[a.cle].req.map(r=>TECHS[r].nom).join(', ')}`};
      p.rech = a.cle;
      return {ok:true, txt:`recherche « ${TECHS[a.cle].nom} » lancée`};
    }
    case 'fortifier': {
      const t = a.cible;
      if(!t || t.owner !== p.id) return {ok:false, txt:'désigne une de tes provinces'};
      if(t.fort >= 40) return {ok:false, txt:'cette province est déjà fortifiée au maximum'};
      if(p.or < 80) return {ok:false, txt:'il faut 80 or'};
      p.or -= 80; t.fort += 10;
      return {ok:true, txt:`${nomTuile(t)} fortifiée (+10% de défense, ${t.fort}% au total)`};
    }
    case 'colonisermer': {
      const t = a.cible;
      const gene = obstacleNaval(p);
      if(gene) return {ok:false, txt:gene};
      if(!t || t.owner !== null) return {ok:false, txt:'cette terre n\'est plus libre'};
      if(p.or < COUT_COLONIE_MER) return {ok:false, txt:`il faut ${COUT_COLONIE_MER} or`};
      p.or -= COUT_COLONIE_MER; t.owner = p.id; t.pop = 2; oublierMer();
      return {ok:true, txt:`comptoir fondé outre-mer sur ${nomTuile(t)} (−${COUT_COLONIE_MER} or)`};
    }
    case 'coloniser': {
      const t = a.cible;
      if(!t || t.owner !== null) return {ok:false, txt:'cette terre n\'est plus libre'};
      if(p.or < 120) return {ok:false, txt:'il faut 120 or'};
      p.or -= 120; t.owner = p.id; t.pop = 2;
      if(typeof oublierMer === 'function') oublierMer();
      return {ok:true, txt:`${nomTuile(t)} colonisée (−120 or)`};
    }
    case 'attaquer': {
      const t = a.cible;
      if(!t || t.owner === null || t.owner === p.id) return {ok:false, txt:'désigne une province ennemie'};
      if(!p.guerre.has(t.owner)) return {ok:false, txt:`tu n'es pas en guerre contre ${S.nations[t.owner].nom}`};
      if(a.naval){
        const gene = obstacleNaval(p);
        if(gene) return {ok:false, txt:gene};
        bataille(p, S.nations[t.owner], t, fracEmbarquee(p, a.part || 0.6), true);
      } else bataille(p, S.nations[t.owner], t, a.part || 0.5);
      return {ok:true, txt:null};
    }
  }
  return {ok:false, txt:'ordre non reconnu'};
}

/* ===========================================================
   DIALOGUE AVEC LE CONSEIL
   =========================================================== */

const fmtOr = x => (x>=0?'+':'') + Math.round(x*10)/10;
const listePuces = l => l.map(x => '• ' + x).join('\n');

function etatConseil(){
  S.conseil = S.conseil || {};
  const C = S.conseil;
  C.chat ||= []; C.nonLus ||= 0;
  if(C.proposition === undefined) C.proposition = null;
  if(C.sujet === undefined) C.sujet = null;
  if(C.province === undefined) C.province = null;
  // ce dont on vient de parler : permet « et combien ça coûte ? »
  C.contexte ||= {batiment:null, unite:null, tech:null, ressource:null,
                  dimension:null, cible:null, province:null, mois:-99};
  return C;
}

/* ---------- réponses ---------- */

function repRapport(){
  const p = S.player, b = bilan(p), m = menacePrincipale(), pr = projeterEtat(12);
  const l = [];
  l.push(`Trésor ${Math.round(p.or)} or (${fmtOr(b.net)}/mois) · matériaux ${Math.round(p.mat)} (${fmtOr(b.mat)}/mois)`);
  l.push(`Nourriture ${Math.round(p.nourriture)} (${fmtOr(b.netFood)}/mois) · population ${b.pop.toFixed(0)}k`);
  l.push(`Énergie ${b.energie.toFixed(0)} · recherche ${fmtOr(b.sci)}/mois${p.rech?` sur « ${TECHS[p.rech].nom} » (${Math.round(p.sci)}/${TECHS[p.rech].cout})`:' — aucune en cours'}`);
  l.push(`Bonheur ${Math.round(p.bonheur)}/100 · impôts ${(p.taxe*100).toFixed(0)}% · ${b.nb} provinces`
    + (malusCapitale(p) > 0.5
       ? ` · capitale perdue : −${malusCapitale(p).toFixed(1)} de bonheur` : ''));
  l.push(`Armée ${nbUnites(p.armee)} unités, puissance ${puissance(p).toFixed(0)}${m?` · principale menace : ${m.nation.nom} (${m.ratio.toFixed(2)}×)`:''}`);
  let t = `État du royaume, ${dateTexte()} :\n${listePuces(l)}`;
  if(pr.evts.length) t += `\n\nCe qui vient : ${pr.evts.map(e=>`${e.txt} dans ${e.m} mois`).join(', ')}.`;
  const reco = actionsPossibles().filter(a=>a.abordable)[0];
  if(reco){ etatConseil().proposition = reco;
    t += `\nPriorité que je recommande : ${reco.libelle}. Dis « fais-le » et je m'en charge.`; }
  return t;
}

function repDiagnostic(an){
  const p = S.player, b = bilan(p);
  let sujet = null;
  const v = an.vecteur;
  if((v.bonheur||0) > .4) sujet = 'bonheur';
  else if((v.argent||0) > .4 || (v.impot||0) > .4) sujet = 'or';
  else if((v.nourriture||0) > .4) sujet = 'nourriture';
  else if((v.energie||0) > .4) sujet = 'energie';
  if(!sujet){                                        // il choisit lui-même le point noir
    const maux = [];
    if(p.bonheur < 50) maux.push(['bonheur', 50 - p.bonheur]);
    if(b.net < 0) maux.push(['or', -b.net*3]);
    if(b.netFood < 0) maux.push(['nourriture', -b.netFood*4]);
    if(b.energie < 0) maux.push(['energie', -b.energie*2]);
    sujet = (maux.sort((a,c)=>c[1]-a[1])[0] || ['bonheur'])[0];
  }
  const d = diagnostic(sujet);
  if(!d) return `Je ne vois pas ce que tu veux que j'examine. Demande-moi le bonheur, le trésor, la nourriture ou l'énergie.`;

  const lignes = d.lignes.filter(x => Math.abs(x.v) > 0.05).sort((a,c)=>Math.abs(c.v)-Math.abs(a.v))
                  .map(x => `${x.txt} : ${fmtOr(x.v)}`);
  const nom = {bonheur:'Le bonheur', or:'Le solde mensuel', nourriture:'La balance alimentaire', energie:'L\'énergie'}[sujet];
  let t = `${nom} est à ${Math.round(d.valeur*10)/10}${d.unite}. Décomposition :\n${listePuces(lignes)}`;
  if(sujet === 'bonheur' && d.cible !== null)
    t += `\nIl converge vers ${Math.round(d.cible)} au rythme de 3 points par mois.`;

  // le remède, calculé
  const remede = actionsPossibles().filter(a => a.abordable &&
      ((sujet==='bonheur' && (a.effets?.bonheur > 0 || a.type==='impot' && a.taux < p.taxe)) ||
       (sujet==='or' && a.effets?.or > 0) ||
       (sujet==='nourriture' && a.effets?.nourriture > 0) ||
       (sujet==='energie' && a.effets?.energie > 0)))[0];
  if(remede){ etatConseil().proposition = remede;
    t += `\n\nRemède le plus efficace : ${remede.libelle}`
       + (remede.effets ? ` (${Object.entries(remede.effets).map(([q,x])=>`${fmtOr(x)} ${q}`).join(', ')})` : '')
       + `. Dis « fais-le ».`;
  }
  return t;
}

function repPrevision(an){
  const mois = clamp(an.slots?.mois || 12, 1, 120);
  const p = S.player, pr = projeterEtat(mois);
  const l = [
    `Trésor : ${Math.round(p.or)} → ${Math.round(pr.or)} or`,
    `Nourriture : ${Math.round(p.nourriture)} → ${Math.round(pr.nourriture)}`,
    `Population : ${bilan(p).pop.toFixed(0)}k → ${pr.pop.toFixed(0)}k`,
    `Bonheur : ${Math.round(p.bonheur)} → ${Math.round(pr.bonheur)}`,
  ];
  let t = `Si tu ne changes rien, dans ${mois} mois :\n${listePuces(l)}`;
  t += pr.evts.length ? `\n\nÉvénements prévus : ${pr.evts.map(e=>`${e.txt} au mois ${e.m}`).join(', ')}.`
                      : `\n\nAucune rupture prévue sur cette période.`;
  return t;
}

function repConseil(){
  const acts = actionsPossibles();
  const dispo = acts.filter(a => a.abordable).slice(0, 3);
  if(!dispo.length) return `Tes caisses ne permettent rien pour l'instant. Laisse passer quelques mois, ou baisse les impôts pour relancer le bonheur.`;
  etatConseil().proposition = dispo[0];
  const l = dispo.map((a,i) => {
    let s = `${a.libelle}`;
    const c = [];
    if(a.cout?.or) c.push(`${a.cout.or} or`);
    if(a.cout?.mat) c.push(`${a.cout.mat} matériaux`);
    if(c.length) s += ` — ${c.join(' + ')}`;
    if(a.effets) s += ` → ${Object.entries(a.effets).map(([q,x])=>`${fmtOr(x)} ${q}`).join(', ')}`;
    if(a.retour) s += `, rentabilisé en ${a.retour} mois`;
    if(a.delai) s += `, ${a.delai} mois d'étude`;
    if(a.pourquoi) s += ` (${a.pourquoi})`;
    return s;
  });
  const bloquees = acts.filter(a => !a.abordable).slice(0,1);
  let t = `Par ordre de rendement :\n${listePuces(l)}\nDis « fais-le » pour lancer la première.`;
  if(bloquees.length) t += `\nHors budget pour l'instant : ${bloquees[0].libelle}.`;
  return t;
}

function repOu(an){
  const k = an.slots?.batiment;
  if(!k) return `Quel bâtiment veux-tu placer ? Ferme, mine, port, usine, centrale, université ou caserne.`;
  const B = BUILDINGS[k];
  if(B.tech && !aTech(S.player, B.tech)) return `Il faut d'abord la technologie « ${TECHS[B.tech].nom} ».`;
  const place = meilleurEmplacement(k);
  if(!place) return `Aucune province libre ne convient${B.cote?' : un port exige une côte':''}.`;
  etatConseil().proposition = {type:'batir', cle:k, cible:place.tuile, cout:{or:B.or,mat:B.mat},
                               libelle:`${B.nom} sur ${nomTuile(place.tuile)}`};
  etatConseil().province = place.tuile;
  return `${B.nom} : la meilleure province est ${nomTuile(place.tuile)}`
       + (place.raisons.length ? ` — ${place.raisons.join(', ')}` : '')
       + `. Coût ${B.or} or et ${B.mat} matériaux. Dis « fais-le » et j'ordonne le chantier.`;
}

function repCout(an){
  const p = S.player, s = an.slots || {};
  if(s.batiment){ const B = BUILDINGS[s.batiment];
    return `${B.nom} : ${B.or} or + ${B.mat} matériaux, entretien ${B.up}/mois. ${B.desc}. `
         + `Tu ${p.or>=B.or && p.mat>=B.mat ? 'peux te le permettre' : `es à court de ${p.or<B.or?'or':'matériaux'}`}.`; }
  if(s.unite){ const U = UNITES[s.unite];
    return `${U.nom} : ${U.or} or + ${U.mat} matériaux l'unité, solde ${U.up}/mois, ${U.hommes.toLocaleString('fr-FR')} hommes. `
         + `Attaque ${U.att}, défense ${U.def}. Avec ${Math.round(p.or)} or tu peux en lever ${Math.floor(p.or/U.or)}.`; }
  if(s.tech){
    const T2 = TECHS[s.tech], b = bilan(p);
    if(p.tech.has(s.tech)) return `« ${T2.nom} » est déjà acquise. ${T2.desc}.`;
    const manque = T2.req.filter(r => !p.tech.has(r));
    let t = `« ${T2.nom} » coûte ${T2.cout} points de recherche. ${T2.desc}.`;
    if(manque.length) t += ` Elle exige d'abord ${manque.map(r=>TECHS[r].nom).join(', ')}.`;
    if(b.sci < 0.5){
      const u = meilleurEmplacement('universite');
      t += ` Mais tu ne produis aucune recherche : sans université, ce chiffre restera hors d'atteinte.`;
      if(u && aTech(p,'ecriture')){
        etatConseil().proposition = {type:'batir', cle:'universite', cible:u.tuile,
          libelle:`Université sur ${nomTuile(u.tuile)}`};
        t += ` J'en bâtirais une sur ${nomTuile(u.tuile)} — dis « fais-le ».`;
      } else if(!aTech(p,'ecriture')){
        etatConseil().proposition = {type:'recherche', cle:'ecriture', libelle:'recherche « Écriture »'};
        t += ` Il faut commencer par la technologie Écriture, qui débloque les universités — dis « fais-le ».`;
      }
    } else {
      t += ` À ton rythme (${b.sci.toFixed(1)} point${b.sci>=2?'s':''} par mois), compte ${Math.ceil((T2.cout - (p.rech===s.tech?p.sci:0))/b.sci)} mois.`;
    }
    return t;
  }
  return `De quoi veux-tu connaître le prix ? Un bâtiment, une unité ou une technologie.`;
}

function repComparer(an){
  const p = S.player;
  const cible = an.cible || an.slots?.cible;
  if(!cible){
    const classement = S.nations.filter(o=>tuilesDe(o).length)
        .map(o=>({o, f:puissance(o)})).sort((a,b)=>b.f-a.f);
    const rang = classement.findIndex(x=>x.o===p) + 1;
    const lignes = classement.slice(0,3).map(x=>`${x.o.nom} : ${x.f.toFixed(0)}${x.o===p?' ← toi':''}`);
    if(rang > 3) lignes.push(`…`, `${p.nom} : ${puissance(p).toFixed(0)} ← toi (${rang}ᵉ)`);
    const m = menacePrincipale();
    return `Tu es ${rang}ᵉ sur ${classement.length} par la puissance militaire.\n` + listePuces(lignes)
      + (m ? `\nLa plus dangereuse pour toi est ${m.nation.nom} : ${m.ratio.toFixed(2)} fois ta puissance`
           + `${frontiereCommune(p, m.nation) ? ', et elle partage ta frontière' : ''}.` : '');
  }
  const plan = planDeGuerre(cible);
  const l = [
    `Puissance : toi ${puissance(p).toFixed(0)} contre ${puissance(cible).toFixed(0)} (${ratioForce(p,cible).toFixed(2)}×)`,
    `Provinces : ${tuilesDe(p).length} contre ${tuilesDe(cible).length}`,
    `Trésor : ${Math.round(p.or)} contre ${Math.round(cible.or)} or`,
  ];
  let t = `Face à ${cible.nom} :\n${listePuces(l)}`;
  if(!plan.possible)
    return t + `\n${plan.raison === 'ni frontière ni portée navale'
      ? `Ni frontière commune, ni portée navale : il faudrait la Navigation et une flotte, ou te rapprocher par la terre.`
      : `Aucune de ses provinces n'est à portée, par terre comme par mer.`}`;
  if(plan.naval)
    t += `\n\nAucune frontière commune — mais ${nomTuile(plan.cible)} est à `
       + `${plan.traversee} case${plan.traversee>1?'s':''} de mer. Un débarquement est possible : `
       + `ta flotte porte ${capaciteNavale(S.player)} unité${capaciteNavale(S.player)>1?'s':''}, `
       + `et elles frappent à 70% de leur force.`;
  t += `\n\nMeilleur point d'attaque : ${nomTuile(plan.cible)} — défense ${Math.round(plan.def)} `
     + `(fortifications +${plan.fortif}%) contre ${Math.round(plan.att)} d'attaque, soit `
     + `environ ${Math.round(plan.proba*100)} chances sur 100 de l'emporter.`;
  if(plan.occ) t += ` Le front y est déjà occupé à ${Math.round(plan.occ*100)}%.`;
  if(plan.renforts > 0) t += ` Avec ${plan.renforts} chars de plus, tu passerais au-dessus de 60%.`;
  if(p.guerre.has(cible.id)){
    etatConseil().proposition = {type:'attaquer', cible:plan.cible, part:0.6, naval:plan.naval,
      libelle:`${plan.naval?'débarquer sur':'attaquer'} ${nomTuile(plan.cible)} avec 60% des forces`};
    t += plan.naval ? ` Dis « attaque » et j'ordonne le débarquement.`
                    : ` Dis « attaque » et j'y engage 60% de l'armée.`;
  }
  return t;
}

/* ---------- le passé : la chronique du règne ---------- */
function repHistoire(an){
  const mois = clamp(an.slots?.mois || 12, 1, 400);
  const depuis = S.mois - mois;
  const faits = (S.log || []).filter(l => l.mois >= depuis && l.txt);
  if(!faits.length)
    return `La chronique est vide sur les ${mois} derniers mois — rien de notable n'a été consigné.`;

  // on garde les événements marquants, du plus récent au plus ancien
  const marquants = faits.filter(l => l.cls === 'bad' || l.cls === 'good');
  const retenus = (marquants.length >= 3 ? marquants : faits).slice(-9).reverse();
  const dat = m => MOIS[((m%12)+12)%12] + ' ' + (1900 + Math.floor(m/12));
  const l = retenus.map(x => `${dat(x.mois)} — ${x.txt}`);

  let t = `Ce que rapportent les registres des ${mois} derniers mois :\n${listePuces(l)}`;
  const guerres = faits.filter(x => /guerre/i.test(x.txt)).length;
  const revers  = faits.filter(x => x.cls === 'bad').length;
  if(revers > faits.length*0.4) t += `\nUne période difficile : ${revers} mauvaises nouvelles sur ${faits.length} entrées.`;
  else if(guerres) t += `\nLes armes ont parlé ${guerres} fois sur la période.`;
  return t;
}

/* ---------- les règles : à quoi sert quoi ---------- */
const MECANIQUES = {
  bonheur: `Le bonheur part d'un fond de 55 et glisse de 3 points par mois vers une cible. `
    + `Les impôts au-dessus de 30% le font chuter (1,2 point par point de taxe), chaque guerre coûte 7 points, `
    + `une famine en coûte 30, une pénurie d'énergie 10, un trésor à découvert 15. `
    + `Les universités et des greniers pleins (plus de 40 de réserve) le remontent. `
    + `Sous 25, le peuple est au bord de la révolte.`,
  or: `Tes revenus viennent des impôts (population × taux × 0,55) et des bâtiments — ports, usines, accords commerciaux. `
    + `La Fiscalité ajoute 25%, chaque accord commercial 8%. En face : l'entretien des bâtiments et la solde de l'armée. `
    + `Une pénurie d'énergie ampute revenus et recherche de 40%.`,
  nourriture: `Chaque province produit selon son terrain, plus 0,05 par millier d'habitants. Les fermes ajoutent 5 `
    + `(7,5 avec l'Agronomie). La population en consomme 0,35 par millier. Une balance négative vide les greniers, `
    + `puis c'est la famine : le bonheur s'effondre et la population décroît.`,
  energie: `Chaque centrale produit 10 (16 avec l'Électricité), chaque usine en consomme 3. `
    + `Si le total passe sous zéro, tous tes revenus et ta recherche tombent de 40%, et le bonheur perd 10 points.`,
  population: `Elle croît de 0,6% par mois tant que la nourriture est positive et le bonheur au-dessus de 50 `
    + `(0,3% sinon), et décroît de 2% en cas de famine. La Médecine ajoute 50% à cette croissance. `
    + `C'est elle qui porte tes impôts : une population qui stagne, ce sont des revenus qui stagnent.`,
  recherche: `Seules les universités produisent des points de recherche : 4 par mois chacune, +60% avec l'Informatique. `
    + `Sans université, tu ne progresses pas du tout dans l'arbre technologique.`,
  guerre: `Une bataille compare ton attaque (somme des attaques × multiplicateurs technologiques) à la défense `
    + `ennemie, majorée par le terrain, les casernes (+20) et les fortifications. `
    + `Sous un rapport de 0,70 tu ne peux pas l'emporter ; au-dessus de 1,45 la victoire est certaine. `
    + `Une province occupée ne produit presque plus rien pour son propriétaire.`,
  impot: `Le taux va de 0 à 80%. Au-delà de 30%, chaque point coûte 1,2 point de bonheur en régime établi. `
    + `La Fiscalité rend chaque point de taxe 25% plus productif.`,
  diplomatie: `Chaque dirigeant a un caractère, une mémoire et une opinion de toi. Il évalue toute proposition `
    + `en comparant l'utilité du monde avec et sans elle, et te réclame de l'or si le solde est négatif. `
    + `Il te croit fiable à un certain pourcentage : trahir un pacte fait chuter ce crédit dans toutes les cours.`,
  fortification: `Chaque fortification coûte 80 or et ajoute 10% de défense à la province, jusqu'à 40%. `
    + `Elle se cumule avec le terrain (montagne +30, forêt +10) et la caserne (+20).`,
  colonisation: `Coloniser une terre libre voisine coûte 120 or et te donne une province à 2 000 habitants. `
    + `C'est le moyen le moins coûteux de t'agrandir — bien moins qu'une guerre.`,
};
function repRegles(an){
  const p = S.player, s = an.slots || {}, v = an.vecteur;
  if(s.batiment){ const B = BUILDINGS[s.batiment];
    const place = meilleurEmplacement(s.batiment);
    return `${B.nom} — ${B.desc}. Coût ${B.or} or et ${B.mat} matériaux, entretien ${B.up} or par mois`
      + (B.tech ? `, exige la technologie « ${TECHS[B.tech].nom} »` : ``)
      + (B.cote ? `, et une province côtière` : ``) + `. `
      + (place ? `Tu en as ${tuilesDe(p).reduce((a,t)=>a+batiments(t).filter(x=>x===s.batiment).length,0)} ; la prochaine irait sur ${nomTuile(place.tuile)}.`
               : `Aucune province libre ne peut l'accueillir pour l'instant.`); }
  if(s.unite){ const U = UNITES[s.unite];
    return `${U.nom} — ${U.desc} Attaque ${U.att}, défense ${U.def}, ${U.hommes.toLocaleString('fr-FR')} hommes par unité. `
      + `${U.or} or + ${U.mat} matériaux à lever, ${U.up} or de solde mensuelle`
      + (U.tech ? `, après la technologie « ${TECHS[U.tech].nom} »` : ``) + `. `
      + `Tu en alignes ${p.armee[s.unite] || 0}.`; }
  if(s.tech){ const T2 = TECHS[s.tech];
    return `« ${T2.nom} » — ${T2.desc}. ${T2.cout} points de recherche`
      + (T2.req.length ? `, après ${T2.req.map(r=>TECHS[r].nom).join(' et ')}` : `, sans prérequis`) + `. `
      + (p.tech.has(s.tech) ? `Tu la possèdes déjà.` : `Tu ne l'as pas encore.`); }

  // mécanique générale : on suit le concept dominant
  const par = [['bonheur','bonheur'],['argent','or'],['impot','impot'],['nourriture','nourriture'],
               ['energie','energie'],['population','population'],['science','recherche'],
               ['guerre','guerre'],['diplo','diplomatie'],['defense','fortification'],
               ['expansion','colonisation']];
  let meilleur = null, best = 0.35;
  for(const [c, k] of par){ const x = v[c] || 0; if(x > best){ best = x; meilleur = k; } }
  if(s.ressource && MECANIQUES[s.ressource]) meilleur = s.ressource;
  if(meilleur) return MECANIQUES[meilleur];
  return `De quelle mécanique veux-tu que je t'explique le détail ? Le bonheur, le trésor, les impôts, `
       + `la nourriture, l'énergie, la population, la recherche, la guerre, les fortifications, `
       + `la colonisation ou la diplomatie — ou bien un bâtiment, une unité, une technologie précise.`;
}

/* ---------- inventaire : ce que tu possèdes ---------- */
function repInventaire(an){
  const p = S.player, b = bilan(p), s = an.slots || {};
  // une ressource nommée l'emporte : « mon énergie » n'est pas une question sur les centrales
  if(s.ressource) return repRessource(an, s.ressource);
  if(s.unite) return `${UNITES[s.unite].nom} : ${p.armee[s.unite] || 0} unité(s), `
    + `soit ${((p.armee[s.unite]||0)*UNITES[s.unite].hommes).toLocaleString('fr-FR')} hommes `
    + `et ${((p.armee[s.unite]||0)*UNITES[s.unite].up).toFixed(1)} or de solde par mois.`;
  if(s.batiment){
    const l = tuilesDe(p).filter(t => aBatiment(t, s.batiment));
    const total = tuilesDe(p).reduce((a,t)=>a+batiments(t).filter(x=>x===s.batiment).length,0);
    return l.length ? `${BUILDINGS[s.batiment].nom} : ${total} sur ${l.length} province(s) — ${l.map(nomTuile).join(', ')}.`
                    : `Tu n'as aucune ${BUILDINGS[s.batiment].nom.toLowerCase()}.`;
  }
  return listeInventaire(tableauRessources());
}

function tableauRessources(){
  const p = S.player, b = bilan(p);
  return {
    or:()=>`${Math.round(p.or)} or en caisse (${fmtOr(b.net)} par mois)`,
    materiaux:()=>`${Math.round(p.mat)} matériaux (${fmtOr(b.mat)} par mois)`,
    nourriture:()=>`${Math.round(p.nourriture)} de réserve alimentaire (${fmtOr(b.netFood)} par mois)`,
    energie:()=>`${b.energie.toFixed(0)} d'énergie nette`,
    recherche:()=>`${Math.round(p.sci)} points de recherche accumulés (${fmtOr(b.sci)} par mois)`,
    bonheur:()=>`${Math.round(p.bonheur)} de bonheur sur 100`,
    population:()=>`${b.pop.toFixed(0)}k habitants sur ${b.nb} provinces`,
    provinces:()=>`${b.nb} provinces : ${tuilesDe(p).map(nomTuile).join(', ')}`,
    armee:()=>`${nbUnites(p.armee)} unités (${effectifs(p.armee).toLocaleString('fr-FR')} hommes), `
            + `puissance ${puissance(p).toFixed(0)} — `
            + (CLES_UNITES.filter(k=>p.armee[k]>0).map(k=>`${p.armee[k]} ${UNITES[k].nom.toLowerCase()}`).join(', ') || 'aucune troupe'),
  };
}

function repRessource(an, cle){
  const R = tableauRessources();
  if(R[cle]) return `Tu as ${R[cle]()}.`;
  return listeInventaire(R);
}

function listeInventaire(R){
  const p = S.player, b = bilan(p);
  const bats = {};
  for(const t of tuilesDe(p)) for(const k of batiments(t)) bats[k] = (bats[k]||0)+1;
  return `Inventaire du royaume :\n` + listePuces([
    R.or(), R.materiaux(), R.nourriture(),
    `${b.energie.toFixed(0)} d'énergie · ${Math.round(p.sci)} points de recherche`,
    R.population(),
    Object.keys(bats).length ? `Bâtiments : ${Object.entries(bats).map(([k,v])=>`${v} ${BUILDINGS[k].nom.toLowerCase()}`).join(', ')}`
                             : `Aucun bâtiment construit`,
    R.armee(),
    p.tech.size ? `Technologies : ${[...p.tech].map(k=>TECHS[k].nom).join(', ')}` : `Aucune technologie`,
  ]);
}

/* ---------- catalogue : ce qui t'est accessible maintenant ---------- */
function repListe(an){
  const p = S.player, v = an.vecteur, s = an.slots || {};
  const veutBat = (v.batir||0) > .3 || s.batiment;
  const veutUni = (v.unite||0) > .3 || s.unite;
  const veutTech = (v.science||0) > .3 || s.tech;

  const bats = () => {
    const ok = [], bloq = [];
    for(const [k,B] of Object.entries(BUILDINGS)){
      const manqueTech = B.tech && !aTech(p, B.tech);
      const ligne = `${B.nom} — ${B.or} or + ${B.mat} matériaux — ${B.desc}`;
      if(manqueTech) bloq.push(`${ligne} (exige « ${TECHS[B.tech].nom} »)`);
      else ok.push(ligne + (p.or >= B.or && p.mat >= B.mat ? '' : ' — hors budget'));
    }
    return `Bâtiments que tu peux ordonner :\n${listePuces(ok)}`
         + (bloq.length ? `\nVerrouillés : ${bloq.length} (${bloq.map(x=>x.split(' —')[0]).join(', ')})` : '');
  };
  const unis = () => {
    const ok = CLES_UNITES.filter(k=>uniteDispo(p,k))
      .map(k=>`${UNITES[k].nom} — ${UNITES[k].or} or + ${UNITES[k].mat} mat. — att ${UNITES[k].att} / déf ${UNITES[k].def}`);
    const bloq = CLES_UNITES.filter(k=>!uniteDispo(p,k)).map(k=>`${UNITES[k].nom} (« ${TECHS[UNITES[k].tech].nom} »)`);
    return `Unités que tu peux lever :\n${listePuces(ok)}` + (bloq.length ? `\nVerrouillées : ${bloq.join(', ')}` : '');
  };
  const techs = () => {
    const dispo = Object.entries(TECHS).filter(([k,t])=>!p.tech.has(k) && t.req.every(r=>p.tech.has(r)));
    const b = bilan(p);
    if(!dispo.length) return `Tu as achevé tout ce qui t'était accessible.`;
    return `Technologies accessibles maintenant :\n` + listePuces(dispo.map(([k,t])=>
      `${t.nom} — ${t.cout} points${b.sci>0.3?`, soit ~${Math.ceil(t.cout/b.sci)} mois`:''} — ${t.desc}`));
  };
  if(veutBat && !veutUni && !veutTech) return bats();
  if(veutUni && !veutBat && !veutTech) return unis();
  if(veutTech && !veutBat && !veutUni) return techs();
  return [bats(), unis(), techs()].join('\n\n');
}

/* ---------- superlatifs : la plus riche, le plus faible… ---------- */
function repClasser(an){
  const p = S.player, s = an.slots || {}, v = an.vecteur;
  const mots = sansAccents(an.mots.join(' '));
  const ditProvince = /\b(provinc|region|terre|territoir|ville|capital|chez moi|mes? )/.test(mots);
  const ditNation   = /\b(nation|pays|voisin|royaum|etat|empire|rival|adversair|puissance)/.test(mots);
  const surNations  = !!s.cible || (ditNation && !ditProvince) ||
                      (!ditProvince && ((v.diplo||0) > .3 || (v.guerre||0) > .4));
  const dim = s.dimension || (surNations ? 'puissante' : 'riche');
  const inv = !!s.inverse;

  if(surNations){
    const mesures = {
      riche:      o => o.or,
      peuplee:    o => bilan(o).pop,
      puissante:  o => puissance(o),
      exposee:    o => -puissance(o),
      fortifiee:  o => tuilesDe(o).reduce((a,t)=>a+t.fort,0),
      nourriciere:o => bilan(o).netFood,
    };
    const f = mesures[dim] || mesures.puissante;
    const l = S.nations.filter(o=>tuilesDe(o).length).map(o=>({o, x:f(o)}))
                .sort((a,b)=> inv ? a.x-b.x : b.x-a.x);
    const u = {riche:' or', peuplee:'k habitants', puissante:' de puissance',
               exposee:' de puissance', fortifiee:'% de fortifications', nourriciere:' de balance alimentaire'}[dim] || '';
    const nomDim = DIMENSIONS[dim] ? DIMENSIONS[dim].nom : dim;
    return `Nations par ordre ${inv?'croissant':'décroissant'} (${nomDim}) :\n`
      + listePuces(l.slice(0,5).map((x,i)=>`${i+1}. ${x.o.nom} : ${Math.round(Math.abs(x.x))}${u}${x.o===p?' ← toi':''}`))
      + `\nLa ${inv?'dernière':'première'} est donc ${l[0].o.nom}${l[0].o===p?" — c'est toi":''}.`;
  }

  const mesures = {
    riche:      t => effetsProvince(t, p).gold + t.pop*p.taxe*0.55,
    peuplee:    t => t.pop,
    nourriciere:t => effetsProvince(t, p).food + TERRAIN[t.terr].food + t.pop*0.05,
    exposee:    t => voisins(t).filter(x=>x.owner!==null&&x.owner!==p.id&&p.guerre.has(x.owner)).length*10
                   + voisins(t).filter(x=>x.owner!==null&&x.owner!==p.id).length*3 - t.fort*0.2 - TERRAIN[t.terr].def*0.1,
    fortifiee:  t => t.fort + TERRAIN[t.terr].def + (aBatiment(t,'caserne')?20:0),
    puissante:  t => t.pop + t.fort,
  };
  const f = mesures[dim] || mesures.riche;
  const l = tuilesDe(p).map(t=>({t, x:f(t)})).sort((a,b)=> inv ? a.x-b.x : b.x-a.x);
  if(!l.length) return `Tu ne possèdes aucune province.`;
  etatConseil().contexte.province = l[0].t;
  const nomDim = DIMENSIONS[dim] ? DIMENSIONS[dim].nom : dim;
  const det = t => `${nomTuile(t)} — ${t.pop.toFixed(1)}k hab., `
                 + (nbBatiments(t) ? batiments(t).map(k=>BUILDINGS[k].nom.toLowerCase()).join(' + ')
                                   : 'sans ouvrage')
                 + (t.fort?`, ${t.fort}% de fortifications`:'');
  return `Ta province la ${inv?'moins':'plus'} ${nomDim} est ${nomTuile(l[0].t)}.\n`
       + listePuces(l.slice(0,4).map((x,i)=>`${i+1}. ${det(x.t)}`))
       + `\nDis « parle-moi de cette province » ou « où bâtir » pour aller plus loin.`;
}

/* ---------- état diplomatique vu du Conseil ---------- */
function repDiploEtat(an){
  const p = S.player, cible = an.cible || an.slots?.cible;
  if(cible){
    const r = rel(p, cible), lien = p.guerre.has(cible.id) ? 'en guerre' : p.allies.has(cible.id) ? 'alliés'
            : p.pacte.has(cible.id) ? 'liés par un pacte de non-agression'
            : (p.commerce && p.commerce.has(cible.id)) ? 'partenaires commerciaux' : 'sans traité';
    return `${cible.nom} : vous êtes ${lien}, relation ${Math.round(r)}/100. `
      + `Puissance ${puissance(cible).toFixed(0)} contre ${puissance(p).toFixed(0)} pour toi `
      + `(${ratioForce(cible,p).toFixed(2)}×)${frontiereCommune(p,cible)?', et vous partagez une frontière':', sans frontière commune'}. `
      + `Ils sont dirigés par un ${PERSOS[cible.perso].nom.toLowerCase()}${cible.guerre.size?`, déjà en guerre contre ${[...cible.guerre].map(i=>S.nations[i]).map(o=>o.joueur?'toi':o.nom).join(', ')}`:', en paix avec tout le monde'}.`;
  }
  const nom = i => S.nations[i].nom;
  const l = [];
  l.push(p.guerre.size ? `En guerre contre : ${[...p.guerre].map(nom).join(', ')}` : `En guerre contre personne`);
  if(p.allies.size)   l.push(`Alliés : ${[...p.allies].map(nom).join(', ')}`);
  if(p.pacte.size)    l.push(`Pactes de non-agression : ${[...p.pacte].map(nom).join(', ')}`);
  if(p.commerce && p.commerce.size) l.push(`Accords commerciaux : ${[...p.commerce].map(nom).join(', ')} (+${8*p.commerce.size}% de revenus)`);
  const autres = S.nations.filter(o=>!o.joueur && tuilesDe(o).length)
                   .map(o=>({o, r:rel(p,o)})).sort((a,b)=>b.r-a.r);
  if(autres.length){
    l.push(`Meilleure relation : ${autres[0].o.nom} (${Math.round(autres[0].r)})`);
    l.push(`Pire relation : ${autres[autres.length-1].o.nom} (${Math.round(autres[autres.length-1].r)})`);
  }
  const m = menacePrincipale();
  let t = `État de tes relations :\n${listePuces(l)}`;
  if(m) t += `\nLa plus dangereuse reste ${m.nation.nom} — ${m.ratio.toFixed(2)} fois ta puissance`
           + `${frontiereCommune(p,m.nation)?', à ta frontière':''}.`;
  return t;
}

/* ---------- échéance : quand atteindrai-je… ---------- */
function repQuand(an){
  const p = S.player, s = an.slots || {};
  const seuil = s.montant;
  const res = s.ressource || ((an.vecteur.argent||0) > .3 ? 'or' : null);

  if(s.tech){
    const T2 = TECHS[s.tech], b = bilan(p);
    if(p.tech.has(s.tech)) return `« ${T2.nom} » est déjà acquise.`;
    if(b.sci < 0.1) return `Jamais, au rythme actuel : tu ne produis aucun point de recherche. Il te faut une université.`;
    const reste = T2.cout - (p.rech === s.tech ? p.sci : 0);
    const m = Math.ceil(reste / b.sci);
    return `« ${T2.nom} » demande encore ${Math.round(reste)} points. À ${b.sci.toFixed(1)} par mois, compte ${m} mois`
      + (p.rech === s.tech ? `, soit ${MOIS[(S.mois+m)%12]} ${1900+Math.floor((S.mois+m)/12)}.`
                           : ` une fois la recherche lancée.`);
  }
  if(seuil === null || seuil === undefined || !res)
    return `Quel seuil veux-tu atteindre ? Par exemple « quand aurai-je 2000 or ? », `
         + `« dans combien de temps 500 matériaux ? » ou « quand aurai-je la Médecine ? ».`;

  const pr = projeterEtat(120);
  const actuel = {or:p.or, materiaux:p.mat, nourriture:p.nourriture, bonheur:p.bonheur,
                  recherche:p.sci, population:bilan(p).pop}[res];
  const cle = {or:'or', materiaux:'mat', nourriture:'nourriture', bonheur:'bonheur',
               recherche:'recherche', population:'population'}[res];
  if(cle === undefined) return `Je ne sais pas projeter « ${res} » dans le temps.`;
  if(actuel >= seuil) return `C'est déjà fait : tu es à ${Math.round(actuel)}, au-delà de ${seuil}.`;

  const atteint = pr.traj.find(x => x[cle] >= seuil);
  if(!atteint){
    const fin = pr.traj[pr.traj.length-1][cle];
    return `Pas avant dix ans : en dix ans tu n'atteindrais que ${Math.round(fin)}`
      + (fin <= actuel ? `, et la courbe descend — il faut changer de politique avant d'espérer ${seuil}.`
                       : `, loin de ${seuil}. Il faudrait accélérer : demande-moi un conseil.`);
  }
  const m = atteint.m;
  return `Dans ${m} mois — ${MOIS[(S.mois+m)%12]} ${1900+Math.floor((S.mois+m)/12)} — si tu ne changes rien. `
       + `Tu passes de ${Math.round(actuel)} à ${Math.round(atteint[cle])}.`;
}

/* ---------- description d'une province ---------- */
function repProvince(an){
  const p = S.player, C = etatConseil();
  const t = (an.slots?.capitale && p.capitale) ? p.capitale
          : (S.sel && S.sel.owner === p.id) ? S.sel
          : C.contexte.province || p.capitale;
  if(!t) return p.capitale
    ? `Sélectionne une province sur la carte, ou dis « parle-moi de ma capitale ».`
    : `Tu n'as plus de capitale, et plus rien à me montrer.`;
  if(t.owner !== p.id) return `${nomTuile(t)} ne t'appartient pas : elle est à ${t.owner===null?'personne':S.nations[t.owner].nom}.`;
  C.contexte.province = t;

  const T0 = TERRAIN[t.terr];
  const l = [
    `Terrain : ${T0.nom.toLowerCase()} — ${T0.food} de nourriture, ${T0.mat} de matériaux, +${T0.def}% de défense naturelle`,
    `Population : ${t.pop.toFixed(1)}k habitants`,
    nbBatiments(t) ? `Ouvrages (${nbBatiments(t)}/${capaciteBat(t)}) : `
        + batiments(t).map(k=>BUILDINGS[k].nom).join(', ')
        + (specialite(t).nb > 1 ? ` — dédiée ${Math.round(specialite(t).part*100)}% `
          + `à la ${BUILDINGS[specialite(t).cle].nom.toLowerCase()}, rendement ×`
          + multSpecialite(t, specialite(t).cle).toFixed(2) : '')
      : `Aucun ouvrage (${capaciteBat(t)} possibles)`,
    `Fortifications : ${t.fort}%${aBatiment(t,'caserne')?' + 20% de caserne':''}`,
  ];
  const vois = voisins(t).filter(x=>x.owner!==null&&x.owner!==p.id).map(x=>S.nations[x.owner]);
  const etr = [...new Set(vois)];
  if(etr.length) l.push(`Voisins étrangers : ${etr.map(o=>`${o.nom}${p.guerre.has(o.id)?' (en guerre)':''}`).join(', ')}`);
  const libres = voisins(t).filter(x=>x.owner===null && x.terr!=='ocean').length;
  if(libres) l.push(`${libres} terre(s) libre(s) adjacente(s) — colonisables à 120 or`);
  if(t.occ) l.push(`OCCUPÉE à ${Math.round(t.occ.val*100)}% par ${S.nations[t.occ.par].nom} — elle ne produit presque plus`);

  let txt = `${majuscule(nomTuile(t))} :\n${listePuces(l)}`;
  if(placeLibre(t)){
    // quel bâtiment rendrait le plus ici ?
    const cand = Object.entries(BUILDINGS)
      .filter(([k,B2]) => (!B2.tech || aTech(p,B2.tech)) && (!B2.cote || t.terr === 'cote'))
      .map(([k]) => { const m = meilleurEmplacement(k); return {k, ici: m && m.tuile === t}; })
      .filter(x => x.ici)[0];
    if(cand){
      const B2 = BUILDINGS[cand.k];
      C.proposition = {type:'batir', cle:cand.k, cible:t, cout:{or:B2.or,mat:B2.mat},
                       libelle:`${B2.nom} sur ${nomTuile(t)}`};
      txt += `\nC'est actuellement le meilleur endroit du royaume pour une ${B2.nom.toLowerCase()} `
           + `(${B2.or} or + ${B2.mat} matériaux). Dis « fais-le ».`;
    }
  }
  return txt;
}

/* ---------- ordres ---------- */
function ordreBatir(an){
  const p = S.player, s = an.slots || {};
  const k = s.batiment;
  if(!k) return `Quel bâtiment ? Ferme, mine, port, usine, centrale, université ou caserne.`;
  let t = s.ici && S.sel && S.sel.owner === p.id ? S.sel : null;
  if(!t){ const m = meilleurEmplacement(k); t = m && m.tuile; }
  if(!t) return `Aucune province disponible pour cela.`;
  const r = executer({type:'batir', cle:k, cible:t});
  return r.ok ? `Fait : ${r.txt}.` : `Impossible : ${r.txt}.`;
}
function ordreRecruter(an){
  const s = an.slots || {};
  const k = s.unite;
  if(!k) return `Quelle unité ? Infanterie, artillerie, chars, aviation ou marine.`;
  const q = clamp(s.quantite || s.montant || 1, 1, 50);
  const r = executer({type:'recruter', cle:k, quantite:q});
  return r.ok ? `Fait : ${r.txt}.` : `Impossible : ${r.txt}.`;
}
function ordreImpot(an){
  const p = S.player, s = an.slots || {}, b = bilan(p);
  let taux = (s.pourcent !== null && s.pourcent !== undefined) ? s.pourcent/100 : null;
  if(taux === null){
    const m = sansAccents(an.mots.join(' '));
    if(/\b(baiss|reduis|diminu|abaiss|moins)/.test(m)) taux = p.taxe - 0.05;
    else if(/\b(mont|augment|leve|releve|plus)/.test(m)) taux = p.taxe + 0.05;
  }
  if(taux === null) return `À quel taux ? Donne-moi un pourcentage, ou dis simplement « baisse les impôts ».`;
  taux = clamp(taux, 0, 0.8);
  const dOr = b.pop*0.55*(taux - p.taxe)*(aTech(p,'fiscalite')?1.25:1);
  const cible = Math.round(55 - (taux-0.3)*120 + b.bonus + (p.nourriture>40?8:0) - p.guerre.size*7
                          - (p.nourriture<0?30:0) - (b.penurieEnergie?10:0) - (p.or<0?15:0)
                          - malusCapitale(p));
  const r = executer({type:'impot', taux});
  return `Fait : ${r.txt}. Revenus ${fmtOr(dOr)} or par mois, et le bonheur visera désormais ${cible} `
       + `(contre ${Math.round(p.bonheur)} aujourd'hui).`;
}

function ordreRecherche(an){
  const p = S.player, s = an.slots || {};
  if(!s.tech){
    const dispo = Object.entries(TECHS).filter(([k,t])=>!p.tech.has(k) && t.req.every(r=>p.tech.has(r)));
    return `Quelle technologie ? Accessibles maintenant : ${dispo.map(([k,t])=>t.nom).join(', ') || 'aucune'}.`;
  }
  const T2 = TECHS[s.tech];
  if(!p.tech.has(s.tech) && !T2.req.every(r=>p.tech.has(r))){
    // il propose lui-même le prérequis manquant
    const manque = T2.req.filter(r=>!p.tech.has(r));
    const premier = manque.find(r => TECHS[r].req.every(x=>p.tech.has(x))) || manque[0];
    etatConseil().proposition = {type:'recherche', cle:premier, libelle:`recherche « ${TECHS[premier].nom} »`};
    return `« ${T2.nom} » exige d'abord ${manque.map(r=>TECHS[r].nom).join(', ')}. `
         + `Je commence par « ${TECHS[premier].nom} » ? Dis « fais-le ».`;
  }
  const r = executer({type:'recherche', cle:s.tech});
  if(!r.ok) return `Impossible : ${r.txt}.`;
  const b = bilan(p);
  return `Fait : ${r.txt}. Environ ${Math.ceil((T2.cout - p.sci)/Math.max(0.5,b.sci))} mois `
       + `au rythme de ${b.sci.toFixed(1)} points par mois. ${T2.desc}.`;
}

function ordreFortifier(an){
  const p = S.player;
  const t = (an.slots?.ici && S.sel && S.sel.owner === p.id) ? S.sel
          : tuilesDe(p).filter(x=>x.fort<40)
              .sort((a,b2)=> (voisins(b2).filter(v=>v.owner!==null&&v.owner!==p.id).length)
                            -(voisins(a).filter(v=>v.owner!==null&&v.owner!==p.id).length))[0];
  const r = executer({type:'fortifier', cible:t});
  return r.ok ? `Fait : ${r.txt}.` : `Impossible : ${r.txt}.`;
}
function ordreColoniser(){
  const p = S.player;
  const libres = tuilesDe(p).flatMap(voisins).filter(t => t && t.owner === null && t.terr !== 'ocean');
  if(!libres.length) return `Aucune terre libre ne touche tes frontières.`;
  const best = libres.sort((a,b)=> (TERRAIN[b.terr].food+TERRAIN[b.terr].mat)-(TERRAIN[a.terr].food+TERRAIN[a.terr].mat))[0];
  const r = executer({type:'coloniser', cible:best});
  return r.ok ? `Fait : ${r.txt}.` : `Impossible : ${r.txt}.`;
}
function ordreAttaquer(an){
  const p = S.player;
  let ennemi = an.cible;
  if(!ennemi){
    const g = [...p.guerre].map(i=>S.nations[i]).filter(o=>tuilesDe(o).length);
    if(!g.length) return `Tu n'es en guerre contre personne. Déclare d'abord la guerre depuis l'onglet Diplomatie.`;
    ennemi = g[0];
  }
  const plan = planDeGuerre(ennemi);
  if(!plan.possible)
    return `Aucune province de ${ennemi.nom} n'est à portée — ni par la terre, ni par la mer.`
         + (obstacleNaval(S.player) ? ` Pour la mer, ${obstacleNaval(S.player)}.` : '');
  if(plan.proba < 0.25)
    return `Je le déconseille : ${Math.round(plan.proba*100)} chances sur 100 seulement sur ${nomTuile(plan.cible)}. `
         + `Il te faudrait ${plan.renforts} chars de plus. Dis « attaque quand même » si tu insistes.`;
  const r = executer({type:'attaquer', cible:plan.cible, part:0.6, naval:plan.naval});
  return r.ok
    ? `${plan.naval ? `Débarquement lancé sur ${nomTuile(plan.cible)} — la flotte a porté `
        + `${nbUnites(corpsDebarquement(S.player, 0.6))} unités.`
      : `Assaut lancé sur ${nomTuile(plan.cible)} avec 60% de l'armée.`} Vois le journal pour le rapport.`
    : `Impossible : ${r.txt}.`;
}

/* ---------- point d'entrée ---------- */
/* --- ce dont on vient de parler comble ce que la phrase ne dit pas --- */
// la ressource n'est PAS reprise du contexte : on la renomme toujours, et l'hériter
// faisait répondre « 2 provinces » à « combien j'ai d'usines ? »
const CRENEAUX_MEMOIRE = ['batiment','unite','tech','dimension','cible'];

// ce dont chaque intention a besoin pour être exécutable. On ne complète que cela :
// sans cette liste, « de quoi je dispose ? » héritait du bâtiment de la question d'avant.
const BESOINS = {
  G_OU:        ['batiment'],
  G_BATIR:     ['batiment'],
  G_RECRUTER:  ['unite'],
  G_COUT:      ['batiment','unite','tech'],
  G_REGLES:    ['batiment','unite','tech'],
  G_RECHERCHE: ['tech'],
  G_QUAND:     ['tech'],
  G_COMPARER:  ['cible'],
  G_DIPLO_ETAT:['cible'],
  G_CLASSER:   ['dimension'],
};

function reprendreContexte(an){
  const C = etatConseil(), ctx = C.contexte;
  if(!an.slots) return an;

  // la phrase nomme déjà son objet : rien à reprendre
  const nomme = ['batiment','unite','tech'].some(k => an.slots[k]);
  if(nomme || an.cible || an.slots.ressource) return an;

  const frais = S.mois - ctx.mois <= 24;               // le fil se perd après deux ans de jeu
  // un vrai pronom de reprise — « le » et « la » sont des articles bien trop courants
  const pronom = /\b(ca|cela|celui|celle|celles|ceux|meme|en|y|dessus|precedent)\b/.test(an.propre || '');
  const nbMots = an.mots.filter(m => /[a-z]/.test(m)).length;   // la ponctuation n'est pas un mot
  if(!frais || !(pronom || nbMots <= 6)) return an;

  // on tente la reprise, puis on rejoue l'arbitrage…
  const avantActe = an.acte, avantSlots = {...an.slots};
  for(const k of CRENEAUX_MEMOIRE) if(!an.slots[k] && ctx[k]) an.slots[k] = ctx[k];
  const G = k => an.vecteur[k] || 0;
  const r = cascadeConseil(an, an.slots, G);

  // …et on ne la garde que si elle rend la question exécutable.
  // Sinon « de quoi je dispose ? » hériterait du bâtiment de la question précédente.
  if(BESOINS[r.acte]){
    an.acte = r.acte;
    an.regle = (r.regle || '') + (r.acte !== avantActe ? ' (repris du contexte)' : '');
  } else {
    an.slots = avantSlots;                              // reprise inutile : on l'annule
  }
  if(!an.cible && an.slots.cible) an.cible = an.slots.cible;
  return an;
}

function memoriserContexte(an){
  const ctx = etatConseil().contexte;
  let touche = false;
  for(const k of CRENEAUX_MEMOIRE)
    if(an.slots && an.slots[k]){ ctx[k] = an.slots[k]; touche = true; }
  if(an.cible){ ctx.cible = an.cible; touche = true; }
  if(touche) ctx.mois = S.mois;
}

/* --- repli : au lieu d'un menu, il propose ses deux meilleures lectures --- */
const NOMS_ACTES = {
  G_RAPPORT:'l’état du royaume', G_DIAGNOSTIC:'l’explication d’un chiffre',
  G_PREVISION:'une projection dans l’avenir', G_CONSEIL:'ma recommandation du moment',
  G_OU:'où placer un bâtiment', G_COUT:'le prix de quelque chose',
  G_COMPARER:'une comparaison de forces', G_BATIR:'un ordre de construction',
  G_RECRUTER:'un recrutement', G_IMPOT:'les impôts', G_RECHERCHE:'la recherche',
  G_FORTIFIER:'des fortifications', G_COLONISER:'une colonisation', G_ATTAQUER:'un assaut',
  G_HISTOIRE:'ce qui s’est passé récemment', G_REGLES:'le fonctionnement d’une règle',
  G_INVENTAIRE:'ce que tu possèdes', G_LISTE:'la liste de ce qui t’est accessible',
  G_CLASSER:'un classement', G_DIPLO_ETAT:'l’état de tes relations',
  G_QUAND:'une échéance', G_PROVINCE:'une province en particulier',
};
function repIncompris(an){
  const l = (an.scores || []).filter(x => x.score > 0.12).slice(0, 3)
              .map(x => NOMS_ACTES[x.acte]).filter(Boolean);
  if(l.length >= 2)
    return `Je ne suis pas sûr de te suivre. Tu me demandes ${l[0]}, ou ${l[1]} ?`
         + (l[2] ? ` Peut-être ${l[2]} ?` : '');
  if(l.length === 1)
    return `Tu me parles de ${l[0]} — mais il me manque de quoi. Précise l’objet : un bâtiment, `
         + `une unité, une technologie, une province ou une nation.`;
  return `Je ne comprends pas. Je sais répondre sur : l’état du royaume, ce que tu possèdes, `
       + `ce qui t’est accessible, le prix et le fonctionnement de chaque chose, le passé du règne, `
       + `l’avenir si rien ne change, une échéance chiffrée, un classement de tes provinces, `
       + `l’état de tes relations — et j’exécute tes ordres : bâtir, recruter, fortifier, coloniser, `
       + `fixer les impôts, lancer une recherche ou un assaut.`;
}

/* --- une intention analysée → une réponse --- */
function repondreActe(an){
  switch(an.acte){
    case 'G_RAPPORT':    return repRapport();
    case 'G_DIAGNOSTIC': return repDiagnostic(an);
    case 'G_PREVISION':  return repPrevision(an);
    case 'G_CONSEIL':    return repConseil();
    case 'G_OU':         return repOu(an);
    case 'G_COUT':       return repCout(an);
    case 'G_COMPARER':   return repComparer(an);
    case 'G_HISTOIRE':   return repHistoire(an);
    case 'G_REGLES':     return repRegles(an);
    case 'G_INVENTAIRE': return repInventaire(an);
    case 'G_LISTE':      return repListe(an);
    case 'G_CLASSER':    return repClasser(an);
    case 'G_DIPLO_ETAT': return repDiploEtat(an);
    case 'G_QUAND':      return repQuand(an);
    case 'G_PROVINCE':   return repProvince(an);
    case 'G_BATIR':      return ordreBatir(an);
    case 'G_RECRUTER':   return ordreRecruter(an);
    case 'G_IMPOT':      return ordreImpot(an);
    case 'G_RECHERCHE':  return ordreRecherche(an);
    case 'G_FORTIFIER':  return ordreFortifier(an);
    case 'G_COLONISER':  return ordreColoniser();
    case 'G_ATTAQUER':   return ordreAttaquer(an);
    case 'AVIS':         return repComparer(an);
    case 'SALUT': {
      const reco = actionsPossibles().filter(a=>a.abordable)[0];
      if(reco) etatConseil().proposition = reco;
      return `À tes ordres. ${reco ? `Si je devais choisir une priorité aujourd'hui : ${reco.libelle}.` : ''}`;
    }
    default: return repIncompris(an);
  }
}

function repondreConseil(txt){
  const p = S.player, C = etatConseil();
  const an = comprendre(txt, CONSEIL, 'conseil');
  const brut = sansAccents(txt);

  // confirmation brève : « fais-le », « vas-y », « d'accord » — jamais un ordre détaillé
  const court = an.mots.length <= 4;
  const confirmation = /^\s*(fais le|fais ca|vas y|execute|d accord|daccord|ok|oui|parfait|approuve|tres bien|allons y|je valide)\s*[!.]?\s*$/
                         .test(brut.trim());
  if((confirmation || (court && /\b(fais le|vas y|ok|oui)\b/.test(brut)))
     && !an.slots?.batiment && !an.slots?.unite && !an.slots?.tech && C.proposition){
    const a = C.proposition; C.proposition = null;
    const r = executer(a);
    return r.ok ? `Fait : ${r.txt || a.libelle}.` : `Impossible : ${r.txt}.`;
  }
  if(/\b(fais le|vas y|execute)\b/.test(brut) && !C.proposition)
    return `Faire quoi ? Demande-moi d'abord un conseil ou un emplacement, et je te proposerai quelque chose à exécuter.`;
  if(/\battaque quand meme\b/.test(brut)){
    const g = [...p.guerre].map(i=>S.nations[i]).filter(o=>tuilesDe(o).length)[0];
    if(g){ const plan = planDeGuerre(g);
      if(plan.possible){ executer({type:'attaquer', cible:plan.cible, part:0.6, naval:plan.naval});
        return `Comme tu voudras. Assaut lancé sur ${nomTuile(plan.cible)}.`; } }
  }

  // question composée : « combien coûte une usine ET où la mettre ? » → deux réponses
  if(an.sousQuestions && an.sousQuestions.length >= 2){
    const vus = new Set();
    const parts = [];
    for(const sq of an.sousQuestions){
      reprendreContexte(sq);
      if(vus.has(sq.acte)) continue;
      vus.add(sq.acte);
      let r; try { r = repondreActe(sq); } catch(e){ r = null; }
      if(r) parts.push(r);
      memoriserContexte(sq);
    }
    if(parts.length >= 2) return parts.join('\n\n— — —\n\n');
  }

  reprendreContexte(an);
  const rep = repondreActe(an);
  memoriserContexte(an);
  return rep;
}

async function envoyerAuConseil(txt){
  const C = etatConseil();
  C.chat.push({de:'moi', txt, mois:S.mois});
  C.ecrit = true; majUI();
  await new Promise(r => setTimeout(r, 260 + Math.random()*380));
  let rep;
  try { rep = repondreConseil(txt); }
  catch(e){ rep = `Mes clercs se sont embrouillés dans les registres (${e.message}). Reformule ?`; }
  C.ecrit = false;
  C.chat.push({de:'eux', txt:rep, mois:S.mois});
  if(C.chat.length > 60) C.chat.splice(0, C.chat.length-60);
  majUI();
}
