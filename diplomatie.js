/* ===========================================================
   DIPLOMATIE VIVANTE — chaque nation a un caractère, une
   mémoire et négocie réellement. Le moteur décide (accepter,
   refuser, contre-offrir) ; Claude, si activé, met les mots.
   =========================================================== */

const PERSOS = {
  conquerant: {nom:'Conquérant', agressivite:.90, cupidite:.45, loyaute:.30, rancune:.85, chaleur:.15,
    voix:'martial et hautain, phrases courtes, parle de force et de territoire'},
  marchand:   {nom:'Marchand',   agressivite:.25, cupidite:.95, loyaute:.55, rancune:.35, chaleur:.60,
    voix:'commerçant, chiffre tout, parle en termes de profit et de routes commerciales'},
  prudent:    {nom:'Prudent',    agressivite:.20, cupidite:.45, loyaute:.75, rancune:.40, chaleur:.45,
    voix:'mesuré et circonspect, pose des conditions, évoque la sécurité de son peuple'},
  opportuniste:{nom:'Opportuniste',agressivite:.60, cupidite:.75, loyaute:.15, rancune:.45, chaleur:.55,
    voix:'flatteur et retors, promet beaucoup, sous-entend qu\'il a d\'autres options'},
  honorable:  {nom:'Honorable',   agressivite:.35, cupidite:.30, loyaute:.95, rancune:.55, chaleur:.75,
    voix:'formel et chevaleresque, parle de parole donnée, d\'honneur et de devoir'},
};
const CLES_PERSOS = Object.keys(PERSOS);

/* ---------- initialisation d'une nation ---------- */
function initDiplomatie(n, i){
  n.perso   = n.perso   || CLES_PERSOS[i % CLES_PERSOS.length];
  n.humeur  = n.humeur  ?? 0.5;                       // 0 = furieux, 1 = enchanté
  n.memoire = n.memoire || {dons:0, orRecu:0, trahisons:0, guerresSubies:0, refus:0,
                            flatteries:0, derniereFlatterie:-99, menaces:0, dernierMsg:-99};
  n.memoire.bluffs ??= 0; n.memoire.menacesTenues ??= 0;   // crédit accordé à tes menaces
  n.memoire.tributs ??= 0;                                 // fois où il a déjà payé sous la menace
  n.menaceEnCours = n.menaceEnCours || null;
  n.chat    = n.chat    || [];
  n.nonLus  = n.nonLus  ?? 0;
  n.commerce = n.commerce instanceof Set ? n.commerce : new Set(n.commerce||[]);
  initCroyances(n);
  if(n.perso && PERSOS[n.perso]) Object.assign(n, {});   // rien à faire, garde la clé
}
const perso = n => PERSOS[n.perso] || PERSOS.prudent;
const fmtSigne = x => (x>=0?'+':'') + Math.round(x*10)/10;

/* ---------- utilitaires de conversation ---------- */
function ajouterMsg(n, de, txt, meta){
  n.chat.push({de, txt, mois:S.mois, meta:meta||null});
  if(n.chat.length > 60) n.chat.splice(0, n.chat.length-60);
  if(de === 'eux' && S.chatOuvert !== n.id) n.nonLus++;
}


const pick2 = a => a[Math.floor(Math.random()*a.length)];

const VOIX = {
  conquerant: {
    appels:['{toi}','petit roi','voisin','seigneur de {toi}'],
    ouvertures:{bon:['Parlons franchement.','Bien.','Voilà qui me plaît.'],
                neutre:['Écoute-moi bien.','Soyons brefs.','Hm.'],
                mauvais:['Tu oses encore m\'écrire.','Fais vite.','Ta voix me fatigue.']},
    chutes:['Mes légions, elles, n\'attendent pas.','Le fort décide, le faible commente.',
            'Souviens-toi de qui te parle.','Ne prends pas ma patience pour de la faiblesse.']},
  marchand: {
    appels:['{toi}','mon cher partenaire','ami {toi}','noble client'],
    ouvertures:{bon:['Excellent.','Voilà une bonne affaire.','Parfait.'],
                neutre:['Parlons chiffres.','Voyons cela.','Tout se négocie.'],
                mauvais:['Ce n\'est pas rentable.','Tu me fais perdre de l\'or.','Soyons sérieux.']},
    chutes:['Le commerce vaut mieux que la guerre — c\'est plus rentable.',
            'Tout a un prix, même l\'amitié.','Mes comptes te remercient.',
            'Un bon accord laisse les deux parties un peu insatisfaites.']},
  prudent: {
    appels:['{toi}','voisin','{toi}, souverain de bonne foi'],
    ouvertures:{bon:['J\'y ai réfléchi.','Après mûre réflexion.','Soit.'],
                neutre:['Prudence.','Laisse-moi peser cela.','Je t\'écoute, mais je pèse chaque mot.'],
                mauvais:['Je me méfie.','Voilà qui m\'inquiète.','Je n\'aime pas ce ton.']},
    chutes:['Mon conseil me reprochera peut-être cette décision.','La sécurité de mon peuple passe avant tout.',
            'Je préfère un accord tiède à une guerre brûlante.','Le temps dira si j\'ai eu raison.']},
  opportuniste: {
    appels:['{toi}','mon très cher {toi}','ami — le mot est faible'],
    ouvertures:{bon:['Ha ! Intéressant.','Tu me plais de plus en plus.','Tiens donc.'],
                neutre:['Voyons ce que tu proposes vraiment.','Intéressant… peut-être.','Hmm.'],
                mauvais:['Tu me déçois.','Ce n\'est pas ainsi qu\'on me parle.','Vraiment ?']},
    chutes:['D\'autres frappent à ma porte, sache-le.','Les alliances d\'aujourd\'hui font les regrets de demain.',
            'Je te garde en réserve, disons.','Tout dépend du vent.']},
  honorable: {
    appels:['{toi}','noble {toi}','souverain de {toi}'],
    ouvertures:{bon:['Sur mon honneur.','Volontiers.','Que les dieux en soient témoins.'],
                neutre:['Je t\'écoute avec respect.','Parlons d\'égal à égal.','Voici ma réponse.'],
                mauvais:['Tu blesses mon honneur.','Je ne m\'attendais pas à cela de toi.','Cela me peine.']},
    chutes:['Ma parole vaut contrat.','Je tiens toujours mes engagements — exige la même chose de toi-même.',
            'L\'honneur survit aux royaumes.','Que cette entente soit digne de nos deux peuples.']},
};

function appel(n){
  return pick2(VOIX[n.perso].appels).replace('{toi}', S.player.nom);
}
function ouverture(n){
  const h = n.humeur > 0.65 ? 'bon' : n.humeur < 0.32 ? 'mauvais' : 'neutre';
  return pick2(VOIX[n.perso].ouvertures[h]);
}


/* ===========================================================
   DÉCISION — tout passe par l'évaluation d'utilité (ia.js)
   =========================================================== */

const rel = (a,b) => a.rel[b.id];
const ratioForce = (a,b) => puissance(a) / Math.max(1, puissance(b));

function decider(n, an){
  const p = S.player, k = perso(n), E = {}, r = rel(n,p);
  const D = o => Object.assign({}, E, o);   // les effets calculés voyagent avec la décision
  let negoc = n.negociation && S.mois - n.negociation.mois <= 8 ? n.negociation : null;

  // --- propositions structurées : un ultimatum ou une exigence de terre
  //     passe avant tout, et périme le marchandage en cours ---
  if(typeof deciderNegociation === 'function'){
    const dn = deciderNegociation(n, an);
    if(dn){ if(!dn.garderNegociation) n.negociation = n.negociation === negoc ? n.negociation : n.negociation; return D(dn); }
  }

  // --- réponse à une contre-proposition en cours ---
  if(negoc && an.acte === 'ACCORD'){
    // tribut : c'est LUI qui paie, pas toi
    if(negoc.tribut){
      const verse = Math.min(negoc.demande, Math.floor(Math.max(0, n.or)));
      n.negociation = null;
      n.memoire.tributs = (n.memoire.tributs || 0) + 1;
      return D({issue:'tributVerse', prix:verse, donIA:verse, relation:-6});
    }
    if(negoc.demande > p.or) return D({issue:'insolvable', prix:negoc.demande});
    E.donJoueur = negoc.demande;
    if(negoc.action === 'PAIX') E.paix = true;
    if(negoc.action === 'PACTE') E.pacte = true;
    if(negoc.action === 'ALLIANCE') E.alliance = true;
    if(negoc.action === 'COMMERCE') E.commerce = true;
    if(negoc.action === 'AIDE_GUERRE' && negoc.cibleId !== undefined) E.guerreContre = negoc.cibleId;
    E.relation = 5;
    n.negociation = null;
    return D({issue:'conclu', action:negoc.action, prix:negoc.demande});
  }
  if(negoc && (an.acte === 'REFUS' || (an.montant && an.montant < negoc.demande))){
    const offre = an.montant;
    const plancher = Math.round(negoc.reserve * (1 + k.cupidite*0.1));
    if(offre && offre >= plancher){
      n.negociation = {...negoc, demande: offre};
      return D({issue:'cede', action:negoc.action, prix:offre});
    }
    if((negoc.concessions||0) >= 2 || (offre && offre < negoc.reserve*0.7)){
      if((negoc.concessions||0) >= 2){ n.negociation = null; n.memoire.refus++;
        return D({issue:'ferme', action:negoc.action, prix:negoc.demande}); }
    }
    const baisse = Math.max(Math.round(negoc.reserve),
                            Math.round(negoc.demande * (0.85 - (1-k.cupidite)*0.1)));
    n.negociation = {...negoc, demande:baisse, concessions:(negoc.concessions||0)+1};
    return D({issue:'concede', action:negoc.action, prix:baisse, avant:negoc.demande});
  }

  // --- demande peu claire : il le dit et propose des lectures ---
  if(an.score < 0.35 || (an.confiance < 0.12 && an.score < 0.6))
    return D({issue:'incompris', lectures: an.scores.slice(0,2).map(s=>s.acte)});

  // --- traités : évaluation d'utilité ---
  const TRAITES = {PAIX:'PAIX', PACTE:'PACTE', ALLIANCE:'ALLIANCE', COMMERCE:'COMMERCE', AIDE_GUERRE:'AIDE_GUERRE'};
  let action = TRAITES[an.acte] || (an.acte === 'CONDITION' ? an.volet : null);

  if(action){
    if(action === 'PAIX' && !n.guerre.has(p.id))            return D({issue:'sansObjet', action, quoi:'paix'});
    if(action === 'PACTE' && n.pacte.has(p.id))             return D({issue:'sansObjet', action, quoi:'pacte'});
    if(action === 'ALLIANCE' && n.allies.has(p.id))         return D({issue:'sansObjet', action, quoi:'alliance'});
    if(action === 'COMMERCE' && n.commerce.has(p.id))       return D({issue:'sansObjet', action, quoi:'commerce'});
    if(action !== 'PAIX' && n.guerre.has(p.id))             return D({issue:'refusGuerre', action});
    if(action === 'AIDE_GUERRE' && !an.cible)               return D({issue:'flou', action});
    if(action === 'AIDE_GUERRE' && an.cible && n.guerre.has(an.cible.id))
      return D({issue:'sansObjet', action, quoi:'guerre déjà déclarée'});

    // --- l'alliance est un contrat : elle se plaide, se chiffre et se date ---
    if(action === 'ALLIANCE' && r >= 15 && n.croyances.fiabilite >= 0.35
       && typeof chiffrerAlliance === 'function'){
      const c = chiffrerAlliance(n, an);
      const offert = an.acte === 'CONDITION' ? clamp(an.montant||0, 0, Math.floor(p.or)) : 0;
      if(c.prix <= offert || c.prix === 0){
        if(offert) E.donJoueur = offert;
        E.alliance = true; E.relation = 8;
        return D({issue:'allianceConclue', action, prix:offert, duree:DUREE_ALLIANCE, chiffrage:c});
      }
      if(c.prix > Math.max(600, p.or*2))
        return D({issue:'allianceTropChere', action, chiffrage:c});
      n.negociation = {action:'ALLIANCE', demande:c.prix, reserve:Math.round(c.prix*0.55),
                       mois:S.mois, concessions:0};
      return D({issue:'alliancePrix', action, prix:c.prix, chiffrage:c});
    }

    // garde-fous de confiance : l'utilité ne suffit pas à sceller un serment
    if(action === 'ALLIANCE' && (r < 15 || n.croyances.fiabilite < 0.35))
      return D({issue:'refuseConfiance', action, manque: Math.max(0, Math.round(15-r)),
                fiab:n.croyances.fiabilite});
    if(action === 'PACTE' && r < -40)
      return D({issue:'refuseConfiance', action, manque: Math.round(-40-r), fiab:n.croyances.fiabilite});

    const par = {cible:an.cible};
    const ev = evaluer(n, action, par);
    const offert = an.acte === 'CONDITION' ? clamp(an.montant||0, 0, Math.floor(p.or)) : 0;
    const dUtotal = ev.dU + offert*ev.valeurOr;

    if(dUtotal > 0.0005){        // toute amélioration nette est acceptée
      if(offert) E.donJoueur = offert;
      if(action === 'PAIX') E.paix = true;
      if(action === 'PACTE') E.pacte = true;
      if(action === 'ALLIANCE') E.alliance = true;
      if(action === 'COMMERCE') E.commerce = true;
      if(action === 'AIDE_GUERRE') E.guerreContre = an.cible.id;
      E.relation = offert ? Math.round(offert*ev.valeurOr*250) : 2;
      return D({issue:'accepte', action, prix:offert, facteurs:ev.facteurs, dU:dUtotal});
    }
    // prix de réserve : le montant qui le rendrait indifférent, plus sa marge
    const reserve = Math.round((-(ev.dU + offert*ev.valeurOr) / Math.max(ev.valeurOr,1e-6)) / 10) * 10;
    const prix = Math.max(offert + 20, Math.round(reserve * (1.15 + k.cupidite*0.5) / 10) * 10 + offert);
    if(reserve > 0 && prix <= Math.max(400, p.or*1.6)){
      n.negociation = {action, demande:prix, reserve: offert + reserve, cible:an.cible?an.cible.nom:null,
                       cibleId:an.cible?an.cible.id:undefined, mois:S.mois, concessions:0};
      return D({issue:'contre', action, prix, offert, facteurs:ev.facteurs, dU:ev.dU});
    }
    n.memoire.refus++;
    return D({issue:'refuse', action, facteurs:ev.facteurs, dU:ev.dU,
              alternative: meilleureAlternative(n, action)});
  }

  // --- or ---
  if(an.acte === 'OFFRE_OR'){
    const m = clamp(an.montant || 100, 1, Math.floor(p.or));
    if(m < 1) return D({issue:'refuse', action:'DON', phraseVide:true});
    const w = poidsObjectifs(n), v = valeurOr(n, w);
    E.donJoueur = m;
    E.relation = Math.round(clamp(m*v*260, 2, 28));
    E.humeur = 0.08;
    return D({issue:'remercie', action:'DON', prix:m, gain:E.relation,
              alternative: meilleureAlternative(n)});
  }
  if(an.acte === 'DEMANDE_OR'){
    const m = clamp(an.montant || 200, 10, 5000);
    const w = poidsObjectifs(n), v = valeurOr(n, w);
    const dU = -m*v + w.standing*0.05*((r+40)/100) + (n.allies.has(p.id)?0.02:0);
    if(dU > 0 && n.or > m*2.2){ E.donIA = m; E.relation = -1;
      return D({issue:'prete', action:'PRET', prix:m, dU}); }
    if(n.or > m*2.2 && r > -20){
      const offre = Math.max(40, Math.round(m*0.35/10)*10);
      n.negociation = {action:'PACTE', demande:0, reserve:0, mois:S.mois, concessions:0, contrepartie:offre};
      E.donIA = 0;
      return D({issue:'contrePret', action:'PRET', prix:offre, dU});
    }
    return D({issue:'refuse', action:'PRET', dU, facteurs:[{quoi:'caisses', valeur:n.or,
              texte: n.or < m*2.2 ? `mes propres caisses ne contiennent que ${Math.round(n.or)} or`
                                  : `tu ne m'as rien donné qui justifie cela`}]});
  }

  // --- menace : il évalue vraiment la guerre ---
  if(an.acte === 'MENACE'){
    n.memoire.menaces++;
    const ev = evaluer(n, 'GUERRE', {});
    const chances = gagneLaGuerre(n, p);
    E.humeur = -0.28;
    if((chances < 0.35 || ev.dU < -0.06) && k.agressivite < 0.82 && !n.guerre.has(p.id)){
      const tribut = Math.round(clamp(-ev.dU / Math.max(valeurOr(n, poidsObjectifs(n)),1e-6) * 0.5, 60, n.or*0.35)/10)*10;
      E.donIA = tribut; E.relation = -14;
      return D({issue:'plie', action:'GUERRE', prix:tribut, chances, facteurs:ev.facteurs});
    }
    E.relation = -18;
    const declare = !n.guerre.has(p.id) && ev.dU > -0.02 && (k.agressivite > 0.55 || n.memoire.menaces >= 3);
    if(declare) E.guerre = true;
    return D({issue:'defie', action:'GUERRE', declare, chances, facteurs:ev.facteurs});
  }
  if(an.acte === 'GUERRE' && !an.negation){
    if(n.guerre.has(p.id)) return D({issue:'sansObjet', quoi:'guerre'});
    E.guerre = true; return D({issue:'accepteGuerre'});
  }
  if(an.acte === 'INSULTE'){
    E.relation = -10 - Math.round(k.rancune*10); E.humeur = -0.3;
    const ev = evaluer(n, 'GUERRE', {});
    const declare = !n.guerre.has(p.id) && k.agressivite > 0.7 && ev.dU > -0.01 && Math.random() < 0.4;
    if(declare) E.guerre = true;
    return D({issue:'offense', declare});
  }
  if(an.acte === 'EXCUSE'){ E.relation = 4 + Math.round(k.chaleur*6); E.humeur = 0.15;
    return D({issue:'pardonne'}); }
  if(an.acte === 'COMPLIMENT'){
    const frais = S.mois - n.memoire.derniereFlatterie > 6;
    if(frais){ n.memoire.derniereFlatterie = S.mois; n.memoire.flatteries++;
      E.relation = 2 + Math.round(k.chaleur*4); E.humeur = 0.12; return D({issue:'flatte'}); }
    return D({issue:'lasse'});
  }
  /* --- dix familles de plus --- */
  if(an.acte === 'RUPTURE_ALLIANCE'){
    if(!n.allies.has(p.id)) return D({issue:'sansObjet', quoi:'alliance à rompre'});
    if(typeof romprAlliance === 'function') romprAlliance(n, true);
    return D({issue:'allianceRompue'});
  }
  if(an.acte === 'PROMESSE'){
    E.relation = 2 + Math.round(k.chaleur*3); E.humeur = 0.08;
    return D({issue:'promesse'});
  }
  if(an.acte === 'INFO'){
    const t = an.propre || '';
    const quoi = /population|habitant|ame\b/.test(t) ? 'population'
               : /technolog|science|savoir/.test(t)   ? 'technologies'
               : /capital/.test(t)                     ? 'capitale'
               : /regne|ancien|depuis quand/.test(t)   ? 'regne'
               : /soldat|armee|troupe|unite|force/.test(t) ? 'armee'
               : /rich|or\b|tresor|argent/.test(t)     ? 'richesse'
               : 'general';
    return D({issue:'info_detail', quoi});
  }
  if(an.acte === 'MARCHANDE'){
    const g = n.negociation && S.mois - n.negociation.mois <= 8 ? n.negociation : null;
    if(!g) return D({issue:'marchandeSansObjet'});
    const plancher = Math.round(g.reserve * (1 + k.cupidite*0.12));
    const propose = an.montant || Math.round(g.demande * 0.5);
    if(propose >= plancher){
      n.negociation = {...g, demande:propose};
      return D({issue:'cede', action:g.action, prix:propose});
    }
    if((g.concessions||0) >= 2){ n.negociation = null; n.memoire.refus++;
      return D({issue:'ferme', action:g.action, prix:g.demande}); }
    const milieu = Math.max(plancher, Math.round((g.demande + propose)/2/10)*10);
    n.negociation = {...g, demande:milieu, concessions:(g.concessions||0)+1};
    return D({issue:'concede', action:g.action, prix:milieu, avant:g.demande});
  }
  if(an.acte === 'AFFECTION'){
    E.relation = 3 + Math.round(k.chaleur*5); E.humeur = 0.12;
    return D({issue:'affection'});
  }
  if(an.acte === 'COMPASSION'){
    E.relation = 2 + Math.round(k.chaleur*4); E.humeur = 0.1;
    return D({issue:'compassion'});
  }
  if(an.acte === 'REPROCHE'){
    E.humeur = -0.12;
    const m = n.memoire;
    const fonde = m.trahisons > 0 || m.refus > 2 || m.menaces > 1;
    if(!fonde) E.relation = -3;
    return D({issue:'reproche', fonde});
  }
  if(an.acte === 'PARTAGE'){
    const c = an.cible || [...n.guerre].map(i=>S.nations[i]).filter(o=>o && tuilesDe(o).length)[0];
    if(!c) return D({issue:'flou', action:'AIDE_GUERRE'});
    const ev = evaluer(n, 'AIDE_GUERRE', {cible:c});
    if(ev.dU > 0){ E.guerreContre = c.id; E.relation = 4;
      return D({issue:'accepte', action:'AIDE_GUERRE', facteurs:ev.facteurs, dU:ev.dU}); }
    return D({issue:'partageRefus', cible:c, facteurs:ev.facteurs,
              chances:gagneLaGuerre(n, c)});
  }
  if(an.acte === 'META')     return D({issue:'meta'});
  if(an.acte === 'PASSAGE')  return D({issue:'passage'});

  if(an.acte === 'PROJETS')   return D({issue:'projets', alternative: meilleureAlternative(n)});
  if(an.acte === 'OPINION')   return D({issue:'opinion'});
  if(an.acte === 'GRATITUDE'){ E.relation = 1 + Math.round(k.chaleur*3); E.humeur = 0.06;
                               return D({issue:'gratitude'}); }
  if(an.acte === 'ADIEU')     return D({issue:'adieu'});
  if(an.acte === 'ATTENTE'){
    const alt = meilleureAlternative(n);
    return D({issue:'attente', alternative:alt, prix: alt ? Math.max(0, alt.prixReserve) : 0});
  }
  if(an.acte === 'GUERRES') return D({issue:'guerres'});
  if(an.acte === 'RAPPEL')  return D({issue:'rappel'});
  if(an.acte === 'ETAT')  return D({issue:'info'});
  if(an.acte === 'AVIS')  return D({issue:'avis', cible:an.cible});
  if(an.acte === 'SALUT') return D({issue:'salut', alternative: Math.random()<0.4 ? meilleureAlternative(n) : null});
  if(an.acte === 'ACCORD' || an.acte === 'REFUS')
    return D({issue:'rienSurLaTable', refus: an.acte === 'REFUS',
              alternative: meilleureAlternative(n)});
  return D({issue:'incompris', lectures: an.scores.slice(0,2).map(s=>s.acte)});
}

/* ===========================================================
   GARDE DE CONFIRMATION
   La paix, une route marchande et une déclaration de guerre
   changent l'état du monde sans retour : l'IA fait répéter
   avant d'engager quoi que ce soit.
   =========================================================== */

const LIBELLES_CONFIRM = {
  PAIX:     'signer la paix',
  COMMERCE: 'ouvrir une route commerciale entre nos peuples',
  GUERRE:   'me déclarer la guerre',
};

// que faut-il faire confirmer dans ce message ? (null = rien)
function aConfirmer(n, an){
  const p = S.player;
  // un ultimatum ou une exigence territoriale relèvent de la négociation, pas de la garde
  if(typeof analyserProposition === 'function'){
    const prop = analyserProposition(an, n);
    if(prop.estUltimatum || prop.exige.province || prop.sanction) return null;
  }
  const acte = an.acte === 'CONDITION' ? an.volet : an.acte;
  if(!LIBELLES_CONFIRM[acte]) return null;
  // on ne fait pas confirmer un acte sans objet : il sera écarté de toute façon
  if(acte === 'PAIX'     && !n.guerre.has(p.id)) return null;
  if(acte === 'COMMERCE' && (n.guerre.has(p.id) || (n.commerce && n.commerce.has(p.id)))) return null;
  if(acte === 'GUERRE'   && (n.guerre.has(p.id) || an.negation)) return null;
  return acte;
}

// le joueur répond-il oui, non, ou parle-t-il d'autre chose ?
function lireConfirmation(an){
  const oui = /\b(oui|daccord|confirme|certain|absolument|vas y|allons y|exactement|tout a fait|je confirme|signons|parfaitement)\b/;
  const non = /\b(non|annul|laisse tomber|oublie|jamais|erreur|me suis trompe|finalement pas|plutot pas)\b/;
  const t = an.propre || '';
  if(non.test(t)) return 'non';
  if(an.acte === 'REFUS' || an.negation) return 'non';
  if(oui.test(t) || an.acte === 'ACCORD') return 'oui';
  return 'autre';
}

function memoriserNegociation(n, intention, d){
  if(['accepte','conclu','refuse','ferme','offense','defie','plie','accepteGuerre'].includes(d.issue))
    n.negociation = null;
}

function appliquer(n, d){
  const p = S.player, E = d;
  const maj = [];
  if(E.relation){ n.rel[p.id] = clamp(n.rel[p.id] + E.relation, -100, 100);
                  p.rel[n.id] = clamp(p.rel[n.id] + E.relation*0.5, -100, 100);
                  maj.push(`relation ${E.relation>0?'+':''}${E.relation}`); }
  if(E.humeur) n.humeur = clamp(n.humeur + E.humeur, 0, 1);
  if(E.donJoueur){ p.or -= E.donJoueur; n.or += E.donJoueur;
                   n.memoire.dons++; n.memoire.orRecu += E.donJoueur; maj.push(`−${E.donJoueur} or`); }
  if(E.donIA){ n.or -= E.donIA; p.or += E.donIA; maj.push(`+${E.donIA} or`); }
  if(E.paix){ faireLaPaix(p, n); maj.push('paix signée'); }
  if(E.pacte){ p.pacte.add(n.id); n.pacte.add(p.id);
               n.rel[p.id] = clamp(n.rel[p.id]+8,-100,100); maj.push('pacte de non-agression'); }
  if(E.alliance){ p.allies.add(n.id); n.allies.add(p.id); p.pacte.add(n.id); n.pacte.add(p.id);
                  n.rel[p.id] = clamp(n.rel[p.id]+12,-100,100);
                  if(typeof ouvrirAlliance === 'function') ouvrirAlliance(n);
                  maj.push(`alliance pour ${DUREE_ALLIANCE} mois`); }
  if(E.commerce){ (p.commerce ||= new Set()).add(n.id); (n.commerce ||= new Set()).add(p.id);
                  maj.push('accord commercial'); }
  if(E.guerre){ declarerGuerre(n, p); n.memoire.debutGuerre = S.mois; maj.push('GUERRE'); }
  if(E.guerreContre !== undefined){ const c = S.nations[E.guerreContre];
                                    declarerGuerre(n, c); maj.push(`entre en guerre contre ${c.nom}`); }
  if(E.tribut){ n.or -= E.tribut; p.or += E.tribut; maj.push(`tribut de ${E.tribut} or`); }
  if(E.cederProvince && E.cederProvince.owner === n.id){
    E.cederProvince.owner = p.id;
    maj.push(`cède une province`);
    logue(`${ic('pacte')} <b>${n.nom}</b> te cède une province.`, 'good');
  }
  return maj;
}


/* ===========================================================
   MISE EN MOTS (voir aussi la génération dans ia.js)
   =========================================================== */

const LIBELLES = {PAIX:'la paix', PACTE:'un pacte de non-agression', ALLIANCE:'une alliance',
                  COMMERCE:'un accord commercial', AIDE_GUERRE:'mon entrée en guerre à tes côtés',
                  PRET:'ce prêt', DON:'ton présent', GUERRE:'la guerre'};

function replique(n, an, d){
  const p = S.player, k = perso(n), reg = REGISTRES[n.perso];
  const A = appel(n);
  const fin = t => { if(Math.random() < 0.2 + k.agressivite*0.15) t += ' ' + choix(VOIX[n.perso].chutes); return t; };

  switch(d.issue){
    case 'accepte': case 'contre': case 'refuse':
      return parler(n, an, d);

    case 'conclu':  return fin(`${majuscule(choix(MOTS.accepte[reg]))} : ${d.prix} or, et ${LIBELLES[d.action]} prend effet.`);
    case 'cede':    return fin(`${d.prix} or ? Tu marchandes bien. Dis « d'accord » et c'est signé.`);
    case 'concede': return fin(`${d.avant} or te semblent trop ? Va pour ${d.prix}. C'est mon dernier mot, ou presque.`);
    case 'ferme':   return fin(`J'ai déjà cédé deux fois. La discussion est close.`);
    case 'insolvable': return `Tu acceptes ${d.prix} or que tu n'as pas, ${A}. Reviens les coffres pleins.`;
    case 'rienSurLaTable': {
      const suite = d.alternative
        ? ` Si tu veux qu'il y ait quelque chose à discuter : ${choix(MOTS.objets[d.alternative.action] || ['un accord'])}.`
        : ` Fais-moi une offre et nous aurons de quoi parler.`;
      return (d.refus
        ? choix([`Refuser quoi, ${A} ? Rien n'est sur la table entre nous.`,
                 `Il n'y a pas de prix à baisser : je ne t'ai rien demandé, ${A}.`,
                 `Tu dis non à quoi ? Je n'ai rien proposé.`])
        : `Accepter quoi ? Je ne t'ai rien proposé, ${A}.`) + suite;
    }

    case 'remercie': {
      let t = `${d.prix} or… ${majuscule(choix(['j\'accepte volontiers','voilà qui se remarque','ta générosité est notée']))}. (relation +${d.gain})`;
      if(d.alternative && Math.random()<0.5) t += ` ${majuscule(choix(MOTS.liaisonOpp))}, ${choix(MOTS.objets[d.alternative.action])} vaudrait bien davantage entre nous.`;
      return t;
    }
    case 'prete':   return fin(`Voici ${d.prix} or. Je ne le referai pas deux fois.`);
    case 'contrePret': return `${d.prix} or — contre un pacte de non-agression signé de ta main. Dis « d'accord » et l'or part aujourd'hui.`;

    case 'plie': {
      const f = d.facteurs && d.facteurs[0];
      return `…Range tes armées. Voici ${d.prix} or. ${f ? majuscule(f.texte)+'.' : ''} Je n'oublierai pas cette humiliation.`;
    }
    case 'defie': {
      const c = Math.round(d.chances*100);
      return d.declare
        ? `Tu me menaces ? Alors ce sera la guerre — et je nous donne ${c} chances sur 100 de l'emporter.`
        : fin(c >= 45
            ? `Je nous donne ${c} chances sur 100 de l'emporter contre toi, ${A}. J'aime ces chances. Non.`
            : `Tu es plus fort, je le sais — ${c} chances sur 100 pour moi. Mais je ne cède pas sous la menace.`);
    }
    case 'accepteGuerre': return `Ainsi soit-il. Que les dieux jugent entre nous.`;
    case 'offense': return d.declare ? `Cette insulte se lavera dans le sang : je te déclare la guerre.`
                                     : choix([`Grossier personnage.`, `Voilà qui en dit long sur toi.`]);
    case 'pardonne': return `…Soit. Des excuses valent mieux qu'un silence, ${A}.`;
    case 'flatte':   return choix([`Merci. La courtoisie entre souverains est chose rare.`,
                                   `Tu sais parler — cela ne coûte rien et cela rapporte.`]);
    case 'lasse':    return `Tu m'as déjà flatté il y a peu. Garde tes louanges.`;

    case 'refuseConfiance':
      return d.action === 'ALLIANCE'
        ? `Une alliance se scelle entre gens qui se font confiance. Je t'estime fiable à ${Math.round(d.fiab*100)}%`
          + `${d.manque ? ` et il te manque ${d.manque} points de relation` : ''} : c'est non.`
        : `Nos relations sont trop mauvaises pour un parchemin commun. Fais d'abord un geste, ${A}.`;
    case 'refusGuerre': return `Nous sommes en guerre, ${A}. Parlons de paix d'abord — le reste viendra après.`;
    case 'sansObjet':   return `Il n'y a rien à signer : ${d.quoi === 'paix' ? 'nous ne sommes pas en guerre'
                                : d.quoi === 'pacte' ? 'notre pacte tient déjà'
                                : d.quoi === 'alliance' ? 'nous sommes déjà alliés'
                                : d.quoi === 'commerce' ? 'nos marchés sont déjà ouverts'
                                : 'c\'est déjà fait'}.`;
    case 'flou':  return `Contre qui, exactement ? Nomme-la et je calculerai.`;

    case 'salut': {
      let t = n.humeur > 0.65 ? `${A} ! Toujours un plaisir.` : n.humeur < 0.32 ? `Encore toi. Sois bref.` : `Bonjour, ${A}.`;
      if(d.alternative) t += ` ${majuscule(choix(MOTS.objets[d.alternative.action]))} entre nous : voilà ce à quoi je pense en ce moment.`;
      return t;
    }
    case 'info': {
      const b = bilan(n), m = mesurer(n), pr = tuilesDe(n).length;
      const pires = m.detail.sort((a,c)=>c.part-a.part)[0];
      return `${n.nom} : ${pr} provinces, ${b.pop.toFixed(0)}k âmes, ${nbUnites(n.armee)} unités, `
        + `${Math.round(n.or)} or en caisse (${b.net >= 0 ? '+' : ''}${b.net.toFixed(0)}/mois). `
        + (n.guerre.size ? `En guerre contre ${[...n.guerre].map(i=>S.nations[i].nom).join(' et ')}, ce qui me coûte ${coutGuerre(n)} or par mois. `
                         : `En paix. `)
        + (pires && pires.part > 0.2 ? `Ce qui m'inquiète le plus : ${pires.nation.nom}. ` : '')
        + `Envers toi : ${rel(n,p) >= 55 ? 'de l\'amitié' : rel(n,p) >= 15 ? 'de la cordialité'
            : rel(n,p) >= -20 ? 'de la méfiance' : 'de l\'hostilité'} (${Math.round(rel(n,p))}), `
        + `et je te crois fiable à ${Math.round(n.croyances.fiabilite*100)}%.`;
    }
    case 'avis': {
      if(!d.cible) return `De quelle nation veux-tu que je te parle ?`;
      const c = d.cible, rr = rel(n,c), f = ratioForce(c,n);
      return `${c.nom} ? ${n.guerre.has(c.id) ? 'Nous sommes en guerre contre eux.'
        : rr > 40 ? 'Un ami fidèle.' : rr > 0 ? 'Des voisins corrects.'
        : rr > -40 ? 'Je m\'en méfie.' : 'Je les hais.'} `
        + `Leur puissance vaut ${f.toFixed(2)} fois la mienne${f > 1.2 ? ', ce qui ne me rassure pas' : ''}.`;
    }
    case 'attente': {
      const a = d.alternative;
      if(!a) return `Rien, pour l'instant, ${A}. Nos affaires sont en ordre — ou tu n'as rien que je convoite.`;
      const obj = choix(MOTS.objets[a.action] || ['un accord']);
      let t = `Ce que je veux ? ${majuscule(obj)}, ${A}.`;
      const f = (a.facteurs || []).filter(x => x.pour)[0];
      // liaisons ponctuées (« : », « — ») exclues : elles suivent mal un point
      if(f) t += ` ${majuscule(choix(MOTS.liaisonCause.filter(x => /[a-zà-ÿ]$/.test(x))))} ${f.texte}.`;
      t += a.prixReserve > 0
        ? ` Cela dit, il y faudrait ${a.prixReserve} or de ta part pour que j'y trouve mon compte.`
        : ` Propose-le-moi et je signe.`;
      return fin(t);
    }
    case 'guerres': {
      const g = [...n.guerre].map(i=>S.nations[i]).filter(o=>tuilesDe(o).length);
      const al = [...n.allies].map(i=>S.nations[i]);
      if(!g.length)
        return `Aucune guerre, ${A}. ${al.length ? `Je marche aux côtés de ${al.map(o=>o.nom).join(' et ')}.`
                : `Et je compte bien que cela dure.`}`;
      const c = coutGuerre(n);
      return `Je suis en guerre contre ${g.map(o=>`${o.nom} (${gagneLaGuerre(n,o) >= 0.5
          ? `je nous donne ${Math.round(gagneLaGuerre(n,o)*100)} chances sur 100`
          : `${Math.round(gagneLaGuerre(n,o)*100)} chances sur 100 seulement`})`).join(', ')}. `
        + `Cela me coûte ${c} or chaque mois. `
        + (al.length ? `${al.map(o=>o.nom).join(' et ')} ${al.length>1?'sont mes alliés':'est mon allié'}.`
                     : `Et je me bats seul.`);
    }
    case 'rappel': {
      const m = n.memoire, l = [];
      if(m.dons)          l.push(`tu m'as fait ${m.dons} présent${m.dons>1?'s':''}, ${Math.round(m.orRecu)} or en tout`);
      if(m.refus)         l.push(`j'ai décliné ${m.refus} de tes propositions`);
      if(m.menaces)       l.push(`tu m'as menacé ${m.menaces} fois`);
      if(m.flatteries)    l.push(`tu m'as flatté ${m.flatteries} fois`);
      if(m.trahisons)     l.push(`j'ai eu vent de ${m.trahisons} trahison${m.trahisons>1?'s':''} de ta main`);
      if(m.debutGuerre !== undefined && n.guerre.has(p.id))
        l.push(`nous nous battons depuis ${S.mois - m.debutGuerre} mois`);
      if(!l.length) return `Entre nous, ${A} ? Presque rien encore. Voilà bien le problème.`;
      return fin(`Je me souviens de tout, ${A} : ${l.join(' ; ')}. `
        + `Je te crois fiable à ${Math.round(n.croyances.fiabilite*100)}%, et nos relations valent ${Math.round(rel(n,p))}.`);
    }
    /* --- ultimatums : il répond avec ses vrais chiffres --- */
    case 'ultimatumCede': {
      const e = d.ev;
      return `${d.prix} or… les voici. ${majuscule(choix([
        `Tes troupes valent ${e.cred.force.toFixed(2)} fois les miennes`,
        `Une guerre me coûterait ${Math.round(e.espere)} or, et je n'ai que ${Math.round(e.chances*100)} chances sur 100 de l'emporter`,
        `Mon peuple ne survivrait pas à une invasion`]))}. `
        + `Mais je tiens les comptes, ${A}, et celui-ci n'est pas clos.`;
    }
    case 'ultimatumInsolvable': {
      const e = d.ev;
      return `${d.prop.exige.or} or ? Mes coffres n'en contiennent que ${Math.round(e.orbite)}, ${A}. `
        + `Tu peux me raser, tu n'en tireras pas un denier de plus. `
        + `${e.cred.valeur > 0.5 ? `Ou tu peux demander ce que je possède réellement.` : `Réfléchis à ce que cela te coûterait.`}`;
    }
    case 'ultimatumMarchande': {
      const e = d.ev;
      return `${d.prop.exige.or} or, sous la menace ? Non. ${d.prix} or — c'est ce que ta menace `
        + `vaut à mes yeux, ${A} : ${Math.round(e.cred.valeur*100)} chances sur 100 qu'elle soit sérieuse, `
        + `et une guerre me coûterait ${Math.round(e.espere)} or. Dis « d'accord » et l'or part aujourd'hui.`;
    }
    case 'ultimatumSigne':
      return `Tu mets le fer sous ma gorge pour ${LIBELLES[d.action] || 'cela'}. Soit — je signe. `
        + `Mais une signature arrachée n'a que la valeur du fer qui la tient.`;
    case 'ultimatumTientBon': {
      const e = d.ev, c = Math.round(e.chances*100), cr = Math.round(e.cred.valeur*100);
      const raisons = [];
      if(e.cred.force < 0.95) raisons.push(`tes troupes valent ${e.cred.force.toFixed(2)} fois les miennes`);
      if(!e.cred.voisine)     raisons.push(`tu ne partages même pas ma frontière`);
      if(e.cred.bluffs)       raisons.push(`tu as déjà menacé ${e.cred.bluffs} fois sans rien faire`);
      if(e.plafond > 0)       raisons.push(`ta menace ne vaut que ${e.plafond} or à mes yeux`);
      if(!raisons.length)      raisons.push(`je nous donne ${c} chances sur 100`);
      const corps = `Je jauge ta menace à ${cr} sur 100, ${A} : ${raisons.slice(0,2).join(', et ')}.`;
      return d.declare
        ? `${corps} Alors n'attendons pas : c'est moi qui te déclare la guerre.`
        : fin(`${corps} Ma réponse est non.`);
    }
    case 'tributVerse':
      return `Voici tes ${d.prix} or, ${A}. L'affaire est close — et bien notée.`;
    case 'ultimatumTout':
      return `Je n'ai que ${d.prix} or, ${A} — prends-les, jusqu'au dernier. `
        + `Tu m'auras vidé les coffres ; souviens-toi qu'on ne tond pas deux fois la même bête.`;
    case 'cedeTerre':
      return `${d.prix ? `${d.prix} or pour une province… ` : ``}Marché conclu, ${A}. `
        + `Elle est à toi — mes gens s'en souviendront plus longtemps que toi.`;
    case 'prixTerre':
      return `Une province ne se demande pas, ${A} : elle s'achète ou elle se prend. `
        + `Le prix est ${d.marche.prix} or${d.prop.offre.or ? `, pas ${d.prop.offre.or}` : ``}. `
        + `Sinon, viens la chercher — je nous donne ${Math.round(d.chances*100)} chances sur 100.`;

    case 'refuseTerritoire': {
      const c = Math.round(d.chances*100);
      return `Une province ? On ne demande pas une terre, ${A} — on la prend, et on en paie le prix. `
        + `Je nous donne ${c} chances sur 100 si tu essaies. Viens la chercher.`;
    }

    case 'confirmer': {
      const quoi = LIBELLES_CONFIRM[d.quoi];
      const prudence = d.quoi === 'GUERRE'
        ? `Réfléchis bien : on ne défait pas une guerre d'un mot.`
        : d.quoi === 'PAIX' ? `Les armes se taisent dès que tu le dis.`
        : `Nos marchands n'attendent que ton mot.`;
      return `Si je t'entends bien, ${A}, tu veux ${quoi}. ${prudence} `
           + `Confirme — dis « oui » — et c'est fait ; dis « non » et j'oublie.`;
    }
    case 'annuleConfirm':
      return choix([`Soit. N'en parlons plus, ${A}.`, `J'oublie. Nous n'avons rien dit.`,
                    `Très bien — rien ne sera engagé.`]);

    case 'promesse':
      return fin(`Les promesses sont faciles, ${A} — je les note quand même. `
        + `Je te crois fiable à ${Math.round(n.croyances.fiabilite*100)}%. `
        + `${n.croyances.fiabilite > 0.7 ? 'Tu as tenu, jusqu\'ici.' : 'Prouve-le, et ce chiffre montera.'}`);

    case 'info_detail': {
      const b = bilan(n), pr = tuilesDe(n).length;
      switch(d.quoi){
        case 'population':   return `${b.pop.toFixed(0)}k âmes sur ${pr} provinces, ${A}. `
          + `${b.netFood >= 0 ? 'Elles mangent à leur faim.' : 'Et je peine à les nourrir.'}`;
        case 'technologies': return n.tech.size
          ? `Mes savants m'ont donné : ${[...n.tech].map(t2=>TECHS[t2].nom).join(', ')}.`
          : `Mes savants ne m'ont encore rien donné, ${A}. Cela viendra.`;
        case 'capitale':     return n.capitale
          ? `Ma capitale est en ${TERRAIN[n.capitale.terr].nom.toLowerCase()}, `
            + `et elle ne bougera pas, ${A}.`
          : `Je n'ai plus de capitale à te montrer.`;
        case 'regne':        return `Je règne depuis ${S.mois} mois, ${A} — `
          + `assez pour avoir vu passer quelques ambitieux.`;
        case 'armee':        return `${nbUnites(n.armee)} unités, `
          + `${effectifs(n.armee).toLocaleString('fr-FR')} hommes, puissance ${puissance(n).toFixed(0)}. `
          + `Je te le dis sans détour : ${ratioForce(n, p) > 1 ? 'nous valons mieux que toi' : 'tu es plus fort, je le sais'}.`;
        case 'richesse':     return `${Math.round(n.or)} or en caisse, ${fmtSigne(b.net)} par mois. `
          + `${n.or > 600 ? 'De quoi voir venir.' : 'De quoi tenir, pas plus.'}`;
        default:             return `Que veux-tu savoir au juste, ${A} ? Ma population, mon armée, `
          + `mon trésor, mes savants, ma capitale — demande, je n'ai pas grand-chose à cacher.`;
      }
    }
    case 'marchandeSansObjet':
      return `Marchander quoi, ${A} ? Fais-moi d'abord une offre, et nous couperons la poire ensuite.`;

    case 'affection':
      return choix([`Voilà qui se dit rarement entre souverains, ${A}. J'y suis sensible.`,
                    `L'amitié entre puissances est une chose fragile — mais j'accepte la tienne.`,
                    `Tu me flattes, ${A}. Cela dit, je ne déteste pas.`]);
    case 'compassion':
      return choix([`Merci, ${A}. Les mots ne relèvent pas les morts, mais ils comptent.`,
                    `C'est noté, et ce n'est pas rien.`,
                    `Un peu de hauteur dans ce monde — merci, ${A}.`]);

    case 'reproche': {
      const m = n.memoire;
      if(!d.fonde)
        return fin(`Tu m'accuses, ${A} ? Cherche bien : je n'ai rien signé que je n'aie tenu. `
          + `C'est toi qui m'as menacé ${m.menaces} fois et refusé ${m.refus} propositions.`);
      return `Je ne le nierai pas, ${A}. J'ai fait ce que ma survie exigeait. `
        + `Si tu veux réparer ce qui reste entre nous, dis-moi à quel prix.`;
    }

    case 'partageRefus': {
      const c = d.cible;
      return fin(`Me partager les terres de ${c.nom} ? Encore faudrait-il les prendre, ${A}. `
        + `Je nous donne ${Math.round(d.chances*100)} chances sur 100 contre eux, `
        + `et la note serait pour moi. Trouve-moi une meilleure raison — ou de l'or.`);
    }

    case 'meta':
      return `Ce dont nous pouvons parler, ${A} ? La paix, un pacte, une alliance, le commerce, `
        + `l'or — donné, prêté ou exigé. Tu peux me menacer, me flatter, m'insulter, t'excuser. `
        + `Tu peux me demander mon état, mon avis sur un voisin, mes projets, ce que je pense de toi, `
        + `ou ce que j'attends de toi. Je réponds à tout — et je m'en souviens.`;

    case 'passage':
      return rel(n,p) > 35
        ? `Traverse mes terres si tu veux, ${A} — mais que tes hommes se tiennent.`
        : `Mes routes ne sont pas les tiennes, ${A}. Signe d'abord quelque chose avec moi.`;

    case 'allianceConclue': {
      const c = d.chiffrage;
      let t = `${majuscule(choix(MOTS.accepte[reg]))} cette alliance, ${A} — `
            + `pour ${d.duree} mois, terme sur lequel je ne reviendrai pas.`;
      if(c.plaid.retenus.length)
        t += ` Tu as plaidé juste : ${c.plaid.retenus[0].texte}.`;
      if(d.prix) t += ` Tes ${d.prix} or scellent l'affaire.`;
      t += ` Romps-la avant terme et le monde entier saura ce que vaut ta parole.`;
      return t;
    }
    case 'alliancePrix': {
      const c = d.chiffrage;
      let t = `Une alliance, ${A} ? Regardons les comptes. `;
      t += c.desequilibre > 0.25
        ? `Elle te sert plus qu'elle ne me sert : ma puissance t'apporterait `
          + `${c.pourToi.toFixed(2)}, la tienne ne m'apporte que ${c.pourLui.toFixed(2)}. `
        : `Elle ne m'avance pas assez pour que je m'engage gratuitement. `;
      if(c.plaid.retenus.length)
        t += `Tu as raison sur un point — ${c.plaid.retenus[0].texte} — et j'en ai tenu compte. `;
      if(c.plaid.rejetes.length)
        t += `En revanche, ${c.plaid.rejetes[0].texte}. `;
      t += `${d.prix} or, et je signe pour ${DUREE_ALLIANCE} mois. `
        + `Plaide mieux si tu veux faire baisser ce chiffre.`;
      return t;
    }
    case 'allianceTropChere': {
      const c = d.chiffrage;
      return `Non, ${A}. Il faudrait ${c.prix} or pour m'y décider, et ni toi ni moi `
        + `n'avons cela. ${c.plaid.rejetes.length ? majuscule(c.plaid.rejetes[0].texte) + '.' : ''} `
        + `Reviens quand nos intérêts se ressembleront davantage.`;
    }
    case 'allianceRompue':
      return `Tu romps ton serment, ${A}. Soit. `
        + `${PRIME_TRAHISON} or à qui te prendra une province — je m'en assurerai personnellement.`;

    case 'projets': {
      const b = bilan(n), m = mesurer(n);
      const pire = (m.detail || []).sort((a,c)=>c.part-a.part)[0];
      const l = [];
      if(n.guerre.size) l.push(`en finir avec ${[...n.guerre].map(i=>S.nations[i].nom).join(' et ')}`);
      if(b.net < 2)     l.push(`remplir des caisses qui se vident`);
      if(b.netFood < 2) l.push(`nourrir mon peuple avant qu'il ne gronde`);
      if(pire && pire.part > 0.25) l.push(`ne pas me laisser surprendre par ${pire.nation.nom}`);
      if(!l.length)     l.push(`m'agrandir sans me faire d'ennemis`);
      let t = `Mes projets, ${A} ? ${majuscule(l[0])}`;
      if(l[1]) t += `, puis ${l[1]}`;
      t += `.`;
      if(d.alternative) t += ` Et si tu veux y avoir une place : `
        + `${choix(MOTS.objets[d.alternative.action] || ['un accord'])}.`;
      return fin(t);
    }
    case 'opinion': {
      const r2 = rel(n,p), c = n.croyances, f = Math.round(c.fiabilite*100);
      const m = n.memoire;
      const traits = [];
      if(m.dons > 2)      traits.push(`tu sais être généreux`);
      if(m.menaces > 1)   traits.push(`tu menaces volontiers`);
      if(m.trahisons)     traits.push(`tu as trahi, et cela ne s'oublie pas`);
      if(m.refus > 2)     traits.push(`tu refuses beaucoup`);
      if(c.menacePercue > 0.6) traits.push(`tu armes plus que de raison`);
      return fin(`Ce que je pense de toi, ${A} ? `
        + `${r2 >= 55 ? 'Un ami, et je n\'en ai pas tant.' : r2 >= 15 ? 'Un voisin correct.'
           : r2 >= -20 ? 'Quelqu\'un que je surveille.' : 'Un adversaire, disons les choses.'} `
        + `Je te crois fiable à ${f}%${traits.length ? ` — ${traits.slice(0,2).join(', et ')}` : ''}. `
        + `Ta puissance vaut ${ratioForce(p,n).toFixed(2)} fois la mienne.`);
    }
    case 'gratitude':
      return choix([`On se remercie entre gens qui comptent l'un sur l'autre, ${A}.`,
                    `Garde tes remerciements pour le jour où j'en aurai vraiment fait beaucoup.`,
                    `C'est peu de chose. Mais c'est noté.`]);
    case 'adieu':
      return choix([`À bientôt, ${A}. Ma porte reste ouverte.`,
                    `Va. Nous nous reparlerons — le monde est petit.`,
                    `Adieu pour cette fois, ${A}.`]);

    case 'incompris': {
      const noms = {PAIX:'la paix', PACTE:'un pacte', ALLIANCE:'une alliance', COMMERCE:'du commerce',
                    AIDE_GUERRE:'une aide militaire', OFFRE_OR:'un présent', DEMANDE_OR:'un prêt',
                    MENACE:'une menace', ETAT:'des nouvelles de mon pays', AVIS:'mon avis sur un voisin',
                    GUERRE:'la guerre', INSULTE:'une insulte', COMPLIMENT:'un compliment',
                    EXCUSE:'des excuses', SALUT:'un salut', ACCORD:'un accord', REFUS:'un refus',
                    QUESTION:'une question', ATTENTE:'ce que j\'attends de toi',
                    GUERRES:'mes guerres en cours', RAPPEL:'notre passé commun',
                    PROJETS:'mes intentions', OPINION:'ce que je pense de toi',
                    GRATITUDE:'des remerciements', ADIEU:'un au revoir'};
      const l = (d.lectures||[]).map(x=>noms[x]).filter(Boolean);
      // on ne clôt pas la conversation : on la relance sur ce qui nous intéresse
      const alt = meilleureAlternative(n);
      const relance = alt
        ? ` Ce qui m'intéresserait, en revanche : ${choix(MOTS.objets[alt.action] || ['un accord'])}.`
        : ` Parle-moi de paix, d'or, de commerce — ou demande-moi ce que je pense de toi.`;
      if(l.length >= 2) return `Je ne te suis pas bien, ${A}. Tu me parles de ${l[0]} ou de ${l[1]} ?${relance}`;
      return choix([`Je ne suis pas sûr de comprendre, ${A}.`,
                    `Voilà qui est obscur, ${A}.`,
                    `Reformule, veux-tu.`]) + relance;
    }
    default: return `Viens-en au fait, ${A}.`;
  }
}

/* ---------- point d'entrée : le joueur envoie un message ---------- */

async function envoyerMessage(n, txt){
  const p = S.player;
  ajouterMsg(n, 'moi', txt);
  let intention = comprendre(txt, n, 'diplo');

  // --- garde de confirmation ---
  let d = null;
  if(n.confirmation && S.mois - n.confirmation.mois <= 6){
    const rep = lireConfirmation(intention);
    const attendu = n.confirmation.acte, texte = n.confirmation.txt;
    if(rep === 'oui'){                       // on rejoue l'intention d'origine, garde levée
      n.confirmation = null;
      intention = comprendre(texte, n, 'diplo');
      d = decider(n, intention);
    } else if(rep === 'non'){
      n.confirmation = null;
      d = {issue:'annuleConfirm', quoi:attendu};
    } else {
      n.confirmation = null;                 // il est passé à autre chose : on abandonne la garde
    }
  } else if(n.confirmation) n.confirmation = null;

  if(!d){
    const quoi = aConfirmer(n, intention);
    if(quoi){
      n.confirmation = {acte:quoi, txt, mois:S.mois};
      d = {issue:'confirmer', quoi};
    } else {
      d = decider(n, intention);
    }
  }

  const maj = appliquer(n, d);
  memoriserNegociation(n, intention, d);
  n.memoire.dernierMsg = S.mois;

  majUI();
  n.ecrit = true; majUI();

  // le dirigeant « réfléchit » un instant, puis compose sa réponse
  await new Promise(r => setTimeout(r, 320 + Math.random()*620));
  const corps = replique(n, intention, d);
  n.ecrit = false;
  ajouterMsg(n, 'eux', corps, maj.length ? maj : null);
  if(maj.length) logue(`${ic('alliance')} <b>${n.nom}</b> — ${maj.join(' · ')}`, maj.includes('GUERRE') ? 'bad' : 'good');
  majUI();
}

/* ===========================================================
   LES NATIONS T'ÉCRIVENT D'ELLES-MÊMES
   =========================================================== */

// messagesSpontanes() vit désormais dans courrier.js
