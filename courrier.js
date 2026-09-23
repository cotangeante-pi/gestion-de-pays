/* ===========================================================
   CORRESPONDANCE — les dirigeants écrivent parce qu'il s'est
   passé quelque chose, pas parce qu'un dé est tombé juste.
   Chacun tient une veille de ce qu'il a vu du monde ; quand
   l'état change, il en tire une lettre. La priorité décide qui
   parle, la mémoire des sujets évite les redites.
   =========================================================== */

/* --- ce que ce dirigeant avait observé au dernier relevé --- */
function veille(n){
  const p = S.player;
  if(!n.vu) n.vu = {};
  const v = n.vu;
  if(v.provJoueur === undefined) v.provJoueur = tuilesDe(p).length;
  if(v.provMoi    === undefined) v.provMoi    = tuilesDe(n).length;
  if(v.armee      === undefined) v.armee      = nbUnites(p.armee);
  if(v.relation   === undefined) v.relation   = rel(n, p);
  if(v.guerresJoueur === undefined) v.guerresJoueur = [...p.guerre];
  if(v.guerresMoi    === undefined) v.guerresMoi    = [...n.guerre];
  if(v.sujets        === undefined) v.sujets = [];      // derniers thèmes abordés
  if(v.sansReponse   === undefined) v.sansReponse = 0;  // lettres restées lettre morte
  if(v.dernierEnvoi  === undefined) v.dernierEnvoi = -99;
  return v;
}

function releverVeille(n){
  const p = S.player, v = n.vu;
  v.provJoueur = tuilesDe(p).length;
  v.provMoi    = tuilesDe(n).length;
  v.armee      = nbUnites(p.armee);
  v.relation   = rel(n, p);
  v.guerresJoueur = [...p.guerre];
  v.guerresMoi    = [...n.guerre];
}

/* --- un sujet se redit, mais pas tout de suite. Sans oubli, un dirigeant
       qui n'avait que deux choses à dire les épuisait et se taisait à jamais. --- */
const OUBLI_SUJET = 20;                            // mois avant de pouvoir y revenir
function sujetRecent(v, sujet){
  return v.sujets.some(x => (x.s || x) === sujet && (x.m === undefined || S.mois - x.m < OUBLI_SUJET));
}

/* --- le joueur a-t-il répondu depuis la dernière lettre ? --- */
const aRepondu = n => n.chat.some(m => m.de === 'moi' && m.mois >= n.vu.dernierEnvoi);

/* --- délai d'attente entre deux lettres, selon la proximité --- */
function delaiCourrier(n){
  const r = rel(n, S.player), k = perso(n);
  let d = 5 - k.chaleur*2.5;                     // un chaleureux écrit plus souvent
  if(n.allies.has(S.player.id)) d -= 1.5;
  else if(n.pacte.has(S.player.id)) d -= 1;
  if(n.guerre.has(S.player.id)) d -= 1.5;        // la guerre fait parler
  if(r > 50) d -= 1;
  if(r < -40) d += 1;
  if(n.vu.sansReponse >= 3) d += 4;              // on finit par ne plus insister
  return clamp(Math.round(d), 2, 10);
}

/* ===========================================================
   LES SUJETS — chacun renvoie {sujet, prio, txt} ou null.
   La priorité dit l'urgence : on n'écrit pas pour saluer quand
   une province vient de tomber.
   =========================================================== */

const SUJETS = [

  /* --- tu as déclaré la guerre à quelqu'un --- */
  function guerreDuJoueur(n, v){
    const p = S.player;
    const neuves = [...p.guerre].filter(i => !v.guerresJoueur.includes(i) && i !== n.id);
    if(!neuves.length) return null;
    const c = S.nations[neuves[0]];
    if(!c || !tuilesDe(c).length) return null;
    const A = appel(n), lien = rel(n, c);
    if(n.allies.has(c.id))
      return {sujet:'guerreAllie', prio:9,
        txt:`Tu lèves les armes contre ${c.nom}, mon allié. Retire-les, ${A}, ou compte-moi parmi tes ennemis.`};
    if(lien > 35)
      return {sujet:'guerreAmi', prio:7,
        txt:`${c.nom} est un ami. Que cette guerre soit courte, ${A} — je n'aimerais pas avoir à choisir.`};
    if(lien < -25)
      return {sujet:'guerreEnnemiCommun', prio:7,
        txt:`Tu marches sur ${c.nom} ? Voilà une nouvelle qui me réjouit, ${A}. `
          + `Nous avons de vieux comptes avec eux — peut-être devrions-nous les régler ensemble.`};
    return {sujet:'guerreTiers', prio:5,
      txt:`On m'apprend que tu es en guerre contre ${c.nom}. Je note, ${A}, et je regarde.`};
  },

  /* --- on vient de te déclarer la guerre, ou de m'en déclarer une --- */
  function mesGuerres(n, v){
    const neuves = [...n.guerre].filter(i => !v.guerresMoi.includes(i) && i !== S.player.id);
    if(!neuves.length) return null;
    const c = S.nations[neuves[0]];
    if(!c || !tuilesDe(c).length) return null;
    const A = appel(n), ch = gagneLaGuerre(n, c);
    if(ch < 0.42)
      return {sujet:'guerreSubie', prio:8,
        txt:`${c.nom} a marché sur mes frontières, ${A}. Je nous donne ${Math.round(ch*100)} chances sur 100. `
          + `Une alliance, ou même de l'or, me serait précieuse — et je n'oublie pas ceux qui aident.`};
    return {sujet:'guerreMienne', prio:5,
      txt:`Nous sommes entrés en guerre contre ${c.nom}. Reste en dehors si tu veux, ${A} — `
        + `mais un ami qui regarde n'est pas tout à fait un ami.`};
  },

  /* --- tu t'agrandis --- */
  function tuGrandis(n, v){
    const p = S.player, d = tuilesDe(p).length - v.provJoueur;
    if(d < 2) return null;
    const A = appel(n), k = perso(n);
    const f = ratioForce(p, n);
    if(f > 1.25 || n.croyances.menacePercue > 0.55)
      return {sujet:'expansionInquiete', prio:7,
        txt:`${d} provinces de plus en peu de temps, ${A}. Ta carte grossit vite — `
          + `dis-moi que ce n'est pas vers moi que tu regardes.`};
    return {sujet:'expansion', prio:4,
      txt:`Tu t'étends, ${A}. ${k.chaleur > 0.5 ? 'Grand bien te fasse' : 'Je le note'} — `
        + `un voisin prospère vaut mieux qu'un voisin affamé. Pour l'instant.`};
  },

  /* --- j'ai perdu du terrain --- */
  function jePerds(n, v){
    const d = v.provMoi - tuilesDe(n).length;
    if(d < 1) return null;
    const A = appel(n);
    if(n.guerre.has(S.player.id))
      return {sujet:'jePerdsContreToi', prio:8,
        txt:`Tu m'as pris ${d} province${d>1?'s':''}. Mon peuple compte ses morts, ${A}. `
          + `${gagneLaGuerre(n, S.player) < 0.35 ? 'Dis ton prix pour la paix, je l\'écouterai.'
             : 'Ne crois pas la partie finie.'}`};
    return {sujet:'jePerds', prio:6,
      txt:`On me prend mes terres, ${A} — ${d} province${d>1?'s':''} en peu de mois. `
        + `Un ami se reconnaît dans ces moments-là.`};
  },

  /* --- tu armes vite --- */
  function tuArmes(n, v){
    const p = S.player, d = nbUnites(p.armee) - v.armee;
    if(d < 4 || n.croyances.menacePercue < 0.45) return null;
    return {sujet:'armement', prio:6,
      txt:`${d} unités de plus sous tes couleurs depuis peu, ${appel(n)}. `
        + `Je jauge ta menace à ${Math.round(n.croyances.menacePercue*100)} sur 100. `
        + `Dis-moi contre qui, avant que je l'imagine moi-même.`};
  },

  /* --- une offre en cours va expirer --- */
  function relanceOffre(n){
    const g = n.negociation;
    if(!g) return null;
    const reste = 8 - (S.mois - g.mois);
    if(reste > 3 || reste <= 0) return null;
    return {sujet:'relanceOffre', prio:7,
      txt:`Mon offre tient encore ${reste} mois, ${appel(n)} : ${g.demande} or pour `
        + `${LIBELLES[g.action] || 'cet accord'}. Passé ce délai, je la retire.`};
  },

  /* --- tu ne réponds jamais --- */
  function silence(n, v){
    if(v.sansReponse < 2 || S.mois - v.dernierEnvoi < 6) return null;
    const k = perso(n), A = appel(n);
    return {sujet:'silence', prio:3,
      txt: k.agressivite > 0.6
        ? `Mes lettres restent sans réponse, ${A}. Le mépris se paie, un jour ou l'autre.`
        : k.chaleur > 0.55
          ? `Je t'écris et rien ne revient, ${A}. Ai-je dit quelque chose de travers ?`
          : `Tu ne réponds pas. Je cesserai d'écrire, ${A} — dis-moi seulement si c'est ce que tu veux.`};
  },

  /* --- ce qu'il a le plus intérêt à obtenir de toi --- */
  function proposition(n){
    const alt = meilleureAlternative(n);
    if(!alt || alt.dU <= 0.02) return null;
    const f = (alt.facteurs || []).filter(x => x.pour !== false)[0];
    const objet = choix(MOTS.objets[alt.action] || ['un accord']), A = appel(n);
    const tours = [
      `${majuscule(objet)} entre nous : voilà ce que je propose, ${A}.`,
      `J'y reviens, ${A} : ${objet}. Tu ne perdrais rien à y réfléchir.`,
      `Si tu veux mon amitié autrement qu'en paroles, ${A} — ${objet}.`,
      `Mes conseillers me pressent de te proposer ${objet}. Ils ont sans doute raison.`,
    ];
    return {sujet:'proposition:' + alt.action, prio:4,
      txt: choix(tours) + (f ? ` ${majuscule(f.texte)}.` : '')};
  },

  /* --- je suis en position de force contre toi --- */
  function menaceOuverte(n){
    const p = S.player, k = perso(n);
    if(n.guerre.has(p.id)) return null;
    const ch = gagneLaGuerre(n, p);
    if(ch < 0.62 || k.agressivite < 0.5) return null;
    const ev = evaluer(n, 'GUERRE', {});
    if(ev.dU < -0.02) return null;
    const tribut = Math.round(clamp(140 + ch*260, 120, 600)/10)*10;
    return {sujet:'menace', prio:6,
      txt:`Mes généraux me donnent ${Math.round(ch*100)} chances sur 100 de t'écraser, ${appel(n)}. `
        + `Un tribut de ${tribut} or les occuperait ailleurs.`};
  },

  /* --- cette guerre me coûte trop cher --- */
  function lasDeLaGuerre(n){
    const p = S.player;
    if(!n.guerre.has(p.id)) return null;
    const ch = gagneLaGuerre(n, p);
    if(ch > 0.42) return null;
    return {sujet:'lassitude', prio:7,
      txt:`Cette guerre me coûte ${coutGuerre(n)} or par mois et je ne la gagne pas. `
        + `Propose-moi la paix, ${appel(n)}, je l'étudierai sans orgueil.`};
  },

  /* --- nos relations ont franchi un seuil --- */
  function bascule(n, v){
    const r = rel(n, S.player), avant = v.relation, A = appel(n);
    if(avant < 45 && r >= 45)
      return {sujet:'amitie', prio:4,
        txt:`Nos relations n'ont jamais été si bonnes, ${A}. Une alliance en règle scellerait tout cela.`};
    if(avant > -40 && r <= -40)
      return {sujet:'rupture', prio:6,
        txt:`Il n'y a plus grand-chose entre nous, ${A}. Un geste, ou nous en resterons là.`};
    return null;
  },

  /* --- des nouvelles du monde : ce que font les autres --- */
  function nouvellesDuMonde(n){
    const p = S.player;
    const autres = S.nations.filter(o => !o.joueur && o !== n && tuilesDe(o).length);
    if(!autres.length) return null;
    const enGuerre = autres.filter(o => n.guerre.has(o.id));
    const allies   = autres.filter(o => n.allies.has(o.id));
    const A = appel(n);
    if(allies.length && Math.random() < 0.5)
      return {sujet:'nouvellesAlliance', prio:2,
        txt:`${nommerTous(allies)} ${allies.length>1?'marchent':'marche'} désormais `
          + `à mes côtés, ${A}. Le monde se partage en camps — le tien reste à choisir.`};
    if(enGuerre.length)
      return {sujet:'nouvellesGuerre', prio:3,
        txt:`Je me bats contre ${nommerTous(enGuerre)}. `
          + `Pendant ce temps mes frontières avec toi sont dégarnies, ${A} — `
          + `j'espère que tu es l'homme que je crois.`};
    const fort = autres.sort((a,b)=>puissance(b)-puissance(a))[0];
    if(fort && ratioForce(fort, n) > 1.4)
      return {sujet:'nouvellesPuissance', prio:2,
        txt:`${fort.nom} devient trop puissant pour mon goût, ${A}. `
          + `Un jour il faudra bien que quelqu'un s'y oppose.`};
    return null;
  },

  /* --- il te pose une question : c'est le plus sûr moyen d'entretenir un échange --- */
  function question(n){
    const p = S.player, A = appel(n), k = perso(n);
    const l = [];
    if(frontiereCommune(n, p)) l.push(`Nos frontières se touchent. Comptes-tu y masser des troupes, ${A} ?`);
    l.push(`Et toi, où en es-tu ? Tes ${tuilesDe(p).length} provinces te suffisent-elles ?`);
    if(p.guerre.size) l.push(`Tu te bats sur ${p.guerre.size} front${p.guerre.size>1?'s':''}. `
      + `Tiens-tu bon, ${A} ? Je demande sans malice.`);
    if(k.cupidite > 0.6) l.push(`Tes marchands passent-ils encore par mes ports ? On me dit que non.`);
    if(k.agressivite > 0.6) l.push(`Dis-moi franchement, ${A} : me crains-tu, ou me négliges-tu ?`);
    return {sujet:'question', prio:2, txt:choix(l)};
  },

  /* --- il se souvient de ce qui s'est passé entre vous --- */
  function souvenir(n){
    const m = n.memoire, A = appel(n);
    if(m.dons > 0 && Math.random() < 0.5)
      return {sujet:'souvenirDons', prio:2,
        txt:`Je repense à tes ${m.orRecu ? Math.round(m.orRecu)+' or' : 'présents'}, ${A}. `
          + `Les cadeaux s'oublient vite chez les autres — pas chez moi.`};
    if(m.refus > 1)
      return {sujet:'souvenirRefus', prio:2,
        txt:`J'ai décliné ${m.refus} de tes propositions, ${A}. Ce n'était pas contre toi : `
          + `c'était contre le prix. Reviens avec un meilleur, je t'écouterai.`};
    if(m.menaces > 0)
      return {sujet:'souvenirMenaces', prio:2,
        txt:`Tu m'as menacé ${m.menaces} fois, ${A}. Je le dis sans rancune — mais je le dis.`};
    return null;
  },

  /* --- un conseil que personne ne lui a demandé --- */
  function conseilNonSollicite(n){
    const p = S.player, A = appel(n), b = bilan(p);
    const l = [];
    if(p.taxe > 0.45) l.push(`On dit tes impôts écrasants, ${A}. Un peuple pressuré finit par se lever — `
      + `j'ai vu cela ailleurs, et cela finit mal.`);
    if(nbUnites(p.armee) < 4) l.push(`Ton armée est mince, ${A}. Le monde n'est pas tendre `
      + `avec les pays sans soldats — je te le dis en voisin.`);
    if(tuilesDe(p).length > 0 && b.net < 0) l.push(`Tes caisses se vident, dit-on. `
      + `Un trésor à sec vaut une défaite, ${A}.`);
    if(!l.length) return null;
    return {sujet:'conseil', prio:2, txt:choix(l)};
  },

  /* --- simple prise de contact, quand rien ne presse --- */
  function courtoisie(n){
    const k = perso(n), A = appel(n), r = rel(n, S.player);
    if(r < 0) return null;
    const b = bilan(n);
    const nouvelles = [
      `Mes greniers sont ${b.netFood > 4 ? 'pleins' : b.netFood < 0 ? 'vides, je ne le cache pas' : 'suffisants'}`,
      `Mon trésor gagne ${Math.round(b.net)} or par mois`,
      `Mes ${tuilesDe(n).length} provinces se tiennent tranquilles`,
    ];
    return {sujet:'courtoisie', prio:1,
      txt:`Rien de grave à signaler, ${A}. ${choix(nouvelles)}. `
        + `${k.chaleur > 0.5 ? 'J\'aime savoir que nous nous parlons encore.'
           : 'Je te souhaite la même chose, sans plus.'}`};
  },
];

/* ===========================================================
   LE COURRIER DU MOIS
   =========================================================== */

// au-delà, ce n'est plus une correspondance mais un déluge
const LETTRES_PAR_MOIS = 2;

function messagesSpontanes(){
  const p = S.player;
  if(!p) return;
  let envoyees = 0;
  // ordre tiré au sort : sans cela, ce sont toujours les mêmes qui ont la parole
  const tour = S.nations.filter(n => !n.joueur && tuilesDe(n).length && n.memoire)
                        .sort(()=> Math.random()-0.5);
  for(const n of tour){
    if(envoyees >= LETTRES_PAR_MOIS) break;
    const v = veille(n);

    // le joueur a-t-il donné signe de vie depuis notre dernière lettre ?
    if(aRepondu(n)) v.sansReponse = 0;

    // on rassemble ce qu'il y aurait à dire
    const candidats = [];
    for(const f of SUJETS){
      let c = null;
      try { c = f(n, v); } catch(e){ c = null; }
      if(c && c.txt && !sujetRecent(v, c.sujet)) candidats.push(c);
    }
    if(!candidats.length){ releverVeille(n); continue; }

    // L'urgence prime : une province qui tombe passe avant une politesse.
    // Sinon on tire au sort en pondérant par la priorité — un tri strict laissait
    // un seul sujet monopoliser la parole et les lettres devenaient répétitives.
    const urgents = candidats.filter(c => c.prio >= 6);
    const lot = urgents.length ? urgents : candidats;
    const total = lot.reduce((a, c) => a + c.prio, 0);
    let x = Math.random() * total, meilleur = lot[lot.length - 1];
    for(const c of lot){ x -= c.prio; if(x <= 0){ meilleur = c; break; } }

    // un événement grave force la plume ; le reste attend son tour
    const attente = S.mois - v.dernierEnvoi;
    const delai = delaiCourrier(n);
    const urgent = meilleur.prio >= 7;
    if(attente < (urgent ? 2 : delai)){ releverVeille(n); continue; }
    if(!urgent && Math.random() > 0.55 + perso(n).chaleur*0.30){ releverVeille(n); continue; }

    n.memoire.dernierMsg = S.mois;
    v.dernierEnvoi = S.mois;
    v.sansReponse++;
    v.sujets.push({s:meilleur.sujet, m:S.mois});
    v.sujets = v.sujets.filter(x => S.mois - x.m < OUBLI_SUJET);
    releverVeille(n);

    let txt = meilleur.txt;
    if(Math.random() < 0.18 + perso(n).agressivite*0.12 && VOIX[n.perso])
      txt += ' ' + choix(VOIX[n.perso].chutes);
    ajouterMsg(n, 'eux', txt);
    envoyees++;
    logue(`${ic('pacte')} <b>${n.nom}</b> t'écrit.`);
  }
}
