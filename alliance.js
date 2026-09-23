/* ===========================================================
   ALLIANCES CONTRACTUELLES
   Une alliance ne se donne pas : elle se plaide. Si elle te
   sert plus qu'elle ne le sert, il te la fera payer — et il te
   dira de combien. Elle court ensuite pour une durée convenue ;
   la rompre avant terme met ta tête à prix.
   =========================================================== */

const DUREE_ALLIANCE = 60;          // mois : cinq ans d'engagement
const PRIME_TRAHISON = 5000;        // or versé à qui te prend une province
const PRIME_MINIMUM  = 24;          // mois de prime, même si le contrat finissait plus tôt

/* --- où en est le contrat avec cette nation ? --- */
function contratAlliance(n){
  if(!n || !n.allianceJusqu) return null;
  const reste = n.allianceJusqu - S.mois;
  return {fin:n.allianceJusqu, reste, expire: reste <= 0};
}

function ouvrirAlliance(n, mois){
  n.allianceJusqu = S.mois + (mois || DUREE_ALLIANCE);
  n.allianceDebut = S.mois;
}

/* --- la prime mise sur ta tête quand tu trahis --- */
function poserPrime(reste){
  const duree = Math.max(PRIME_MINIMUM, Math.round(reste || 0));
  S.prime = {fin: S.mois + duree, montant: PRIME_TRAHISON};
  logue(`${ic('guerre')} Pacte rompu : <b>${PRIME_TRAHISON} or</b> sont promis à quiconque `
      + `t'arrachera une province, et ce pendant ${duree} mois.`, 'bad');
}
const primeActive = ()=> !!(S.prime && S.mois < S.prime.fin);
const primeReste  = ()=> primeActive() ? S.prime.fin - S.mois : 0;

/* --- rupture : par déclaration de guerre, ou de vive voix --- */
function romprAlliance(n, parLeJoueur){
  const p = S.player, c = contratAlliance(n);
  p.allies.delete(n.id); n.allies.delete(p.id);
  n.allianceJusqu = null;
  if(parLeJoueur && c && !c.expire){
    n.rel[p.id] = clamp(n.rel[p.id] - 45, -100, 100);
    if(n.croyances) n.croyances.fiabilite = clamp(n.croyances.fiabilite * 0.3, 0, 1);
    if(n.memoire) n.memoire.trahisons++;
    // toutes les cours l'apprennent
    for(const o of S.nations){
      if(o.joueur || o === n || !o.croyances) continue;
      o.croyances.fiabilite = clamp(o.croyances.fiabilite * 0.7, 0, 1);
      o.rel[p.id] = clamp(o.rel[p.id] - 15, -100, 100);
    }
    poserPrime(c.reste);
  }
}

/* --- chaque mois : les contrats arrivent à terme --- */
function suivreAlliances(){
  const p = S.player;
  if(!p) return;
  for(const n of S.nations){
    if(n.joueur || !n.allianceJusqu) continue;
    const c = contratAlliance(n);
    if(!c.expire){
      if(c.reste === 6)
        ajouterMsg(n, 'eux', `Notre alliance court encore six mois, ${appel(n)}. `
          + `Veux-tu la reconduire, ou nous quitterons-nous en gens corrects ?`);
      continue;
    }
    // terme atteint : on se sépare sans rancune
    p.allies.delete(n.id); n.allies.delete(p.id);
    n.allianceJusqu = null;
    n.rel[p.id] = clamp(n.rel[p.id] - 5, -100, 100);
    ajouterMsg(n, 'eux', `Notre alliance arrive à son terme, ${appel(n)}. `
      + `Elle aura tenu ${DUREE_ALLIANCE} mois sans accroc — c'est déjà beaucoup. `
      + `Propose-la de nouveau si tu le souhaites.`);
    logue(`${ic('alliance')} L'alliance avec <b>${n.nom}</b> arrive à échéance.`);
  }
  if(S.prime && S.mois >= S.prime.fin){
    logue(`${ic('paix')} La prime sur tes provinces a expiré. Les cours passent à autre chose.`, 'good');
    S.prime = null;
  }
}

/* ===========================================================
   PLAIDER SON ALLIANCE
   L'IA vérifie chaque argument contre l'état réel du monde.
   Un argument juste fait baisser son prix ; un argument faux
   l'agace.
   =========================================================== */

const ARGUMENTS = [
  {cle:'ennemiCommun', motif:/\b(ennemi commun|meme ennemi|nous avons? un ennemi|contre (lui|eux)|ensemble contre)\b/,
   verifier(n){
     const p = S.player;
     const communs = [...p.guerre].filter(i => n.guerre.has(i));
     return communs.length
       ? {vrai:true, poids:0.45, texte:`nous combattons déjà ${S.nations[communs[0]].nom}`}
       : {vrai:false, texte:`nous n'avons aucun ennemi en commun`};
   }},
  {cle:'menace', motif:/\b(tu es menace|on te menace|tu as besoin|te proteger|je te protege|protection)\b/,
   verifier(n){
     const m = mesurer(n);
     const pire = (m.detail||[]).filter(x => x.nation !== S.player).sort((a,b)=>b.part-a.part)[0];
     return pire && pire.part > 0.25
       ? {vrai:true, poids:0.40, texte:`${pire.nation.nom} me pèse, c'est vrai`}
       : {vrai:false, texte:`personne ne me menace assez pour que je paie ta protection`};
   }},
  {cle:'force', motif:/\b(je suis (fort|puissant)|ma puissance|mon armee|mes troupes|je vaux)\b/,
   verifier(n){
     const f = ratioForce(S.player, n);
     return f > 1.1
       ? {vrai:true, poids:0.35, texte:`tes troupes valent ${f.toFixed(2)} fois les miennes`}
       : {vrai:false, texte:`ta puissance vaut ${f.toFixed(2)} fois la mienne — ce n'est pas un argument`};
   }},
  {cle:'passe', motif:/\b(je t ai (donne|aide)|mes (dons|presents)|souviens toi|notre passe|tout ce que j ai fait)\b/,
   verifier(n){
     const m = n.memoire;
     return m && m.dons > 0
       ? {vrai:true, poids:0.30, texte:`tu m'as donné ${Math.round(m.orRecu)} or, je ne l'oublie pas`}
       : {vrai:false, texte:`tu ne m'as jamais rien donné`};
   }},
  {cle:'commerce', motif:/\b(commerce|nos marchands|nos echanges|route commerciale)\b/,
   verifier(n){
     const p = S.player;
     return (n.commerce && n.commerce.has(p.id))
       ? {vrai:true, poids:0.25, texte:`nos marchés sont déjà ouverts`}
       : {vrai:false, texte:`nous ne commerçons même pas`};
   }},
  {cle:'paix', motif:/\b(longue paix|jamais attaque|nous n avons jamais|toujours respecte|pacte)\b/,
   verifier(n){
     const c = n.croyances;
     return c && c.fiabilite > 0.6
       ? {vrai:true, poids:0.30, texte:`tu as tenu parole jusqu'ici — ${Math.round(c.fiabilite*100)}%`}
       : {vrai:false, texte:`je ne te crois fiable qu'à ${Math.round((c?c.fiabilite:0.5)*100)}%`};
   }},
];

/* --- lit les arguments d'un message et les confronte au réel --- */
function plaidoyer(n, an){
  const t = ' ' + (an.propre || '') + ' ';
  const retenus = [], rejetes = [];
  for(const a of ARGUMENTS){
    if(!a.motif.test(t)) continue;
    const v = a.verifier(n);
    (v.vrai ? retenus : rejetes).push({...a, ...v});
  }
  const remise = retenus.reduce((s, a) => s + a.poids, 0);
  return {retenus, rejetes, remise: clamp(remise, 0, 0.85)};
}

/* --- ce que l'alliance vaut pour chacun, et donc son prix --- */
function chiffrerAlliance(n, an){
  const p = S.player;
  const ev = evaluer(n, 'ALLIANCE', {});
  const plaid = an ? plaidoyer(n, an) : {retenus:[], rejetes:[], remise:0};

  // ce qu'elle rapporte au joueur, vu de lui : force gagnée et menaces levées
  const pourToi = ratioForce(n, p) + (n.guerre.size ? 0.3 : 0);
  const pourLui = ratioForce(p, n) + (p.guerre.size ? -0.25 : 0.15);
  const desequilibre = clamp(pourToi - pourLui, -2, 2);

  const w = poidsObjectifs(n), vOr = valeurOr(n, w);
  let prix = 0;
  if(ev.dU < 0) prix = -ev.dU / Math.max(vOr, 1e-9);
  // même profitable, il fait payer une alliance qui te sert bien plus qu'à lui
  if(desequilibre > 0.25) prix += desequilibre * 220 * (0.6 + perso(n).cupidite);
  prix *= (1 - plaid.remise);
  prix = Math.max(0, Math.round(prix / 10) * 10);

  return {ev, plaid, prix, desequilibre, pourToi, pourLui, dU:ev.dU};
}
