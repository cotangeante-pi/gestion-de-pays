/* ===========================================================
   COMPOSEUR DE PROPOSITIONS
   On négocie au clic : on choisit une intention, on règle ses
   paramètres, on ajoute ses arguments. Le composeur en fait une
   phrase française, qui repart dans le même moteur de
   compréhension que la saisie libre. Rien d'autre ne change —
   et le clavier reste disponible pour qui veut.
   =========================================================== */

const INTENTIONS = [
  {cle:'paix',     icone:'paix',       nom:'Proposer la paix',
   phrase:()=> 'Signons la paix.',
   visible:n => n.guerre.has(S.player.id)},

  {cle:'pacte',    icone:'pacte',      nom:'Pacte de non-agression',
   phrase:()=> 'Signons un pacte de non-agression.',
   visible:n => !n.guerre.has(S.player.id) && !n.pacte.has(S.player.id)},

  {cle:'alliance', icone:'alliance',   nom:'Alliance',
   phrase:(o)=> 'Concluons une alliance.' + (o.args.length ? ' ' + o.args.join(' ') : ''),
   arguments:true,
   visible:n => !n.guerre.has(S.player.id) && !n.allies.has(S.player.id)},

  {cle:'commerce', icone:'port',       nom:'Route commerciale',
   phrase:()=> 'Ouvrons une route commerciale.',
   visible:n => !n.guerre.has(S.player.id) && !(n.commerce && n.commerce.has(S.player.id))},

  {cle:'don',      icone:'don',        nom:'Offrir de l\'or', or:true,
   phrase:(o)=> `Je te donne ${o.or} or.`,
   visible:()=> S.player.or >= 50},

  {cle:'pret',     icone:'or',         nom:'Demander de l\'or', or:true,
   phrase:(o)=> `Prête-moi ${o.or} or.`,
   visible:()=> true},

  {cle:'condition',icone:'echange',    nom:'Or contre traité', or:true, traite:true,
   phrase:(o)=> `Je te donne ${o.or} or si tu signes ${LIB_TRAITE[o.traite] || 'un pacte'}.`,
   visible:()=> S.player.or >= 50},

  {cle:'ultimatum',icone:'guerre',     nom:'Ultimatum', or:true, danger:true,
   phrase:(o)=> `Donne-moi ${o.or} or, sinon je t'envahis.`,
   visible:n => !n.allies.has(S.player.id)},

  {cle:'aide',     icone:'alliance',   nom:'Demander son aide', cible:true,
   phrase:(o)=> `Aide-moi dans ma guerre contre ${o.cible}.`,
   visible:()=> S.player.guerre.size > 0},

  {cle:'etat',     icone:'monde',      nom:'Des nouvelles ?',
   phrase:()=> 'Comment va ton pays ?'},

  {cle:'attente',  icone:'chat',       nom:'Que veux-tu de moi ?',
   phrase:()=> 'Que veux-tu de moi ?'},

  {cle:'opinion',  icone:'ia',         nom:'Que penses-tu de moi ?',
   phrase:()=> 'Que penses-tu de moi ?'},

  {cle:'rupture',  icone:'guerre',     nom:'Rompre l\'alliance', danger:true,
   phrase:()=> 'Je romps notre alliance.',
   visible:n => n.allies.has(S.player.id)},

  {cle:'guerre',   icone:'guerre',     nom:'Déclarer la guerre', danger:true,
   phrase:()=> 'Je te déclare la guerre.',
   visible:n => !n.guerre.has(S.player.id)},
];

const LIB_TRAITE = {pacte:'un pacte de non-agression', alliance:'une alliance',
                    commerce:'une route commerciale', paix:'la paix'};

/* --- les arguments d'une plaidoirie, repris de alliance.js --- */
const PLAIDOIRIES = [
  {cle:'ennemi',   nom:'Nous avons un ennemi commun', txt:'Nous avons un ennemi commun.'},
  {cle:'protege',  nom:'Je te protégerai',            txt:'Je te protégerai.'},
  {cle:'force',    nom:'Je suis puissant',            txt:'Je suis puissant.'},
  {cle:'passe',    nom:'Je t\'ai déjà aidé',          txt:'Je t\'ai déjà donné.'},
  {cle:'commerce', nom:'Nos marchands se connaissent',txt:'Notre commerce nous lie.'},
  {cle:'parole',   nom:'J\'ai toujours tenu parole',  txt:'J\'ai toujours respecté nos pactes.'},
];

/* --- état du composeur, par conversation --- */
const Compose = {par:{}, ouvert:null};
function etatCompose(id){
  return Compose.par[id] || (Compose.par[id] = {intention:null, or:150, traite:'pacte', cible:null, args:[]});
}
const oublierCompose = id => { delete Compose.par[id]; };

/* --- pas de l'ajustement d'or, adapté à l'ordre de grandeur --- */
function pasOr(v){ return v < 200 ? 25 : v < 1000 ? 50 : 250; }

/* --- la phrase que produira le clic --- */
function phraseComposee(n){
  const o = etatCompose(n.id);
  const it = INTENTIONS.find(x => x.cle === o.intention);
  if(!it) return '';
  const args = o.args.map(c => (PLAIDOIRIES.find(a => a.cle === c) || {}).txt).filter(Boolean);
  return it.phrase({or:o.or, traite:o.traite, cible:o.cible, args});
}

/* ===========================================================
   RENDU
   =========================================================== */
function htmlComposeur(n){
  const o = etatCompose(n.id), p = S.player;
  const dispo = INTENTIONS.filter(it => !it.visible || it.visible(n));
  const it = dispo.find(x => x.cle === o.intention);
  if(o.intention && !it) o.intention = null;

  let h = `<div class="composeur">`;
  h += `<div class="cintentions">` + dispo.map(x =>
      `<button class="cint ${x.cle===o.intention?'actif':''} ${x.danger?'danger':''}" `
    + `data-cint="${x.cle}">${ic(x.icone)} <span>${x.nom}</span></button>`).join('') + `</div>`;

  if(it){
    h += `<div class="creglages">`;
    if(it.or){
      h += `<div class="cor">
        <button class="cpm" data-cor="-1">−</button>
        <b>${o.or} ${ic('or')}</b>
        <button class="cpm" data-cor="1">+</button>
        <span class="muted">sur ${Math.round(p.or)} en caisse</span></div>`;
    }
    if(it.traite){
      h += `<div class="cchoix">` + Object.keys(LIB_TRAITE).map(k =>
        `<button class="cpuce ${k===o.traite?'actif':''}" data-ctraite="${k}">${LIB_TRAITE[k]}</button>`).join('') + `</div>`;
    }
    if(it.cible){
      const ennemis = [...p.guerre].map(i=>S.nations[i]).filter(x => x && tuilesDe(x).length && x !== n);
      if(!ennemis.length) h += `<p class="muted">Tu n'es en guerre contre personne d'autre.</p>`;
      else {
        if(!o.cible || !ennemis.some(x=>x.nom===o.cible)) o.cible = ennemis[0].nom;
        h += `<div class="cchoix">` + ennemis.map(x =>
          `<button class="cpuce ${x.nom===o.cible?'actif':''}" data-ccible="${x.nom}">`
          + `<i class="flag" style="background:${x.col}"></i>${x.nom}</button>`).join('') + `</div>`;
      }
    }
    if(it.arguments){
      h += `<div class="cargs"><span class="muted">Tes arguments — il les vérifiera :</span>`
        + PLAIDOIRIES.map(a =>
          `<button class="cpuce ${o.args.includes(a.cle)?'actif':''}" data-carg="${a.cle}">${a.nom}</button>`).join('')
        + `</div>`;
    }
    h += `</div>`;
    h += `<div class="capercu">« ${phraseComposee(n)} »</div>`;
    h += `<button class="btn cenvoi" data-cenvoi="1">${ic('envoyer')} Envoyer</button>`;
  } else {
    h += `<p class="muted cvide">Choisis ce que tu veux lui dire — ou écris-lui librement.</p>`;
  }
  return h + `</div>`;
}

/* --- branchement des boutons ; renvoie true si l'affichage doit être refait --- */
function brancherComposeur(el, n, redessiner, envoyer){
  const o = etatCompose(n.id);
  el.querySelectorAll('[data-cint]').forEach(b => b.onclick = ()=>{
    o.intention = (o.intention === b.dataset.cint) ? null : b.dataset.cint;
    o.args = [];
    redessiner();
  });
  el.querySelectorAll('[data-cor]').forEach(b => b.onclick = ()=>{
    const sens = +b.dataset.cor;
    o.or = clamp(o.or + sens * pasOr(o.or), 25, 100000);
    redessiner();
  });
  el.querySelectorAll('[data-ctraite]').forEach(b => b.onclick = ()=>{ o.traite = b.dataset.ctraite; redessiner(); });
  el.querySelectorAll('[data-ccible]').forEach(b => b.onclick = ()=>{ o.cible = b.dataset.ccible; redessiner(); });
  el.querySelectorAll('[data-carg]').forEach(b => b.onclick = ()=>{
    const c = b.dataset.carg;
    const i = o.args.indexOf(c);
    if(i >= 0) o.args.splice(i, 1); else o.args.push(c);
    redessiner();
  });
  const env = el.querySelector('[data-cenvoi]');
  if(env) env.onclick = ()=>{
    const t = phraseComposee(n);
    if(!t) return;
    o.intention = null; o.args = [];
    envoyer(t);
  };
}
