/* ===========================================================
   VICTOIRE — plusieurs chemins, pour toi comme pour l'IA
   On ne gagne plus seulement en comptant ses provinces : un
   royaume peut triompher par les armes, le savoir, l'or, les
   alliances ou le bonheur de son peuple. Quand l'horloge d'une
   partie limitée s'arrête, un score de civilisation départage
   les nations sur six domaines.
   =========================================================== */

const SEUIL_RICHESSE = 15000;
const AGE_OR = {mois:24, bonheur:78, pop:150};

const coutTotalTechs = () => Object.values(TECHS).reduce((s, t) => s + t.cout, 0);
const coutTechs = n => [...n.tech].reduce((s, k) => s + (TECHS[k] ? TECHS[k].cout : 0), 0);
const terresHabitables = () => [...S.tiles.values()].filter(t => t.terr !== 'ocean').length;
const nationsVivantes = () => S.nations.filter(n => tuilesDe(n).length > 0);
const alliesRequis = () => Math.max(2, Math.ceil((nationsVivantes().length - 1) / 2));

/* ---------- les cinq victoires anticipées ---------- */
const VICTOIRES = [
  {cle:'domination', nom:'Domination', icone:'guerre',
   desc:'Tenir la moitié des terres du monde.',
   progres: n => tuilesDe(n).length / Math.max(1, terresHabitables()) / 0.5,
   detail:  n => `${tuilesDe(n).length} / ${Math.ceil(terresHabitables()*0.5)} provinces`},
  {cle:'savoir', nom:'Savoir', icone:'recherche',
   desc:'Découvrir toutes les technologies, jusqu\'au Nucléaire.',
   progres: n => coutTechs(n) / coutTotalTechs(),
   detail:  n => `${n.tech.size} / ${Object.keys(TECHS).length} technologies`},
  {cle:'richesse', nom:'Richesse', icone:'or',
   desc:`Amasser un trésor de ${SEUIL_RICHESSE.toLocaleString('fr-FR')} or.`,
   progres: n => Math.max(0, n.or) / SEUIL_RICHESSE,
   detail:  n => `${Math.round(Math.max(0, n.or)).toLocaleString('fr-FR')} or`},
  {cle:'diplomatie', nom:'Diplomatie', icone:'alliance',
   desc:'S\'allier à la moitié des nations encore debout, et n\'être en guerre avec personne.',
   // une seule guerre suffit à barrer la dernière marche
   progres: n => { const p = n.allies.size / alliesRequis(); return n.guerre.size ? Math.min(p, 0.95) : p; },
   detail:  n => `${n.allies.size} / ${alliesRequis()} alliés${n.guerre.size ? ' · en guerre' : ''}`},
  {cle:'ageor', nom:'Âge d\'or', icone:'bonheur',
   desc:`${AGE_OR.mois} mois d'affilée avec ${AGE_OR.pop}k habitants et un bonheur d'au moins ${AGE_OR.bonheur}.`,
   progres: n => (n.ageOr || 0) / AGE_OR.mois,
   detail:  n => `${n.ageOr || 0} / ${AGE_OR.mois} mois · ${bilan(n).pop.toFixed(0)}k hab. · bonheur ${Math.round(n.bonheur)}`},
];

/* ---------- le score de civilisation, pour la fin d'une partie limitée ---------- */
const DOMAINES_SCORE = [
  {cle:'territoire', nom:'Territoire', val: (n, b) => tuilesDe(n).length*10 + b.pop*0.5},
  {cle:'economie',   nom:'Économie',   val: (n, b) => Math.max(0, n.or)*0.02 + Math.max(0, b.net)*3
                                         + tuilesDe(n).reduce((s, t) => s + nbBatiments(t), 0)*5},
  {cle:'savoir',     nom:'Savoir',     val: (n, b) => coutTechs(n)/10 + b.sci*2},
  {cle:'puissance',  nom:'Puissance',  val: (n)    => puissance(n)},
  {cle:'prosperite', nom:'Prospérité', val: (n, b) => n.bonheur * b.pop / 100},
  {cle:'diplomatie', nom:'Diplomatie', val: (n)    => n.allies.size*25 + n.pacte.size*8 + (n.commerce ? n.commerce.size : 0)*10},
];

// chaque domaine est noté sur 100 : la meilleure nation du domaine fait 100, les autres en proportion
function scoresCivilisation(){
  const nations = nationsVivantes(), bilans = new Map(nations.map(n => [n, bilan(n)]));
  const brut = nations.map(n => DOMAINES_SCORE.map(d => Math.max(0, d.val(n, bilans.get(n)))));
  const max = DOMAINES_SCORE.map((_, j) => Math.max(1e-9, ...brut.map(r => r[j])));
  return nations.map((n, i) => {
    const notes = DOMAINES_SCORE.map((_, j) => 100 * brut[i][j] / max[j]);
    const total = notes.reduce((s, x) => s + x, 0);
    const fort = notes.indexOf(Math.max(...notes));
    return {n, notes, total, specialite: DOMAINES_SCORE[fort].nom};
  }).sort((a, b) => b.total - a.total);
}

/* ---------- suivi mensuel : âge d'or, alertes, victoires ---------- */
function suivreVictoires(){
  if(S.victoire) return;
  for(const n of nationsVivantes()){
    const b = bilan(n);
    const florissant = b.pop >= AGE_OR.pop && n.bonheur >= AGE_OR.bonheur;
    n.ageOr = florissant ? (n.ageOr || 0) + 1 : Math.max(0, (n.ageOr || 0) - 3);
  }
  for(const n of nationsVivantes()){
    n.alertesVictoire = n.alertesVictoire || {};
    for(const V of VICTOIRES){
      const p = V.progres(n);
      if(p >= 1) return triompher(n, V);
      // prévenir quand quelqu'un touche au but — toi pour t'encourager, l'IA pour t'alerter
      if(p >= 0.75 && !n.alertesVictoire[V.cle]){
        n.alertesVictoire[V.cle] = true;
        if(n.joueur) logue(`${ic(V.icone)} Tu approches de la victoire « ${V.nom} » : ${V.detail(n)}.`, 'good');
        else logue(`${ic(V.icone)} <b>${n.nom}</b> approche de la victoire « ${V.nom} » : ${V.detail(n)}. `
                 + `Il faut l'en empêcher !`, 'bad');
      }
    }
  }
}

function triompher(n, V){
  S.victoire = {id: n.id, cle: V.cle};
  S.paused = true; majVitesse();
  if(n.joueur){
    modal(`Victoire — ${V.nom}`, `${V.desc}<br><br><b>${n.nom}</b> y est parvenu : ${V.detail(n)}.`
      + `<br><br>Tu peux continuer à régner si tu le souhaites.`);
    logue(`${ic(V.icone)} <b>Victoire « ${V.nom} » !</b>`, 'good');
    if(typeof SON !== 'undefined'){ SON.jouer('victoire'); SON.direUn(PHRASES.victoire, true); }
  } else {
    modal(`Défaite — ${n.nom} l'emporte`, `<b>${n.nom}</b> remporte la victoire « ${V.nom} » : ${V.detail(n)}.`
      + `<br><br>${V.desc}<br><br>Tu peux continuer à jouer, mais la partie est jouée.`);
    logue(`${ic(V.icone)} <b>${n.nom}</b> remporte la victoire « ${V.nom} ».`, 'bad');
    if(typeof SON !== 'undefined'){ SON.jouer('defaite'); SON.direUn(PHRASES.defaite, true); }
  }
  if(typeof SDK !== 'undefined') SDK.partieFin();
}

/* ---------- fin de l'horloge : le score de civilisation départage ---------- */
function finDuTemps(){
  S.paused = true; majVitesse();
  const cl = scoresCivilisation();
  const moi = cl.findIndex(x => x.n.joueur) + 1;
  const g = cl[0];
  const ans = Math.round(S.finMois / 12);
  const lignes = cl.slice(0, 6).map((x, i) =>
    `${i+1}. ${x.n.joueur ? '<b>' + x.n.nom + ' (toi)</b>' : x.n.nom} — `
    + `<b>${Math.round(x.total)}</b> pts · fort en ${x.specialite.toLowerCase()}`).join('<br>');
  const meneurs = DOMAINES_SCORE.map((d, j) => {
    const top = cl.slice().sort((a, b) => b.notes[j] - a.notes[j])[0];
    return `${d.nom} : ${top.n.joueur ? '<b>toi</b>' : top.n.nom}`;
  }).join(' · ');
  const titre = g && g.n.joueur ? 'Victoire' : `${moi}ᵉ sur ${cl.length}`;
  S.victoire = {id: g ? g.n.id : null, cle: 'score'};
  modal(`${ans} ans ont passé — ${titre}`,
    (g && g.n.joueur
      ? 'Ta civilisation domine le monde connu.'
      : `${g ? g.n.nom : 'Personne'} l'emporte, forte en ${g ? g.specialite.toLowerCase() : '—'}.`)
    + '<br><br>' + lignes + '<br><br><span class="muted">Meilleurs par domaine — ' + meneurs + '</span>');
  logue(`${ic('monde')} <b>Fin de la partie.</b> ${titre}.`, g && g.n.joueur ? 'good' : 'bad');
  if(typeof SON !== 'undefined'){
    if(g && g.n.joueur){ SON.jouer('victoire'); SON.direUn(PHRASES.victoire, true); }
    else if(moi <= 3){ SON.jouer('reussi'); SON.dire(`Bravo, tu finis ${moi === 2 ? 'deuxième' : 'troisième'} !`, true); }
    else { SON.jouer('defaite'); SON.dire('Partie terminée. Tu feras mieux la prochaine fois !', true); }
  }
  if(typeof SDK !== 'undefined') SDK.partieFin();
}

/* ---------- panneau « Chemins de la victoire », dans l'onglet Pays ---------- */
function htmlVictoires(){
  const p = S.player, autres = nationsVivantes().filter(n => !n.joueur);
  let h = `<h3 style="margin-top:14px">Chemins de la victoire</h3>
    <p class="muted">Le premier à atteindre l'un de ces buts gagne — toi ou une IA.</p>`;
  for(const V of VICTOIRES){
    const moi = Math.min(1, V.progres(p));
    const rival = autres.map(n => ({n, x: V.progres(n)})).sort((a, b) => b.x - a.x)[0];
    const danger = rival && rival.x >= 0.6;
    h += `<div class="card victoire">
      <b>${ic(V.icone)} ${V.nom}</b> <span class="muted">${Math.round(moi*100)} %</span>
      <div class="bar"><i style="width:${moi*100}%"></i></div>
      <span class="muted">${V.desc} — ${V.detail(p)}</span>
      ${rival ? `<span class="muted" style="display:block;${danger ? 'color:#ff8a7a' : ''}">
        En tête des rivaux : ${rival.n.nom}, ${Math.round(Math.min(1, rival.x)*100)} %</span>` : ''}
    </div>`;
  }
  if(S.finMois){
    const cl = scoresCivilisation(), rang = cl.findIndex(x => x.n.joueur) + 1;
    h += `<h3 style="margin-top:14px">Score de civilisation</h3>
      <p class="muted">À la fin des ${Math.round(S.finMois/12)} ans, sans victoire anticipée, le meilleur score gagne.
      Six domaines, notés sur 100 : territoire, économie, savoir, puissance, prospérité, diplomatie.</p>`
      + cl.slice(0, 3).map((x, i) => `<div class="row"><span>${i+1}. ${x.n.joueur ? '<b>toi</b>' : x.n.nom}
         <i class="muted">· ${x.specialite.toLowerCase()}</i></span><span>${Math.round(x.total)}</span></div>`).join('')
      + (rang > 3 ? `<div class="row"><span>${rang}. <b>toi</b></span><span>${Math.round(cl[rang-1].total)}</span></div>` : '');
  }
  return h;
}
