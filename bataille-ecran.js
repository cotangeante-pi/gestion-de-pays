/* ===========================================================
   LUNETTE DE CAMPAGNE
   Un petit écran montre l'assaut en cours : deux lignes de
   bannières de part et d'autre d'un front qui bouge. Rien de
   sanglant — des enseignes, un front, des rangs qui s'éclaircissent.
   Le temps ralentit le temps de l'action : un assaut ne doit pas
   coûter des mois de règne.
   =========================================================== */

const DUREE_ASSAUT   = 5600;   // ms d'animation : trois phases, lisibles
const RALENTI_FACTEUR = 0.12;  // le temps du royaume s'écoule à 12%

const Combat = {
  actif:null, file:[], depuis:0, cv:null, cx:null, anim:null,
  grand:false, sonPret:false, ctxAudio:null,
};

/* --- un carillon bref et doux : deux notes, pas d'attaque sèche --- */
function bruitAlerte(){
  if(typeof SON !== 'undefined' && !SON.actif()) return;
  try{
    if(!Combat.ctxAudio){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;
      Combat.ctxAudio = new AC();
    }
    const a = Combat.ctxAudio;
    if(a.state === 'suspended') a.resume();
    const t0 = a.currentTime;
    [660, 880].forEach((f, i)=>{
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'sine'; o.frequency.value = f;
      // enveloppe douce : montée et descente lentes, volume bas
      g.gain.setValueAtTime(0.0001, t0 + i*0.13);
      g.gain.exponentialRampToValueAtTime(0.045, t0 + i*0.13 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i*0.13 + 0.42);
      o.connect(g); g.connect(a.destination);
      o.start(t0 + i*0.13); o.stop(t0 + i*0.13 + 0.45);
    });
  }catch(e){ /* le son n'est jamais indispensable */ }
}

/* --- le temps du royaume ralentit pendant l'action --- */
function ralentirTemps(ms){
  S.ralenti = Math.max(S.ralenti || 0, (typeof performance !== 'undefined' ? performance.now() : Date.now()) + ms);
}
function facteurTemps(){
  const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  return (S.ralenti && t < S.ralenti) ? RALENTI_FACTEUR : 1;
}

/* ===========================================================
   ENTRÉE : appelée à chaque assaut résolu
   =========================================================== */
function montrerCombat(info){
  if(typeof document === 'undefined') return;
  // seuls les combats qui te concernent méritent la lunette
  if(!info || (!info.att.joueur && !info.def.joueur)) return;

  if(Combat.actif){
    Combat.file.push(info);
    clignoterAlerte();                 // un autre assaut pendant qu'on regarde
    return;
  }
  lancerCombat(info);
}

function clignoterAlerte(){
  const el = document.getElementById('combat');
  if(!el) return;
  el.classList.remove('alerte');
  void el.offsetWidth;                 // force le redémarrage de l'animation
  el.classList.add('alerte');
  bruitAlerte();
  const f = document.getElementById('combatFile');
  if(f) f.textContent = Combat.file.length ? `+${Combat.file.length} autre${Combat.file.length>1?'s':''} assaut${Combat.file.length>1?'s':''}` : '';
}

function lancerCombat(info){
  Combat.actif = info;
  Combat.depuis = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  ralentirTemps(DUREE_ASSAUT + 400);

  const el = document.getElementById('combat');
  if(!el) return;
  el.classList.remove('hidden', 'alerte');
  const titre = document.getElementById('combatTitre');
  if(titre) titre.innerHTML = `${info.att.nom} <span class="cvs">contre</span> ${info.def.nom}`;
  const lieu = document.getElementById('combatLieu');
  if(lieu) lieu.textContent = (info.debarquement ? 'Débarquement sur ' : 'Assaut sur ')
    + (typeof nomTuile === 'function' ? nomTuile(info.tuile) : 'une province');
  const f = document.getElementById('combatFile');
  if(f) f.textContent = Combat.file.length ? `+${Combat.file.length} en attente` : '';

  Combat.cv = document.getElementById('combatcv');
  Combat.cx = Combat.cv && Combat.cv.getContext ? Combat.cv.getContext('2d') : null;
  dimensionnerCombat();
  if(Combat.anim === null && typeof requestAnimationFrame === 'function')
    Combat.anim = requestAnimationFrame(animerCombat);
}

function dimensionnerCombat(){
  const cv = Combat.cv; if(!cv) return;
  const l = Combat.grand ? 520 : 260, h = Combat.grand ? 300 : 150;
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  cv.style.width = l + 'px'; cv.style.height = h + 'px';
  cv.width = Math.round(l*dpr); cv.height = Math.round(h*dpr);
  if(Combat.cx) Combat.cx.setTransform(dpr,0,0,dpr,0,0);
  cv.L = l; cv.H = h;
}

function fermerCombat(){
  Combat.actif = null;
  const el = document.getElementById('combat');
  if(el) el.classList.add('hidden');
  if(Combat.anim !== null && typeof cancelAnimationFrame === 'function')
    cancelAnimationFrame(Combat.anim);
  Combat.anim = null;
  if(Combat.file.length) lancerCombat(Combat.file.shift());
}

/* ===========================================================
   DESSIN — la bataille en trois temps, sans rien de sanglant :
   bombardement (les pièces tirent, la brèche s'ouvre), mêlée
   (les lignes se heurtent, le front glisse), poursuite (les
   troupes rapides du vainqueur talonnent le vaincu). Chaque
   type d'unité a sa silhouette ; les tombés s'estompent.
   =========================================================== */
const doux = x => x<0.5 ? 2*x*x : 1-Math.pow(-2*x+2,2)/2;      // accélère puis freine
const bornerC = (x, a, b) => Math.max(a, Math.min(b, x));
const k01C = (t, a, b) => bornerC((t - a)/(b - a), 0, 1);
const SOLS = {plaine:['#5d8a4a','#4a7039'], foret:['#3f6b3a','#2f5530'], montagne:['#7a7468','#5e594f'],
              desert:['#c9ad72','#a88d55'], cote:['#8fae6a','#6f8f52']};

// une petite troupe par type d'unité, proportionnelle à l'effectif réel
function troupes(armee, pertes, max){
  const out = [], total = CLES_UNITES.reduce((s, k) => s + (armee && armee[k] || 0), 0);
  if(!total) return out;
  const f = Math.min(1, max / total);
  for(const k of CLES_UNITES){
    const n = armee[k] || 0; if(!n) continue;
    const vus = Math.max(1, Math.round(n * f)), tombes = Math.round(vus * ((pertes && pertes[k] || 0) / n));
    for(let i=0;i<vus;i++) out.push({k, tombe: i < tombes, graine: out.length*1.7});
  }
  return out;
}

function figSoldat(cx, x, y, s, col, arme){
  cx.fillStyle = col; cx.fillRect(x - 1.6*s, y - 7*s, 3.2*s, 5*s);
  cx.fillStyle = '#e3c3a0'; cx.beginPath(); cx.arc(x, y - 8.6*s, 1.8*s, 0, 7); cx.fill();
  cx.fillStyle = '#2a2530'; cx.fillRect(x - 1.4*s, y - 2*s, 1.1*s, 2*s); cx.fillRect(x + 0.3*s, y - 2*s, 1.1*s, 2*s);
  if(arme){ cx.strokeStyle = '#3a3036'; cx.lineWidth = 0.8*s; cx.beginPath(); cx.moveTo(x + 1.5*s, y - 4*s); cx.lineTo(x + 4.5*s, y - 9*s); cx.stroke(); }
}
function figCavalier(cx, x, y, s, col, sens, t){
  const g = Math.sin(t*14)*0.8*s;
  cx.fillStyle = '#6b4a32';
  cx.beginPath(); cx.ellipse(x, y - 4*s, 5*s, 2.4*s, 0, 0, 7); cx.fill();
  cx.fillRect(x + sens*3.5*s, y - 8*s, 1.8*s*sens, 4.5*s);
  cx.strokeStyle = '#5a3d28'; cx.lineWidth = 1*s;
  cx.beginPath(); cx.moveTo(x - 3*s, y - 2*s); cx.lineTo(x - 3*s - g, y); cx.moveTo(x + 3*s, y - 2*s); cx.lineTo(x + 3*s + g, y); cx.stroke();
  cx.fillStyle = col; cx.fillRect(x - 1.2*s, y - 10*s, 2.6*s, 4*s);
  cx.fillStyle = '#e3c3a0'; cx.beginPath(); cx.arc(x + 0.1*s, y - 11.4*s, 1.5*s, 0, 7); cx.fill();
}
function figCanon(cx, x, y, s, col, sens, recul){
  const r = recul*2*s*sens;
  cx.fillStyle = '#4a3a2a'; cx.beginPath(); cx.arc(x - r, y - 1.5*s, 2.2*s, 0, 7); cx.fill();
  cx.strokeStyle = '#2e2e34'; cx.lineWidth = 2.4*s;
  cx.beginPath(); cx.moveTo(x - r - sens*2*s, y - 2*s); cx.lineTo(x - r + sens*6*s, y - 5*s); cx.stroke();
  cx.fillStyle = col; cx.fillRect(x - r - sens*5*s, y - 4*s, 2*s, 3*s);
}
function figChar(cx, x, y, s, col, sens){
  cx.fillStyle = '#3a3d44'; cx.fillRect(x - 6*s, y - 3*s, 12*s, 3*s);
  cx.fillStyle = col; cx.fillRect(x - 5*s, y - 6*s, 10*s, 3.4*s);
  cx.fillRect(x - 2.5*s, y - 8.4*s, 5*s, 2.6*s);
  cx.strokeStyle = '#2e2e34'; cx.lineWidth = 1.3*s;
  cx.beginPath(); cx.moveTo(x, y - 7*s); cx.lineTo(x + sens*8*s, y - 7.6*s); cx.stroke();
}
function figAvion(cx, x, y, s, col, sens){
  // de profil : fuselage, aile, dérive, et l'hélice qui tourne
  cx.fillStyle = '#d8dce4';
  cx.beginPath(); cx.ellipse(x, y, 8*s, 1.8*s, 0, 0, 7); cx.fill();
  cx.fillStyle = col;
  cx.beginPath(); cx.moveTo(x - sens*1*s, y); cx.lineTo(x - sens*4*s, y + 3.5*s); cx.lineTo(x + sens*1.5*s, y + 3.5*s); cx.lineTo(x + sens*3*s, y); cx.fill();
  cx.beginPath(); cx.moveTo(x - sens*6*s, y - 0.5*s); cx.lineTo(x - sens*8.5*s, y - 4.5*s); cx.lineTo(x - sens*7*s, y - 0.5*s); cx.fill();
  cx.fillStyle = 'rgba(40,40,50,.6)'; cx.fillRect(x + sens*8*s - 0.4*s, y - 3*s, 0.8*s, 6*s);
}
function figNavire(cx, x, y, s, col, t){
  const b = Math.sin(t*6)*0.8*s;
  cx.fillStyle = '#5a3d28';
  cx.beginPath(); cx.moveTo(x - 9*s, y - 3*s + b); cx.lineTo(x + 9*s, y - 3*s + b); cx.lineTo(x + 6*s, y + 1*s + b); cx.lineTo(x - 7*s, y + 1*s + b); cx.fill();
  cx.strokeStyle = '#3a2a1f'; cx.lineWidth = 1*s; cx.beginPath(); cx.moveTo(x, y - 3*s + b); cx.lineTo(x, y - 13*s + b); cx.stroke();
  cx.fillStyle = '#ece3cc'; cx.fillRect(x - 4*s, y - 12*s + b, 8*s, 6*s);
  cx.fillStyle = col; cx.fillRect(x - 4*s, y - 9.5*s + b, 8*s, 1.4*s);
}
function figure(cx, u, x, y, s, col, sens, t){
  switch(u.k){
    case 'cavalerie': return figCavalier(cx, x, y, s, col, sens, t);
    case 'artillerie': return figCanon(cx, x, y, s, col, sens, 0);
    case 'chars': return figChar(cx, x, y, s, col, sens);
    case 'avions': return;                       // en l'air : dessinés à part
    case 'navires': return;                      // au large : dessinés à part
    default: return figSoldat(cx, x, y, s, u.k === 'milice' ? '#8a7a60' : col, u.k === 'fusiliers');
  }
}
// un nuage de poussière, pas une gerbe de sang
function impact(cx, x, y, r, a){
  const g = cx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,220,150,${0.8*a})`); g.addColorStop(0.35, `rgba(200,180,150,${0.55*a})`); g.addColorStop(1, 'rgba(160,150,140,0)');
  cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();
}

function animerCombat(ts){
  Combat.anim = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(animerCombat) : null;
  const info = Combat.actif, cx = Combat.cx, cv = Combat.cv;
  if(!info || !cx || !cv) return;
  const now = ts || Date.now(), t = Math.min(1, (now - Combat.depuis) / DUREE_ASSAUT), sec = now/1000;
  const L = cv.L, H = cv.H, s = L/260;
  const sol = SOLS[info.tuile && info.tuile.terr] || SOLS.plaine;
  const cote = info.tuile && info.tuile.terr === 'cote';
  const sensA = 1;                              // l'assaillant vient de la gauche

  // --- décor : ciel, horizon, terrain, mer si la province est côtière ---
  const gc = cx.createLinearGradient(0, 0, 0, H*0.55);
  gc.addColorStop(0, '#6f93c4'); gc.addColorStop(1, '#c9d9e6');
  cx.fillStyle = gc; cx.fillRect(0, 0, L, H);
  cx.fillStyle = 'rgba(90,110,120,.5)';
  cx.beginPath(); cx.moveTo(0, H*0.5);
  for(let x=0;x<=L;x+=10) cx.lineTo(x, H*0.5 - 6*s - Math.sin(x*0.05)*4*s - Math.sin(x*0.013)*6*s);
  cx.lineTo(L, H*0.5); cx.fill();
  const gs = cx.createLinearGradient(0, H*0.48, 0, H);
  gs.addColorStop(0, sol[0]); gs.addColorStop(1, sol[1]);
  cx.fillStyle = gs; cx.fillRect(0, H*0.48, L, H);
  if(cote){
    cx.fillStyle = '#3f7fae'; cx.fillRect(0, H*0.48, L*0.16, H*0.52);
    cx.strokeStyle = 'rgba(255,255,255,.5)'; cx.lineWidth = 1*s;
    cx.beginPath(); cx.moveTo(L*0.16, H*0.48); cx.lineTo(L*0.16, H); cx.stroke();
  }
  if(info.tuile && info.tuile.terr === 'foret'){
    cx.fillStyle = '#2c4f2a';
    for(let i=0;i<9;i++){ const x = (i*37 % 260)*s, y = H*0.5 + (i%3)*3*s; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x+5*s, y-12*s); cx.lineTo(x+10*s, y); cx.fill(); }
  }

  // --- temps de la bataille ---
  const P1 = [0, 0.3], P2 = [0.3, 0.7], P3 = [0.7, 0.9];
  const k1 = k01C(t, ...P1), k2 = k01C(t, ...P2), k3 = k01C(t, ...P3);
  const phase = t < P1[1] ? 0 : t < P2[1] ? 1 : 2;

  // --- la position : murs du défenseur, qui cèdent à mesure que la brèche s'ouvre ---
  const xMur = L*0.66, sol0 = H*0.8;
  const breche = (info.breche || 0) * doux(k1);
  if(info.fortif > 0){
    const hMur = Math.min(26, 8 + info.fortif*0.35)*s;
    for(let i=0;i<7;i++){
      const casse = i >= 2 && i <= 4 ? breche : breche*0.3;
      const h = hMur * (1 - casse*0.9) * (i%2 ? 0.85 : 1);
      cx.fillStyle = '#8a8478'; cx.fillRect(xMur + i*5*s, sol0 - h, 5*s - 0.6*s, h);
      cx.fillStyle = '#6e695f'; cx.fillRect(xMur + i*5*s, sol0 - h, 5*s - 0.6*s, 1.4*s);
    }
  }

  // --- les troupes ---
  const max = Combat.grand ? 22 : 14;
  const A = troupes(info.armeeA, info.pertesA, max), D = troupes(info.armeeD, info.pertesD, max);
  // la milice locale défend aussi : quelques silhouettes grises
  for(let i=0;i<Math.min(4, Math.round((info.milice||0)/10));i++) D.push({k:'milice', tombe:false, graine:90+i});
  const gagne = info.gagne;
  // le front : il part du milieu et glisse vers le vaincu pendant la mêlée
  const xFront = L*(0.5 + (gagne ? 0.1 : -0.12)*doux(k2));
  const colA = info.att.col || '#7fb0ff', colD = info.def.col || '#ff8f8f';
  const disposer = (liste, cote2) => {
    const sol2 = liste.filter(u => u.k !== 'avions' && u.k !== 'navires');
    sol2.sort((a, b) => (a.k === 'artillerie') - (b.k === 'artillerie'));    // les pièces en arrière
    return sol2.map((u, i) => ({u, rang: i % 3, col: Math.floor(i / 3)}));
  };
  const posA = disposer(A), posD = disposer(D);
  const avance = doux(k2);
  const fuite = k3 * (gagne ? 1 : 0), deroute = k3 * (gagne ? 0 : 1);
  // l'assaillant : pièces en arrière, troupes rangées devant, qui avancent pendant la mêlée
  const pieces = posA.filter(q => q.u.k === 'artillerie'), lignes = posA.filter(q => q.u.k !== 'artillerie');
  pieces.forEach((q, i) => { q.col = i; });
  lignes.forEach((q, i) => { q.rang = i % 3; q.col = Math.floor(i / 3); });
  const nbCols = Math.max(1, Math.ceil(lignes.length / 3));
  for(const {u, rang, col} of posA){
    const artillerie = u.k === 'artillerie';
    let x = artillerie ? L*0.2 + col*9*s : xFront - 12*s - col*8*s;
    if(!artillerie) x = lerpC(L*0.3 + (nbCols - 1 - col)*8*s, x, avance)
                      + (gagne ? k3*28*s*(u.k==='cavalerie'||u.k==='chars'?1.6:0.6) : -deroute*30*s);
    const y = sol0 - 2*s - rang*7*s;
    const tombe = u.tombe && t > 0.35 + (u.graine % 1)*0.3;
    cx.globalAlpha = tombe ? 0.28 : 1;
    if(artillerie) figCanon(cx, x, y, s, colA, sensA, phase === 0 ? Math.max(0, Math.sin(sec*9 + u.graine)) : 0);
    else figure(cx, u, x, y, s, tombe ? '#777' : colA, sensA, sec + u.graine);
    cx.globalAlpha = 1;
  }
  for(const {u, rang, col} of posD){
    const artillerie = u.k === 'artillerie';
    let x = artillerie ? L*0.9 - col*7*s : lerpC(xMur + 8*s + col*7*s, xFront + 14*s + col*9*s, avance*0.6);
    if(!artillerie) x += gagne ? fuite*40*s : -deroute*0;
    const y = sol0 - 2*s - rang*7*s;
    const tombe = u.tombe && t > 0.2 + (u.graine % 1)*0.45;
    cx.globalAlpha = tombe ? 0.28 : 1;
    if(artillerie) figCanon(cx, x, y, s, colD, -1, phase === 0 ? Math.max(0, Math.sin(sec*7 + u.graine))*0.6 : 0);
    else figure(cx, u, x, y, s, tombe ? '#777' : colD, -1, sec + u.graine);
    cx.globalAlpha = 1;
  }
  // l'aviation et la flotte
  A.filter(u => u.k === 'avions').forEach((u, i) => {
    const x = lerpC(L*0.05, L*0.95, (k1*0.8 + k3*0.4 + i*0.1) % 1), y = H*0.2 + i*6*s;
    figAvion(cx, x, y, s, colA, 1);
  });
  if(cote) A.filter(u => u.k === 'navires').forEach((u, i) => figNavire(cx, L*0.07, H*0.66 + i*9*s, s, colA, sec + i));

  // --- phase 1 : les obus et les impacts sur les murs ---
  if(phase === 0){
    const pieces = A.filter(u => u.k === 'artillerie' || u.k === 'navires' || u.k === 'avions').length;
    for(let i=0;i<Math.min(6, pieces*2);i++){
      const q = (sec*0.9 + i*0.37) % 1;
      const x0 = L*0.12, x1 = xMur + 10*s + (i%3)*5*s;
      const x = lerpC(x0, x1, q), y = sol0 - 8*s - Math.sin(q*Math.PI)*H*0.35;
      cx.fillStyle = '#2a2a2a'; cx.beginPath(); cx.arc(x, y, 1.3*s, 0, 7); cx.fill();
      if(q > 0.88) impact(cx, x1, sol0 - 10*s, 12*s, (q - 0.88)/0.12);
    }
  }
  // --- phase 2 : le choc sur la ligne de front ---
  if(phase === 1){
    for(let i=0;i<4;i++){
      const a = Math.max(0, Math.sin(sec*6 + i*1.9));
      impact(cx, xFront + (i-1.5)*5*s, sol0 - 8*s - (i%2)*6*s, 7*s, a*0.6);
    }
    cx.strokeStyle = gagne ? 'rgba(126,224,208,.6)' : 'rgba(255,200,97,.6)'; cx.lineWidth = 1.5*s;
    cx.beginPath(); cx.moveTo(xFront, H*0.55); cx.lineTo(xFront, H*0.92); cx.stroke();
  }

  // --- le bandeau de la phase en cours ---
  const ph = (info.phases || [])[phase];
  const noms = ['① Bombardement', '② Mêlée', '③ Poursuite'];
  cx.fillStyle = 'rgba(8,13,23,.72)'; cx.fillRect(0, 0, L, 17*s);
  cx.font = `700 ${9*s}px "Segoe UI",system-ui,sans-serif`; cx.textAlign = 'left';
  cx.fillStyle = '#ffd978'; cx.fillText(noms[phase], 5*s, 11.5*s);
  if(ph){ const w = cx.measureText(noms[phase]).width;
    cx.fillStyle = '#c9d3e6'; cx.font = `${8*s}px "Segoe UI",system-ui,sans-serif`;
    cx.fillText('— ' + ph.texte, 5*s + w + 6*s, 11.5*s); }
  // jauges des trois phases
  for(let i=0;i<3;i++){
    const k = [k1, k2, k3][i];
    cx.fillStyle = 'rgba(255,255,255,.18)'; cx.fillRect(5*s + i*28*s, 15*s, 25*s, 1.6*s);
    cx.fillStyle = '#ffd978'; cx.fillRect(5*s + i*28*s, 15*s, 25*s*k, 1.6*s);
  }

  // le verdict, à la fin
  if(t > 0.86){
    const a = Math.min(1, (t-0.86)/0.1);
    cx.globalAlpha = a;
    cx.fillStyle = 'rgba(8,13,23,.7)'; cx.fillRect(L*0.1, H*0.28, L*0.8, 30*s);
    cx.font = `700 ${12*s}px "Segoe UI",system-ui,sans-serif`; cx.textAlign = 'center';
    cx.fillStyle = info.conquise ? '#7ee0d0' : info.gagne ? '#8fe3b4' : '#ffc861';
    cx.fillText(info.verdict || '', L/2, H*0.28 + 13*s);
    cx.font = `${7.5*s}px "Segoe UI",system-ui,sans-serif`; cx.fillStyle = '#c9d3e6';
    const pa = CLES_UNITES.reduce((x, k) => x + (info.pertesA && info.pertesA[k] || 0), 0);
    const pd = CLES_UNITES.reduce((x, k) => x + (info.pertesD && info.pertesD[k] || 0), 0);
    cx.fillText(`pertes : ${pa} unité${pa>1?'s':''} pour l'assaillant, ${pd} pour le défenseur`, L/2, H*0.28 + 24*s);
    cx.globalAlpha = 1;
  }

  if(t >= 1 && now - Combat.depuis > DUREE_ASSAUT + 1400) fermerCombat();
}
const lerpC = (a, b, k) => a + (b - a) * k;
