/* ===========================================================
   LE DÉBUT DE PARTIE
   Les premières années manquaient de buts : on attendait
   l'Écriture. Deux choses les remplissent désormais :
   - des missions de départ, pour toutes les nations, avec une
     petite récompense chacune ;
   - des découvertes semées sur les terres libres — ruines,
     tribus, gisements — que l'on met au jour en colonisant.
     Coloniser devient un choix : quelle terre d'abord ?
   =========================================================== */

const FIN_MISSIONS = 36;            // mois : passé ce délai, les missions de départ se referment

const MISSIONS = [
  {cle:'terres', nom:'Des terres pour tous', desc:'Posséder 4 provinces.',
   test: n => tuilesDe(n).length >= 4, prix:{or:100}},
  {cle:'mine', nom:'La pioche et la pelle', desc:'Bâtir une mine.',
   test: n => tuilesDe(n).some(t => aBatiment(t, 'mine')), prix:{mat:60}},
  {cle:'ecriture', nom:'Les premiers scribes', desc:'Découvrir l\'Écriture.',
   test: n => n.tech.has('ecriture'), prix:{sci:30}},
  {cle:'decouverte', nom:'Explorateurs', desc:'Mettre au jour une découverte en colonisant une terre marquée.',
   test: n => (n.decouvertes || 0) >= 1, prix:{or:60}},
  {cle:'garde', nom:'Une frontière gardée', desc:'Avoir des troupes sur deux provinces différentes.',
   test: n => new Set(corpsDe(n).map(c => c.t)).size >= 2, prix:{bonheur:5}},
  {cle:'voisin', nom:'Tendre la main', desc:'Nouer un accord de commerce ou un pacte avec une autre nation.',
   test: n => n.commerce.size > 0 || n.pacte.size > 0, prix:{or:80}},
];

function texteRecompense(r){
  return Object.entries(r).map(([k, v]) => `+${v} ${{or:'or', mat:'matériaux', sci:'recherche', bonheur:'bonheur'}[k]}`).join(', ');
}

function suivreMissions(){
  revelerDecouvertes();
  if(S.mois > FIN_MISSIONS) return;
  for(const n of S.nations){
    if(!tuilesDe(n).length) continue;
    if(!(n.missions instanceof Set)) n.missions = new Set(n.missions || []);
    for(const M of MISSIONS){
      if(n.missions.has(M.cle) || !M.test(n)) continue;
      n.missions.add(M.cle);
      for(const [k, v] of Object.entries(M.prix)){
        if(k === 'bonheur') n.bonheur = clamp(n.bonheur + v, 0, 100); else n[k] = (n[k] || 0) + v;
      }
      if(n.joueur) logue(`${ic('etoile')} Mission accomplie : <b>${M.nom}</b> — ${texteRecompense(M.prix)}.`, 'good');
    }
  }
}

function htmlMissions(){
  const p = S.player;
  if(S.mois > FIN_MISSIONS) return '';
  const faites = p.missions instanceof Set ? p.missions : new Set(p.missions || []);
  let h = `<h3 style="margin-top:14px">Premiers pas du royaume</h3>
    <p class="muted">Encore ${FIN_MISSIONS - S.mois} mois pour ces missions — chacune rapporte une récompense.</p>`;
  for(const M of MISSIONS){
    const ok = faites.has(M.cle);
    h += `<div class="row"><span>${ok ? ic('ok') : '○'} <b>${M.nom}</b> <i class="muted">${M.desc}</i></span>
      <span style="color:${ok ? '#4ad991' : '#8fa3c4'};white-space:nowrap">${texteRecompense(M.prix)}</span></div>`;
  }
  return h;
}

/* ---------- découvertes sur les terres libres ---------- */
const DECOUVERTES = {
  ruines:   {nom:'Ruines anciennes', desc:'or ou savoir enfouis'},
  tribu:    {nom:'Tribu', desc:'un peuple qui se joindra à toi'},
  gisement: {nom:'Gisement', desc:'+3 matériaux par mois, pour toujours'},
};
function semerDecouvertes(){
  const caps = new Set(S.nations.map(n => n.capitale).filter(Boolean));
  for(const t of S.tiles.values()){
    if(t.terr === 'ocean' || t.owner !== null || caps.has(t)) continue;
    if(Math.random() > 0.16) continue;
    const x = Math.random();
    t.dec = x < 0.4 ? 'ruines' : x < 0.7 ? 'tribu' : 'gisement';
  }
}
// une terre marquée qui vient d'être prise livre son secret à son nouveau maître
function revelerDecouvertes(){
  for(const t of S.tiles.values()){
    if(!t.dec || t.owner === null) continue;
    const n = S.nations[t.owner], type = t.dec;
    t.dec = null;
    if(!n) continue;
    n.decouvertes = (n.decouvertes || 0) + 1;
    let txt;
    if(type === 'ruines'){
      if(Math.random() < 0.5){ n.or += 120; txt = 'des ruines anciennes livrent un trésor : +120 or'; }
      else { n.sci += 45; txt = 'des ruines anciennes gardaient des tablettes : +45 recherche'; }
    } else if(type === 'tribu'){
      t.pop += 6; n.bonheur = clamp(n.bonheur + 3, 0, 100);
      txt = 'une tribu se joint à ton peuple : +6k habitants';
    } else {
      t.gisement = true;
      txt = 'un gisement affleure : +3 matériaux par mois dans cette province';
    }
    if(n.joueur) logue(`${ic('coloniser')} Découverte ! ${majuscule1(txt)}.`, 'good');
  }
}
const majuscule1 = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- sur la carte : des repères sur les terres qui cachent quelque chose ---------- */
function dessinerDecouvertes(t, p, z){
  if(!t.dec || t.owner !== null || z < 0.45 || typeof cx === 'undefined') return;
  const x = p.x, y = p.y - 2*z, s = z, b = Math.sin(temps*2 + t.q)*1.2*s;
  cx.fillStyle = 'rgba(8,13,23,.3)';
  cx.beginPath(); cx.ellipse(x, y + 5*s, 8*s, 2.6*s, 0, 0, 7); cx.fill();
  if(t.dec === 'ruines'){
    cx.fillStyle = '#c9c2ae';
    cx.fillRect(x - 7*s, y - 9*s, 3*s, 13*s); cx.fillRect(x + 3*s, y - 5*s, 3*s, 9*s);
    cx.fillRect(x - 8*s, y - 11*s, 9*s, 2.5*s);
  } else if(t.dec === 'tribu'){
    cx.fillStyle = '#b8864f';
    cx.beginPath(); cx.moveTo(x - 7*s, y + 4*s); cx.lineTo(x, y - 9*s); cx.lineTo(x + 7*s, y + 4*s); cx.fill();
    cx.fillStyle = `rgba(255,170,70,${0.7 + 0.3*Math.sin(temps*9)})`;
    cx.beginPath(); cx.arc(x + 9*s, y + 2*s, 2*s, 0, 7); cx.fill();
  } else {
    cx.fillStyle = '#7fd6ff';
    cx.beginPath(); cx.moveTo(x, y - 9*s + b); cx.lineTo(x + 5*s, y - 2*s + b); cx.lineTo(x, y + 4*s + b); cx.lineTo(x - 5*s, y - 2*s + b); cx.fill();
    cx.fillStyle = 'rgba(255,255,255,.7)'; cx.fillRect(x - 1*s, y - 6*s + b, 1.6*s, 3*s);
  }
}
