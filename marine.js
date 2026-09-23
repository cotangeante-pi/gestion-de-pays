/* ===========================================================
   LA MER — franchir un bras de mer.
   Sans marine, un archipel est une prison : chaque nation reste
   sur son île. Une expédition outre-mer demande trois choses :
   la Navigation, une flotte pour porter les troupes, et une
   distance de mer que cette flotte sait couvrir.
   =========================================================== */

/* --- jusqu'où une expédition peut aller, en cases d'océan --- */
function porteeNavale(n){
  if(!aTech(n, 'navigation')) return 0;
  let p = 3;                                  // cabotage : on longe les côtes
  if(aTech(n, 'industrie'))    p += 2;        // coques de fer, machines à vapeur
  if(aTech(n, 'electricite'))  p += 3;        // navigation moderne
  for(const t of tuilesDe(n)) if(aBatiment(t, 'port')){ p += 1; break; }   // une base navale
  return p;
}

/* --- combien d'unités terrestres la flotte sait porter --- */
const capaciteNavale = n => (n.armee.navires || 0) * 3;

/* --- possède-t-on seulement un accès à la mer ? --- */
const aUneCote = n => tuilesDe(n).some(t => voisins(t).some(v => v && v.terr === 'ocean'));

/* --- ce qui manque pour embarquer, dit en clair --- */
function obstacleNaval(n){
  if(!aUneCote(n))            return 'aucune de tes provinces ne touche la mer : il faut d\'abord '
                                   + 'atteindre une côte';
  if(!aTech(n, 'navigation')) return 'il faut d\'abord la technologie « Navigation »';
  if(capaciteNavale(n) < 1)   return 'il faut au moins un navire pour porter les troupes';
  return null;
}

/* ---------- cartographie des côtes atteignables ----------
   Parcours en largeur sur l'océan, au départ de toutes les côtes
   de la nation. On retient, pour chaque terre étrangère touchée,
   la plus courte traversée.                                     */
let _cacheMer = {mois:-1, par:{}};
const oublierMer = ()=> { _cacheMer = {mois:-1, par:{}}; };

function atteignablesParMer(n){
  if(_cacheMer.mois !== S.mois) _cacheMer = {mois:S.mois, par:{}};
  if(_cacheMer.par[n.id]) return _cacheMer.par[n.id];

  const out = new Map();
  const portee = porteeNavale(n);
  if(portee <= 0){ _cacheMer.par[n.id] = out; return out; }

  const file = [], vu = new Set();
  for(const t of tuilesDe(n))
    for(const v of voisins(t))
      if(v && v.terr === 'ocean' && !vu.has(v)){ vu.add(v); file.push({t:v, d:1}); }

  for(let i = 0; i < file.length; i++){
    const {t, d} = file[i];
    for(const v of voisins(t)){
      if(!v) continue;
      if(v.terr === 'ocean'){
        if(!vu.has(v) && d + 1 <= portee){ vu.add(v); file.push({t:v, d:d+1}); }
      } else if(v.owner !== n.id){
        const prec = out.get(v);
        if(prec === undefined || d < prec) out.set(v, d);
      }
    }
  }
  _cacheMer.par[n.id] = out;
  return out;
}

/* --- cette province est-elle déjà voisine par la terre ? --- */
const voisineParTerre = (n, t) => voisins(t).some(v => v && v.owner === n.id);

/* --- une cible ne relève de la marine que si la terre n'y mène pas --- */
function cibleNavale(n, t){
  if(!t || t.terr === 'ocean' || voisineParTerre(n, t)) return null;
  const d = atteignablesParMer(n).get(t);
  return d === undefined ? null : {distance:d, portee:porteeNavale(n), capacite:capaciteNavale(n)};
}

/* --- part de l'armée réellement embarquable --- */
function fracEmbarquee(n, frac){
  const total = nbUnites(n.armee), cap = capaciteNavale(n);
  if(total < 1 || cap < 1) return 0;
  return Math.min(frac, cap / total);
}
const corpsDebarquement = (n, frac) => apercuDetachement(n.armee, fracEmbarquee(n, frac));

/* ---------- colonisation outre-mer ---------- */
const COUT_COLONIE_MER = 200;                 // franchir la mer coûte plus qu'un pas de plus

function coloniesNavales(n){
  const out = [];
  for(const [t, d] of atteignablesParMer(n))
    if(t.owner === null && t.terr !== 'ocean') out.push({tuile:t, distance:d});
  return out.sort((a,b)=>a.distance-b.distance);
}

/* ---------- cibles d'invasion ---------- */
function ciblesDebarquement(n){
  const out = [];
  for(const [t, d] of atteignablesParMer(n)){
    if(t.owner === null || t.owner === n.id) continue;
    if(!n.guerre.has(t.owner)) continue;
    out.push({tuile:t, distance:d, ennemi:S.nations[t.owner]});
  }
  return out.sort((a,b)=>a.distance-b.distance);
}

/* ---------- l'IA prend la mer, elle aussi ---------- */
function iaMarine(n){
  if(obstacleNaval(n)) return;

  // s'étendre sur une île voisine quand la sienne est pleine
  if(Math.random() < 0.09 && n.or > COUT_COLONIE_MER){
    const libresTerre = tuilesDe(n).flatMap(voisins)
      .filter(v => v && v.owner === null && v.terr !== 'ocean');
    // elle part outre-mer quand sa terre est pleine — ou par ambition
    if(!libresTerre.length || Math.random() < 0.25){
      const c = coloniesNavales(n)[0];
      if(c){ c.tuile.owner = n.id; c.tuile.pop = 2; n.or -= COUT_COLONIE_MER; oublierMer();
        if(frontiereCommune(n, S.player) || S.mois % 3 === 0)
          logue(`${ic('coloniser')} <b>${n.nom}</b> fonde un comptoir outre-mer.`); }
    }
  }

  // débarquer chez un ennemi hors de portée terrestre
  if(n.guerre.size && Math.random() < 0.16 && nbUnites(n.armee) > 4){
    const parTerre = tuilesDe(n).flatMap(voisins)
      .filter(v => v && v.owner !== null && v.owner !== n.id && n.guerre.has(v.owner));
    if(!parTerre.length){
      const c = ciblesDebarquement(n)[0];
      if(c && capaciteNavale(n) >= 2)
        bataille(n, c.ennemi, c.tuile, fracEmbarquee(n, rnd(0.5, 0.9)), true);
    }
  }
}
