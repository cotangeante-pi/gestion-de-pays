/* ===========================================================
   LUNETTE DE CAMPAGNE
   Un petit écran montre l'assaut en cours : deux lignes de
   bannières de part et d'autre d'un front qui bouge. Rien de
   sanglant — des enseignes, un front, des rangs qui s'éclaircissent.
   Le temps ralentit le temps de l'action : un assaut ne doit pas
   coûter des mois de règne.
   =========================================================== */

const DUREE_ASSAUT   = 3400;   // ms d'animation
const RALENTI_FACTEUR = 0.12;  // le temps du royaume s'écoule à 12%

const Combat = {
  actif:null, file:[], depuis:0, cv:null, cx:null, anim:null,
  grand:false, sonPret:false, ctxAudio:null,
};

/* --- un carillon bref et doux : deux notes, pas d'attaque sèche --- */
function bruitAlerte(){
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
   DESSIN — abstrait et lisible : des enseignes, un front.
   =========================================================== */
function animerCombat(ts){
  Combat.anim = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(animerCombat) : null;
  const info = Combat.actif, cx = Combat.cx, cv = Combat.cv;
  if(!info || !cx || !cv) return;

  const t = Math.min(1, ((ts || Date.now()) - Combat.depuis) / DUREE_ASSAUT);
  const L = cv.L, H = cv.H;
  const doux = x => x<0.5 ? 2*x*x : 1-Math.pow(-2*x+2,2)/2;      // accélère puis freine

  cx.clearRect(0,0,L,H);
  // ciel et sol, sobres
  const g = cx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#0d1626'); g.addColorStop(1,'#111d2e');
  cx.fillStyle = g; cx.fillRect(0,0,L,H);
  cx.fillStyle = '#16233a'; cx.fillRect(0, H*0.72, L, H*0.28);

  // le front : il part du milieu et glisse vers sa position finale
  const depart = 0.5 - (info.occAvant || 0) * 0.32;
  const arrivee = 0.5 - (info.occApres || 0) * 0.32;
  const xf = L * (depart + (arrivee - depart) * doux(t));

  // fortifications du défenseur
  if(info.fortif > 0){
    const solide = 1 - 0.5*doux(t)*(info.gagne ? 1 : 0.2);
    cx.globalAlpha = 0.85;
    cx.fillStyle = '#3a4a66';
    const hx = Math.min(28, 8 + info.fortif*0.35);
    for(let i=0;i<5;i++){
      const y = H*0.72 - (i%2?hx*0.5:hx)*solide;
      cx.fillRect(xf + 14 + i*7, y, 5, H*0.72 - y);
    }
    cx.globalAlpha = 1;
  }

  // deux troupes : des enseignes, pas des corps
  const rangs = (col, x0, sens, nb, perte)=>{
    const vivants = Math.max(1, Math.round(nb * (1 - perte*doux(t))));
    for(let i=0;i<vivants;i++){
      const ligne = i % 3, col2 = Math.floor(i/3);
      const x = x0 + sens*(col2*11 + ligne*3) + sens*doux(t)*(L*0.06);
      const y = H*0.72 - 10 - ligne*9;
      cx.fillStyle = col;
      cx.fillRect(x - 2, y - 11, 2, 11);                 // hampe
      cx.beginPath();                                     // bannière
      cx.moveTo(x, y-11); cx.lineTo(x + sens*7, y-8); cx.lineTo(x, y-5);
      cx.closePath(); cx.fill();
      cx.globalAlpha = 0.45; cx.fillRect(x-3, y, 4, 3); cx.globalAlpha = 1;  // socle
    }
  };
  const nbA = Math.min(21, Math.max(3, Math.round((info.nbA||6))));
  const nbD = Math.min(21, Math.max(3, Math.round((info.nbD||6))));
  rangs(info.att.col || '#7fb0ff', xf - 24, -1, nbA, info.partA || 0.2);
  rangs(info.def.col || '#ff8f8f', xf + 24, 1, nbD, info.partD || 0.2);

  // la ligne de front
  cx.strokeStyle = info.gagne ? '#7ee0d0' : '#ffc861';
  cx.globalAlpha = 0.5 + 0.3*Math.sin(t*10);
  cx.lineWidth = 2; cx.beginPath();
  cx.moveTo(xf, H*0.18); cx.lineTo(xf, H*0.78); cx.stroke();
  cx.globalAlpha = 1;

  // le verdict, à la fin
  if(t > 0.72){
    const a = Math.min(1, (t-0.72)/0.2);
    cx.globalAlpha = a;
    cx.font = `700 ${Combat.grand?18:13}px "Segoe UI",system-ui,sans-serif`;
    cx.textAlign = 'center';
    cx.fillStyle = info.conquise ? '#7ee0d0' : info.gagne ? '#8fe3b4' : '#ffc861';
    cx.fillText(info.verdict || '', L/2, H*0.16);
    cx.font = `${Combat.grand?13:10}px "Segoe UI",system-ui,sans-serif`;
    cx.fillStyle = '#8fa3c4';
    cx.fillText(info.detail || '', L/2, H*0.16 + (Combat.grand?20:15));
    cx.globalAlpha = 1;
  }

  if(t >= 1 && (ts||Date.now()) - Combat.depuis > DUREE_ASSAUT + 900) fermerCombat();
}
