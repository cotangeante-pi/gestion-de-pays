/* ===========================================================
   NÉGOCIATION STRUCTURÉE — 1/3 : LIRE UNE PROPOSITION
   Le sac de concepts dit de QUOI on parle ; il ne dit pas qui
   donne quoi à qui, à quel prix, sous quelle menace, ni pour
   quand. On découpe donc la phrase en clauses et on remplit
   une proposition : {exige, offre, sanction, delai}.
   =========================================================== */

/* --- marqueurs de découpage, et ce qu'ils annoncent --- */
const CHARNIERES = [
  {re:/\b(sinon|sans quoi|faute de quoi|autrement|sans ca|ou alors|a defaut)\b/, suite:'sanction'},
  {re:/\bou\b/,                                                                  suite:'sanction'},
  {re:/\b(en echange|contre|a condition que?|si)\b/,                             suite:'condition'},
  {re:/\b(et|puis|ensuite|apres quoi)\b/,                                        suite:'ajout'},
];

/* --- ce qu'une clause exprime --- */
const MARQ = {
  // le joueur réclame
  demande: /\b(donne|verse|paye|paie|remets|rends|cede|livre|apporte|envoie)\w*\s+(moi|nous|m|le|la)?\b|\b(je (veux|exige|reclame|demande|attends)|il me faut|je prends)\b|\btu me (cedes?|dois|donnes?|rends?|remets?|livres?|verses?)\b|\btu as\b.*\bpour\b/,
  // le joueur offre
  offre:   /\b(je te (donne|donnerai|verse|offre|paye|paie|cede|laisse)|voici|tiens|je t offre|je te propose|je te laisse)\b/,
  // le joueur menace
  sanction:/\b(j (envahis|attaque|ecrase|aneantis)|je (t )?(envahis|attaque|ecrase|detruis|rase|aneantis|brule|marche sur|declare la guerre|prends|prendrai|romps|rompt)|ce sera la guerre|mes (troupes|armees|legions)|la guerre)\b/,
};
const MOT_PROVINCE = /\b(provinc\w*|territoir\w*|region\w*|ville\w*|terre\w*|cite\w*)\b/;

/* --- découpe la phrase normalisée en clauses étiquetées --- */
function clauses(propre){
  let restant = ' ' + propre.trim() + ' ';
  const out = [{role:'principal', txt:''}];
  let garde = 0;
  while(garde++ < 6){
    let meilleure = null;
    for(const c of CHARNIERES){
      const m = restant.match(c.re);
      // on ignore une charnière en tête : elle ne sépare rien
      if(m && m.index > 2 && (!meilleure || m.index < meilleure.i))
        meilleure = {i:m.index, len:m[0].length, suite:c.suite};
    }
    if(!meilleure){ out[out.length-1].txt += restant; break; }
    out[out.length-1].txt += restant.slice(0, meilleure.i);
    out.push({role:meilleure.suite, txt:''});
    restant = restant.slice(meilleure.i + meilleure.len);
  }
  return out.map(c => ({...c, txt:c.txt.trim()})).filter(c => c.txt);
}

/* --- montant cité dans une clause --- */
function montantDe(txt){
  const m = (txt.match(/\b\d{1,9}\b/g) || []).map(Number);
  return m.length ? Math.max(...m) : null;
}
/* --- délai cité, en mois --- */
const CHIFFRES_MOTS = {un:1, une:1, deux:2, trois:3, quatre:4, cinq:5, six:6, sept:7, huit:8,
                       neuf:9, dix:10, douze:12, quinze:15, vingt:20};
function delaiDe(propre){
  const m = propre.match(/\b(\d{1,3}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze|quinze|vingt)\s*(mois|ans?|annees?|semaines?)\b/);
  if(!m) return null;
  const nb = /^\d+$/.test(m[1]) ? +m[1] : (CHIFFRES_MOTS[m[1]] || 1);
  if(/^an|^annee/.test(m[2])) return nb*12;
  if(/^semaine/.test(m[2]))   return Math.max(1, Math.round(nb/4));
  return nb;
}

/* --- le traité évoqué dans une clause, s'il y en a un --- */
const TRAITES_NEG = ['PAIX','PACTE','ALLIANCE','COMMERCE'];
function traiteDe(txt){
  const v = vectoriser(txt.split(/\s+/).filter(Boolean));
  // « donne-moi 100 or » n'est pas un accord commercial : il faut le concept du traité,
  // pas seulement celui de l'argent
  const substance = (v.union||0) + (v.paix||0) + (v.echange||0) + (v.aide||0);
  if(substance < 0.45) return null;
  let best = null, bs = 0.42;
  for(const a of TRAITES_NEG){ const s = cos(v, ACTES[a]); if(s > bs){ bs = s; best = a; } }
  return best;
}

/* --- lecture complète : qui donne quoi, contre quoi, sous quelle menace --- */
function analyserProposition(an, n){
  const propre = ' ' + (an.propre || '').trim() + ' ';
  const cls = clauses(propre);
  const prop = {exige:{or:null, province:false, traite:null},
                offre:{or:null, traite:null},
                sanction:null, delai:delaiDe(propre), clauses:cls};

  for(const c of cls){
    const t = ' ' + c.txt + ' ';
    const estSanction = c.role === 'sanction' || MARQ.sanction.test(t);
    const estOffre    = MARQ.offre.test(t);
    const estDemande  = MARQ.demande.test(t);
    const traite      = traiteDe(c.txt);
    const som         = montantDe(t);

    if(estSanction && !estOffre){
      const rupture = /\b(romps|rompt|rupture|je me retire|fini|termine)\b/.test(t) && !/\bguerre\b/.test(t);
      prop.sanction = {type: rupture ? 'RUPTURE' : 'GUERRE', txt:c.txt};
      continue;
    }
    if(estOffre){
      if(som !== null) prop.offre.or = som;
      if(traite) prop.offre.traite = traite;
      continue;
    }
    if(estDemande || c.role === 'principal' || c.role === 'condition'){
      if(estDemande && som !== null) prop.exige.or = som;
      else if(som !== null && prop.exige.or === null && prop.offre.or === null) prop.exige.or = som;
      if(MOT_PROVINCE.test(t) && (estDemande || /\brends\b|\bcede\b|\brestitue\b/.test(t)))
        prop.exige.province = true;
      if(traite){ if(estDemande || c.role === 'condition' || !prop.offre.traite) prop.exige.traite = traite; }
    }
  }
  // « 100 pièces ou je t'envahis » : la clause principale est nue, c'est quand même une exigence
  if(prop.sanction && prop.exige.or === null && prop.exige.traite === null && !prop.exige.province){
    const t0 = cls[0] ? cls[0].txt : '';
    const som = montantDe(t0);
    if(som !== null) prop.exige.or = som;
    // « trois provinces ou je marche sur toi » : l'exigence porte sur la terre
    else if(MOT_PROVINCE.test(' ' + t0 + ' ')) prop.exige.province = true;
  }
  prop.estUltimatum = !!(prop.sanction &&
                        (prop.exige.or !== null || prop.exige.province || prop.exige.traite));
  // « tu as trois mois pour me payer 200 or » : le délai vaut menace implicite
  if(!prop.estUltimatum && prop.delai && prop.exige.or !== null && MARQ.demande.test(propre)){
    prop.sanction = {type:'GUERRE', txt:'(sous-entendue)', implicite:true};
    prop.estUltimatum = true;
  }
  return prop;
}

/* ===========================================================
   NÉGOCIATION STRUCTURÉE — 2/3 : PESER UNE MENACE
   Une menace ne vaut pas par les mots : elle vaut par la
   force de celui qui la porte, par la frontière qu'il peut
   franchir, et par ce qu'il a fait des menaces précédentes.
   =========================================================== */

function credibiliteMenace(n){
  const p = S.player, c = n.croyances, m = n.memoire;
  const force   = ratioForce(p, n);                       // ta puissance rapportée à la sienne
  const voisine = frontiereCommune(n, p) ? 1 : 0.40;      // sans frontière, on n'envahit pas
  const vu      = 0.55 + c.menacePercue * 0.75;           // ce qu'il a vu de ton armement
  const tenues  = m.menacesTenues || 0, bluffs = m.bluffs || 0;
  const passe   = clamp(0.55 + tenues*0.20 - bluffs*0.25, 0.05, 1.25);
  const brut = (0.20 + clamp(force, 0, 2.5) * 0.55) * voisine * vu * passe;
  return {valeur: clamp(brut, 0.02, 0.97), force, voisine:voisine === 1, passe, tenues, bluffs};
}

/* --- ce que vaut tout ce qu'il possède, exprimé en or --- */
function valeurPatrimoine(n){
  let v = Math.max(0, n.or) * 0.5;                    // l'or en caisse, à moitié (il en dépense)
  for(const t of tuilesDe(n)){
    const T0 = TERRAIN[t.terr];
    v += (T0.food*2.2 + T0.mat*1.6) * 40              // production capitalisée
       + t.pop * 18                                    // les hommes valent plus que la terre
       + (t.bld ? BUILDINGS[t.bld].or : 0);
  }
  for(const k of CLES_UNITES) v += (n.armee[k]||0) * UNITES[k].or;
  return v;
}

/* --- que coûte céder, que coûte tenir bon ? ---
   On ne passe PAS par l'utilité : elle sature. Quand la menace
   est déjà écrasante, `securite` vaut déjà zéro et la guerre
   « ne change rien » — le modèle conclurait qu'il ne risque
   rien. On chiffre donc la sanction en or, directement. --- */
function evaluerUltimatum(n, prop){
  const p = S.player, k = perso(n), w = poidsObjectifs(n);
  const cred    = credibiliteMenace(n);
  const chances = gagneLaGuerre(n, p);                 // sa probabilité de l'emporter
  const orbite  = Math.floor(Math.max(0, n.or));

  // coût espéré de la sanction, en or
  const patrimoine = valeurPatrimoine(n);
  const perteSiDefaite = patrimoine * 0.22;            // une guerre perdue coûte des provinces, pas tout
  const usure = coutGuerre(n) * 10 + puissance(n) * 1.2;   // la guerre coûte même quand on gagne
  const brut  = ((1 - chances) * perteSiDefaite + usure) * 0.6;  // et elle n'est pas pour demain
  const espere = brut * cred.valeur;

  // l'orgueil rabat ce qu'il consent à payer — un conquérant ne paie jamais
  const fierte = clamp(1 - k.rancune*0.50 - k.agressivite*0.45, 0.04, 1);
  // et céder une fois n'achète pas la paix : il le sait, et il rabat davantage
  const precedent = 1 / (1 + 0.85 * (n.memoire.tributs || 0));
  // il ne vide pas ses coffres pour une menace : le cas désespéré est traité à part
  const plafond = Math.min(Math.floor(orbite * 0.6),
                           Math.round(espere * fierte * precedent / 10) * 10);

  const demandeOr = prop.exige.or || 0;
  return {cred, chances, plafond, espere, patrimoine, usure, fierte,
          demandeOr, orbite, solvable: demandeOr <= orbite,
          vOr: valeurOr(n, w), risque: espere,
          coutCeder: demandeOr, dUGuerre: evaluer(n, 'GUERRE', {}).dU};
}

/* ===========================================================
   NÉGOCIATION STRUCTURÉE — 3/3 : DÉCIDER
   Branché en tête de decider() : renvoie une décision, ou
   null pour laisser le moteur historique faire son travail.
   =========================================================== */

function deciderNegociation(n, an){
  const p = S.player, k = perso(n), E = {};
  const prop = analyserProposition(an, n);
  an.proposition = prop;

  /* --- 1. exigence territoriale --- */
  if(prop.exige.province && !prop.estUltimatum){
    const marche = evaluerCessionTerre(n, prop.offre.or || 0);
    if(!marche.tuile) return {issue:'refuseTerritoire', prop, chances:gagneLaGuerre(n, p)};
    if(marche.accepte){
      E.cederProvince = marche.tuile;
      if(prop.offre.or) E.donJoueur = Math.min(prop.offre.or, Math.floor(p.or));
      E.relation = 6;
      return {issue:'cedeTerre', prop, marche, prix:E.donJoueur || 0, ...E};
    }
    return {issue:'prixTerre', prop, marche, prix:marche.prix,
            chances:gagneLaGuerre(n, p), ...E};
  }

  if(!prop.estUltimatum) return null;          // rien d'un ultimatum : moteur historique

  n.negociation = null;                        // un nouvel ultimatum périme le marchandage précédent

  /* --- 2. ultimatum --- */
  const ev = evaluerUltimatum(n, prop);
  n.memoire.menaces++;
  E.humeur = -0.22 - k.rancune*0.12;

  // il note la menace : si elle n'est pas suivie d'effet, il s'en souviendra
  n.menaceEnCours = {mois:S.mois, echeance:(prop.delai || 4), montant:prop.exige.or || 0,
                     cede:false};

  // (a) il ne peut pas payer la somme : ou bien il vide ses coffres, ou bien il le dit
  if(prop.exige.or !== null && !ev.solvable){
    // les coffres vidés : seulement acculé, face à une menace qu'il juge sérieuse
    if(ev.cred.valeur > 0.62 && ev.chances < 0.35 && ev.orbite >= 10 && ev.orbite <= ev.espere){
      E.donIA = ev.orbite;
      E.relation = -12;
      n.memoire.tributs = (n.memoire.tributs || 0) + 1;
      n.menaceEnCours.cede = true;
      return {issue:'ultimatumTout', prop, ev, prix:ev.orbite, ...E};
    }
    E.relation = -8;
    return {issue:'ultimatumInsolvable', prop, ev, ...E};
  }

  // (b) la somme est en-deçà de ce que la sanction lui coûterait → il paie
  if(prop.exige.or !== null && prop.exige.or <= ev.plafond){
    E.donIA = Math.min(prop.exige.or, ev.orbite);
    E.relation = -12 - Math.round(k.rancune*12);
    n.memoire.tributs = (n.memoire.tributs || 0) + 1;
    n.menaceEnCours.cede = true;
    return {issue:'ultimatumCede', prop, ev, prix:E.donIA, ...E};
  }

  // (c) il en lâcherait une partie : contre-offre au point d'indifférence.
  //     En-dessous d'un cinquième du montant réclamé, ce n'est plus une offre
  //     mais une insulte : il préfère refuser.
  if(prop.exige.or !== null && ev.plafond < prop.exige.or
     && ev.plafond >= Math.max(20, prop.exige.or * 0.2)){
    E.relation = -6;
    n.negociation = {action:'TRIBUT', demande:ev.plafond, reserve:ev.plafond,
                     mois:S.mois, concessions:0, tribut:true};
    return {issue:'ultimatumMarchande', prop, ev, prix:ev.plafond, ...E};
  }

  // (d) exigence d'un traité sous la menace : il signe s'il y gagne malgré l'humiliation
  if(prop.exige.traite){
    const evT = evaluer(n, prop.exige.traite, {cible:an.cible});
    // la menace pèse dans la balance, convertie en gain d'utilité équivalent
    const poidsMenace = ev.espere * ev.vOr;
    if(evT.dU + poidsMenace > 0.02){
      if(prop.exige.traite === 'PAIX') E.paix = true;
      if(prop.exige.traite === 'PACTE') E.pacte = true;
      if(prop.exige.traite === 'ALLIANCE') E.alliance = true;
      if(prop.exige.traite === 'COMMERCE') E.commerce = true;
      E.relation = -10;
      n.menaceEnCours.cede = true;
      return {issue:'ultimatumSigne', prop, ev, action:prop.exige.traite, ...E};
    }
  }

  // (e) il tient bon — et parfois prend les devants
  E.relation = -16 - Math.round(k.rancune*10);
  const devance = !n.guerre.has(p.id) && ev.dUGuerre > -0.02 && ev.chances > 0.55
               && (k.agressivite > 0.62 || n.memoire.menaces >= 4);
  if(devance) E.guerre = true;
  return {issue:'ultimatumTientBon', prop, ev, declare:devance, ...E};
}

/* --- une menace non suivie d'effet se paie en crédit : appelé chaque mois --- */
function suivreMenaces(){
  const p = S.player;
  for(const n of S.nations){
    if(n.joueur || !n.menaceEnCours || !n.memoire) continue;
    const m = n.menaceEnCours;
    if(n.guerre.has(p.id)){                       // la menace a été tenue
      n.memoire.menacesTenues = (n.memoire.menacesTenues || 0) + 1;
      n.croyances.menacePercue = clamp(n.croyances.menacePercue + 0.12, 0, 1);
      n.menaceEnCours = null;
      continue;
    }
    if(S.mois - m.mois > m.echeance){             // l'échéance est passée dans le silence
      if(!m.cede){
        n.memoire.bluffs = (n.memoire.bluffs || 0) + 1;
        n.croyances.menacePercue = clamp(n.croyances.menacePercue - 0.10, 0, 1);
        n.rel[p.id] = clamp(n.rel[p.id] + 3, -100, 100);   // le mépris remplace la peur
        if(S.chatOuvert !== n.id)
          ajouterMsg(n, 'eux', `Tes menaces sont passées, ${appel(n)}, et mes frontières sont intactes. `
            + `Je les pèserai à ce prix la prochaine fois.`);
      }
      n.menaceEnCours = null;
    }
  }
}


/* ===========================================================
   CÉDER UNE TERRE — on ne vend pas une province au prix d'une
   ferme : sa valeur, c'est sa production capitalisée, plus ce
   qu'elle coûterait de sécurité, plus l'orgueil du souverain.
   =========================================================== */
function evaluerCessionTerre(n, orOffert){
  const p = S.player, k = perso(n), w = poidsObjectifs(n);
  const miennes = tuilesDe(n);
  if(miennes.length <= 1) return {tuile:null, raison:'derniere'};

  // il céderait la moins utile, de préférence une qui touche déjà tes terres
  const note = t => {
    const T0 = TERRAIN[t.terr];
    const prod = T0.food*1.1 + T0.mat*0.8 + t.pop*0.9 + (t.bld ? 6 : 0) + t.fort*0.12;
    const touche = voisins(t).some(v => v && v.owner === p.id) ? -2.5 : 0;   // plus facile à lâcher
    const capitale = (n.capitale === t) ? 999 : 0;                           // jamais la capitale
    return prod + touche + capitale;
  };
  const tri = miennes.map(t => ({t, x:note(t)})).sort((a,b)=>a.x-b.x);
  const tuile = tri[0].t;
  if(n.capitale === tuile) return {tuile:null, raison:'capitale'};

  // valeur en or : production capitalisée sur ~4 ans, majorée de l'attachement
  const T0 = TERRAIN[tuile.terr];
  const rente = T0.food*2.2 + T0.mat*1.6 + tuile.pop*1.8 + (tuile.bld ? BUILDINGS[tuile.bld].or*0.5 : 0);
  const attache = 1.6 + k.rancune*0.9 + (1 - k.cupidite)*0.8;
  const prix = Math.max(150, Math.round(rente * 48 * attache / 50) * 50);

  const accepte = orOffert >= prix && orOffert <= Math.floor(p.or);
  return {tuile, prix, accepte, rente, part: miennes.length};
}
