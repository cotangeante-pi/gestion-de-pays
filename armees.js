/* ===========================================================
   ARMÉES SUR LA CARTE
   L'armée n'est plus un simple compteur : elle se divise en
   corps d'armée posés sur des provinces. On les fait marcher
   d'une case à l'autre ; une province n'est défendue que par
   ceux qui s'y trouvent ; loin de chez soi, on s'use faute de
   ravitaillement. Une bataille se livre en trois phases —
   bombardement, mêlée, poursuite — où la composition des troupes
   et le terrain pèsent plus lourd que le hasard.

   `n.armee` reste le total national, que tout le reste du jeu
   lit (puissance, solde, diplomatie). Les corps en sont la
   répartition ; syncArmee() réconcilie les deux quand du code
   plus ancien touche directement à `n.armee`.
   =========================================================== */

/* ---------- les corps ---------- */
function corpsDe(n){ if(!n.corps) n.corps = []; return n.corps; }
const tuileCorps = c => S.tiles.get(c.t);
function nouveauCorps(n, t, u){
  n.corpsSeq = (n.corpsSeq || 0) + 1;
  const c = {id: n.corpsSeq, t: key(t.q, t.r), u: Object.assign(armeeVide(), u || {}), chemin: []};
  corpsDe(n).push(c);
  return c;
}
function corpsSur(t){
  const k = key(t.q, t.r), out = [];
  for(const n of S.nations) for(const c of corpsDe(n)) if(c.t === k) out.push({n, c});
  return out;
}
const nomCorps = (n, c) => `${c.id === 1 ? '1ʳᵉ' : c.id + 'ᵉ'} armée`;

// le corps qui reçoit les recrues : celui qui stationne à la capitale
function corpsAccueil(n){
  const cap = n.capitale && n.capitale.owner === n.id ? n.capitale : tuilesDe(n)[0];
  if(!cap) return null;
  const k = key(cap.q, cap.r);
  return corpsDe(n).find(c => c.t === k && !c.chemin.length) || nouveauCorps(n, cap);
}

// n.armee a pu changer ailleurs (recrutement, pertes, dissolution) : on répercute
function syncArmee(n){
  const cs = corpsDe(n);
  // un corps dont la province a disparu rentre à la capitale
  for(const c of cs){
    const t = tuileCorps(c);
    if(!t || t.terr === 'ocean'){ const a = corpsAccueil(n); if(a && a !== c){ ajouterUnites(a.u, c.u); c.u = armeeVide(); } }
  }
  for(const k of CLES_UNITES){
    let diff = (n.armee[k] || 0) - cs.reduce((s, c) => s + (c.u[k] || 0), 0);
    if(diff > 0){ const a = corpsAccueil(n); if(a) a.u[k] = (a.u[k] || 0) + diff; }
    else if(diff < 0){
      for(const c of cs.slice().sort((a, b) => (b.u[k]||0) - (a.u[k]||0))){
        const r = Math.min(-diff, c.u[k] || 0); c.u[k] -= r; diff += r;
        if(diff >= 0) break;
      }
    }
  }
  n.corps = corpsDe(n).filter(c => nbUnites(c.u) > 0);
}
function recompterArmee(n){
  const tot = armeeVide();
  for(const c of corpsDe(n)) ajouterUnites(tot, c.u);
  for(const k of CLES_UNITES) n.armee[k] = tot[k];
  n.corps = corpsDe(n).filter(c => nbUnites(c.u) > 0);
}
function ajouterUnites(a, b){ for(const k of CLES_UNITES) a[k] = (a[k] || 0) + (b[k] || 0); }

// des pertes qui ne s'arrondissent pas toujours à zéro sur les petits corps
function pertesDouces(u, f){
  const perdu = armeeVide();
  for(const k of CLES_UNITES){
    const x = (u[k] || 0) * f, p = Math.min(u[k] || 0, Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0));
    perdu[k] = p; u[k] = (u[k] || 0) - p;
  }
  return perdu;
}

/* ---------- déplacements ---------- */
// où une armée peut passer : chez soi, chez un allié, sur une terre libre ;
// la province ennemie n'est qu'un terme — y entrer, c'est l'assaillir
function passable(n, t){
  if(!t || t.terr === 'ocean') return false;
  return t.owner === null || t.owner === n.id || n.allies.has(t.owner);
}
function cheminVers(n, depart, arrivee){
  if(!depart || !arrivee || depart === arrivee) return [];
  const cibleEnnemie = arrivee.owner !== null && n.guerre.has(arrivee.owner);
  if(!passable(n, arrivee) && !cibleEnnemie) return null;
  const prec = new Map([[depart, null]]), file = [depart];
  for(let i = 0; i < file.length; i++){
    const t = file[i];
    if(t === arrivee) break;
    for(const v of voisins(t)){
      if(!v || prec.has(v)) continue;
      if(v !== arrivee && !passable(n, v)) continue;
      prec.set(v, t); file.push(v);
    }
  }
  if(!prec.has(arrivee)) return null;
  const out = [];
  for(let t = arrivee; t && t !== depart; t = prec.get(t)) out.unshift(key(t.q, t.r));
  return out;
}
const RAPIDES = new Set(['cavalerie', 'chars', 'avions']);
function vitesseCorps(n, c){
  const types = CLES_UNITES.filter(k => (c.u[k] || 0) > 0 && k !== 'navires');
  let v = 1;
  if(types.length && types.every(k => RAPIDES.has(k))) v++;          // une troupe montée va plus vite
  if(aTech(n, 'logistique')) v++;
  const t = tuileCorps(c);
  if(t && aBatiment(t, 'route')) v++;                                  // les routes raccourcissent la marche
  return v;
}
function ordonnerMarche(n, c, arrivee){
  const ch = cheminVers(n, tuileCorps(c), arrivee);
  if(ch === null) return false;
  c.chemin = ch;
  return true;
}

/* ---------- ravitaillement ---------- */
function ravitaille(n, t){
  if(!t) return false;
  if(t.owner === n.id || (t.owner !== null && n.allies.has(t.owner))) return true;
  return false;
}
function usure(n, c){
  const t = tuileCorps(c);
  if(ravitaille(n, t)) return 0;
  // à une case de chez soi, les convois suivent encore à peu près
  const proche = voisins(t).some(v => v && v.owner === n.id);
  let f = proche ? 0.02 : 0.06;
  if(aTech(n, 'logistique')) f /= 2;
  return f;
}

/* ---------- défense d'une province ---------- */
const fortifTuile = t => TERRAIN[t.terr].def + (aBatiment(t,'caserne') ? 20 : 0) + (aBatiment(t,'arsenal') ? 10 : 0) + t.fort;
const milice = t => 6 + t.pop * 0.45;                               // les habitants défendent aussi leurs murs
function garnisonDe(def, t){
  const u = armeeVide(), corps = [];
  for(const {n, c} of corpsSur(t)) if(n === def){ ajouterUnites(u, c.u); corps.push(c); }
  return {u, corps};
}
// les corps voisins du défenseur viennent en soutien, pour un quart de leur force
function soutien(def, t){
  let s = 0;
  for(const v of voisins(t)) if(v) for(const {n, c} of corpsSur(v)) if(n === def) s += forceDef(c.u, def) * 0.25;
  return s;
}
function defenseEstimee(t){
  const def = t.owner !== null ? S.nations[t.owner] : null;
  if(!def) return milice(t);
  return (forceDef(garnisonDe(def, t).u, def) + milice(t)) * (1 + fortifTuile(t)/100) + soutien(def, t);
}
function corpsAuContact(n, t){
  syncArmee(n);
  const proches = new Set(voisins(t).filter(Boolean).map(v => key(v.q, v.r)));
  return corpsDe(n).filter(c => proches.has(c.t))
    .sort((a, b) => forceAtt(b.u, n) - forceAtt(a.u, n))[0] || null;
}
function corpsEmbarquable(n){
  syncArmee(n);
  return corpsDe(n).filter(c => { const t = tuileCorps(c); return t && voisins(t).some(v => v && v.terr === 'ocean'); })
    .sort((a, b) => forceAtt(b.u, n) - forceAtt(a.u, n))[0] || null;
}

/* ===========================================================
   LA BATAILLE — trois phases
   =========================================================== */
const tactique = n => aTech(n, 'tactique') ? 1.15 : 1;
function frappeLongue(u, cote){
  return (u.artillerie || 0) * UNITES.artillerie.att
       + (u.avions || 0) * UNITES.avions.att * 0.5
       + (cote ? (u.navires || 0) * UNITES.navires.att : 0);
}
function elan(u){ return (u.cavalerie || 0) * 1.0 + (u.chars || 0) * 1.3 + (u.avions || 0) * 0.9; }

function resoudreBataille(A, D, ctx){
  const {att, def, tuile, debarquement} = ctx;
  const cote = tuile.terr === 'cote';
  const phases = [];
  const avantA = {...A}, avantD = {...D};
  const pertesA = armeeVide(), pertesD = armeeVide();

  // 1. Bombardement : artillerie, aviation, et la flotte si la province touche la mer
  const bA = frappeLongue(A, cote) * multMilitaire(att);
  const bD = frappeLongue(D, false) * multMilitaire(def) * 0.6;
  const fortif = ctx.fortif;
  const breche = bA > 0 ? Math.min(0.75, bA / (bA + 30 + fortif * 1.5)) : 0;
  const fortEff = fortif * (1 - breche);
  const p1D = Math.min(0.15, bA / (forceDef(D, def) + ctx.milice + 40) * 0.12);
  const p1A = Math.min(0.12, bD / (forceAtt(A, att) + 40) * 0.12);
  ajouterUnites(pertesD, pertesDouces(D, p1D)); ajouterUnites(pertesA, pertesDouces(A, p1A));
  phases.push({nom:'Bombardement', a:bA, d:bD, breche,
    texte: bA > 0 ? `brèche de ${Math.round(breche*100)} % dans les défenses` : 'pas de pièces pour bombarder'});

  // 2. Mêlée : le gros des troupes, derrière ce qui reste des murs
  const mA = forceAtt(A, att) * tactique(att) * (debarquement ? 0.7 : 1);
  const mD = (forceDef(D, def) * tactique(def) + ctx.milice) * (1 + fortEff/100) + ctx.soutien;
  let r = mA / Math.max(1, mA + mD);
  r = Math.min(0.97, Math.max(0.03, r * (0.93 + Math.random()*0.14)));   // un peu de fortune, pas davantage
  const gagne = r > 0.5, q = gagne ? r : 1 - r;
  const perteVainqueur = Math.min(0.2, Math.max(0.03, 0.30 - q*0.26));
  const perteVaincu    = Math.min(0.4, Math.max(0.10, 0.08 + q*0.26));
  ajouterUnites(pertesA, pertesDouces(A, gagne ? perteVainqueur : perteVaincu));
  ajouterUnites(pertesD, pertesDouces(D, gagne ? perteVaincu : perteVainqueur));
  phases.push({nom:'Mêlée', a:mA, d:mD, ratio:r,
    texte: gagne ? 'la ligne ennemie plie' : 'l\'assaut se brise sur la défense'});

  // 3. Poursuite : cavalerie, chars et aviation du vainqueur achèvent la déroute
  const vainqueur = gagne ? A : D, vaincu = gagne ? D : A;
  const force = elan(vainqueur);
  const p3 = force > 0 ? Math.min(0.2, force * 5 / (nbUnites(vaincu) * 6 + 20)) : 0;
  ajouterUnites(gagne ? pertesD : pertesA, pertesDouces(vaincu, p3));
  phases.push({nom:'Poursuite', a: gagne ? force : 0, d: gagne ? 0 : force,
    texte: force > 0 ? `${gagne ? 'l\'ennemi' : 'l\'assaillant'} est talonné dans sa retraite` : 'personne pour poursuivre'});

  return {gagne, ratio:r, breche, phases, pertesA, pertesD, avantA, avantD, fortEff};
}

/* ---------- l'assaut d'une province ----------
   Signature historique conservée : le Conseil, la marine et l'IA
   appellent toujours bataille(att, def, tuile, part, débarquement).
   On engage désormais le corps au contact (ou embarqué), pas une
   fraction abstraite de l'armée nationale. */
function bataille(att, def, tuile, frac = 1, debarquement = false, corpsImpose = null){
  if(!def) return;
  syncArmee(att); syncArmee(def);
  const c = corpsImpose || (debarquement ? corpsEmbarquable(att) : corpsAuContact(att, tuile));
  if(!c){
    if(att.joueur) logue(debarquement
      ? 'Aucun corps d\'armée sur une côte d\'où embarquer : fais-en marcher un jusqu\'à la mer.'
      : 'Aucun corps d\'armée au contact de cette province : fais-en marcher un jusqu\'à la frontière (onglet Armée).', 'bad');
    return;
  }
  const engage = armeeVide();
  for(const k of CLES_UNITES){ engage[k] = Math.floor((c.u[k] || 0) * frac); c.u[k] -= engage[k]; }
  if(debarquement){
    // la flotte ne porte que ce qu'elle peut ; les navires eux-mêmes appuient du large
    let place = capaciteNavale(att);
    for(const k of CLES_UNITES){
      if(k === 'navires') continue;
      const p = Math.min(engage[k], place); c.u[k] += engage[k] - p; engage[k] = p; place -= p;
    }
  }
  const nb = nbUnites(engage);
  if(nb < 1){
    ajouterUnites(c.u, engage);
    if(att.joueur) logue(debarquement ? 'Aucune troupe embarquable : il faut des navires pour porter les hommes.'
                                      : 'Aucune unité disponible pour cet assaut.', 'bad');
    return;
  }

  const g = garnisonDe(def, tuile);
  const D = {...g.u};
  const ctx = {att, def, tuile, debarquement, fortif: fortifTuile(tuile), milice: milice(tuile), soutien: soutien(def, tuile)};
  const res = resoudreBataille(engage, D, ctx);

  // les pertes du défenseur se répartissent entre les corps de la garnison
  for(const k of CLES_UNITES){
    let reste = res.pertesD[k] || 0;
    for(const gc of g.corps){ const r = Math.min(reste, gc.u[k] || 0); gc.u[k] -= r; reste -= r; }
  }

  // --- avancée du front : on ne prend pas une province d'un seul coup ---
  const occAvant = (tuile.occ && tuile.occ.par === att.id) ? tuile.occ.val : 0;
  if(!tuile.occ || tuile.occ.par !== att.id) tuile.occ = {par:att.id, val:0, mois:S.mois};
  const gain = res.gagne ? Math.min(0.42, Math.max(0.08, 0.14 + (res.ratio-0.5)*0.8))
                         : -Math.min(0.22, Math.max(0.02, 0.05 + (0.5-res.ratio)*0.35));
  tuile.occ.val = Math.min(1, Math.max(0, tuile.occ.val + gain));
  tuile.occ.mois = S.mois;

  let txt, conquise = false;
  if(tuile.occ.val >= 1){
    const etaitAuJoueur = def.joueur, etaitCapitale = (def.capitale === tuile), reprise = (att.ancienneCapitale === tuile);
    tuile.owner = att.id; tuile.pop *= 0.85; tuile.fort = 0; tuile.occ = null;
    // la garnison vaincue se replie chez elle, ou se rend
    for(const gc of g.corps){
      const repli = voisins(tuile).find(v => v && v.owner === def.id);
      if(repli && nbUnites(gc.u)){ gc.t = key(repli.q, repli.r); gc.chemin = []; }
      else gc.u = armeeVide();
    }
    // les vainqueurs entrent dans la place
    const occupant = nouveauCorps(att, tuile, engage);
    for(const k of CLES_UNITES) engage[k] = 0;
    if(c.chemin && c.chemin[0] === key(tuile.q, tuile.r)){ occupant.chemin = c.chemin.slice(1); c.chemin = []; }
    if(etaitCapitale) deplacerCapitale(def, tuile);
    if(reprise) reprendreCapitale(att, tuile);
    if(typeof oublierMer === 'function') oublierMer();
    if(etaitAuJoueur && !att.joueur && typeof primeActive === 'function' && primeActive()){
      att.or += S.prime.montant;
      logue(`${ic('or')} <b>${att.nom}</b> touche ${S.prime.montant} or de prime pour cette province.`, 'bad');
    }
    txt = 'Province conquise'; conquise = true;
    if(att.joueur && typeof SDK !== 'undefined') SDK.moment();
  } else {
    const pc = Math.round(tuile.occ.val*100);
    txt = res.gagne ? `Front avancé · ${pc}%` : `Assaut contenu · ${pc}%`;
    if(tuile.occ.val <= 0) tuile.occ = null;
  }
  ajouterUnites(c.u, engage);                 // les survivants rejoignent leur corps
  // un assaut brisé coûte l'élan : la marche s'arrête
  if(!res.gagne && nbUnites(res.pertesA) > nb*0.3 && c.chemin) c.chemin = [];
  recompterArmee(att); recompterArmee(def);

  if(typeof fxBataille === 'function') fxBataille(tuile, att.col, def.col, res.gagne, txt);
  if(typeof montrerCombat === 'function') montrerCombat({
    tuile, att, def, gagne:res.gagne, conquise, debarquement,
    occAvant, occApres: tuile.occ ? tuile.occ.val : (conquise ? 1 : 0),
    fortif: ctx.fortif, nbA: nb, nbD: nbUnites(res.avantD) + Math.round(ctx.milice/6),
    partA: nbUnites(res.pertesA) / Math.max(1, nb),
    partD: nbUnites(res.pertesD) / Math.max(1, nbUnites(res.avantD)),
    armeeA: res.avantA, armeeD: res.avantD, pertesA: res.pertesA, pertesD: res.pertesD,
    phases: res.phases, breche: res.breche, milice: ctx.milice,
    verdict: conquise ? 'Province conquise' : res.gagne ? 'Front avancé' : 'Assaut repoussé',
    detail: `pertes ${texteArmee(res.pertesA)} contre ${texteArmee(res.pertesD)}`,
  });

  if(att.joueur || def.joueur){
    const detail = `${debarquement ? 'débarquement · ' : ''}pertes ${texteArmee(res.pertesA)} contre ${texteArmee(res.pertesD)}`;
    if(conquise){
      logue(`${ic('paix')} <b>${att.nom}</b> achève l'occupation d'une province de <b>${def.nom}</b> · ${detail}`,
            att.joueur ? 'good' : 'bad');
      if(tuilesDe(def).length === 0) logue(`${ic('guerre')} <b>${def.nom}</b> n'existe plus.`, 'bad');
    } else {
      logue(`${ic('attaque')} ${txt} — <b>${att.nom}</b> contre <b>${def.nom}</b> · ${detail}`,
            (res.gagne === att.joueur) ? 'good' : 'bad');
    }
  }
  majUI();
}

/* ===========================================================
   LE MOIS DES ARMÉES : marches, assauts en cours, usure
   =========================================================== */
function armeesMois(n){
  syncArmee(n);
  for(const c of corpsDe(n).slice()){
    if(!nbUnites(c.u)) continue;
    // une armée restée sur une terre qui n'est plus ni à elle ni en guerre rentre au pays
    const ici = tuileCorps(c);
    if(ici && ici.owner !== null && ici.owner !== n.id && !n.allies.has(ici.owner) && !n.guerre.has(ici.owner)){
      const a = corpsAccueil(n); if(a && a !== c){ ajouterUnites(a.u, c.u); c.u = armeeVide(); } continue;
    }
    let pas = vitesseCorps(n, c);
    while(pas-- > 0 && c.chemin && c.chemin.length){
      const suiv = S.tiles.get(c.chemin[0]);
      if(!suiv){ c.chemin = []; break; }
      if(suiv.owner !== null && suiv.owner !== n.id && !n.allies.has(suiv.owner)){
        if(n.guerre.has(suiv.owner)){ bataille(n, S.nations[suiv.owner], suiv, 1, false, c); }
        else {
          if(n.joueur) logue(`${ic('guerre')} La ${nomCorps(n, c)} s'arrête : ${S.nations[suiv.owner].nom} ne nous ouvre pas ses terres.`, 'bad');
          c.chemin = [];
        }
        break;                                // un assaut prend le mois entier
      }
      c.t = c.chemin.shift();
    }
    const f = usure(n, c);
    if(f > 0){
      const perdu = pertesDouces(c.u, f);
      if(n.joueur && nbUnites(perdu)) logue(`${ic('food')} La ${nomCorps(n, c)} s'use loin de ses bases : ${texteArmee(perdu)} perdus.`, 'bad');
    }
  }
  // deux corps immobiles sur la même province n'en font plus qu'un
  const parCase = new Map();
  for(const c of corpsDe(n)){
    if(c.chemin && c.chemin.length) continue;
    const autre = parCase.get(c.t);
    if(autre){ ajouterUnites(autre.u, c.u); c.u = armeeVide(); } else parCase.set(c.t, c);
  }
  recompterArmee(n);
}

/* ===========================================================
   L'IA MÈNE SES ARMÉES
   Une armée principale marche au front et frappe là où c'est
   faible ; les recrues de la capitale la rejoignent ; en paix,
   elle se poste face au voisin le plus inquiétant.
   =========================================================== */
function iaArmees(n){
  syncArmee(n);
  const cs = corpsDe(n);
  if(!cs.length) return;
  const principale = cs.slice().sort((a, b) => nbUnites(b.u) - nbUnites(a.u))[0];
  const cap = n.capitale && n.capitale.owner === n.id ? n.capitale : null;

  if(n.guerre.size){
    const front = [];
    for(const t of tuilesDe(n)) for(const v of voisins(t))
      if(v && v.owner !== null && v.owner !== n.id && n.guerre.has(v.owner) && !front.includes(v)) front.push(v);
    if(front.length){
      // on pousse le front déjà entamé, sinon la province la moins bien défendue
      const cout = t => (t.occ && t.occ.par === n.id ? -1000*t.occ.val : 0) + defenseEstimee(t);
      const cible = front.sort((a, b) => cout(a) - cout(b))[0];
      const auContact = voisins(cible).some(v => v && key(v.q, v.r) === principale.t);
      if(auContact){
        if(forceAtt(principale.u, n) * tactique(n) > defenseEstimee(cible) * 0.75 || (cible.occ && cible.occ.par === n.id))
          bataille(n, S.nations[cible.owner], cible, 1, false, principale);
      } else if(!principale.chemin.length){
        // la base de départ la plus proche — chaque chemin n'est calculé qu'une fois
        let base = null, meilleur = Infinity;
        for(const v of voisins(cible)){
          if(!v || v.owner !== n.id) continue;
          const ch = cheminVers(n, tuileCorps(principale), v);
          const d = ch === null ? Infinity : ch.length;
          if(d < meilleur){ meilleur = d; base = v; }
        }
        if(base) ordonnerMarche(n, principale, base);
      }
    }
    // les autres corps, sauf une garde à la capitale, rejoignent l'armée principale
    for(const c of cs){
      if(c === principale || c.chemin.length) continue;
      const aLaCapitale = cap && c.t === key(cap.q, cap.r);
      if(aLaCapitale && nbUnites(c.u) <= 2) continue;
      if(aLaCapitale){
        const garde = armeeVide(); garde.infanterie = Math.min(1, c.u.infanterie || 0);
        garde.milice = Math.min(1, c.u.milice || 0);
        for(const k of CLES_UNITES) c.u[k] -= garde[k];
        nouveauCorps(n, cap, garde);
      }
      ordonnerMarche(n, c, tuileCorps(principale));
    }
  } else if(!principale.chemin.length){
    // en paix : face au voisin le plus menaçant
    const m = menacePrincipale(n);
    if(m && frontiereCommune(n, m.nation)){
      const poste = tuilesDe(n).filter(t => voisins(t).some(v => v && v.owner === m.nation.id))
        .sort((a, b) => defenseEstimee(a) - defenseEstimee(b))[0];
      if(poste && key(poste.q, poste.r) !== principale.t && nbUnites(principale.u) > 3) ordonnerMarche(n, principale, poste);
    }
  }
  recompterArmee(n);
}

/* ===========================================================
   ORDRES DU JOUEUR — sélection d'un corps, destination d'un clic
   =========================================================== */
function choisirDestination(idCorps){
  S.ordreCorps = idCorps;
  logue(`${ic('guerre')} Clique sur la province où la ${nomCorps(S.player, {id:idCorps})} doit marcher.`);
  majUI();
}
// appelé par clicCarte : renvoie vrai si le clic était un ordre de marche
function clicOrdreMarche(t){
  if(S.ordreCorps == null) return false;
  const p = S.player, c = corpsDe(p).find(x => x.id === S.ordreCorps);
  S.ordreCorps = null;
  if(!c) return false;
  if(!ordonnerMarche(p, c, t)){
    const pourquoi = t.terr === 'ocean' ? 'on ne marche pas sur la mer'
      : (t.owner !== null && !passable(p, t) && !p.guerre.has(t.owner))
        ? `${S.nations[t.owner].nom} ne t'a pas ouvert ses terres (il faut une alliance, ou la guerre)`
        : 'aucun chemin par la terre — pour franchir la mer, débarque depuis une côte';
    logue(`${ic('guerre')} Impossible : ${pourquoi}.`, 'bad');
  } else {
    const assaut = t.owner !== null && p.guerre.has(t.owner);
    logue(`${ic('guerre')} La ${nomCorps(p, c)} se met en marche : ${c.chemin.length} étape${c.chemin.length>1?'s':''}`
      + `${assaut ? ', puis l\'assaut' : ''}.`, 'good');
  }
  majUI();
  return true;
}

/* ---------- panneau « Corps d'armée » dans l'onglet Armée ---------- */
function htmlCorps(){
  const p = S.player;
  syncArmee(p);
  let h = `<h3>Corps d'armée</h3>
    <p class="muted">Tes troupes stationnent sur la carte. Une province n'est défendue que par ceux qui s'y trouvent.
    Choisis une destination puis clique sur la carte : une province ennemie, en guerre, sera assaillie à l'arrivée.
    Loin de tes terres, faute de ravitaillement, une armée s'use. Les recrues rejoignent la capitale.</p>`;
  if(S.ordreCorps != null)
    h += `<p class="muted" style="color:#ffc861">➜ Clique sur une province de la carte pour donner la destination.
      <button class="btn mini" data-annulerordre="1" style="width:auto">annuler</button></p>`;
  for(const c of corpsDe(p)){
    const t = tuileCorps(c), dest = c.chemin.length ? S.tiles.get(c.chemin[c.chemin.length-1]) : null;
    const etat = dest ? (dest.owner !== null && p.guerre.has(dest.owner)
        ? `en marche pour assaillir ${nomTuile(dest)} (${c.chemin.length} étape${c.chemin.length>1?'s':''})`
        : `en marche vers ${nomTuile(dest)} (${c.chemin.length} étape${c.chemin.length>1?'s':''})`)
      : 'au repos';
    const f = usure(p, c);
    h += `<div class="card unit${S.ordreCorps === c.id ? ' actif' : ''}">
      <div class="uhead"><span class="uname">${ic('guerre')} ${nomCorps(p, c)}</span>
        <span class="ucount">${nbUnites(c.u)}</span></div>
      <div class="muted">${t ? nomTuile(t) : '—'} · ${etat}${f ? ` · <span style="color:#ff8a7a">usure ${Math.round(f*100)} %/mois</span>` : ''}</div>
      <div class="muted">${texteArmee(c.u)} · attaque ${forceAtt(c.u, p).toFixed(0)} · défense ${forceDef(c.u, p).toFixed(0)}</div>
      <div class="ubuy">
        <button class="btn mini" data-marche="${c.id}">Destination</button>
        <button class="btn mini" data-voircorps="${c.id}">Voir</button>
        <button class="btn mini" data-diviser="${c.id}" ${nbUnites(c.u) < 2 ? 'disabled' : ''}>Diviser</button>
        <button class="btn mini" data-halte="${c.id}" ${c.chemin.length ? '' : 'disabled'}>Halte</button>
      </div></div>`;
  }
  if(!corpsDe(p).length) h += `<p class="muted">Aucune troupe : recrute ci-dessous.</p>`;
  return h;
}
function brancherCorps(el){
  const p = S.player, C = id => corpsDe(p).find(c => c.id === +id);
  el.querySelectorAll('[data-marche]').forEach(b => b.onclick = () => choisirDestination(+b.dataset.marche));
  el.querySelectorAll('[data-voircorps]').forEach(b => b.onclick = () => { const c = C(b.dataset.voircorps); if(c) centrer(tuileCorps(c), true); });
  el.querySelectorAll('[data-halte]').forEach(b => b.onclick = () => { const c = C(b.dataset.halte); if(c){ c.chemin = []; majUI(); } });
  el.querySelectorAll('[data-diviser]').forEach(b => b.onclick = () => {
    const c = C(b.dataset.diviser); if(!c) return;
    const moitie = armeeVide();
    for(const k of CLES_UNITES){ moitie[k] = Math.floor((c.u[k] || 0) / 2); c.u[k] -= moitie[k]; }
    if(!nbUnites(moitie)){                     // un seul type, une seule unité de chaque : on en détache une
      const k = CLES_UNITES.find(x => (c.u[x] || 0) > 0 && nbUnites(c.u) > 1);
      if(k){ c.u[k]--; moitie[k] = 1; }
    }
    if(nbUnites(moitie)){ const n2 = nouveauCorps(p, tuileCorps(c), moitie); n2.chemin = []; }
    majUI();
  });
  const a = el.querySelector('[data-annulerordre]');
  if(a) a.onclick = () => { S.ordreCorps = null; majUI(); };
}

/* ---------- sur la carte : bannières des corps, et leur route ---------- */
function dessinerCorps(z){
  if(typeof cx === 'undefined') return;
  for(const n of S.nations){
    for(const c of corpsDe(n)){
      const t = tuileCorps(c);
      if(!t || !t.geo) continue;
      const p = ecran(t);
      // la route prévue, en pointillé
      if(n.joueur && c.chemin.length){
        cx.save(); cx.setLineDash([4*z, 4*z]); cx.strokeStyle = 'rgba(255,220,140,.85)'; cx.lineWidth = 2*z;
        cx.beginPath(); cx.moveTo(p.x, p.y);
        for(const k of c.chemin){ const q = S.tiles.get(k); if(!q || !q.geo) break; const e = ecran(q); cx.lineTo(e.x, e.y); }
        cx.stroke(); cx.restore();
      }
      if(z < 0.35) continue;
      const nb = nbUnites(c.u), dx = (n.capitale === t ? -14 : 0) * z;
      const x = p.x + dx, y = p.y - 4*z;
      // le porte-étendard du corps, et son effectif
      cx.fillStyle = 'rgba(8,13,23,.35)';
      cx.beginPath(); cx.ellipse(x, y + 5*z, 9*z, 3*z, 0, 0, 7); cx.fill();
      const k = Math.min(3, Math.ceil(nb / 4));
      for(let i = 0; i < k; i++) soldat(x - 6*z + i*6*z, y + 3*z - (i%2)*2*z, z*1.05, n.col, i*1.7 + c.id);
      cx.strokeStyle = '#e8e8ee'; cx.lineWidth = Math.max(1, 1.2*z);
      cx.beginPath(); cx.moveTo(x + 9*z, y + 4*z); cx.lineTo(x + 9*z, y - 20*z); cx.stroke();
      cx.fillStyle = n.col;
      cx.beginPath(); cx.moveTo(x + 9*z, y - 20*z); cx.lineTo(x + 20*z, y - 16*z); cx.lineTo(x + 9*z, y - 12*z); cx.fill();
      cx.font = `700 ${Math.max(8, 9*z)}px "Segoe UI",system-ui,sans-serif`; cx.textAlign = 'center';
      cx.fillStyle = 'rgba(8,13,23,.8)'; cx.fillRect(x + 4*z, y - 31*z, 16*z, 10*z);
      cx.fillStyle = '#fff'; cx.fillText(String(nb), x + 12*z, y - 23*z);
      if(n.joueur && S.ordreCorps === c.id){
        cx.strokeStyle = 'rgba(255,200,97,.9)'; cx.lineWidth = 2*z;
        cx.beginPath(); cx.ellipse(x, y + 4*z, 15*z, 6*z, 0, 0, 7); cx.stroke();
      }
    }
  }
}

/* ---------- sauvegarde ---------- */
const corpsVersSauvegarde = n => corpsDe(n).map(c => ({id:c.id, t:c.t, u:{...c.u}, chemin:c.chemin.slice()}));
function corpsDepuisSauvegarde(n, l){
  n.corps = (l || []).map(c => ({id:c.id, t:c.t, u:Object.assign(armeeVide(), c.u), chemin:(c.chemin || []).slice()}));
  n.corpsSeq = n.corps.reduce((m, c) => Math.max(m, c.id), 0);
}
