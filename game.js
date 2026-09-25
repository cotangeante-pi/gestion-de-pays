/* ===========================================================
   NATION — jeu de gestion de pays (temps réel + pause)
   Carte hexagonale générée, IA adverses, économie / recherche
   / diplomatie / guerre.
   =========================================================== */

// ---------- Données de base ----------

const TERRAIN = {
  ocean:    {nom:'Océan',    col:'#132a4a', food:0, mat:0, hab:0,   def:0},
  cote:     {nom:'Côte',     col:'#3b7a5a', food:2, mat:1, hab:1.0, def:0},
  plaine:   {nom:'Plaine',   col:'#4f8c45', food:3, mat:1, hab:1.2, def:0},
  foret:    {nom:'Forêt',    col:'#2f6b3c', food:1, mat:3, hab:0.8, def:10},
  montagne: {nom:'Montagne', col:'#6b6b73', food:0, mat:4, hab:0.4, def:30},
  desert:   {nom:'Désert',   col:'#b8a05e', food:0, mat:1, hab:0.3, def:5},
};

const BUILDINGS = {
  ferme:      {nom:'Ferme',        or:60,  mat:20, up:1, tech:null,
               desc:'+5 nourriture', eff:{food:5}},
  mine:       {nom:'Mine',         or:90,  mat:30, up:2, tech:null,
               desc:'+4 matériaux',  eff:{mat:4}},
  port:       {nom:'Port',         or:120, mat:40, up:2, tech:'navigation',
               desc:'+6 or (côte uniquement)', eff:{gold:6}, cote:true},
  usine:      {nom:'Usine',        or:180, mat:70, up:4, tech:'industrie',
               desc:'+10 or, -3 énergie', eff:{gold:10, energie:-3}},
  centrale:   {nom:'Centrale',     or:150, mat:60, up:3, tech:'industrie',
               desc:'+10 énergie',   eff:{energie:10}},
  universite: {nom:'Université',   or:160, mat:50, up:4, tech:'ecriture',
               desc:'+4 recherche, +bonheur', eff:{sci:4, bonheur:2}},
  caserne:    {nom:'Caserne',      or:110, mat:45, up:3, tech:null,
               desc:'+20 défense, recrutement +50%', eff:{def:20}},
};

const TECHS = {
  ecriture:   {nom:'Écriture',        cout:60,  req:[],                    desc:'Débloque Université'},
  navigation: {nom:'Navigation',      cout:90,  req:['ecriture'],          desc:'Débloque Port, +colonisation'},
  agronomie:  {nom:'Agronomie',       cout:140, req:['ecriture'],          desc:'+50% nourriture des fermes'},
  industrie:  {nom:'Industrie',       cout:220, req:['navigation'],        desc:'Débloque Usine et Centrale'},
  fiscalite:  {nom:'Fiscalité',       cout:200, req:['ecriture'],          desc:'+25% revenus d\'impôts'},
  medecine:   {nom:'Médecine',        cout:260, req:['agronomie'],         desc:'+50% croissance démographique'},
  poudre:     {nom:'Poudre à canon',  cout:300, req:['industrie'],         desc:'+40% puissance militaire'},
  electricite:{nom:'Électricité',     cout:380, req:['industrie'],         desc:'+6 énergie par centrale'},
  informatique:{nom:'Informatique',   cout:520, req:['electricite','fiscalite'], desc:'+60% recherche'},
  nucleaire:  {nom:'Nucléaire',       cout:700, req:['poudre','informatique'], desc:'+80% puissance militaire'},
};

const UNITES = {
  infanterie: {nom:'Infanterie', or:45,  mat:15,  up:0.5, att:4,  def:6,  hommes:1000, tech:null,
               desc:'Bon marché, solide en défense.'},
  artillerie: {nom:'Artillerie', or:170, mat:90,  up:1.6, att:14, def:3,  hommes:300,  tech:'poudre',
               desc:'Frappe fort, fragile si prise à revers.'},
  chars:      {nom:'Chars',      or:260, mat:140, up:2.4, att:20, def:14, hommes:200,  tech:'industrie',
               desc:'Fer de lance des offensives terrestres.'},
  avions:     {nom:'Aviation',   or:380, mat:190, up:3.5, att:26, def:7,  hommes:60,   tech:'electricite',
               desc:'Ignore une partie des fortifications ennemies.'},
  navires:    {nom:'Marine',     or:300, mat:160, up:2.8, att:12, def:12, hommes:400,  tech:'navigation',
               desc:'+25% d\'attaque sur les provinces côtières.'},
};
const CLES_UNITES = Object.keys(UNITES);

/* ===========================================================
   BÂTIMENTS D'UNE PROVINCE
   Une province en porte plusieurs, dans la limite de ce que sa
   population et son terrain supportent. Plus elle est dédiée à
   un même ouvrage, plus elle y est efficace : c'est la
   spécialisation. `t.bld` reste le bâtiment dominant, pour que
   la carte et les infobulles n'aient rien à réapprendre.
   =========================================================== */

const batiments = t => (t && t.blds) ? t.blds : [];
const nbBatiments = t => batiments(t).length;
const aBatiment = (t, k) => batiments(t).includes(k);

// combien d'ouvrages une province peut porter
function capaciteBat(t){
  if(!t || t.terr === 'ocean') return 0;
  const plafond = TERRAIN[t.terr].hab >= 1 ? 5 : TERRAIN[t.terr].hab >= 0.6 ? 4 : 3;
  return clamp(1 + Math.floor(t.pop / 8), 1, plafond);
}
const placeLibre = t => nbBatiments(t) < capaciteBat(t);

// le type le plus représenté, et la part qu'il occupe
function specialite(t){
  const l = batiments(t);
  if(!l.length) return {cle:null, part:0, nb:0};
  const compte = {};
  for(const k of l) compte[k] = (compte[k]||0) + 1;
  let cle = l[0], nb = 0;
  for(const k in compte) if(compte[k] > nb){ nb = compte[k]; cle = k; }
  return {cle, part: nb / l.length, nb};
}

// une province dédiée rend davantage — jusqu'à +45% quand tout y concourt
function multSpecialite(t, cle){
  const s2 = specialite(t);
  if(s2.cle !== cle || s2.nb < 2) return 1;
  return 1 + Math.max(0, s2.part - 0.5) * 0.9;
}

// `t.bld` suit toujours le dominant : la carte et le reste du code s'y fient
function rangerBatiments(t){
  t.blds = batiments(t).slice().sort();
  t.bld = t.blds.length ? specialite(t).cle : null;
  return t;
}
function ajouterBatiment(t, k){ t.blds = batiments(t).concat([k]); return rangerBatiments(t); }
function retirerBatiment(t, k){
  const l = batiments(t).slice(), i = l.indexOf(k);
  if(i >= 0) l.splice(i, 1);
  t.blds = l; return rangerBatiments(t);
}

// production d'une province, spécialisation comprise
function effetsProvince(t, n){
  const out = {food:0, mat:0, gold:0, sci:0, energie:0, bonheur:0, def:0, up:0};
  for(const k of batiments(t)){
    const B = BUILDINGS[k]; if(!B) continue;
    const m = multSpecialite(t, k);
    out.up += B.up;
    for(const [q, v] of Object.entries(B.eff)){
      if(q === 'energie') out.energie += (v + (k === 'centrale' && aTech(n,'electricite') ? 6 : 0)) * (v > 0 ? m : 1);
      else if(q === 'food') out.food += v * (aTech(n,'agronomie') ? 1.5 : 1) * m;
      else out[q] = (out[q] || 0) + v * m;
    }
  }
  return out;
}

/* ===========================================================
   LA CAPITALE
   Elle n'est plus un simple repère : la perdre ébranle le pays,
   et le siège se déplace vers la plus grande ville qui reste.
   Reprendre son ancienne capitale apaise une part du choc.
   =========================================================== */

const CHOC_CAPITALE = 14;     // points de bonheur au moment de la chute
const DEUIL_CAPITALE = 30;    // mois pour que la blessure se referme

// ce que la perte coûte encore au moral, aujourd'hui
function malusCapitale(n){
  const c = n && n.chocCapitale;
  if(!c) return 0;
  const passe = S.mois - c.depuis;
  if(passe >= DEUIL_CAPITALE) return 0;
  return c.force * (1 - passe / DEUIL_CAPITALE);
}

// la plus grande ville qui reste fait le meilleur siège
function meilleurSiege(n){
  const l = tuilesDe(n);
  if(!l.length) return null;
  return l.slice().sort((a, b) =>
      (b.pop - a.pop) || (nbBatiments(b) - nbBatiments(a)) || (b.fort - a.fort))[0];
}

// appelé quand la capitale de n vient de changer de main
function deplacerCapitale(n, perdue){
  n.ancienneCapitale = perdue;
  n.chocCapitale = {depuis: S.mois, force: CHOC_CAPITALE};
  const siege = meilleurSiege(n);
  n.capitale = siege;
  if(n.joueur){
    if(siege) logue(`${ic('guerre')} <b>Ta capitale est tombée.</b> Le siège du royaume se replie `
        + `sur ${nomTuile(siege)} — le pays est sonné pour ${DEUIL_CAPITALE} mois.`, 'bad');
    else logue(`${ic('guerre')} <b>Ta capitale est tombée</b>, et il ne te reste rien.`, 'bad');
  } else if(siege){
    logue(`${ic('guerre')} La capitale de <b>${n.nom}</b> est tombée.`);
  }
}

// n reprend la ville dont il avait été chassé
function reprendreCapitale(n, tuile){
  n.ancienneCapitale = null;
  n.capitale = tuile;
  if(n.chocCapitale){
    // la moitié de ce qu'il restait de deuil est effacée
    const reste = malusCapitale(n);
    n.chocCapitale = reste > 0.5
      ? {depuis: S.mois, force: reste * 0.5}
      : null;
  }
  if(n.joueur) logue(`${ic('paix')} <b>Ta capitale est reprise.</b> Le siège du royaume y retourne `
      + `et le peuple respire.`, 'good');
  else logue(`${ic('paix')} <b>${n.nom}</b> reprend sa capitale.`);
}

const armeeVide = ()=> ({infanterie:0, artillerie:0, chars:0, avions:0, navires:0});
const nbUnites  = a => CLES_UNITES.reduce((s,k)=>s+(a[k]||0),0);
const effectifs = a => CLES_UNITES.reduce((s,k)=>s+(a[k]||0)*UNITES[k].hommes,0);
const coutUp    = a => CLES_UNITES.reduce((s,k)=>s+(a[k]||0)*UNITES[k].up,0);

const NOMS_IA = ['Valoria','Karthag','Nordheim','Solmara','Ostragne','Tanzir',
                 'Belgravie','Ryukan','Mirandel','Zephyra','Aldoria','Kesmir',
                 'Thalassie','Vorn','Almerande','Kyrenor','Dravonie','Sélénie',
                 'Harkaan','Morlave','Ustrenn','Calibra','Novogrod','Ythara',
                 'Perendal','Skarn','Ombrelune','Tarquine','Velmoria','Azuria'];
const COULEURS = ['#e05252','#e0a63a','#8e5ce0','#25b0a0','#d9569b','#5d7ce0',
                  '#79b03a','#c96a28','#3ac4e0','#a8446b','#6ad95a','#b06be0',
                  '#ff8a5c','#4fd1a5','#c05cff','#e0c44a','#3e9de0','#e0607f',
                  '#8fd44a','#d4763a','#5ce0c8','#9b5ce0','#e04a8a','#4ab8e0',
                  '#b8e04a','#e07a4a','#7a5ce0','#4ae0a0','#e04a4a','#4a7ae0'];

// ---------- État global ----------

const S = {
  tiles:new Map(), nations:[], player:null, sel:null,
  mois:0, paused:true, speed:1, acc:0, log:[],
  cam:{x:0,y:0,z:1}, tab:'province', chatOuvert:null, prime:null, finMois:0, mode:'courte',
};

const key = (q,r)=>q+','+r;
const T = (q,r)=>S.tiles.get(key(q,r));
const DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const voisins = t => DIRS.map(([dq,dr])=>T(t.q+dq,t.r+dr)).filter(Boolean);
const rnd = (a,b)=>a+Math.random()*(b-a);
const ri  = (a,b)=>Math.floor(rnd(a,b+1));
const pick = a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt = n=>{n=Math.round(n); return Math.abs(n)>=1000?(n/1000).toFixed(1)+'k':''+n;};

// ---------- Génération du monde ----------

/* ===========================================================
   RÉGLAGES DU MONDE — choisis avant la partie.
   Le rayon de la carte n'est pas un réglage : il se déduit de
   la surface de terre demandée, pour qu'un archipel de huit
   grandes îles ne soit pas à l'étroit et qu'une île unique ne
   flotte pas au milieu d'un océan vide.
   =========================================================== */

const TAILLES = [
  {cle:'minuscules', nom:'minuscules', mult:0.40},
  {cle:'petites',    nom:'petites',    mult:0.65},
  {cle:'moyennes',   nom:'moyennes',   mult:1.00},
  {cle:'grandes',    nom:'grandes',    mult:1.55},
  {cle:'vastes',     nom:'vastes',     mult:2.30},
];
const MAX_ADVERSAIRES = Math.min(NOMS_IA.length, COULEURS.length) - 1;   // autant que de noms

const MAX_ILES = 18;

/* ===========================================================
   DEUX FAÇONS DE JOUER
   La partie courte a une fin annoncée : cinq ans, et le plus
   grand royaume l'emporte. La partie longue est celle d'avant,
   sans horloge, jusqu'à la victoire totale.
   =========================================================== */
const MODES = {
  courte: {nom:'Partie courte', duree:60, ms:1800, adversaires:5, iles:3, taille:1,
           objectif:'Cinq ans pour bâtir le plus grand royaume.'},
  longue: {nom:'Partie longue', duree:0,  ms:2500, adversaires:6, iles:6, taille:2,
           objectif:'Sans limite : règne jusqu\'à la victoire totale.'},
};

const CONFIG = {mode:'courte', adversaires:5, iles:3, taille:1};

// surface de terre visée, et rayon de carte qui va avec
function planMonde(cfg = CONFIG){
  const mult = TAILLES[clamp(cfg.taille,0,TAILLES.length-1)].mult;
  const nations = cfg.adversaires + 1;
  const parIle = Math.round(30 * mult);
  // assez de terre pour les îles demandées, et au moins de quoi loger tout le monde :
  // 11 adversaires sur une seule île minuscule, ce sont douze capitales sur vingt cases
  const voulu = cfg.iles * parIle;
  const requis = nations * 15;
  const terre = Math.max(voulu, requis);
  const agrandi = requis > voulu;                 // la taille choisie a dû être forcée
  const cibleIle = Math.max(5, Math.round(terre / cfg.iles));
  // la terre occupe ~40% du disque utile ; le pourtour reste en pleine mer
  const utile = terre / 0.40;
  const u = Math.sqrt(Math.max(1, utile / 3));
  const rayon = Math.round(clamp(u + 2.5, 9, 30));
  return {mult, nations, parIle, terre, rayon, cibleIle, agrandi};
}

function genererMonde(cfg = CONFIG){
  const plan = planMonde(cfg);
  const RAYON = plan.rayon;
  S.plan = plan;

  // table rase : sans cela, « Nouvelle partie » empilait les nations de la
  // partie précédente sur celles du nouveau monde, avec des identifiants qui
  // se recouvraient
  S.tiles = new Map();
  S.nations = [];
  S.player = null;
  S.sel = null;
  S.chatOuvert = null;
  if(typeof oublierMer === 'function') oublierMer();
  if(typeof oublierRendu === 'function') oublierRendu();

  // 1. disque d'hexagones
  for(let q=-RAYON;q<=RAYON;q++){
    for(let r=Math.max(-RAYON,-q-RAYON); r<=Math.min(RAYON,-q+RAYON); r++){
      S.tiles.set(key(q,r),{q,r,terr:'ocean',owner:null,pop:0,bld:null,blds:[],fort:0,occ:null,geo:null});
    }
  }
  // 2. îles : autant de noyaux que demandé, chacun poussant à la taille voulue
  const noyaux = clamp(cfg.iles, 1, MAX_ILES);
  for(let i=0;i<noyaux;i++){
    // couronne régulière : c'est l'espacement qui fait l'archipel. Le rayon de
    // l'île attendue donne la distance minimale à tenir entre deux noyaux.
    const rIle = Math.sqrt(Math.max(1, plan.cibleIle) / 3);   // rayon approché d'une île
    const ecart = noyaux > 1 ? (rIle * 2.1) / (2 * Math.sin(Math.PI / noyaux)) : 0;
    const rCouronne = clamp(ecart, RAYON*0.34, RAYON*0.70);
    const ang = (i / noyaux) * Math.PI*2 + rnd(-0.18, 0.18);
    const d = noyaux === 1 ? rnd(0, RAYON*0.15) : rCouronne * rnd(0.92, 1.08);
    let q = Math.round(Math.cos(ang)*d), r = Math.round(Math.sin(ang)*d);
    let t = T(q,r); if(!t) continue;
    const cible = Math.max(4, Math.round(plan.cibleIle * rnd(0.80, 1.20)));
    let front=[t], pose = 1;
    t.terr='plaine'; t.ile = i;
    while(front.length && pose < cible){
      const cur = front.splice(ri(0,front.length-1),1)[0];
      for(const v of voisins(cur)){
        if(v.terr!=='ocean' || Math.random()>=0.62) continue;
        // on laisse toujours un bras de mer : deux îles ne se soudent pas,
        // sans quoi « huit îles » finirait en un seul continent
        if(voisins(v).some(w => w.terr!=='ocean' && w.ile !== undefined && w.ile !== i)) continue;
        v.terr='plaine'; v.ile = i; front.push(v);
        if(++pose >= cible) break;
      }
    }
  }
  // 3. biomes + côtes
  for(const t of S.tiles.values()){
    if(t.terr==='ocean') continue;
    const d = Math.abs(t.r)/RAYON, x = Math.random();
    if(x<0.16) t.terr='montagne';
    else if(x<0.38) t.terr='foret';
    else if(d<0.28 && x<0.55) t.terr='desert';
    else t.terr='plaine';
  }
  // large ceinture d'océan sur le pourtour : le monde se termine en pleine mer
  for(const t of S.tiles.values()){
    const d = (Math.abs(t.q) + Math.abs(t.q+t.r) + Math.abs(t.r))/2;
    if(d > RAYON - 2.5) t.terr = 'ocean';
  }
  // la ceinture d'océan a pu ronger les côtes : on vérifie qu'il reste assez de terre
  const minimum = (clamp(cfg.adversaires, 0, MAX_ADVERSAIRES) + 1) * 10;
  let garde = 0;
  while([...S.tiles.values()].filter(t=>t.terr!=='ocean').length < minimum && garde++ < 40){
    const bord = [...S.tiles.values()].filter(t =>
      t.terr === 'ocean' && voisins(t).some(v=>v.terr!=='ocean') &&
      (Math.abs(t.q)+Math.abs(t.q+t.r)+Math.abs(t.r))/2 <= RAYON - 3);
    if(!bord.length) break;
    for(const t of bord){
      if(Math.random()>=0.5) continue;
      const iles = new Set(voisins(t).filter(v=>v.terr!=='ocean' && v.ile!==undefined).map(v=>v.ile));
      if(iles.size > 1) continue;                  // ne pas relier deux îles entre elles
      t.terr='plaine'; if(iles.size === 1) t.ile = [...iles][0];
    }
  }

  for(const t of S.tiles.values()){
    if(t.terr!=='ocean' && t.terr!=='montagne' && voisins(t).some(v=>v.terr==='ocean')
       && Math.random()<0.7) t.terr='cote';
  }

  // 4. nations : le joueur + IA
  const nbIA = clamp(cfg.adversaires, 0, MAX_ADVERSAIRES);
  const noms = [...NOMS_IA].sort(()=>Math.random()-0.5);
  noms[0] = pick(['Avalonie','Ostrévie','Novaterre','Lysandre','Ferrance','Montclair']);
  const capitales = [];

  // on n'installe personne sur un îlot de trois cases : on repère les masses
  // de terre viables, et on répartit les capitales entre elles
  const masses = massesDeTerre();
  const viables = masses.filter(m => m.length >= 6).sort((a,b)=>b.length-a.length);
  const accueil = viables.length ? viables : masses.sort((a,b)=>b.length-a.length);
  const libres = accueil.length ? accueil.flat() : [...S.tiles.values()].filter(t=>t.terr!=='ocean');

  for(let i=0;i<=nbIA;i++){
    // capitale : sur une masse viable, et aussi loin que possible des autres
    const bassin = accueil.length ? accueil[i % accueil.length] : libres;
    let best=null, bestD=-1;
    for(let k=0;k<260;k++){
      const c = pick(bassin.length ? bassin : libres);
      if(!c || c.owner!==null) continue;
      const d = capitales.length ? Math.min(...capitales.map(x=>hexDist(x,c))) : 99;
      if(d>bestD){bestD=d;best=c;}
    }
    // dernier recours : n'importe quelle terre encore libre
    if(!best) best = libres.find(t=>t.owner===null);
    if(!best) break;
    capitales.push(best);

    const n = {
      id:i, nom: noms[i] || ('Nation '+i), col: i===0?'#4da3ff':(COULEURS[i-1]||'#888'),
      joueur:i===0, or:400, mat:150, nourriture:120, bonheur:65,
      armee: Object.assign(armeeVide(), {infanterie: i===0?2:ri(1,3)}),
      taxe:0.35, sci:0, tech:new Set(['ecriture']), rech:null,
      rel:{}, guerre:new Set(), allies:new Set(), pacte:new Set(),
      agressivite:rnd(0.15,0.8), capitale:best,
    };
    n.commerce = new Set();
    if(i>0) initDiplomatie(n, i);
    S.nations.push(n);
    if(i===0){ S.player=n; n.tech=new Set(); }

    // territoire de départ : la capitale, et rien d'autre.
    // Tout le reste se colonise ou se conquiert.
    best.owner = i; best.pop = 18; best.blds = []; ajouterBatiment(best, 'ferme');
  }
  // relations initiales
  for(const a of S.nations) for(const b of S.nations)
    if(a!==b) a.rel[b.id] = ri(-10,25);

}

/* --- les masses de terre connexes : une « île » au sens du jeu --- */
function massesDeTerre(){
  const vus = new Set(), out = [];
  for(const t of S.tiles.values()){
    if(t.terr === 'ocean' || vus.has(t)) continue;
    const masse = [], file = [t]; vus.add(t);
    while(file.length){
      const c = file.pop(); masse.push(c);
      for(const v of voisins(c))
        if(v && v.terr !== 'ocean' && !vus.has(v)){ vus.add(v); file.push(v); }
    }
    out.push(masse);
  }
  return out;
}

function hexDist(a,b){
  return (Math.abs(a.q-b.q)+Math.abs(a.q+a.r-b.q-b.r)+Math.abs(a.r-b.r))/2;
}

// ---------- Économie ----------

const tuilesDe = n => [...S.tiles.values()].filter(t=>t.owner===n.id);
const aTech = (n,t) => n.tech.has(t);

function bilan(n){
  const ts = tuilesDe(n);
  let pop=0, food=0, mat=0, gold=0, sci=0, energie=0, upkeep=0, bonus=0;
  for(const t of ts){
    const T0 = TERRAIN[t.terr];
    const occ = t.occ ? 1 - t.occ.val*0.85 : 1;   // une province envahie ne produit presque plus
    pop += t.pop;
    food += (T0.food + t.pop*0.05)*occ;
    mat  += T0.mat*0.5*occ;
    if(nbBatiments(t)){
      const e = effetsProvince(t, n);
      upkeep  += e.up;
      food    += e.food * occ;
      mat     += e.mat  * occ;
      gold    += e.gold * occ;
      sci     += e.sci  * occ;
      energie += e.energie;
      bonus   += e.bonheur;
    }
  }
  gold += pop * n.taxe * 0.55 * (aTech(n,'fiscalite')?1.25:1);
  if(n.commerce && n.commerce.size) gold *= 1 + 0.08*n.commerce.size;   // accords commerciaux
  sci  *= aTech(n,'informatique')?1.6:1;
  const conso = pop*0.35;
  const penurieEnergie = energie<0;
  if(penurieEnergie){ gold*=0.6; sci*=0.6; }
  const upArmee = coutUp(n.armee);
  return {pop, food, conso, mat, gold, sci, energie,
          upkeep:upkeep+upArmee, net: gold-upkeep-upArmee,
          netFood: food-conso, bonus, penurieEnergie, nb:ts.length};
}

function multMilitaire(n){
  let m = 1;
  if(aTech(n,'poudre')) m *= 1.25;
  if(aTech(n,'nucleaire')) m *= 1.5;
  if(aTech(n,'industrie')) m *= 1.1;
  return m;
}
function forceAtt(a,n){ return CLES_UNITES.reduce((s,k)=>s+(a[k]||0)*UNITES[k].att,0)*multMilitaire(n); }
function forceDef(a,n){ return CLES_UNITES.reduce((s,k)=>s+(a[k]||0)*UNITES[k].def,0)*multMilitaire(n); }
function puissance(n){ return (forceAtt(n.armee,n)+forceDef(n.armee,n))/2; }

// unités disponibles pour une nation (tech débloquée)
const uniteDispo = (n,k)=> !UNITES[k].tech || n.tech.has(UNITES[k].tech);

// aperçu du détachement (sans rien retirer)
function apercuDetachement(armee, frac){
  const d = armeeVide();
  for(const k of CLES_UNITES) d[k] = Math.floor((armee[k]||0)*frac);
  return d;
}
// retire réellement `frac` de chaque type et renvoie le corps expéditionnaire
function detacher(armee, frac){
  const d = apercuDetachement(armee, frac);
  for(const k of CLES_UNITES) armee[k] -= d[k];
  return d;
}
function appliquerPertes(armee, frac){
  const perdu = armeeVide();
  for(const k of CLES_UNITES){
    const p = Math.round((armee[k]||0)*frac);
    perdu[k] = Math.min(armee[k]||0, p);
    armee[k] = Math.max(0, (armee[k]||0) - perdu[k]);
  }
  return perdu;
}
function texteArmee(a){
  const parts = CLES_UNITES.filter(k=>a[k]>0).map(k=>`${ic(k,'mini')}${a[k]}`);
  return parts.length? parts.join(' ') : '—';
}

// ---------- Boucle mensuelle ----------

function tickMois(){
  S.mois++;
  if(typeof suivreMenaces === 'function') suivreMenaces();
  if(typeof suivreAlliances === 'function') suivreAlliances();
  for(const n of S.nations){
    if(tuilesDe(n).length===0) continue;
    const b = bilan(n);

    n.or += b.net;
    n.mat += b.mat;
    n.nourriture = clamp(n.nourriture + b.netFood, -50, 400);

    // bonheur
    let cible = 55 - (n.taxe-0.3)*120 + b.bonus + (n.nourriture>40?8:0)
              - (n.guerre.size*7) + (n.allies.size*3) - malusCapitale(n);
    if(n.nourriture<0) cible -= 30;
    if(b.penurieEnergie) cible -= 10;
    if(n.or<0) cible -= 15;
    n.bonheur += clamp(cible-n.bonheur, -3, 3);
    n.bonheur = clamp(n.bonheur, 0, 100);

    // population
    const ts = tuilesDe(n);
    const croiss = (n.nourriture>0? 0.006 : -0.02)
                 * (aTech(n,'medecine')?1.5:1)
                 * (n.bonheur>50?1:0.5);
    for(const t of ts){
      const capMax = 10 + TERRAIN[t.terr].hab*22 + (aBatiment(t,'ferme')?15:0);
      t.pop = clamp(t.pop + t.pop*croiss + (t.pop<capMax?0.05:-0.05), 0.5, capMax);
    }

    // recherche
    if(n.joueur){
      n.sci += b.sci;
      if(n.rech && n.sci >= TECHS[n.rech].cout){
        n.sci -= TECHS[n.rech].cout;
        n.tech.add(n.rech);
        logue(`${ic('universite')} Recherche terminée : <b>${TECHS[n.rech].nom}</b>`,'good');
        n.rech = null;
      }
    } else if(Math.random()<0.02){
      const dispo = Object.keys(TECHS).filter(k=>!n.tech.has(k)
                    && TECHS[k].req.every(r=>n.tech.has(r)));
      if(dispo.length) n.tech.add(pick(dispo));
    }

    // trésorerie négative : on dissout de l'armée
    if(n.or<0 && nbUnites(n.armee)>0){
      appliquerPertes(n.armee, 0.12); n.or += 60;
      if(n.joueur) logue(`${ic('or')} Caisses vides : des unités sont dissoutes faute de solde !`,'bad');
    }

    if(!n.joueur) iaJoue(n, b);
  }

  majOccupations();
  // disparue de la carte, disparue de la messagerie : ses non-lus ne comptent plus
  for(const q of S.nations) if(!q.joueur && tuilesDe(q).length === 0 && q.nonLus) q.nonLus = 0;
  for(const q of S.nations) if(!q.joueur && q.croyances) majCroyances(q);
  messagesSpontanes();
  evenementAleatoire();
  majUI();
  if(S.mois % 12 === 0) sauvegarder(true);
  if(S.mois%12===0) verifierFin();
  if(S.finMois && S.mois >= S.finMois) finDuTemps();
}

// ---------- IA ----------

function iaJoue(n, b){
  // construire
  if(n.or>200 && n.mat>60 && Math.random()<0.25){
    const ts = tuilesDe(n).filter(t=>placeLibre(t));
    if(ts.length){
      const t = pick(ts);
      const opts = Object.entries(BUILDINGS).filter(([k,v])=>
        (!v.tech||n.tech.has(v.tech)) && (!v.cote||t.terr==='cote'));
      if(opts.length){ const [k,v]=pick(opts);
        if(n.or>=v.or&&n.mat>=v.mat){ n.or-=v.or; n.mat-=v.mat; ajouterBatiment(t,k); } }
    }
  }
  // recruter
  if(n.or>250 && Math.random()<0.35){
    const dispo = CLES_UNITES.filter(k=>uniteDispo(n,k) && n.or>=UNITES[k].or && n.mat>=UNITES[k].mat);
    if(dispo.length){
      // les IA agressives privilégient les unités lourdes
      const k = Math.random()<n.agressivite ? dispo[dispo.length-1] : pick(dispo);
      n.or -= UNITES[k].or; n.mat -= UNITES[k].mat; n.armee[k]++;
    }
  }
  // coloniser
  if(Math.random()<0.12){
    const libres = tuilesDe(n).flatMap(voisins)
      .filter(v=>v.owner===null && v.terr!=='ocean');
    if(libres.length && n.or>120){ const c=pick(libres); c.owner=n.id; c.pop=2; n.or-=120;
      if(typeof oublierMer === 'function') oublierMer(); }
  }
  // relations qui dérivent
  for(const o of S.nations){
    if(o===n) continue;
    if(n.guerre.has(o.id)) n.rel[o.id] = clamp(n.rel[o.id]-1,-100,100);
    else n.rel[o.id] = clamp(n.rel[o.id] + (Math.random()<0.5?1:-0.5), -100, 100);
  }
  // déclarer la guerre
  const appat = (typeof primeActive === 'function' && primeActive()) ? 3.5 : 1;
  if(Math.random()<0.012*n.agressivite*3*appat){
    const cibles = S.nations.filter(o=>o!==n && o.id!==undefined
      && !n.guerre.has(o.id) && !n.allies.has(o.id) && !n.pacte.has(o.id)
      && tuilesDe(o).length>0
      && (n.rel[o.id]<10 || (o.joueur && appat>1))          // la prime fait oublier les bonnes manières
      && puissance(n)>puissance(o)*(o.joueur && appat>1 ? 0.85 : 1.2));
    if(cibles.length){ declarerGuerre(n, pick(cibles)); }
  }
  // attaquer
  if(n.guerre.size && nbUnites(n.armee)>5 && Math.random()<0.3){
    const front = tuilesDe(n).flatMap(voisins)
      .filter(v=>v.owner!==null && v.owner!==n.id && n.guerre.has(v.owner));
    if(front.length){ const c = pick(front); bataille(n, S.nations[c.owner], c, rnd(0.4,0.9)); }
  }
  // expéditions maritimes
  if(typeof iaMarine === 'function') iaMarine(n);
  // faire la paix
  if(n.guerre.size && Math.random()<0.05){
    const o = S.nations[[...n.guerre][0]];
    if(o && (puissance(o)>puissance(n) || Math.random()<0.5)) faireLaPaix(n,o);
  }
}

// ---------- Guerre ----------

function declarerGuerre(a,b){
  // rompre un pacte est une trahison : la nouvelle se répand
  if(a.joueur && b.allies && b.allies.has(a.id) && typeof romprAlliance === 'function')
    romprAlliance(b, true);              // met ta tête à prix
  if(a.joueur && b.pacte && b.pacte.has(a.id) && typeof signalerTrahison === 'function') signalerTrahison(b);
  a.guerre.add(b.id); b.guerre.add(a.id);
  a.allies.delete(b.id); b.allies.delete(a.id);
  a.rel[b.id]=-60; b.rel[a.id]=-60;
  for(const o of S.nations){ if(o!==a && o!==b) o.rel[a.id]-=6; }
  if(a.joueur||b.joueur)
    logue(`${ic('guerre')} <b>${a.nom}</b> déclare la guerre à <b>${b.nom}</b> !`,'bad');
  else
    logue(`${ic('guerre')} Au loin : <b>${a.nom}</b> déclare la guerre à <b>${b.nom}</b>.`);
}

function faireLaPaix(a,b){
  a.guerre.delete(b.id); b.guerre.delete(a.id);
  a.rel[b.id]=clamp(a.rel[b.id]+25,-100,100); b.rel[a.id]=clamp(b.rel[a.id]+25,-100,100);
  if(a.joueur||b.joueur) logue(`${ic('paix')} Paix entre <b>${a.nom}</b> et <b>${b.nom}</b>.`,'good');
  else logue(`${ic('paix')} Au loin : <b>${a.nom}</b> et <b>${b.nom}</b> font la paix.`);
}

function bataille(att, def, tuile, frac, debarquement){
  if(!def) return;
  const corps = detacher(att.armee, frac);
  const nb = nbUnites(corps);
  if(nb<1){ if(att.joueur) logue(debarquement
      ? 'Aucune troupe embarquable : il faut des navires pour porter les hommes.'
      : 'Aucune unité disponible pour cet assaut.','bad'); return; }

  const fortif = TERRAIN[tuile.terr].def + (aBatiment(tuile,'caserne')?20:0) + tuile.fort;
  const partAir = (corps.avions||0)/nb;              // l'aviation contourne les fortifications
  const fortEff = fortif * (1 - 0.55*partAir);

  let fA = forceAtt(corps, att);
  if(tuile.terr==='cote' && corps.navires>0) fA *= 1.25;
  // une tête de pont se paie : on débarque sans artillerie en position ni terrain connu
  if(debarquement) fA *= 0.70;
  const fD = (forceDef(def.armee, def) + 25) * (1 + fortEff/100);

  const rA = fA*rnd(0.82,1.18), rD = fD*rnd(0.82,1.18);
  const gagne = rA > rD, ratio = rA/(rA+rD);

  const pertesA = appliquerPertes(corps, clamp(gagne? 0.30-ratio*0.22 : 0.45-ratio*0.2, 0.05, 0.6));
  const pertesD = appliquerPertes(def.armee, clamp(gagne? ratio*0.38 : 0.20-ratio*0.1, 0.02, 0.5));
  for(const k of CLES_UNITES) att.armee[k] += corps[k];   // les survivants rentrent

  const occAvant = (tuile.occ && tuile.occ.par === att.id) ? tuile.occ.val : 0;
  // --- avancée du front : on ne prend pas une province d'un seul coup ---
  if(!tuile.occ || tuile.occ.par !== att.id) tuile.occ = {par:att.id, val:0, mois:S.mois};
  const gain = gagne ? clamp(0.14 + (ratio-0.5)*0.8, 0.08, 0.42)
                     : -clamp(0.05 + (0.5-ratio)*0.35, 0.02, 0.22);
  tuile.occ.val = clamp(tuile.occ.val + gain, 0, 1);
  tuile.occ.mois = S.mois;

  let txt, conquise = false;
  if(tuile.occ.val >= 1){
    const etaitAuJoueur = def.joueur;
    const etaitCapitale = (def.capitale === tuile);
    const reprise = (att.ancienneCapitale === tuile);
    tuile.owner = att.id; tuile.pop *= 0.85; tuile.fort = 0; tuile.occ = null;
    if(etaitCapitale) deplacerCapitale(def, tuile);
    if(reprise) reprendreCapitale(att, tuile);
    if(typeof oublierMer === 'function') oublierMer();   // les côtes ont changé de main
    // prime de trahison : le monde paie qui t'arrache une terre
    if(etaitAuJoueur && !att.joueur && typeof primeActive === 'function' && primeActive()){
      att.or += S.prime.montant;
      logue(`${ic('or')} <b>${att.nom}</b> touche ${S.prime.montant} or de prime pour cette province.`, 'bad');
    }
    txt = 'Province conquise'; conquise = true;
  } else {
    const pc = Math.round(tuile.occ.val*100);
    txt = gagne ? `Front avancé · ${pc}%` : `Assaut contenu · ${pc}%`;
    if(tuile.occ.val <= 0) tuile.occ = null;
  }

  if(typeof fxBataille === 'function') fxBataille(tuile, att.col, def.col, gagne, txt);
  if(typeof montrerCombat === 'function') montrerCombat({
    tuile, att, def, gagne, conquise, debarquement,
    occAvant, occApres: tuile.occ ? tuile.occ.val : (conquise ? 1 : 0),
    fortif, nbA: nb, nbD: nbUnites(def.armee) + nbUnites(pertesD),
    partA: nbUnites(pertesA) / Math.max(1, nb),
    partD: nbUnites(pertesD) / Math.max(1, nbUnites(def.armee) + nbUnites(pertesD)),
    verdict: conquise ? 'Province conquise' : gagne ? 'Front avancé' : 'Assaut repoussé',
    detail: `pertes ${texteArmee(pertesA)} contre ${texteArmee(pertesD)}`,
  });

  if(att.joueur || def.joueur){
    const detail = `${debarquement ? 'débarquement · ' : ''}pertes ${texteArmee(pertesA)} contre ${texteArmee(pertesD)}`;
    if(conquise){
      logue(`${ic('paix')} <b>${att.nom}</b> achève l'occupation d'une province de <b>${def.nom}</b> · ${detail}`,
            att.joueur?'good':'bad');
      if(tuilesDe(def).length===0)
        logue(`${ic('guerre')} <b>${def.nom}</b> n'existe plus.`,'bad');
    } else {
      logue(`${ic('attaque')} ${txt} — <b>${att.nom}</b> contre <b>${def.nom}</b> · ${detail}`,
            (gagne === att.joueur) ? 'good' : 'bad');
    }
  }
  majUI();
}

// le front reflue quand plus personne ne pousse
function majOccupations(){
  for(const t of S.tiles.values()){
    if(!t.occ) continue;
    const occupant = S.nations[t.occ.par];
    const proprio  = t.owner!==null ? S.nations[t.owner] : null;
    const enGuerre = proprio && occupant && occupant.guerre.has(proprio.id);
    if(!enGuerre) t.occ.val -= 0.15;
    else if(S.mois - t.occ.mois >= 2) t.occ.val -= 0.05;
    if(t.occ.val <= 0) t.occ = null;
  }
}

// ---------- Événements ----------

function evenementAleatoire(){
  if(Math.random()>0.04) return;
  const p = S.player, ts = tuilesDe(p);
  if(!ts.length) return;
  const e = pick([
    ()=>{ const t=pick(ts); t.pop*=0.8;
          logue(`${ic('pop')} Une épidémie frappe une province.`,'bad'); },
    ()=>{ p.or+=180; logue(`${ic('or')} Découverte d'un gisement : +180 or.`,'good'); },
    ()=>{ p.nourriture-=45; logue(`${ic('food')} Tempêtes : récoltes perdues.`,'bad'); },
    ()=>{ p.sci+=50;  logue(`${ic('sci')} Un savant fait une percée : +50 recherche.`,'good'); },
    ()=>{ p.bonheur=clamp(p.bonheur+10,0,100); logue(`${ic('bonheur')} Fête nationale : +10 bonheur.`,'good'); },
    ()=>{ const libres=ts.flatMap(voisins).filter(v=>v.owner===null&&v.terr!=='ocean');
          if(libres.length){ const c=pick(libres); c.owner=p.id; c.pop=2;
            logue(`${ic('coloniser')} Des colons fondent une nouvelle province.`,'good'); } },
  ]);
  e();
}

function verifierFin(){
  const vivants = S.nations.filter(n=>tuilesDe(n).length>0);
  if(tuilesDe(S.player).length===0){
    S.paused=true; majVitesse(); modal('Défaite','Ton pays a disparu de la carte…');
    if(typeof SDK !== 'undefined') SDK.partieFin();
  } else if(vivants.length===1){
    S.paused=true; majVitesse(); modal('Victoire totale','Tu règnes seul sur le monde !');
    if(typeof SDK !== 'undefined') SDK.partieFin();
  }
}

// le compte des provinces départage la partie courte ; la puissance en cas d'égalité
function classementFinal(){
  return S.nations.filter(n => tuilesDe(n).length > 0)
    .map(n => ({n, prov: tuilesDe(n).length, force: puissance(n)}))
    .sort((a,b) => (b.prov - a.prov) || (b.force - a.force));
}

function finDuTemps(){
  S.paused = true; majVitesse();
  const cl = classementFinal();
  const moi = cl.findIndex(x => x.n.joueur) + 1;
  const gagnant = cl[0];
  const lignes = cl.slice(0, 5).map((x, i) =>
    `${i+1}. ${x.n.joueur ? '<b>' + x.n.nom + ' (toi)</b>' : x.n.nom} — `
    + `${x.prov} province${x.prov>1?'s':''}, puissance ${x.force.toFixed(0)}`).join('<br>');
  const titre = gagnant && gagnant.n.joueur ? 'Victoire' : `${moi}ᵉ sur ${cl.length}`;
  modal(`Cinq ans ont passé — ${titre}`,
    (gagnant && gagnant.n.joueur
      ? 'Ton royaume est le plus grand du monde connu.'
      : `${gagnant ? gagnant.n.nom : 'Personne'} l'emporte avec ${gagnant ? gagnant.prov : 0} provinces.`)
    + '<br><br>' + lignes);
  logue(`${ic('monde')} <b>Fin de la partie courte.</b> ${titre}.`, gagnant && gagnant.n.joueur ? 'good' : 'bad');
  if(typeof SDK !== 'undefined') SDK.partieFin();
}

/* ===========================================================
   INTERFACE
   =========================================================== */

function logue(txt, cls=''){
  // chronique interrogeable : le Conseil sait relire le passé du règne
  S.log.push({mois:S.mois, cls:cls||'', txt: txt.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim()});
  if(S.log.length > 400) S.log.splice(0, S.log.length - 400);

  const d = document.createElement('div');
  d.className = cls || 'hl';
  d.innerHTML = `<span class="date">${dateTexte()}</span> ${txt}`;
  const el = document.getElementById('log');
  el.appendChild(d); el.scrollTop = el.scrollHeight;
  while(el.children.length>120) el.removeChild(el.firstChild);
}

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
const dateTexte = ()=> MOIS[S.mois%12] + ' ' + (1900 + Math.floor(S.mois/12));

function modal(titre, corps){
  document.getElementById('modalTitle').textContent = titre;
  document.getElementById('modalBody').innerHTML = corps;
  document.getElementById('modal').classList.remove('hidden');
}
document.getElementById('modalOk').onclick = ()=>
  document.getElementById('modal').classList.add('hidden');

function ongletActif(nom){
  S.tab = nom;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===nom));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('hidden', p.id!=='tab-'+nom));
}
document.querySelectorAll('.tab').forEach(b=>
  b.onclick = ()=>{ ongletActif(b.dataset.tab); majUI(); });

// ----- barre de ressources -----

function majBarre(){
  const p = S.player, b = bilan(p);
  const d = v => `<i class="delta" style="color:${v>=0?'#4ad991':'#ff6b6b'}">${v>=0?'+':''}${v.toFixed(1)}</i>`;
  const prime = (typeof primeActive === 'function' && primeActive())
    ? `<span class="tag war" title="Tu as rompu une alliance avant son terme : chaque province qu'on te prend rapporte ${S.prime.montant} or à son vainqueur">`
      + `${ic('guerre')} Tête mise à prix · ${primeReste()} mois</span>` : '';
  const reste = S.finMois ? Math.max(0, S.finMois - S.mois) : 0;
  const horloge = S.finMois
    ? `<span class="tag ${reste<=12?'war':''}" title="Partie courte : à la fin, le plus grand royaume l'emporte">`
      + `${ic('temps')} ${reste} mois</span>` : '';
  document.getElementById('resBar').innerHTML = horloge + prime + `
    <span title="Trésor national">${ic('or')} <b>${fmt(p.or)}</b> ${d(b.net)}</span>
    <span title="Matériaux de construction">${ic('mat')} <b>${fmt(p.mat)}</b> ${d(b.mat)}</span>
    <span title="Réserves de nourriture">${ic('food')} <b>${fmt(p.nourriture)}</b> ${d(b.netFood)}</span>
    <span title="Population totale">${ic('pop')} <b>${fmt(p.pop=b.pop)}k</b></span>
    <span title="Bilan énergétique">${ic('energie')} <b style="color:${b.energie<0?'#ff6b6b':'#dce6f5'}">${b.energie.toFixed(0)}</b></span>
    <span title="Points de recherche">${ic('recherche')} <b>${fmt(p.sci)}</b> ${d(b.sci)}</span>
    <span title="Bonheur du peuple">${ic('bonheur')} <b>${Math.round(p.bonheur)}</b></span>
    <span title="Armée">${ic('infanterie')} <b>${nbUnites(p.armee)}</b> <i class="delta">${fmt(effectifs(p.armee))} h.</i></span>`;
  document.getElementById('dateLabel').textContent = dateTexte();
}

// ----- onglet Province -----

function panProvince(){
  const el = document.getElementById('tab-province');
  const t = S.sel;
  if(!t){ el.innerHTML = '<p class="muted">Clique sur une province de la carte.</p>'; return; }
  const n = t.owner!==null ? S.nations[t.owner] : null;
  const T0 = TERRAIN[t.terr];
  let h = `<h3>${T0.nom}</h3>
    <div class="row"><span>Propriétaire</span><span>${n?`<i class="flag" style="background:${n.col}"></i>${n.nom}`:'Terre inoccupée'}</span></div>
    <div class="row"><span>Population</span><span>${t.pop.toFixed(1)}k</span></div>
    <div class="row"><span>Nourriture / Matériaux</span><span>${T0.food} / ${T0.mat}</span></div>
    <div class="row"><span>Bonus défensif</span><span>+${T0.def+t.fort}%</span></div>
    <div class="row"><span>Ouvrages</span><span>${nbBatiments(t)} / ${capaciteBat(t)}</span></div>`;
  const sp = specialite(t);
  if(sp.nb > 1){
    const m = multSpecialite(t, sp.cle);
    h += `<div class="row"><span>Spécialité</span><span style="color:${m>1?'#7ee0d0':'#fff'}">`
       + `${ic(sp.cle)} ${BUILDINGS[sp.cle].nom} ${Math.round(sp.part*100)}%`
       + `${m>1?` · rendement ×${m.toFixed(2)}`:''}</span></div>`;
  }

  const p = S.player;
  if(t.owner===p.id){
    // --- ce qui est déjà bâti, avec sa démolition propre ---
    if(nbBatiments(t)){
      h += '<h3 style="margin-top:14px">Sur place</h3>';
      const compte = {};
      for(const k of batiments(t)) compte[k] = (compte[k]||0) + 1;
      for(const [k, q] of Object.entries(compte)){
        const m = multSpecialite(t, k);
        h += `<div class="card unit" style="padding:0.5rem 0.625rem">
          <div class="uhead"><span class="uname">${ic(k)} ${BUILDINGS[k].nom}${q>1?` ×${q}`:''}</span>
            <button class="btn mini danger" data-raser="${k}" style="flex:none;width:auto"
              ${bridePause('raser')}>−1</button></div>
          <div class="muted">${BUILDINGS[k].desc}${m>1?` · ×${m.toFixed(2)} par spécialisation`:''}</div>
        </div>`;
      }
    }
    // --- ce qu'on peut encore y bâtir ---
    if(placeLibre(t)){
      h += '<h3 style="margin-top:14px">Construire</h3>';
      for(const [k,b] of Object.entries(BUILDINGS)){
        const verrou = b.tech && !p.tech.has(b.tech);
        const mauvaisSol = b.cote && t.terr!=='cote';
        const cher = p.or<b.or || p.mat<b.mat;
        const deja = batiments(t).filter(x=>x===k).length;
        const apres = deja ? (deja+1)/(nbBatiments(t)+1) : 0;
        const gain = apres > 0.5 ? ` · porterait la spécialité à ${Math.round(apres*100)}%` : '';
        h += `<button class="btn" data-build="${k}" ${bridePause('batir', verrou||mauvaisSol||cher)}>
          ${ic(k)} ${b.nom}${deja?` (déjà ${deja})`:''}<span class="cost">${b.or}${ic('or')} ${b.mat}${ic('mat')}</span>
          <div class="muted">${verrou?`${ic('verrou')} Requiert `+TECHS[b.tech].nom : mauvaisSol?'Côte uniquement' : b.desc+gain}</div>
        </button>`;
      }
    } else {
      h += `<p class="muted" style="margin-top:0.875rem">${ic('verrou')} Plus de place : `
         + `${capaciteBat(t)} ouvrages pour ${t.pop.toFixed(1)}k habitants sur ce terrain. `
         + `La population en fera de la place en grandissant.</p>`;
    }
    h += `<button class="btn" data-fort="1" ${bridePause('fortifier', p.or<80||t.fort>=40)}>
      ${ic('fortifier')} Fortifier (+10% défense)<span class="cost">80${ic('or')}</span></button>`;
  } else if(t.owner===null && [...voisins(t)].some(v=>v.owner===p.id)){
    h += `<button class="btn" data-colon="1" ${bridePause('coloniser', p.or<120)}>
      ${ic('coloniser')} Coloniser cette terre<span class="cost">120${ic('or')}</span></button>`;
  } else if(t.owner===null && cibleNavale(p, t)){
    const m = cibleNavale(p, t), gene = obstacleNaval(p);
    h += `<h3 style="margin-top:14px">Outre-mer</h3>
      <p class="muted">${m.distance} case${m.distance>1?'s':''} de mer à franchir, `
      + `ta portée est de ${m.portee}.</p>`;
    h += gene
      ? `<p class="muted">${ic('verrou')} Impossible : ${gene}.</p>`
      : `<button class="btn" data-colonmer="1" ${bridePause('coloniser', p.or<COUT_COLONIE_MER)}>
          ${ic('coloniser')} Fonder un comptoir outre-mer
          <span class="cost">${COUT_COLONIE_MER}${ic('or')}</span></button>`;
  } else if(n && p.guerre.has(n.id) && voisins(t).some(v=>v.owner===p.id)){
    const fortif = TERRAIN[t.terr].def + (aBatiment(t,'caserne')?20:0) + t.fort;
    h += `<h3 style="margin-top:14px">Offensive</h3>
      <div class="row"><span>Ton attaque</span><span>${forceAtt(p.armee,p).toFixed(0)}</span></div>
      <div class="row"><span>Défense sur place</span><span>${(forceDef(n.armee,n)*(1+fortif/100)).toFixed(0)}</span></div>
      <p class="muted">Ton armée : ${texteArmee(p.armee)}</p>`;
    for(const pct of [25,50,100])
      h += `<button class="btn danger" data-attaque="${pct}" ${bridePause('attaquer', nbUnites(p.armee)<1)}>
        ${ic('guerre')} Engager ${pct}% des forces<span class="cost">${texteArmee(apercuDetachement(p.armee,pct/100))}</span></button>`;
  } else if(n && p.guerre.has(n.id) && cibleNavale(p, t)){
    const m = cibleNavale(p, t), gene = obstacleNaval(p);
    const fortif = TERRAIN[t.terr].def + (aBatiment(t,'caserne')?20:0) + t.fort;
    h += `<h3 style="margin-top:14px">Débarquement</h3>
      <div class="row"><span>Traversée</span><span>${m.distance} case${m.distance>1?'s':''} de mer / portée ${m.portee}</span></div>
      <div class="row"><span>Capacité de transport</span><span>${m.capacite} unité${m.capacite>1?'s':''}</span></div>
      <div class="row"><span>Défense sur place</span><span>${(forceDef(n.armee,n)*(1+fortif/100)).toFixed(0)}</span></div>
      <p class="muted">Une tête de pont se paie : les troupes débarquées frappent à 70% de leur force.</p>`;
    if(gene){
      h += `<p class="muted">${ic('verrou')} Impossible : ${gene}.</p>`;
    } else {
      for(const pct of [50,100]){
        const corps = corpsDebarquement(p, pct/100);
        h += `<button class="btn danger" data-debarque="${pct}"
          ${bridePause('attaquer', nbUnites(corps)<1)}>
          ${ic('navires')} Débarquer ${pct}% des forces
          <span class="cost">${texteArmee(corps)}</span></button>`;
      }
    }
  }
  el.innerHTML = h;

  el.querySelectorAll('[data-build]').forEach(btn=> btn.onclick = ()=>{
    if(!actionPermise('batir')) return refuserPause();
    const b = BUILDINGS[btn.dataset.build];
    p.or-=b.or; p.mat-=b.mat; ajouterBatiment(t, btn.dataset.build);
    logue(`${ic('batir')} ${b.nom} construit.`); majUI(); dessiner();
  });
  const q = s => el.querySelector(s);
  el.querySelectorAll('[data-raser]').forEach(btn => btn.onclick = ()=>{
    if(!actionPermise('raser')) return refuserPause();
    const k = btn.dataset.raser;
    if(!aBatiment(t, k)) return;
    p.mat += BUILDINGS[k].mat*0.3; retirerBatiment(t, k); majUI(); dessiner(); });
  if(q('[data-fort]')) q('[data-fort]').onclick = ()=>{
    if(!actionPermise('fortifier')) return refuserPause();
    p.or-=80; t.fort+=10; majUI(); };
  if(q('[data-colon]')) q('[data-colon]').onclick = ()=>{
    if(!actionPermise('coloniser')) return refuserPause();
    p.or-=120; t.owner=p.id; t.pop=2; oublierMer();
    logue(`${ic('coloniser')} Nouvelle province colonisée.`,'good');
    majUI(); dessiner(); };
  if(q('[data-colonmer]')) q('[data-colonmer]').onclick = ()=>{
    if(!actionPermise('coloniser')) return refuserPause();
    if(obstacleNaval(p) || p.or < COUT_COLONIE_MER) return;
    p.or -= COUT_COLONIE_MER; t.owner = p.id; t.pop = 2; oublierMer();
    logue(`${ic('navires')} Comptoir fondé outre-mer — la flotte a porté les colons.`,'good');
    majUI(); dessiner(); };
  el.querySelectorAll('[data-attaque]').forEach(btn=> btn.onclick = ()=>{
    if(!actionPermise('attaquer')) return refuserPause();
    bataille(p, S.nations[t.owner], t, btn.dataset.attaque/100);
    dessiner(); });
  el.querySelectorAll('[data-debarque]').forEach(btn=> btn.onclick = ()=>{
    if(!actionPermise('attaquer')) return refuserPause();
    if(obstacleNaval(p)) return;
    bataille(p, S.nations[t.owner], t, fracEmbarquee(p, btn.dataset.debarque/100), true);
    dessiner(); });
}

// ----- onglet Pays -----

function panPays(){
  const p = S.player, b = bilan(p);
  document.getElementById('tab-pays').innerHTML = `
    <h3>${p.nom}</h3>
    <label class="iachamp" style="margin:0 0 10px">Nom de ton pays
      <input id="nomPays" value="${p.nom.replace(/"/g,'&quot;')}" maxlength="24"></label>
    <div class="row"><span>Provinces</span><span>${b.nb}</span></div>
    <div class="row"><span>Population</span><span>${b.pop.toFixed(1)}k</span></div>
    <div class="row"><span>Revenus bruts</span><span>${b.gold.toFixed(1)} ${ic('or')}</span></div>
    <div class="row"><span>Dépenses</span><span>-${b.upkeep.toFixed(1)} ${ic('or')}</span></div>
    <div class="row"><span>Solde mensuel</span><span style="color:${b.net>=0?'#4ad991':'#ff6b6b'}">${b.net.toFixed(1)} ${ic('or')}</span></div>
    <div class="row"><span>Énergie</span><span style="color:${b.energie<0?'#ff6b6b':'#fff'}">${b.energie.toFixed(0)}</span></div>
    <h3 style="margin-top:14px">Bonheur</h3>
    <div class="bar"><i style="width:${p.bonheur}%;background:${p.bonheur>50?'#4ad991':'#ff6b6b'}"></i></div>
    <p class="muted">${p.bonheur<30?'⚠️ Le peuple gronde. Baisse les impôts ou nourris-le.':'La population est satisfaite.'}</p>
    <h3 style="margin-top:14px">Taux d'imposition : ${(p.taxe*100).toFixed(0)}%</h3>
    <input class="slider" type="range" min="0" max="80" value="${p.taxe*100}" id="sTaxe" ${bridePause('impot')}>
    <p class="muted">Des impôts élevés remplissent les caisses mais font chuter le bonheur.</p>`;
  document.getElementById('sTaxe').oninput = e => {
    if(!actionPermise('impot')) return refuserPause();
    p.taxe = e.target.value/100; majUI(); };
  const champNom = document.getElementById('nomPays');
  champNom.onchange = e => { const v = e.target.value.trim(); if(v){ p.nom = v; majUI(); } };
  champNom.onkeydown = e => { e.stopPropagation(); if(e.key === 'Enter') e.target.blur(); };
  champNom.onkeyup = e => e.stopPropagation();
}

// ----- onglet Recherche -----

function panTech(){
  const p = S.player;
  let h = `<h3>Recherche</h3><p class="muted">Points : <b>${p.sci.toFixed(0)}</b>
    (+${bilan(p).sci.toFixed(1)}/mois)</p>`;
  if(p.rech){
    const t = TECHS[p.rech];
    h += `<div class="card"><b>En cours : ${t.nom}</b>
      <div class="bar"><i style="width:${clamp(p.sci/t.cout*100,0,100)}%"></i></div>
      <span class="muted">${p.sci.toFixed(0)} / ${t.cout}</span></div>`;
  }
  for(const [k,t] of Object.entries(TECHS)){
    const fait = p.tech.has(k);
    const ok = t.req.every(r=>p.tech.has(r));
    h += `<button class="btn" data-tech="${k}" ${bridePause('recherche', fait||!ok||p.rech===k)}>
      ${fait?`${ic('ok')}`:ok?`${ic('recherche')}`:`${ic('verrou')}`} ${t.nom}<span class="cost">${t.cout}</span>
      <div class="muted">${t.desc}${!ok?' · requiert '+t.req.map(r=>TECHS[r].nom).join(', '):''}</div>
    </button>`;
  }
  const el = document.getElementById('tab-tech');
  el.innerHTML = h;
  el.querySelectorAll('[data-tech]').forEach(b=> b.onclick = ()=>{
    p.rech = b.dataset.tech; logue(`${ic('recherche')} Recherche lancée : ${TECHS[p.rech].nom}`); majUI(); });
}

// ----- onglet Diplomatie -----

function panDiplo(){
  const p = S.player;
  let h = '<h3>Nations du monde</h3>';
  for(const n of S.nations){
    if(n.joueur) continue;
    const mort = tuilesDe(n).length===0;
    const rel = Math.round(p.rel[n.id]);
    h += `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b class="lien" data-voir="${n.id}"><i class="flag" style="background:${n.col}"></i>${n.nom}</b>
        ${mort?'<span class="tag">détruite</span>'
          : p.guerre.has(n.id)?'<span class="tag war">EN GUERRE</span>'
          : p.allies.has(n.id)?'<span class="tag ally">Alliée</span>'
          : p.pacte.has(n.id)?'<span class="tag">Non-agression</span>':''}
      </div>`;
    if(!mort){
      h += `<div class="bar"><i style="width:${(rel+100)/2}%;background:${rel>=0?'#4ad991':'#ff6b6b'}"></i></div>
      <span class="muted">Relation ${rel} · ${tuilesDe(n).length} provinces · armée ${nbUnites(n.armee)} · puissance ${puissance(n).toFixed(0)}</span>`;
      if(p.guerre.has(n.id)){
        h += `<button class="btn" data-paix="${n.id}">${ic('paix')} Proposer la paix</button>`;
      } else {
        h += `<button class="btn" data-don="${n.id}" ${bridePause('don', p.or<150)}>${ic('don')} Offrir 150 or (+15 relation)</button>
        <button class="btn" data-pacte="${n.id}" ${bridePause('pacte', p.pacte.has(n.id)||rel<15)}>${ic('pacte')} Pacte de non-agression</button>
        <button class="btn" data-alli="${n.id}" ${bridePause('alliance', p.allies.has(n.id)||rel<55)}>${ic('alliance')} Proposer une alliance ${rel<55?'(relation 55+)':''}</button>
        <button class="btn danger" data-guerre="${n.id}" ${bridePause('guerre')}>${ic('guerre')} Déclarer la guerre</button>`;
      }
    }
    h += '</div>';
  }
  const el = document.getElementById('tab-diplo');
  el.innerHTML = h;
  const N = id => S.nations[+id];
  el.querySelectorAll('[data-voir]').forEach(b=> b.onclick = ()=>{
    const n = N(b.dataset.voir); S.sel = n.capitale; centrer(n.capitale, true); });
  el.querySelectorAll('[data-don]').forEach(b=>b.onclick=()=>{
    if(!actionPermise('don')) return refuserPause();
    const n=N(b.dataset.don); p.or-=150; n.rel[p.id]=clamp(n.rel[p.id]+15,-100,100);
    p.rel[n.id]=clamp(p.rel[n.id]+5,-100,100); logue(`${ic('don')} Don offert à ${n.nom}.`); majUI(); });
  el.querySelectorAll('[data-pacte]').forEach(b=>b.onclick=()=>{
    if(!actionPermise('pacte')) return refuserPause();
    const n=N(b.dataset.pacte);
    if(n.rel[p.id]>10){ p.pacte.add(n.id); n.pacte.add(p.id);
      logue(`${ic('pacte')} Pacte de non-agression avec ${n.nom}.`,'good'); }
    else logue(`❌ ${n.nom} refuse le pacte.`,'bad');
    majUI(); });
  el.querySelectorAll('[data-alli]').forEach(b=>b.onclick=()=>{
    if(!actionPermise('alliance')) return refuserPause();
    const n=N(b.dataset.alli);
    if(n.rel[p.id]>45){ p.allies.add(n.id); n.allies.add(p.id);
      logue(`${ic('alliance')} Alliance conclue avec ${n.nom} !`,'good'); }
    else logue(`❌ ${n.nom} décline l'alliance.`,'bad');
    majUI(); });
  el.querySelectorAll('[data-guerre]').forEach(b=>b.onclick=()=>{
    if(!actionPermise('guerre')) return refuserPause();
    const n=N(b.dataset.guerre); declarerGuerre(p,n);
    // les alliés de la cible rejoignent la guerre
    for(const a of n.allies) if(a!==p.id && !p.guerre.has(a)) declarerGuerre(S.nations[a],p);
    majUI(); });
  el.querySelectorAll('[data-paix]').forEach(b=>b.onclick=()=>{
    if(!actionPermise('paix')) return refuserPause();
    const n=N(b.dataset.paix);
    if(puissance(p)>puissance(n)*0.8 || Math.random()<0.4) faireLaPaix(p,n);
    else logue(`❌ ${n.nom} refuse la paix : ils se croient plus forts.`,'bad');
    majUI(); });
}

// ----- onglet Armée -----

function panArmee(){
  const p = S.player, a = p.armee;
  let h = `<h3>Forces armées</h3>
    <div class="row"><span>Unités totales</span><span>${nbUnites(a)}</span></div>
    <div class="row"><span>Effectifs</span><span>${effectifs(a).toLocaleString('fr-FR')} hommes</span></div>
    <div class="row"><span>Puissance d'attaque</span><span>${forceAtt(a,p).toFixed(0)}</span></div>
    <div class="row"><span>Puissance défensive</span><span>${forceDef(a,p).toFixed(0)}</span></div>
    <div class="row"><span>Solde mensuelle</span><span>${coutUp(a).toFixed(1)} ${ic('or')}</span></div>
    <h3 style="margin-top:14px">Recrutement</h3>`;

  for(const k of CLES_UNITES){
    const u = UNITES[k], verrou = !uniteDispo(p,k);
    h += `<div class="card unit ${verrou?'lock':''}">
      <div class="uhead">
        <span class="uname">${ic(k)} ${u.nom}</span>
        <span class="ucount">${a[k]}</span>
      </div>
      <div class="ustats">
        <span title="Attaque">${ic('guerre')} ${u.att}</span>
        <span title="Défense">${ic('caserne')} ${u.def}</span>
        <span title="Effectif par unité">👤 ${u.hommes.toLocaleString('fr-FR')}</span>
        <span title="Entretien mensuel">${ic('or')} ${u.up}/mois</span>
      </div>
      <div class="muted">${verrou?`${ic('verrou')} Requiert la technologie « `+TECHS[u.tech].nom+' »':u.desc}</div>
      <div class="ucost">Coût unitaire : <b>${u.or}${ic('or')}</b> + <b>${u.mat}${ic('mat')}</b></div>`;
    if(!verrou){
      h += `<div class="ubuy">`;
      for(const q of [1,5,10]){
        const cher = p.or < u.or*q || p.mat < u.mat*q;
        h += `<button class="btn mini" data-buy="${k}" data-q="${q}" ${cher?'disabled':''}>+${q}</button>`;
      }
      h += `<button class="btn mini danger" data-sell="${k}" ${a[k]<1?'disabled':''}>−1</button></div>`;
    }
    h += `</div>`;
  }

  h += `<h3 style="margin-top:14px">Rapport de puissance</h3>`;
  for(const n of S.nations.filter(x=>!x.joueur && tuilesDe(x).length)){
    const r = clamp(puissance(p)/(puissance(p)+puissance(n))*100,0,100);
    h += `<div style="margin-bottom:7px">
      <span class="muted"><i class="flag" style="background:${n.col}"></i>${n.nom} — ${puissance(n).toFixed(0)} ${p.guerre.has(n.id)?'<span class="tag war">guerre</span>':''}</span>
      <div class="bar"><i style="width:${r}%;background:${r>50?'#4ad991':'#ff6b6b'}"></i></div></div>`;
  }

  const el = document.getElementById('tab-armee');
  el.innerHTML = h;
  el.querySelectorAll('[data-buy]').forEach(b=> b.onclick = ()=>{
    const k=b.dataset.buy, q=+b.dataset.q, u=UNITES[k];
    p.or -= u.or*q; p.mat -= u.mat*q; p.armee[k] += q;
    logue(`${ic('infanterie')} ${q} ${u.nom} ${q>1?'recrutées':'recrutée'} (${(u.hommes*q).toLocaleString('fr-FR')} hommes).`);
    majUI(); });
  el.querySelectorAll('[data-sell]').forEach(b=> b.onclick = ()=>{
    const k=b.dataset.sell; p.armee[k]--; p.or += UNITES[k].or*0.35; majUI(); });
}

/* ===========================================================
   MESSAGERIE
   Le panneau se redessinait entièrement à chaque rafraîchissement
   — donc à chaque mois écoulé. Toutes les bulles rejouaient leur
   animation d'apparition et le fil sautait en bas : le taux de
   rafraîchissement se voyait. On ne reconstruit plus que ce qui
   a réellement changé.
   =========================================================== */

// les interlocuteurs sont ceux qui existent encore sur la carte
const nationsSurLaCarte = ()=> S.nations.filter(n => !n.joueur && tuilesDe(n).length > 0);

const ECRIT = '<div class="bulle eux ecrit"><span></span><span></span><span></span></div>';
const echappe = t => String(t).replace(/</g,'&lt;');
const bulleHTML = m => `<div class="bulle ${m.de}">${echappe(m.txt).replace(/\n/g,'<br>')}`
  + `${m.meta ? `<div class="effets">${m.meta.map(echappe).join(' · ')}</div>` : ''}</div>`;

let _rendu = {cle:null, n:0, ecrit:false, entete:'', sugg:''};
const oublierRendu = ()=> { _rendu = {cle:null, n:0, ecrit:false, entete:'', sugg:''}; };

/* --- rendu d'une conversation, en ne touchant que le nécessaire --- */
function rendreConversation(el, v){
  const fil = document.getElementById('fil');
  const memeFil = _rendu.cle === v.cle && fil && el.contains(fil);

  const brancherSugg = ()=> el.querySelectorAll('[data-sugg]').forEach(b =>
    b.onclick = ()=> { if(!v.occupe()) v.envoyer(b.dataset.sugg); });
  const brancherEntete = ()=> {
    const r = document.getElementById('chatRetour');
    if(r) r.onclick = ()=>{ S.chatOuvert = null; oublierRendu(); majUI(); };
  };

  if(!memeFil){
    // on entre dans la conversation : construction complète
    el.innerHTML = `<div class="chattete" id="chattete">${v.entete}</div>`
      + `<div class="fil" id="fil">`
      + (v.messages.length ? '' : (v.vide || ''))
      + v.messages.map(bulleHTML).join('')
      + (v.ecrit ? ECRIT : '')
      + `</div><div class="suggestions" id="sugg">${v.sugg}</div>`
      + `<div class="saisie">`
      + `<input id="chatInput" placeholder="${v.invite}" autocomplete="off">`
      + `<button class="btn mini" id="chatEnvoi" style="flex:none">${ic('envoyer')}</button></div>`;

    const input = document.getElementById('chatInput');
    const envoi = ()=>{ const t = input.value.trim();
                        if(!t || v.occupe()) return; input.value=''; v.envoyer(t); };
    document.getElementById('chatEnvoi').onclick = envoi;
    input.onkeydown = e => { if(e.key === 'Enter') envoi(); e.stopPropagation(); };
    input.onkeyup   = e => e.stopPropagation();
    brancherEntete(); brancherSugg();
    const f = document.getElementById('fil'); f.scrollTop = f.scrollHeight;
  } else {
    // même conversation : on n'ajoute que ce qui est neuf.
    // La saisie n'est jamais touchée — le texte, le curseur et le focus survivent.
    if(v.entete !== _rendu.entete){
      document.getElementById('chattete').innerHTML = v.entete; brancherEntete();
    }
    // le lecteur qui a remonté le fil n'est pas ramené de force en bas
    const colle = fil.scrollHeight - fil.scrollTop - fil.clientHeight < 40;
    const ind = fil.querySelector('.bulle.ecrit'); if(ind) ind.remove();
    const vide = fil.querySelector('.vide');
    if(vide && v.messages.length) vide.remove();
    for(let i = _rendu.n; i < v.messages.length; i++)
      fil.insertAdjacentHTML('beforeend', bulleHTML(v.messages[i]));
    if(v.ecrit) fil.insertAdjacentHTML('beforeend', ECRIT);
    if(v.sugg !== _rendu.sugg){
      document.getElementById('sugg').innerHTML = v.sugg; brancherSugg();
    }
    if(colle || v.messages.length > _rendu.n) fil.scrollTop = fil.scrollHeight;
  }
  _rendu = {cle:v.cle, n:v.messages.length, ecrit:v.ecrit, entete:v.entete, sugg:v.sugg};
}

const puces = l => l.map(t=>`<button class="puce" data-sugg="${t.replace(/"/g,'&quot;')}">${t}</button>`).join('');

function panChat(){
  const el = document.getElementById('tab-chat');
  const p = S.player;
  const vivantes = nationsSurLaCarte();

  // l'interlocuteur a disparu de la carte : on revient à la liste
  if(S.chatOuvert !== null && S.chatOuvert !== -1){
    const n0 = S.nations[S.chatOuvert];
    if(!n0 || tuilesDe(n0).length === 0){ S.chatOuvert = null; oublierRendu(); }
  }

  // ---- liste des conversations ----
  if(S.chatOuvert === null){
    const C = etatConseil();
    const derC = C.chat[C.chat.length-1];
    // signature : on ne reconstruit la liste que si elle a changé
    const sig = 'L|' + C.nonLus + '|' + (derC ? derC.txt.length + derC.de : '') + '|'
      + vivantes.map(n => `${n.id}:${n.nonLus||0}:${Math.round(n.rel[p.id])}:`
        + `${p.guerre.has(n.id)?'g':p.allies.has(n.id)?'a':''}:`
        + `${n.chat.length}:${n.chat.length?n.chat[n.chat.length-1].txt.length:0}`).join(',');
    if(_rendu.cle === sig) return;

    let h = `<h3>${ic('chat')} Messages</h3>
      <div class="conv conseil" data-ouvrir="-1">
        <div class="convtete"><b>${ic('ia')} Conseil de la Couronne</b>
          <span>${C.nonLus ? `<span class="badge">${C.nonLus}</span>` : ''}<span class="tag ally">ton pays</span></span></div>
        <div class="muted convapercu">${derC ? (derC.de==='moi'?'toi : ':'') + echappe(derC.txt.slice(0,64))
          : 'gestion, diagnostics, prévisions, ordres — pose-lui n\'importe quelle question'}</div>
      </div>
      <p class="muted">${vivantes.length} dirigeant${vivantes.length>1?'s':''} sur la carte.
      Propose la paix, un pacte, une alliance, de l'or, ou menace-les.
      Chacun a son caractère et se souvient de tes actes.</p>`;
    for(const n of vivantes){
      const der = n.chat[n.chat.length-1];
      const r = Math.round(n.rel[p.id]);
      h += `<div class="conv" data-ouvrir="${n.id}">
        <div class="convtete">
          <b><i class="flag" style="background:${n.col}"></i>${echappe(n.nom)}</b>
          <span>${n.nonLus ? `<span class="badge">${n.nonLus}</span>` : ''}
          ${p.guerre.has(n.id)?'<span class="tag war">guerre</span>':p.allies.has(n.id)?'<span class="tag ally">allié</span>':''}</span>
        </div>
        <div class="muted convapercu">${PERSOS[n.perso].nom} · ${tuilesDe(n).length} provinces · relation ${r} ·
          ${der ? (der.de==='moi'?'toi : ':'') + echappe(der.txt.slice(0,60)) + (der.txt.length>60?'…':'')
                : 'aucun message'}</div>
      </div>`;
    }
    el.innerHTML = h;
    el.querySelectorAll('[data-ouvrir]').forEach(d => d.onclick = ()=>{
      S.chatOuvert = +d.dataset.ouvrir;
      if(S.chatOuvert === -1) etatConseil().nonLus = 0; else S.nations[S.chatOuvert].nonLus = 0;
      oublierRendu(); majUI(); });
    _rendu = {cle:sig, n:0, ecrit:false, entete:'', sugg:''};
    return;
  }

  // ---- conversation avec le Conseil ----
  if(S.chatOuvert === -1){
    const C = etatConseil(); C.nonLus = 0;
    const b = bilan(p);
    const sugg = [];
    sugg.push('Que dois-je faire en priorité ?', 'Rapport complet.',
      p.bonheur < 55 ? 'Pourquoi mon peuple est-il mécontent ?' : 'Pourquoi mon trésor évolue ainsi ?',
      'Où construire une ferme ?', 'Où en serai-je dans 24 mois ?');
    const ennemi = [...p.guerre].map(i=>S.nations[i]).filter(o=>tuilesDe(o).length)[0]
                || vivantes[0];
    if(ennemi) sugg.push(`Puis-je battre ${ennemi.nom} ?`);

    rendreConversation(el, {
      cle: 'C',
      entete: `<button class="btn mini" id="chatRetour" style="flex:none">←</button>
        <div><b>${ic('ia')} Conseil de la Couronne</b>
          <div class="muted">${Math.round(p.or)} or · ${Math.round(p.nourriture)} vivres · `
        + `bonheur ${Math.round(p.bonheur)} · ${b.nb} provinces</div></div>`,
      messages: C.chat,
      ecrit: !!C.ecrit,
      sugg: puces(sugg),
      invite: 'Parle à ton conseil…',
      vide: `<div class="bulle eux vide">Je suis ton conseil, ${echappe(p.nom)}. Demande-moi l'état du royaume,
        pourquoi un chiffre baisse, ce qu'il faut faire en priorité, où bâtir, ce que coûte une unité,
        si tu peux l'emporter contre un voisin — ou donne-moi un ordre : je l'exécute.</div>`,
      occupe: ()=> !!C.ecrit,
      envoyer: t => envoyerAuConseil(t),
    });
    return;
  }

  // ---- conversation avec une nation ----
  const n = S.nations[S.chatOuvert];
  n.nonLus = 0;
  const r = Math.round(n.rel[p.id]);
  const humeur = n.humeur > 0.65 ? 'de bonne humeur' : n.humeur < 0.3 ? 'de mauvaise humeur' : 'neutre';

  const sugg = [];
  if(n.negociation && S.mois-n.negociation.mois<=8){
    sugg.push('D\'accord, marché conclu.');
    sugg.push(`C'est trop cher, je te propose ${Math.round(n.negociation.demande*0.6)} or.`);
    sugg.push('Laisse tomber.');
  }
  if(p.guerre.has(n.id)) sugg.push('Proposons la paix.');
  if(!p.pacte.has(n.id) && !p.guerre.has(n.id)) sugg.push('Signons un pacte de non-agression.');
  if(r > 40 && !p.allies.has(n.id)) sugg.push('Concluons une alliance.');
  if(!p.guerre.has(n.id)) sugg.push('Ouvrons une route commerciale.');
  if(p.or >= 150) sugg.push('Je te donne 150 or en gage d\'amitié.');
  sugg.push('Comment va ton pays ?', 'Que veux-tu de moi ?');
  const autre = vivantes.find(o => o !== n && p.guerre.has(o.id));
  if(autre) sugg.push(`Aide-moi dans ma guerre contre ${autre.nom}.`);

  rendreConversation(el, {
    cle: 'N' + n.id,
    entete: `<button class="btn mini" id="chatRetour" style="flex:none">←</button>
      <div><b><i class="flag" style="background:${n.col}"></i>${echappe(n.nom)}</b>
        <div class="muted">${PERSOS[n.perso].nom} · ${humeur} · ${tuilesDe(n).length} provinces · relation ${r}
          ${p.guerre.has(n.id)?'<span class="tag war">guerre</span>':''}
          ${p.allies.has(n.id)?`<span class="tag ally">allié${(typeof contratAlliance==='function'&&contratAlliance(n))?` · ${contratAlliance(n).reste} mois`:''}</span>`:p.pacte.has(n.id)?'<span class="tag">pacte</span>':''}
          ${p.commerce && p.commerce.has(n.id)?'<span class="tag">commerce</span>':''}
          ${n.negociation && S.mois-n.negociation.mois<=8 ? `<span class="tag nego">offre : ${n.negociation.demande} or</span>`:''}</div></div>`,
    messages: n.chat,
    ecrit: !!n.ecrit,
    sugg: puces(sugg),
    invite: `Écris à ${echappe(n.nom)}…`,
    vide: '',
    occupe: ()=> !!n.ecrit,
    envoyer: t => envoyerMessage(n, t),
  });
}

function majBadgeChat(){
  const t = document.getElementById('tabChat');
  if(!t) return;
  // une nation disparue de la carte ne figure plus dans la liste : elle ne doit
  // pas non plus peser dans le compteur, sinon le chiffre ne correspond à rien
  const total = nationsSurLaCarte().reduce((s,n)=> s + (n.nonLus||0), 0) + (S.conseil?.nonLus||0);
  t.classList.toggle('anonlus', total > 0);
  t.dataset.nonlus = total > 9 ? '9+' : (total || '');
}

function majUI(){
  majBarre();
  ({province:panProvince, pays:panPays, tech:panTech, diplo:panDiplo, armee:panArmee, chat:panChat})[S.tab]();
  majBadgeChat();
}

/* ===========================================================
   BOUCLE DE JEU
   =========================================================== */

let MS_PAR_MOIS = 2500;

function boucle(ts){
  if(!boucle.last) boucle.last = ts;
  const dt = ts - boucle.last; boucle.last = ts;
  if(!S.paused){
    // un assaut ne doit pas coûter des mois : le temps du royaume ralentit
    S.acc += dt * S.speed * (typeof facteurTemps === 'function' ? facteurTemps() : 1);
    while(S.acc >= MS_PAR_MOIS){ S.acc -= MS_PAR_MOIS; tickMois(); }
  }
  dessiner(ts);                 // la carte est animée en continu, même en pause
  requestAnimationFrame(boucle);
}

/* ===========================================================
   PAUSE — le temps arrêté n'est pas un temps libre.
   On peut réfléchir, discuter et lever des troupes ; on ne
   peut rien faire qui change la carte ou l'économie, sinon
   il suffirait de tout mener à bien pendant que rien ne coûte.
   =========================================================== */
const PERMIS_EN_PAUSE = new Set(['recruter','dissoudre','discuter']);
const actionPermise = type => !S.paused || PERMIS_EN_PAUSE.has(type);
// 'disabled' à coller dans le HTML des boutons concernés
const bridePause = (type, dejaBride) => (dejaBride || !actionPermise(type)) ? 'disabled' : '';
let dernierRefus = 0;
function refuserPause(){
  // le mois ne s'écoule pas en pause : on tempère sur le temps réel
  if(Date.now() - dernierRefus < 2500) return false;
  dernierRefus = Date.now();
  logue(`${ic('pause')} Le temps est arrêté. En pause tu peux discuter et lever des troupes — `
      + `pour le reste, relance la partie.`, 'bad');
  return false;
}

document.getElementById('btnPause').onclick = ()=>{ S.paused = !S.paused; majVitesse(); };
document.querySelectorAll('.spd[data-speed]').forEach(b=> b.onclick = ()=>{
  S.speed = +b.dataset.speed; S.paused = false; majVitesse(); });
function majVitesse(){
  document.getElementById('btnPause').innerHTML = S.paused
    ? '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5 19.5 12 7 19.5z"/></svg>'
    : '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="4.5" width="4" height="15" rx="1"/><rect x="13.5" y="4.5" width="4" height="15" rx="1"/></svg>';
    document.getElementById('btnPause').classList.toggle('on', S.paused);
  document.querySelectorAll('.spd[data-speed]').forEach(b=>
    b.classList.toggle('on', !S.paused && +b.dataset.speed===S.speed));
  document.body.classList.toggle('enpause', S.paused);
  if(typeof majUI === 'function') majUI();     // les actions interdites s'éteignent
}
window.addEventListener('keydown', e=>{
  if(e.code==='Space'){ e.preventDefault(); S.paused=!S.paused; majVitesse(); }
});

document.getElementById('btnCenter').innerHTML = ic('monde');
document.getElementById('btnCenter').onclick = ()=> centrer(S.player.capitale || tuilesDe(S.player)[0], true);

// ---------- Démarrage ----------

function demarrer(donnees){
  if(donnees) appliquerSauvegarde(donnees); else genererMonde();
  resize();
  adapterInterface();
  construireCarte();          // cuisson du relief (heightmap continue)
  initNuages();
  toutVoir();
  majVitesse();
  majUI();
}

/* ===========================================================
   ÉCRAN DE DÉPART — on choisit son monde avant d'y régner
   =========================================================== */

const accueilEl = id => document.getElementById(id);

// une valeur illisible ne doit pas produire un NaN qui traverserait la génération
const nombreSur = (v, defaut) => Number.isFinite(+v) ? +v : defaut;

function choisirMode(cle){
  if(!MODES[cle]) return;
  CONFIG.mode = cle;
  const m = MODES[cle];
  // la partie courte propose d'emblée un monde à sa mesure
  accueilEl('sAdv').value    = m.adversaires;
  accueilEl('sIles').value   = m.iles;
  accueilEl('sTaille').value = m.taille;
  document.querySelectorAll('.accmode').forEach(b =>
    b.classList.toggle('actif', b.dataset.mode === cle));
  majApercu();
}

function lireReglages(){
  CONFIG.adversaires = clamp(nombreSur(accueilEl('sAdv').value,    6), 1, MAX_ADVERSAIRES);
  CONFIG.iles        = clamp(nombreSur(accueilEl('sIles').value,   6), 1, MAX_ILES);
  CONFIG.taille      = Math.round(clamp(nombreSur(accueilEl('sTaille').value, 2), 0, TAILLES.length-1));
}

function majApercu(){
  lireReglages();
  const p = planMonde(CONFIG);
  const cases = 3*p.rayon*p.rayon + 3*p.rayon + 1;
  accueilEl('vAdv').textContent    = CONFIG.adversaires;
  accueilEl('vIles').textContent   = CONFIG.iles;
  accueilEl('vTaille').textContent = TAILLES[CONFIG.taille].nom;

  const m = MODES[CONFIG.mode] || MODES.longue;
  const l = [];
  l.push(m.duree
    ? `<b>${m.objectif}</b> ${m.duree} mois de jeu, `
      + `soit environ ${Math.round(m.duree * m.ms / 60000)} minutes en vitesse normale — `
      + `plus le temps que tu prends à décider.`
    : `<b>${m.objectif}</b> Aucune horloge : la partie s'arrête quand tu règnes seul, ou quand tu tombes.`);
  l.push(`Un monde d'environ <b>${cases}</b> cases, dont à peu près `
       + `<b>${p.terre}</b> de terre ferme, pour <b>${p.nations}</b> nations.`);
  if(p.agrandi)
    l.push(`<em>Les îles seront agrandies :</em> la taille choisie ne suffirait pas à loger `
         + `${p.nations} capitales.`);
  if(CONFIG.iles > 1)
    l.push(`<em>Les îles sont séparées par la mer.</em> Pour passer de l'une à l'autre il faut `
         + `la <b>Navigation</b> et une flotte : les navires portent les colons et les troupes. `
         + `Jusque-là, tes voisins d'outre-mer ne sont joignables que par la parole.`);
  else
    l.push(`Une seule terre : tout le monde est voisin de tout le monde, tôt ou tard.`);
  accueilEl('accApercu').innerHTML = l.join('<br>');
}

function ouvrirAccueil(){
  accueilEl('accueil').classList.remove('hidden');
  S.paused = true; majVitesse();
  accueilEl('accCharger').classList.toggle('hidden', !localStorage.getItem(CLE_SAUV));
  majApercu();
}
function fermerAccueil(){ accueilEl('accueil').classList.add('hidden'); }

['sAdv','sIles','sTaille'].forEach(id => accueilEl(id).oninput = majApercu);
// les touches du jeu ne doivent pas agir pendant qu'on règle les curseurs
accueilEl('accueil').addEventListener('keydown', e => e.stopPropagation());

document.querySelectorAll('.accmode').forEach(b =>
  b.onclick = ()=> choisirMode(b.dataset.mode));

accueilEl('accJouer').onclick = ()=>{
  lireReglages();
  fermerAccueil();
  nouvellePartie();
};
accueilEl('accCharger').onclick = ()=>{ fermerAccueil(); charger(); };

window.addEventListener('load', ()=>{
  setTimeout(()=>{
    demarrer();
    accueilEl('chargement').classList.add('hidden');
    requestAnimationFrame(boucle);
    ouvrirAccueil();
  }, 60);
});

/* ===========================================================
   PANNEAUX REDIMENSIONNABLES
   =========================================================== */

/* ===========================================================
   MISE À L'ÉCHELLE — les panneaux sont stockés en PROPORTION
   de la fenêtre, jamais en pixels : la même partie garde donc
   la même allure d'un téléphone à un téléviseur, et supporte
   n'importe quel ratio, du 1:1 au 1:2 et au-delà.
   =========================================================== */

const DIM = {sideFrac:0.26, logFrac:0.13, sideMem:0.26, logMem:0.13};

const estPortrait = ()=> innerHeight > innerWidth;

// une proportion → des pixels, bornée pour rester utilisable à toute taille
function mesure(frac, total, minPx, maxPart){
  if(frac <= 0.001) return 0;                       // replié
  return Math.round(clamp(frac*total, Math.min(minPx, total*0.3), total*maxPart));
}

function appliquerDim(){
  const R = document.documentElement.style;
  const port = estPortrait();
  document.body.classList.toggle('portrait', port);

  const topH = (document.getElementById('topbar').offsetHeight) || 56;
  R.setProperty('--topH', topH+'px');

  if(port){
    R.setProperty('--sideW', '0px');
    R.setProperty('--sideH', mesure(DIM.sideFrac, innerHeight, 120, 0.62) + 'px');
  } else {
    R.setProperty('--sideH', '0px');
    R.setProperty('--sideW', mesure(DIM.sideFrac, innerWidth, 190, 0.60) + 'px');
  }
  R.setProperty('--logH', mesure(DIM.logFrac, innerHeight, 44, 0.40) + 'px');

  resize();                         // le canvas suit la nouvelle place disponible
  majMini();
}

/* --- la mini-carte suit l'échelle, et s'efface si la carte devient exiguë --- */
function majMini(){
  const cvm = document.getElementById('minicv');
  if(!cvm || !cvm.getContext) return;
  const aire = document.getElementById('map');
  const L = aire.clientWidth || innerWidth, H = aire.clientHeight || innerHeight;
  // trop petite pour accueillir une vignette lisible sans manger la carte
  document.body.classList.toggle('sansmini', L < 330 || H < 260);

  const l = Math.round(clamp(Math.min(L*0.22, H*0.30), 96, 300));
  const h = Math.round(l*0.74);
  if(cvm.width !== l || cvm.height !== h){
    cvm.width = l; cvm.height = h;
    // les centres n'existent qu'une fois la carte cuite
    const t0 = S.tiles.values().next().value;
    if(t0 && t0.centre && typeof preparerMini === 'function'){ preparerMini(); dessinerMini(); }
  }
}

/* --- poignées : leur axe suit l'orientation du moment --- */
function poignee(id, role){
  const h = document.getElementById(id);
  let actif = false;

  const axe = ()=> role === 'log' ? 'y' : (estPortrait() ? 'y' : 'x');

  const deplacer = e =>{
    const m = document.getElementById('main').getBoundingClientRect();
    if(role === 'log'){
      DIM.logFrac = clamp((innerHeight - e.clientY) / innerHeight, 0, 0.42);
    } else if(estPortrait()){
      DIM.sideFrac = clamp((m.bottom - e.clientY) / innerHeight, 0, 0.64);
    } else {
      DIM.sideFrac = clamp((m.right - e.clientX) / innerWidth, 0, 0.62);
    }
    appliquerDim();
  };

  h.addEventListener('mousedown', e=>{
    actif = true; h.classList.add('actif');
    document.body.classList.add('resizing');
    document.body.style.cursor = axe()==='x' ? 'ew-resize' : 'ns-resize';
    e.preventDefault();
  });
  window.addEventListener('mousemove', e=>{ if(actif) deplacer(e); });
  window.addEventListener('mouseup', ()=>{
    if(!actif) return;
    actif = false; h.classList.remove('actif');
    document.body.classList.remove('resizing'); document.body.style.cursor='';
    if(role === 'log'){ if(DIM.logFrac  > 0.02) DIM.logMem  = DIM.logFrac; }
    else             { if(DIM.sideFrac > 0.03) DIM.sideMem = DIM.sideFrac; }
  });

  // le tactile mène la même danse — sans faire pour autant une interface à part
  h.addEventListener('touchstart', e=>{ actif = true; h.classList.add('actif'); e.preventDefault(); }, {passive:false});
  window.addEventListener('touchmove', e=>{
    if(!actif || !e.touches[0]) return;
    deplacer(e.touches[0]); e.preventDefault();
  }, {passive:false});
  window.addEventListener('touchend', ()=>{ actif = false; h.classList.remove('actif'); });

  // double-clic : replier / déplier
  h.addEventListener('dblclick', ()=>{
    if(role === 'log') DIM.logFrac  = DIM.logFrac  > 0.02 ? (DIM.logMem = DIM.logFrac, 0)  : (DIM.logMem  || 0.13);
    else               DIM.sideFrac = DIM.sideFrac > 0.03 ? (DIM.sideMem = DIM.sideFrac, 0) : (DIM.sideMem || 0.26);
    appliquerDim();
  });
}

poignee('hsplit','side');
poignee('vsplit','log');
appliquerDim();

function adapterInterface(){ appliquerDim(); }

/* ===========================================================
   SAUVEGARDE
   =========================================================== */

const CLE_SAUV = 'nation-sauvegarde';

function sauvegarder(auto){
  try{
    const d = {
      v:1, mois:S.mois, cam:{...S.cam},
      nations: S.nations.map(n=>({
        id:n.id, nom:n.nom, col:n.col, joueur:n.joueur, or:n.or, mat:n.mat,
        nourriture:n.nourriture, bonheur:n.bonheur, taxe:n.taxe, sci:n.sci, rech:n.rech,
        armee:{...n.armee}, tech:[...n.tech], rel:{...n.rel}, guerre:[...n.guerre],
        allies:[...n.allies], pacte:[...n.pacte], agressivite:n.agressivite,
        commerce:[...(n.commerce||[])], perso:n.perso, humeur:n.humeur,
        memoire:n.memoire ? {...n.memoire} : null, chat:(n.chat||[]).slice(-40), nonLus:n.nonLus||0,
        croyances:n.croyances ? {...n.croyances} : null, negociation:n.negociation || null,
        confirmation:n.confirmation || null, menaceEnCours:n.menaceEnCours || null,
        allianceJusqu:n.allianceJusqu || null, allianceDebut:n.allianceDebut || null,
        chocCapitale:n.chocCapitale || null,
        ancienneCapitale: n.ancienneCapitale ? key(n.ancienneCapitale.q, n.ancienneCapitale.r) : null,
        capitale: n.capitale ? key(n.capitale.q, n.capitale.r) : null,
      })),
      conseil: S.conseil ? {chat:S.conseil.chat.slice(-30)} : null,
      prime: S.prime || null, finMois: S.finMois || 0, mode: CONFIG.mode,
      log: S.log.slice(-150),
      tiles: [...S.tiles.values()].map(t=>({
        q:t.q, r:t.r, terr:t.terr, owner:t.owner, pop:+t.pop.toFixed(2),
        blds:batiments(t), fort:t.fort, occ: t.occ ? {par:t.occ.par, val:+t.occ.val.toFixed(3), mois:t.occ.mois} : null,
      })),
    };
    localStorage.setItem(CLE_SAUV, JSON.stringify(d));
    if(!auto) logue(`${ic('pacte')} Partie sauvegardée (${dateTexte()}).`,'good');
  }catch(e){
    logue('Sauvegarde impossible : espace de stockage indisponible.','bad');
  }
}

function charger(){
  const brut = localStorage.getItem(CLE_SAUV);
  if(!brut){ modal('Aucune sauvegarde', 'Sauvegarde d\'abord une partie avec le bouton de sauvegarde.'); return; }
  S.paused = true;
  document.getElementById('chargement').classList.remove('hidden');
  setTimeout(()=>{
    try{
      demarrer(JSON.parse(brut));
      logue(`${ic('pacte')} Partie chargée — ${dateTexte()}.`,'good');
    }catch(e){
      logue('Sauvegarde illisible.','bad');
    }
    document.getElementById('chargement').classList.add('hidden');
    majVitesse();
  }, 60);
}

function appliquerSauvegarde(d){
  S.tiles = new Map(); S.nations = []; S.sel = null; S.mois = d.mois;
  for(const t of d.tiles)
    S.tiles.set(key(t.q,t.r), {q:t.q, r:t.r, terr:t.terr, owner:t.owner, pop:t.pop,
      bld:null, blds:Array.isArray(t.blds) ? t.blds.slice() : (t.bld ? [t.bld] : []),
      fort:t.fort, occ:t.occ, geo:null});
  for(const t of S.tiles.values()) rangerBatiments(t);   // le dominant se recalcule
  for(const n of d.nations){
    const nat = {...n, tech:new Set(n.tech), guerre:new Set(n.guerre),
      allies:new Set(n.allies), pacte:new Set(n.pacte), commerce:new Set(n.commerce||[]),
      capitale: n.capitale ? S.tiles.get(n.capitale) : null,
      ancienneCapitale: n.ancienneCapitale ? S.tiles.get(n.ancienneCapitale) : null};
    if(!nat.joueur) initDiplomatie(nat, nat.id);
    S.nations.push(nat);
    if(nat.joueur) S.player = nat;
  }
  Object.assign(S.cam, d.cam);
  S.chatOuvert = null;
  if(typeof oublierRendu === 'function') oublierRendu();
  S.log = Array.isArray(d.log) ? d.log : [];
  S.prime = d.prime || null;
  S.finMois = d.finMois || 0;
  if(d.mode && MODES[d.mode]){ CONFIG.mode = d.mode; MS_PAR_MOIS = MODES[d.mode].ms; }
  S.conseil = {chat:(d.conseil && d.conseil.chat) || [], nonLus:0, proposition:null};
}

function nouvellePartie(){
  S.paused = true;
  document.getElementById('chargement').classList.remove('hidden');
  setTimeout(()=>{
    document.getElementById('log').innerHTML = '';
    S.mois = 0; S.acc = 0;
    S.log = [];                 // la chronique du règne précédent ne déborde pas sur le nouveau
    S.conseil = null;           // ni la conversation du Conseil, ni son contexte
    S.chatOuvert = null; oublierRendu(); S.prime = null;
    const m = MODES[CONFIG.mode] || MODES.longue;
    MS_PAR_MOIS = m.ms;
    S.finMois = m.duree || 0;
    demarrer();
    document.getElementById('chargement').classList.add('hidden');
    logue(`${ic('monde')} <b>${dateTexte()}</b> — ${CONFIG.adversaires} adversaire`
        + `${CONFIG.adversaires>1?'s':''}, ${CONFIG.iles} île${CONFIG.iles>1?'s':''} `
        + `${TAILLES[CONFIG.taille].nom}. Ton pays est né. <kbd>Espace</kbd> pause · `
        + `<kbd>molette</kbd> zoom · <kbd>flèches</kbd> déplacer · <kbd>C</kbd> capitale · `
        + `<kbd>F</kbd> vue d'ensemble · <kbd>H</kbd> règles.`,'good');
  }, 60);
}

// icônes vectorielles dans les onglets
for(const [tab, nom] of Object.entries({province:'coloniser', pays:'monde', tech:'recherche',
                                        diplo:'alliance', armee:'guerre', chat:'chat'})){
  const b = document.querySelector(`.tab[data-tab="${tab}"]`);
  if(b) b.innerHTML = ic(nom) + '<br>' + b.textContent.trim();
}

/* ===========================================================
   PAGE DES RÈGLES
   =========================================================== */

function texteAide(){
  const u = k => `<b>${ic(k)} ${UNITES[k].nom}</b> — ${UNITES[k].att} att · ${UNITES[k].def} déf · ${UNITES[k].or} or + ${UNITES[k].mat} matériaux · ${UNITES[k].hommes.toLocaleString('fr-FR')} hommes${UNITES[k].tech?` · requiert ${TECHS[UNITES[k].tech].nom}`:''}`;
  return `
  <h1>Règles du jeu</h1>
  <p>Tu diriges un pays sur un monde généré au hasard. Six nations rivales, pilotées par l'ordinateur,
  se développent en même temps que toi. Le temps s'écoule <b>mois par mois</b> en temps réel : mets en pause
  quand tu veux avec <kbd>Espace</kbd>.</p>

  <h2>${ic('monde')} But du jeu</h2>
  <p>Faire prospérer ton pays et survivre. Tu <b>gagnes</b> si tu es la dernière nation debout,
  tu <b>perds</b> si tu perds toutes tes provinces. Entre les deux, tu joues comme tu veux :
  marchand pacifique, puissance scientifique ou conquérant.</p>

  <h2>${ic('or')} Ressources</h2>
  <div class="grille">
    <div class="bloc"><b>${ic('or')} Or</b>Revenus d'impôts et bâtiments, moins l'entretien. Si le trésor devient négatif, des unités sont dissoutes.</div>
    <div class="bloc"><b>${ic('mat')} Matériaux</b>Produits par le terrain et les mines. Nécessaires à toute construction et à chaque unité.</div>
    <div class="bloc"><b>${ic('food')} Nourriture</b>Surplus = la population grandit. Pénurie = famine et chute du bonheur.</div>
    <div class="bloc"><b>${ic('energie')} Énergie</b>Les usines en consomment, les centrales en produisent. En déficit, or et recherche chutent de 40%.</div>
    <div class="bloc"><b>${ic('recherche')} Recherche</b>Produite par les universités, elle finance les technologies.</div>
    <div class="bloc"><b>${ic('bonheur')} Bonheur</b>Dépend des impôts, de la nourriture, des guerres et des universités. Trop bas, le pays s'effondre.</div>
  </div>

  <h2>${ic('batir')} Provinces et bâtiments</h2>
  <p>Clique une province pour l'ouvrir. Chaque province accueille <b>un seul bâtiment</b> et peut être
  <b>fortifiée</b> (+10% de défense par niveau). Les terres inoccupées voisines de ton territoire peuvent être
  <b>colonisées</b> pour 120 or.</p>
  <ul>${Object.entries(BUILDINGS).map(([k,b])=>`<li>${ic(k)} <b>${b.nom}</b> — ${b.desc} (${b.or} or + ${b.mat} matériaux, entretien ${b.up}/mois)${b.tech?` · requiert ${TECHS[b.tech].nom}`:''}</li>`).join('')}</ul>

  <h2>${ic('recherche')} Recherche</h2>
  <p>Choisis une technologie : elle se termine dès que tu as accumulé assez de points. Certaines débloquent
  des bâtiments ou des unités, d'autres donnent des bonus permanents. Les IA cherchent aussi de leur côté.</p>

  <h2>${ic('alliance')} Diplomatie</h2>
  <ul>
    <li><b>${ic('don')} Offrir de l'or</b> — améliore la relation de 15 points.</li>
    <li><b>${ic('pacte')} Pacte de non-agression</b> — possible à partir d'une relation correcte ; l'IA ne t'attaquera pas.</li>
    <li><b>${ic('alliance')} Alliance</b> — à partir d'une relation de 55 ; ton allié entre en guerre avec toi.</li>
    <li><b>${ic('guerre')} Déclarer la guerre</b> — les alliés de la cible se joignent à elle et le monde entier t'en tient rigueur.</li>
    <li><b>${ic('paix')} Paix</b> — l'adversaire refuse tant qu'il se croit plus fort que toi.</li>
  </ul>

  <h2>${ic('infanterie')} Armée</h2>
  <p>Tu achètes un <b>nombre précis d'unités</b>, chacune avec son coût, son entretien mensuel et ses effectifs réels.</p>
  <ul>${CLES_UNITES.map(k=>`<li>${u(k)}</li>`).join('')}</ul>
  <p>L'aviation annule une partie des fortifications adverses, la marine donne un bonus sur les provinces
  côtières, l'infanterie encaisse, l'artillerie frappe fort mais se défend mal.</p>

  <h2>${ic('attaque')} L'invasion est progressive</h2>
  <p>Une province ne tombe pas d'un seul assaut. Chaque attaque fait <b>avancer le front</b> d'un pourcentage
  qui dépend du rapport de forces : une jauge apparaît au-dessus de la province et sa couleur vire peu à peu
  vers celle de l'envahisseur. À <b>100%</b>, la province change de mains.</p>
  <ul>
    <li>Un assaut repoussé fait <b>reculer</b> le front.</li>
    <li>Sans nouvel assaut, l'occupation <b>reflue</b> de 5% par mois — il faut maintenir la pression.</li>
    <li>La paix signée, le front se vide en quelques mois.</li>
    <li>Une province envahie ne produit presque plus rien pour son propriétaire.</li>
  </ul>

  <h2>${ic('chat')} Parler aux dirigeants</h2>
  <p>L'onglet <b>Messages</b> ouvre une vraie discussion. Écris ce que tu veux, comme tu veux :
  il n'y a ni menu de questions, ni réponses préécrites.</p>

  <h2>${ic('ia')} Comment l'IA fonctionne</h2>
  <ul>
    <li><b>Elle lit ta phrase.</b> Chaque mot est ramené à son radical puis projeté dans un espace de
      ${Object.keys(ACTES).length} intentions via un lexique de concepts (paix, force, argent, confiance, échange…).
      L'intention est trouvée par <b>similarité cosinus</b>, pas par mots-clés : « j'aimerais qu'on arrête de se battre »
      est comprise comme une demande de paix. Les fautes de frappe sont rattrapées par similarité de forme
      (« alliannce », « bonjur »), et des règles d'interprétation combinent les concepts
      (guerre + cessation = paix ; forces exhibées sans projet de paix = menace).</li>
    <li><b>Elle calcule.</b> Chaque dirigeant mesure l'état du monde — sécurité, richesse, expansion, réputation,
      rancune — pondéré selon son caractère. Pour ta proposition, il <b>projette le monde qui en résulterait</b>
      et compare les deux utilités. Il accepte si son utilité augmente.</li>
    <li><b>Elle chiffre ses prix.</b> S'il refuse, il calcule son <b>prix de réserve</b> : la somme exacte qui le
      rendrait indifférent, plus sa marge selon sa cupidité. C'est ce prix qu'il te propose — et il ne descendra
      jamais en dessous, même si tu marchandes.</li>
    <li><b>Elle se souvient et anticipe.</b> Chaque nation entretient des croyances sur toi : ta <b>fiabilité</b>
      (0–100%) et la <b>menace perçue</b>, réévaluées chaque mois selon ta croissance militaire, tes conquêtes et
      les pactes que tu respectes. Rompre un pacte est une <b>trahison qui fait le tour du monde</b> :
      toutes les cours baissent ta fiabilité, pas seulement la victime.</li>
    <li><b>Elle parle à partir de son raisonnement.</b> La réponse n'est pas choisie dans une liste : elle est
      <b>planifiée puis réalisée</b> — décision, arguments retenus parmi ceux qui ont réellement pesé dans le calcul,
      prix, contre-proposition — puis mise en mots avec le vocabulaire et le registre de son caractère. Les chiffres
      qu'il cite (coût mensuel de la guerre, gain commercial, chances de victoire, rapport de forces) sont
      <b>ses vrais calculs</b>.</li>
    <li><b>Elle a un objectif.</b> À tout moment, chaque dirigeant sait quel accord lui serait le plus profitable —
      et c'est celui-là qu'il te propose spontanément, ou qu'il te suggère quand il refuse autre chose.</li>
  </ul>
  <p>Tu peux tout lui dire : proposer la paix, un pacte, une alliance, du commerce, offrir ou réclamer de l'or,
  demander son aide contre un tiers, le menacer, l'insulter, t'excuser, le flatter, lui demander l'état de son pays
  ou son avis sur un voisin. Les <b>offres groupées</b> (« je te donne 400 or si tu signes la paix ») sont
  comprises comme une seule offre à deux volets, et le marchandage se fait en plusieurs tours.
  S'il ne comprend pas, il le dit et te propose les deux lectures possibles.</p>

  <h2>${ic('temps')} Commandes</h2>
  <div class="grille">
    <div class="bloc"><b>Temps</b><kbd>Espace</kbd> pause/reprise · boutons <kbd>0,5x</kbd> <kbd>1x</kbd> <kbd>2x</kbd> <kbd>4x</kbd>.
      En pause tout s'arrête : tu peux discuter et lever des troupes, rien d'autre.</div>
    <div class="bloc"><b>${ic('monde')} Capitale</b>La perdre coûte <b>${CHOC_CAPITALE} points de bonheur</b>,
      qui se résorbent sur ${DEUIL_CAPITALE} mois. Le siège se replie sur ta plus grande ville ;
      reprendre l'ancienne efface la moitié du deuil. <kbd>C</kbd> pour y revenir.</div>
    <div class="bloc"><b>${ic('alliance')} Alliances</b>Une alliance se plaide : donne-lui de vraies
      raisons et le prix baisse. Elle dure <b>${DUREE_ALLIANCE} mois</b>. La rompre avant terme met
      ta tête à prix : <b>${PRIME_TRAHISON} or</b> à qui t'arrache une province.</div>
    <div class="bloc"><b>${ic('guerre')} Batailles</b>Une lunette montre chaque assaut qui te concerne,
      et le temps ralentit le temps de l'action. Un second assaut fait clignoter le cadre.</div>
    <div class="bloc"><b>${ic('batir')} Provinces</b>Une province porte plusieurs ouvrages selon sa
      population et son terrain. Plus elle est <b>dédiée</b> à un même métier, plus elle y rend :
      jusqu'à +45% pour une province entièrement spécialisée.</div>
    <div class="bloc"><b>${ic('navires')} La mer</b>Pour passer d'une île à l'autre il faut la
      <b>Navigation</b>, une province côtière et des <b>navires</b> : chacun porte 3 unités.
      La portée s'étend avec l'Industrie, l'Électricité et un port. Les troupes débarquées
      frappent à 70% de leur force — une tête de pont se paie.</div>
    <div class="bloc"><b>Caméra</b><kbd>molette</kbd> zoom · <kbd>glisser</kbd> déplacer · <kbd>flèches</kbd>/<kbd>WASD</kbd> · <kbd>C</kbd> capitale · <kbd>F</kbd> tout voir</div>
    <div class="bloc"><b>Interface</b>Les poignées entre la carte, le panneau et le journal se glissent ; double-clic pour replier.</div>
    <div class="bloc"><b>Partie</b>Boutons de la barre : sauvegarder, charger, nouvelle partie. Sauvegarde automatique chaque 1<sup>er</sup> janvier.</div>
  </div>`;
}

function ouvrirAide(){
  document.getElementById('aideTexte').innerHTML = texteAide();
  document.getElementById('aide').classList.remove('hidden');
}
function fermerAide(){ document.getElementById('aide').classList.add('hidden'); }

/* ---------- branchements ---------- */
document.getElementById('btnAide').onclick = ouvrirAide;
document.getElementById('aideFermer').onclick = fermerAide;
document.getElementById('aide').onclick = e => { if(e.target.id === 'aide') fermerAide(); };
document.getElementById('btnSave').onclick = ()=> sauvegarder(false);
document.getElementById('btnLoad').onclick = charger;
document.getElementById('btnNew').onclick  = ()=> ouvrirAccueil();
document.getElementById('btnFit').onclick = ()=> toutVoir();
if(document.getElementById('combatX'))
  document.getElementById('combatX').onclick = ()=> fermerCombat();
if(document.getElementById('combatGrand'))
  document.getElementById('combatGrand').onclick = ()=>{
    Combat.grand = !Combat.grand; dimensionnerCombat();
  };
document.getElementById('btnSave').innerHTML = ic('pacte');
document.getElementById('btnLoad').innerHTML = ic('coloniser');
document.getElementById('btnNew').innerHTML  = ic('monde');
document.getElementById('btnFit').innerHTML  = ic('recherche');

window.addEventListener('keydown', e=>{
  if(e.code === 'Escape') fermerAide();
  else if(e.code === 'KeyH' && !e.repeat){
    const a = document.getElementById('aide');
    a.classList.contains('hidden') ? ouvrirAide() : fermerAide();
  }
});
