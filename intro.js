/* ===========================================================
   INTRODUCTION — « Le départ »
   Un meneur rallie les siens, ils prennent la mer, débarquent
   sur une île… et découvrent qu'ils ne sont pas seuls. Puis la
   caméra recule jusqu'à la vraie carte : le jeu commence.
   Tout est dessiné à la volée, sans image ni vidéo.
   =========================================================== */

(function(){

const DUREE = 45;               // secondes, dézoom compris
const DEBUT_DEZOOM = 39;

const Intro = {
  actif: false, anim: null, t0: 0, decalage: 0, tPrec: 0,
  fin: null, cv: null, cx: null, W: 0, H: 0, s: 1,
  cam: null, texte: '',
};

/* ---------- petits outils ---------- */
const borne = (x, a, b) => Math.max(a, Math.min(b, x));
const k01   = (t, a, b) => borne((t - a) / (b - a), 0, 1);
const doux  = x => x<0.5 ? 2*x*x : 1-Math.pow(-2*x+2,2)/2;      // accélère puis freine
const lerp  = (a, b, k) => a + (b - a) * k;
const rgb   = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
const mix   = (a, b, k) => { const A = rgb(a), B = rgb(b);
  return `rgb(${A.map((v,i)=>Math.round(lerp(v,B[i],k))).join(',')})`; };
const teinte = (h, f, a=1) => `rgba(${rgb(h).map(v=>borne(v*f,0,255)|0).join(',')},${a})`;
const echap = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// la scène est pensée sur une toile de 1000 × 620, centrée ; le décor déborde
const X = u => Intro.W/2 + u*Intro.s;
const Y = v => Intro.H/2 + v*Intro.s;
const HORIZON = 30;

// étoiles fixes d'une partie à l'autre
const ETOILES = Array.from({length:70}, (_, i) => {
  const a = Math.sin(i*127.1)*43758.5453, b = Math.sin(i*311.7)*24634.6345;
  return {u:(a-Math.floor(a))*1800-900, v:-320 + (b-Math.floor(b))*330, p:i};
});
// la foule : chacun a son allure — peau, cheveux, habit, coiffe, bagage
const h01 = n => { const a = Math.sin(n*91.7 + 13.1)*43758.5453; return a - Math.floor(a); };
const HABITS  = ['#7a4e3a','#4f6a82','#8a7350','#6a4a5e','#4c6b52','#8c5a3c','#5a5f7e','#9a7a4a','#6e3f3f','#3f6070'];
const BAS     = ['#3a3440','#4a3c30','#2e3848','#5a4a3a','#40362c'];
const PEAUX   = ['#f1d2b6','#e3b892','#c89066','#9c6a46','#6e4630'];
const CHEVEUX = ['#2a1d14','#4a3020','#6b4a2a','#15100c','#8a6a40','#a89a88','#7a3a1a'];
const COIFFES = ['aucune','aucune','bonnet','foulard','chapeau','aucune'];
const FOULE = Array.from({length:16}, (_, i) => {
  const robe = h01(i*3.3) > 0.55;
  return {
    // place autour du meneur, les rangs proches sont plus grands
    u: -330 + (i%6)*42 + (Math.floor(i/6)%2)*20,
    v: 104 + Math.floor(i/6)*30 + (i%3)*4,
    habit: HABITS[i % HABITS.length], bas: BAS[i % BAS.length],
    peau: PEAUX[Math.floor(h01(i*5.7)*PEAUX.length)],
    cheveux: CHEVEUX[Math.floor(h01(i*7.1)*CHEVEUX.length)],
    robe, longs: robe && h01(i*2.9) > 0.3,
    coiffe: robe ? (h01(i*4.4) > 0.5 ? 'foulard' : 'aucune') : COIFFES[Math.floor(h01(i*6.3)*COIFFES.length)],
    coiffeCol: HABITS[(i*3 + 2) % HABITS.length],
    baluchon: h01(i*8.8) > 0.5, enfant: i === 4 || i === 13,
    taille: 0.93 + h01(i*9.9)*0.14, phase: i*1.7, enthousiasme: h01(i*1.9),
  };
});
const CHEF = {habit:'#3a3446', bas:'#2a2430', peau:'#e3b892', cheveux:'#2a1d14', robe:false, longs:false,
              coiffe:'tricorne', coiffeCol:'#241e2a', baluchon:false, enfant:false, taille:1.28, phase:0.4,
              barbe:true, chef:true};

/* ---------- lumière ---------- */
const alea = n => { const a = Math.sin(n*127.1 + 311.7)*43758.5453; return a - Math.floor(a); };
// d'où vient la lumière de la scène : couleur du reflet sur les silhouettes, et de quel côté
const LUM = {col:'#ffb27a', cote:1, nuit:0};

function halo(x, y, r, col, a){
  if(a <= 0 || r <= 0) return;
  const c = Intro.cx, g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, teinte(col, 1, a)); g.addColorStop(0.35, teinte(col, 1, a*0.35)); g.addColorStop(1, teinte(col, 1, 0));
  c.save(); c.globalCompositeOperation = 'lighter';
  c.fillStyle = g; c.fillRect(x-r, y-r, 2*r, 2*r); c.restore();
}
function astre(u, v, r, coeur, bord, a=1){
  const c = Intro.cx, x = X(u), y = Y(v), R = r*Intro.s;
  halo(x, y, R*9, bord, 0.28*a);
  halo(x, y, R*3.2, coeur, 0.45*a);
  const g = c.createRadialGradient(x - R*0.3, y - R*0.3, R*0.1, x, y, R);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, coeur); g.addColorStop(1, bord);
  c.globalAlpha = a; c.fillStyle = g; c.beginPath(); c.arc(x, y, R, 0, 7); c.fill(); c.globalAlpha = 1;
}
// rais de lumière qui tombent du soleil
function rayons(u, v, t, col, a){
  const c = Intro.cx, x = X(u), y = Y(v), L = Math.max(Intro.W, Intro.H)*1.5;
  c.save(); c.globalCompositeOperation = 'lighter';
  for(let i=0;i<8;i++){
    const ang = 0.35 + i*0.13 + Math.sin(t*0.25 + i)*0.02, lg = 0.018 + alea(i)*0.03;
    const g = c.createLinearGradient(x, y, x + Math.cos(ang)*L, y + Math.sin(ang)*L);
    g.addColorStop(0, teinte(col, 1, a*(0.5 + 0.5*alea(i+9)))); g.addColorStop(1, teinte(col, 1, 0));
    c.fillStyle = g; c.beginPath(); c.moveTo(x, y);
    c.lineTo(x + Math.cos(ang-lg)*L, y + Math.sin(ang-lg)*L);
    c.lineTo(x + Math.cos(ang+lg)*L, y + Math.sin(ang+lg)*L); c.fill();
  }
  c.restore();
}

/* ---------- ciel ---------- */
function ciel(haut, milieu, bas){
  const c = Intro.cx, g = c.createLinearGradient(0, 0, 0, Y(HORIZON));
  g.addColorStop(0, haut); g.addColorStop(0.55, milieu); g.addColorStop(1, bas);
  c.fillStyle = g; c.fillRect(0, 0, Intro.W, Y(HORIZON) + 1);
}
function etoiles(t, a){
  if(a <= 0) return;
  const c = Intro.cx;
  for(const e of ETOILES){
    const b = a * (0.45 + 0.55*Math.sin(t*2 + e.p));
    c.globalAlpha = b; c.fillStyle = '#eef2ff';
    const r = (0.6 + alea(e.p)*1.1)*Intro.s;
    c.beginPath(); c.arc(X(e.u), Y(e.v), Math.max(0.6, r), 0, 7); c.fill();
    if(alea(e.p+3) > 0.85) halo(X(e.u), Y(e.v), 6*Intro.s, '#c8d4ff', b*0.5);
  }
  c.globalAlpha = 1;
}
function etoileFilante(t, t0, a){
  const k = k01(t, t0, t0 + 0.9);
  if(k <= 0 || k >= 1 || a <= 0) return;
  const c = Intro.cx, x = X(lerp(-500, -120, k)), y = Y(lerp(-280, -170, k));
  const g = c.createLinearGradient(x, y, x - 90*Intro.s, y - 26*Intro.s);
  g.addColorStop(0, `rgba(255,255,255,${a*(1-k)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.strokeStyle = g; c.lineWidth = 1.6*Intro.s;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x - 90*Intro.s, y - 26*Intro.s); c.stroke();
}
const NUAGES = Array.from({length:10}, (_, i) => ({
  u: -1000 + i*220 + alea(i)*120, v: -270 + alea(i+7)*190, w: 70 + alea(i+3)*120, vit: 3 + alea(i+5)*7,
}));
function nuages(t, clair, ombre, a){
  const c = Intro.cx;
  for(const n of NUAGES){
    const u = ((n.u + t*n.vit + 1200) % 2400) - 1200;
    const g = c.createLinearGradient(0, Y(n.v - n.w*0.35), 0, Y(n.v + n.w*0.18));
    g.addColorStop(0, clair); g.addColorStop(1, ombre);
    c.globalAlpha = a; c.fillStyle = g;
    c.beginPath();
    for(let k=0;k<6;k++){
      const du = (k - 2.5)*n.w*0.28, dv = -Math.sin((k/5)*Math.PI)*n.w*0.16 + (alea(n.u + k) - 0.5)*n.w*0.08;
      const r = n.w*(0.2 + 0.14*Math.sin((k/5)*Math.PI));
      c.moveTo(X(u + du + r), Y(n.v + dv));
      c.ellipse(X(u + du), Y(n.v + dv), r*Intro.s, r*0.62*Intro.s, 0, 0, 7);
    }
    c.fill();
  }
  c.globalAlpha = 1;
}
function oiseaux(t, n, u0, v0, col){
  const c = Intro.cx, s = Intro.s;
  c.strokeStyle = col; c.lineWidth = 1.6*s; c.lineCap = 'round';
  for(let i=0;i<n;i++){
    const u = ((u0 + i*55 + t*(26 + i*3) + 900) % 1800) - 900;
    const v = v0 + Math.sin(t*0.7 + i*1.3)*14 + (i%3)*16;
    const ai = Math.sin(t*7 + i*2.1)*5, sc = 0.7 + alea(i)*0.6;
    c.beginPath();
    c.moveTo(X(u - 8*sc), Y(v - ai*sc)); c.quadraticCurveTo(X(u - 3*sc), Y(v - 2), X(u), Y(v));
    c.quadraticCurveTo(X(u + 3*sc), Y(v - 2), X(u + 8*sc), Y(v - ai*sc)); c.stroke();
  }
}
// une chaîne de collines lointaines, voilée par la brume
function relief(v, hauteur, col, graine, du=0){
  const c = Intro.cx, W = Intro.W;
  c.fillStyle = col; c.beginPath(); c.moveTo(-4, Y(v));
  for(let x=-4; x<=W+8; x+=6){
    const u = (x - W/2)/Intro.s - du;
    const h = 0.5 + Math.sin(u*0.009 + graine)*0.28 + Math.sin(u*0.023 + graine*2)*0.15 + Math.sin(u*0.061 + graine*3)*0.07;
    c.lineTo(x, Y(v - h*hauteur));
  }
  c.lineTo(W+8, Y(v)); c.closePath(); c.fill();
}
function brume(col, a){
  const c = Intro.cx, y = Y(HORIZON), g = c.createLinearGradient(0, y - 70*Intro.s, 0, y + 30*Intro.s);
  g.addColorStop(0, teinte(col, 1, 0)); g.addColorStop(0.7, teinte(col, 1, a)); g.addColorStop(1, teinte(col, 1, 0));
  c.fillStyle = g; c.fillRect(0, y - 70*Intro.s, Intro.W, 100*Intro.s);
}

/* ---------- mer ---------- */
function mer(t, haut, bas, reflet, decale=0){
  const c = Intro.cx, W = Intro.W, H = Intro.H, y0 = Y(HORIZON);
  const g = c.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, haut); g.addColorStop(1, bas);
  c.fillStyle = g; c.fillRect(0, y0, W, H - y0);
  // houle en couches : plus proche = plus ample et plus rapide
  for(let k=0;k<8;k++){
    const v = HORIZON + 6 + k*k*5.2, amp = (0.8 + k*1.2)*Intro.s, lg = (46 + k*30)*Intro.s;
    const vit = (14 + k*16) * Intro.s;
    c.strokeStyle = reflet; c.globalAlpha = 0.10 + k*0.045; c.lineWidth = Math.max(0.7, (0.6 + k*0.42)*Intro.s);
    c.beginPath();
    for(let x=-20; x<=W+20; x+=5){
      const ph = (x + t*vit + decale*Intro.s*(0.3 + k*0.14) + k*97) / lg * Math.PI*2;
      const y = Y(v) + (Math.sin(ph) + 0.35*Math.sin(ph*2.3 + k)) * amp;
      x === -20 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
  }
  c.globalAlpha = 1;
}
// la traînée scintillante d'un astre sur l'eau
function colonne(t, u, largeur, col, force){
  if(force <= 0) return;
  const c = Intro.cx, s = Intro.s;
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = col;
  for(let i=0;i<46;i++){
    const k = i/46, v = HORIZON + 1.5 + k*k*300;
    const w = largeur*(0.25 + k*1.6)*(0.45 + 0.55*Math.abs(Math.sin(t*2.1 + i*1.7)));
    const dx = Math.sin(t*1.3 + i*0.9)*10*k;
    c.globalAlpha = force*(1 - k*0.85)*(0.35 + 0.65*Math.abs(Math.sin(t*3.3 + i*2.3)));
    c.fillRect(X(u + dx) - w*s/2, Y(v), w*s, Math.max(1, (0.8 + k*2.6)*s));
  }
  c.restore();
}
function paillettes(t, col, a, n=70){
  if(a <= 0) return;
  const c = Intro.cx;
  c.fillStyle = col;
  for(let i=0;i<n;i++){
    const b = Math.sin(t*3 + i*7.3);
    if(b < 0.6) continue;
    const u = ((alea(i)*1800 - 900 + t*12*(1 + alea(i+2))) % 1800 + 1800) % 1800 - 900;
    const v = HORIZON + 4 + Math.pow(alea(i+5), 1.6)*280;
    c.globalAlpha = a*(b - 0.6)*2.5;
    const r = (0.8 + (v - HORIZON)/120)*Intro.s;
    c.fillRect(X(u) - r, Y(v), r*2.2, Math.max(1, r*0.5));
  }
  c.globalAlpha = 1;
}

/* ---------- décor à terre ---------- */
function maisons(t){
  const c = Intro.cx, s = Intro.s;
  for(let i=0;i<7;i++){
    const u = -760 + i*95, l = 60 + (i*37)%30, h = 38 + (i*53)%26, v = 78 + (i%2)*6;
    const g = c.createLinearGradient(X(u), 0, X(u + l), 0);
    g.addColorStop(0, '#2a2334'); g.addColorStop(1, '#1a1622');
    c.fillStyle = g; c.fillRect(X(u), Y(v - h), l*s, h*s);
    // toit, bordé par la lumière du couchant
    c.fillStyle = '#16121d';
    c.beginPath(); c.moveTo(X(u-6), Y(v-h)); c.lineTo(X(u + l/2), Y(v-h-24)); c.lineTo(X(u+l+6), Y(v-h)); c.fill();
    c.strokeStyle = teinte(LUM.col, 1, 0.35); c.lineWidth = 1.2*s;
    c.beginPath(); c.moveTo(X(u + l/2), Y(v-h-24)); c.lineTo(X(u+l+6), Y(v-h)); c.stroke();
    // cheminée et sa fumée
    if(i % 2 === 0){
      c.fillStyle = '#16121d'; c.fillRect(X(u + l*0.7), Y(v - h - 22), 6*s, 12*s);
      fumee(u + l*0.7 + 3, v - h - 22, t, i*0.31, 0.22);
    }
    // fenêtres éclairées qui vacillent
    const f = 0.8 + 0.2*Math.sin(t*6 + i*3.1)*Math.sin(t*2.3 + i);
    for(const fx of [0.22, 0.62]){
      c.fillStyle = `rgba(255,196,110,${0.85*f})`;
      c.fillRect(X(u + l*fx), Y(v - h*0.62), 8*s, 9*s);
      halo(X(u + l*fx + 4), Y(v - h*0.62 + 4.5), 22*s, '#ffb45a', 0.35*f);
    }
  }
}
function lanterne(u, v, t, graine){
  const c = Intro.cx, s = Intro.s, f = 0.75 + 0.25*Math.sin(t*9 + graine)*Math.sin(t*3.7 + graine*2);
  c.strokeStyle = '#1a141c'; c.lineWidth = 2.2*s;
  c.beginPath(); c.moveTo(X(u), Y(v)); c.lineTo(X(u), Y(v - 46)); c.lineTo(X(u + 8), Y(v - 46)); c.stroke();
  c.fillStyle = `rgba(255,210,130,${f})`; c.fillRect(X(u + 5), Y(v - 44), 6*s, 8*s);
  halo(X(u + 8), Y(v - 40), 60*s, '#ffae55', 0.45*f);
}
function tonneau(u, v, sc=1){
  const c = Intro.cx, s = Intro.s*sc, g = c.createLinearGradient(X(u) - 8*s, 0, X(u) + 8*s, 0);
  g.addColorStop(0, '#3a2819'); g.addColorStop(0.35, '#7a5534'); g.addColorStop(1, '#2a1c12');
  c.fillStyle = g; c.beginPath(); c.ellipse(X(u), Y(v) - 10*s, 8*s, 11*s, 0, 0, 7); c.fill();
  c.strokeStyle = '#1b130c'; c.lineWidth = 1.3*s;
  for(const dy of [-17, -3]){ c.beginPath(); c.moveTo(X(u) - 7.4*s, Y(v) + dy*s); c.lineTo(X(u) + 7.4*s, Y(v) + dy*s); c.stroke(); }
}
function palmier(u, v, t, sc=1){
  const c = Intro.cx, s = Intro.s*sc, bal = Math.sin(t*1.3 + u)*3*sc;
  const tx = X(u + 4*sc + bal), ty = Y(v - 78*sc);
  // ombre portée sur le sable
  c.fillStyle = 'rgba(80,60,30,.22)';
  c.beginPath(); c.ellipse(X(u) + 34*s*LUM.cote*-1, Y(v) + 3*s, 40*s, 5*s, 0, 0, 7); c.fill();
  // tronc annelé
  const g = c.createLinearGradient(X(u) - 4*s, 0, X(u) + 4*s, 0);
  g.addColorStop(0, '#6b5238'); g.addColorStop(1, '#3b2c1c');
  c.strokeStyle = g; c.lineWidth = 6*s; c.lineCap = 'round';
  c.beginPath(); c.moveTo(X(u), Y(v)); c.quadraticCurveTo(X(u + 8*sc), Y(v - 40*sc), tx, ty); c.stroke();
  c.strokeStyle = 'rgba(30,20,10,.35)'; c.lineWidth = 1*s;
  for(let k=1;k<9;k++){
    const q = k/9, x = lerp(X(u), tx, q) + Math.sin(q*Math.PI)*6*s, y = lerp(Y(v), ty, q);
    c.beginPath(); c.moveTo(x - 3*s, y); c.lineTo(x + 3*s, y + 1*s); c.stroke();
  }
  // palmes, en deux tons
  for(let i=0;i<7;i++){
    const a = -Math.PI/2 + (i-3)*0.52 + Math.sin(t*1.7 + i)*0.04;
    const ex = tx + Math.cos(a)*50*s, ey = ty + Math.sin(a)*50*s + 18*s;
    c.fillStyle = i%2 ? '#2f6a3c' : '#24552f';
    c.beginPath(); c.moveTo(tx, ty);
    c.quadraticCurveTo(tx + Math.cos(a-0.35)*32*s, ty + Math.sin(a-0.35)*32*s - 8*s, ex, ey);
    c.quadraticCurveTo(tx + Math.cos(a+0.3)*26*s, ty + Math.sin(a+0.3)*26*s, tx, ty);
    c.fill();
    c.strokeStyle = 'rgba(200,240,170,.25)'; c.lineWidth = 0.8*s;
    c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(tx + Math.cos(a-0.1)*30*s, ty + Math.sin(a-0.1)*30*s - 4*s, ex, ey); c.stroke();
  }
  c.fillStyle = '#4a3218';
  for(let k=0;k<3;k++){ c.beginPath(); c.arc(tx + (k-1)*3.4*s, ty + 3*s, 2.6*s, 0, 7); c.fill(); }
}
function touffe(u, v, t, sc=1){
  const c = Intro.cx, s = Intro.s*sc;
  c.strokeStyle = '#4f7a3a'; c.lineWidth = 1.3*s; c.lineCap = 'round';
  for(let k=0;k<7;k++){
    const a = -Math.PI/2 + (k-3)*0.22 + Math.sin(t*2 + k + u)*0.05;
    c.beginPath(); c.moveTo(X(u), Y(v)); c.lineTo(X(u) + Math.cos(a)*12*s, Y(v) + Math.sin(a)*12*s); c.stroke();
  }
}
function fumee(u, v, t, graine, force=0.35){
  const c = Intro.cx, s = Intro.s;
  for(let i=0;i<9;i++){
    const age = ((t*0.32 + i/9 + graine) % 1);
    const r = (3 + age*11)*s;
    const x = X(u + Math.sin(age*5 + graine*9)*6 + age*18), y = Y(v - age*80);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(215,215,225,${force*(1-age)})`); g.addColorStop(1, 'rgba(215,215,225,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
}
function petitDrapeau(u, v, h, col, t, graine=0){
  const c = Intro.cx, s = Intro.s;
  c.strokeStyle = '#d8d8de'; c.lineWidth = Math.max(1, h*0.07*s);
  c.beginPath(); c.moveTo(X(u), Y(v)); c.lineTo(X(u), Y(v-h)); c.stroke();
  const w = h*0.66*s, x = X(u), y = Y(v-h), H = h*0.34*s;
  // tissu en bandes : chaque bande ondule et prend la lumière différemment
  const N = 10;
  for(let k=0;k<N;k++){
    const q0 = k/N, q1 = (k+1)/N;
    const o0 = Math.sin(t*4 + graine - q0*5)*h*0.06*s*q0, o1 = Math.sin(t*4 + graine - q1*5)*h*0.06*s*q1;
    const ecl = 0.8 + 0.3*Math.cos(t*4 + graine - q0*5);
    c.fillStyle = teinte(col, ecl);
    c.beginPath();
    c.moveTo(x + w*q0, y + o0 + H*0.06*q0); c.lineTo(x + w*q1 + 0.5, y + o1 + H*0.06*q1);
    c.lineTo(x + w*q1 + 0.5, y + o1 + H*(1 - 0.2*q1)); c.lineTo(x + w*q0, y + o0 + H*(1 - 0.2*q0));
    c.closePath(); c.fill();
  }
  c.fillStyle = '#e8d9a0'; c.beginPath(); c.arc(x, y - 1.5*s, Math.max(1, h*0.05*s), 0, 7); c.fill();
}

/* ---------- personnages ----------
   Dessinés de trois quarts : jambes, bras qui balancent, mains, visage,
   coiffes. La lumière de la scène (LUM) les éclaire d'un côté. */
function ombre(x, y, s, l){
  const c = Intro.cx, g = c.createRadialGradient(x - LUM.cote*5*s, y + 1*s, 0, x - LUM.cote*5*s, y + 1*s, l*s);
  g.addColorStop(0, `rgba(10,12,20,${LUM.nuit ? 0.28 : 0.38})`); g.addColorStop(1, 'rgba(10,12,20,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(x - LUM.cote*5*s, y + 1*s, l*s, 2.8*s, 0, 0, 7); c.fill();
}
function degradeFlanc(x, s, col, l){
  const c = Intro.cx, g = c.createLinearGradient(x - l*s, 0, x + l*s, 0);
  const sombre = teinte(col, 0.6), clair = teinte(col, 1.22);
  g.addColorStop(0, LUM.cote > 0 ? sombre : clair); g.addColorStop(0.55, teinte(col, 0.95)); g.addColorStop(1, LUM.cote > 0 ? clair : sombre);
  return g;
}
function membre(x1, y1, x2, y2, x3, y3, l, col){
  const c = Intro.cx;
  c.strokeStyle = col; c.lineWidth = l; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.stroke();
}
function main(x, y, s, peau){
  const c = Intro.cx; c.fillStyle = peau; c.beginPath(); c.arc(x, y, 1.45*s, 0, 7); c.fill();
}

/* p : l'apparence ; e : l'état — {marche, dir, bras:'repos'|'leves'|'pointe'|'parle'|'drapeau', lev, saut, dos} */
function personnage(u, v, p, t, e){
  const c = Intro.cx;
  const prof = 0.8 + (v - 90)/260;
  const s = Intro.s * prof * 1.32 * p.taille * (p.enfant ? 0.68 : 1);
  const dir = e.dir || 1, ph = p.phase;
  const pas = e.marche ? Math.sin(t*8.5 + ph) : 0;
  const saut = (e.saut || 0) * Math.abs(Math.sin(t*6.5 + ph)) * 5 * s;
  const souffle = e.marche ? Math.abs(pas)*1.1*s : Math.sin(t*1.7 + ph)*0.45*s;
  const x = X(u), y = Y(v) - saut, yb = y - souffle;       // yb : haut du corps, qui respire
  const hanche = yb - 15*s, epaule = yb - 28.5*s, cou = yb - 30.5*s, teteY = yb - 35.2*s;
  const peau = p.peau;
  ombre(x, Y(v), s, 10 - saut/(3*s));

  // cape du meneur, derrière tout le reste
  if(p.chef){
    const vent = Math.sin(t*2.3)*2.6*s, v2 = Math.sin(t*3.2 + 1)*1.8*s;
    const gc = c.createLinearGradient(x, epaule, x - dir*12*s, Y(v));
    gc.addColorStop(0, teinte(e.col, 1.0)); gc.addColorStop(1, teinte(e.col, 0.42));
    c.fillStyle = gc;
    c.beginPath(); c.moveTo(x - 4.5*s, epaule);
    c.quadraticCurveTo(x - dir*10*s + v2, yb - 16*s, x - dir*14*s + vent, Y(v) - 2*s);
    c.lineTo(x - dir*3*s + vent*0.4, Y(v) - 1*s); c.lineTo(x + 4.5*s, epaule); c.closePath(); c.fill();
    c.strokeStyle = teinte(e.col, 0.35, 0.6); c.lineWidth = 0.8*s;
    c.beginPath(); c.moveTo(x - 1*s, epaule + 2*s); c.quadraticCurveTo(x - dir*6*s + v2, yb - 12*s, x - dir*8*s + vent, Y(v) - 2*s); c.stroke();
  }
  // cheveux longs, derrière la tête
  if(p.longs){
    c.fillStyle = p.cheveux;
    c.beginPath(); c.ellipse(x - dir*0.8*s, teteY + 3.5*s, 5*s, 7*s, 0, 0, 7); c.fill();
  }
  // sac de voyage porté sur le dos
  if(p.baluchon){
    const bx = x - dir*5.2*s, by = epaule + 6*s;
    const gb = c.createRadialGradient(bx + LUM.cote*1.5*s, by - 2*s, 0.5*s, bx, by, 6*s);
    gb.addColorStop(0, '#c7a674'); gb.addColorStop(1, '#6e5232');
    c.fillStyle = gb; c.beginPath(); c.ellipse(bx, by, 4.2*s, 5.6*s, dir*0.15, 0, 7); c.fill();
    c.strokeStyle = '#4a3420'; c.lineWidth = 0.8*s;
    c.beginPath(); c.moveTo(bx - 3*s, by - 3.5*s); c.quadraticCurveTo(bx, by - 1.5*s, bx + 3*s, by - 3.5*s); c.stroke();
  }

  // --- bras : positions des mains selon le geste ---
  const bras = e.bras || (e.marche ? 'marche' : 'repos');
  const ag = {x: x - 4.3*s, y: epaule + 1*s}, ad = {x: x + 4.3*s, y: epaule + 1*s};   // épaules
  let mg, md, cg, cd;                                  // mains et coudes
  const bal = e.marche ? pas*3.2*s : Math.sin(t*1.7 + ph)*0.5*s;
  if(bras === 'leves'){
    const w = Math.sin(t*9 + ph)*2.2*s;
    mg = {x: x - 8*s + w, y: yb - 44*s}; md = {x: x + 8*s - w, y: yb - 44*s};
    cg = {x: x - 8*s, y: yb - 34*s}; cd = {x: x + 8*s, y: yb - 34*s};
  } else if(bras === 'pointe'){
    mg = {x: x - 5*s, y: hanche + 1*s}; cg = {x: x - 5.5*s, y: yb - 21*s};
    md = {x: x + dir*15*s, y: yb - 33*s}; cd = {x: x + dir*9*s, y: yb - 30*s};
    if(dir < 0){ [mg, md] = [md, mg]; [cg, cd] = [cd, cg]; }
  } else if(bras === 'parle'){
    const g = Math.sin(t*3.1 + ph), g2 = Math.sin(t*4.3);
    // la main libre accompagne la parole
    md = {x: x + 5.5*s, y: hanche + 1*s}; cd = {x: x + 5.8*s, y: yb - 21*s};
    mg = {x: x - (9 + g*3)*s, y: yb - (26 + g2*5)*s}; cg = {x: x - 7*s, y: yb - 21*s};
  } else {
    mg = {x: x - 5*s + bal, y: hanche + 1.5*s}; md = {x: x + 5*s - bal, y: hanche + 1.5*s};
    cg = {x: x - 5.6*s + bal*0.4, y: yb - 21.5*s}; cd = {x: x + 5.6*s - bal*0.4, y: yb - 21.5*s};
  }
  // bras du drapeau (meneur) : la main tient la hampe, plus ou moins haut
  if(e.drapeau !== undefined){
    const lev = e.lev || 0;
    md = {x: x + lerp(9, 6, lev)*s, y: yb - lerp(22, 44, lev)*s}; cd = {x: x + lerp(8, 8.5, lev)*s, y: yb - lerp(19, 34, lev)*s};
  }
  const manche = teinte(p.habit, 0.8);
  // bras du fond, derrière le corps
  const fond = dir > 0 ? [ag, cg, mg] : [ad, cd, md];
  membre(fond[0].x, fond[0].y, fond[1].x, fond[1].y, fond[2].x, fond[2].y, 2.4*s, teinte(p.habit, 0.62));
  main(fond[2].x, fond[2].y, s*0.95, teinte(peau, 0.8));

  // --- jambes et bottes ---
  const botte = '#2a1f18';
  if(p.robe){
    for(const k of [-1, 1]){
      const px = x + k*1.8*s + (k < 0 ? pas : -pas)*2.5*s;
      c.fillStyle = botte; c.beginPath(); c.ellipse(px + dir*0.8*s, Y(v) - saut - 0.6*s, 2*s, 1.2*s, 0, 0, 7); c.fill();
    }
  } else {
    for(const k of [-1, 1]){
      const avance = (k < 0 ? pas : -pas)*4.2*s;
      const gx = x + k*1.8*s, genou = {x: gx + avance*0.55 + dir*0.6*s, y: hanche + 7.5*s};
      membre(gx, hanche, genou.x, genou.y, gx + avance, Y(v) - saut - 1.2*s, 2.9*s, k*dir < 0 ? teinte(p.bas, 0.7) : p.bas);
      c.fillStyle = botte; c.beginPath(); c.ellipse(gx + avance + dir*0.9*s, Y(v) - saut - 0.8*s, 2.1*s, 1.3*s, 0, 0, 7); c.fill();
    }
  }

  // --- corps : tunique ceinturée, ou robe évasée ---
  c.fillStyle = degradeFlanc(x, s, p.habit, 7);
  c.beginPath();
  if(p.robe){
    const ev = e.marche ? pas*1.5*s : Math.sin(t*1.5 + ph)*0.6*s;
    c.moveTo(x - 4*s, epaule); c.lineTo(x + 4*s, epaule);
    c.quadraticCurveTo(x + 5*s, hanche, x + 7.5*s + ev, Y(v) - saut - 2*s);
    c.quadraticCurveTo(x, Y(v) - saut - 0.5*s, x - 7.5*s + ev, Y(v) - saut - 2*s);
    c.quadraticCurveTo(x - 5*s, hanche, x - 4*s, epaule);
  } else {
    c.moveTo(x - 4.3*s, epaule); c.lineTo(x + 4.3*s, epaule);
    c.quadraticCurveTo(x + 5*s, hanche - 4*s, x + 5.2*s, hanche + 2.5*s);
    c.lineTo(x - 5.2*s, hanche + 2.5*s);
    c.quadraticCurveTo(x - 5*s, hanche - 4*s, x - 4.3*s, epaule);
  }
  c.fill();
  // plis
  c.strokeStyle = teinte(p.habit, 0.55, 0.5); c.lineWidth = 0.7*s;
  c.beginPath();
  if(p.robe){ for(const k of [-2.5, 0.5, 3]){ c.moveTo(x + k*s*0.6, hanche); c.lineTo(x + k*s*1.3, Y(v) - saut - 2*s); } }
  else { c.moveTo(x - 1*s, epaule + 3*s); c.lineTo(x - 0.5*s, hanche + 2*s); }
  c.stroke();
  // ceinture
  c.fillStyle = p.chef ? e.col : '#3a2a1c';
  c.fillRect(x - (p.robe ? 4.6 : 5.1)*s, hanche - 2.5*s, (p.robe ? 9.2 : 10.2)*s, 1.8*s);
  if(p.chef){ c.fillStyle = '#f0cf6a'; c.fillRect(x - 1*s, hanche - 2.8*s, 2*s, 2.4*s); }
  if(p.baluchon){
    c.strokeStyle = '#4a3420'; c.lineWidth = 1*s;
    c.beginPath(); c.moveTo(x - dir*3.5*s, epaule + 0.5*s); c.lineTo(x + dir*3.8*s, hanche - 3*s); c.stroke();
  }
  // liseré de lumière du côté de l'astre
  c.strokeStyle = teinte(LUM.col, 1, 0.8); c.lineWidth = 0.9*s;
  c.beginPath(); c.moveTo(x + LUM.cote*4.2*s, epaule + 0.5*s);
  c.quadraticCurveTo(x + LUM.cote*5*s, hanche - 4*s, x + LUM.cote*5.2*s, hanche + 1.5*s); c.stroke();

  // cou et tête
  c.fillStyle = teinte(peau, 0.82); c.fillRect(x - 1.3*s, cou - 1*s, 2.6*s, 3*s);
  const gt = c.createRadialGradient(x + LUM.cote*1.6*s, teteY - 1.4*s, 0.6*s, x, teteY, 5*s);
  gt.addColorStop(0, teinte(peau, 1.12)); gt.addColorStop(1, teinte(peau, 0.72));
  c.fillStyle = gt; c.beginPath(); c.ellipse(x, teteY, 4.1*s, 4.6*s, 0, 0, 7); c.fill();
  if(!e.dos){
    // visage de trois quarts, tourné vers dir
    const fx = x + dir*1.3*s;
    c.fillStyle = '#1a1410';
    c.beginPath(); c.arc(fx - 1.3*s, teteY - 0.3*s, 0.48*s, 0, 7); c.arc(fx + 1.3*s, teteY - 0.3*s, 0.48*s, 0, 7); c.fill();
    c.strokeStyle = teinte(peau, 0.6); c.lineWidth = 0.6*s;
    c.beginPath(); c.moveTo(fx + dir*0.4*s, teteY + 0.2*s); c.lineTo(fx + dir*0.9*s, teteY + 1.5*s); c.lineTo(fx, teteY + 1.6*s); c.stroke();
    c.beginPath(); c.moveTo(fx - 1*s, teteY + 2.7*s);
    c.quadraticCurveTo(fx, teteY + (bras === 'leves' ? 3.8 : 3.2)*s, fx + 1*s, teteY + 2.7*s); c.stroke();
    c.fillStyle = 'rgba(220,110,90,.18)';
    c.beginPath(); c.arc(fx - 2*s, teteY + 1.4*s, 0.9*s, 0, 7); c.arc(fx + 2*s, teteY + 1.4*s, 0.9*s, 0, 7); c.fill();
  }
  if(p.barbe){
    c.fillStyle = p.cheveux;
    c.beginPath(); c.moveTo(x - 3.6*s, teteY + 0.8*s);
    c.quadraticCurveTo(x + dir*0.8*s, teteY + 7.2*s, x + 3.6*s, teteY + 0.8*s);
    c.quadraticCurveTo(x + dir*0.8*s, teteY + 3.6*s, x - 3.6*s, teteY + 0.8*s); c.fill();
  }
  // chevelure et coiffe
  c.fillStyle = p.cheveux;
  if(e.dos){ c.beginPath(); c.ellipse(x, teteY, 4.2*s, 4.7*s, 0, 0, 7); c.fill(); }
  else { c.beginPath(); c.ellipse(x - dir*0.6*s, teteY - 2.2*s, 4.4*s, 2.9*s, 0, Math.PI, 0); c.fill();
         c.beginPath(); c.ellipse(x - dir*3.2*s, teteY - 0.5*s, 1.4*s, 3*s, 0, 0, 7); c.fill(); }
  switch(p.coiffe){
    case 'bonnet':
      c.fillStyle = p.coiffeCol;
      c.beginPath(); c.ellipse(x, teteY - 2.8*s, 4.6*s, 3.2*s, 0, Math.PI, 0); c.fill();
      c.fillRect(x - 4.6*s, teteY - 3.2*s, 9.2*s, 1.4*s); break;
    case 'foulard':
      c.fillStyle = p.coiffeCol;
      c.beginPath(); c.moveTo(x - 4.8*s, teteY + 0.5*s);
      c.quadraticCurveTo(x, teteY - 8.5*s, x + 4.8*s, teteY + 0.5*s);
      c.lineTo(x - dir*5*s, teteY + 4*s); c.closePath(); c.fill(); break;
    case 'chapeau':
      c.fillStyle = '#4a3624';
      c.beginPath(); c.ellipse(x, teteY - 2.6*s, 7.2*s, 1.6*s, 0, 0, 7); c.fill();
      c.beginPath(); c.ellipse(x, teteY - 4*s, 3.8*s, 3.2*s, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#2a1e14'; c.fillRect(x - 3.8*s, teteY - 4.2*s, 7.6*s, 1.1*s); break;
    case 'tricorne': {
      c.fillStyle = p.coiffeCol;
      c.beginPath(); c.moveTo(x - 7.5*s, teteY - 2.8*s); c.quadraticCurveTo(x, teteY - 10*s, x + 7.5*s, teteY - 2.8*s);
      c.quadraticCurveTo(x, teteY - 4.4*s, x - 7.5*s, teteY - 2.8*s); c.fill();
      c.strokeStyle = '#d8b454'; c.lineWidth = 0.7*s; c.stroke();
      // plume aux couleurs du pays
      const pv = Math.sin(t*3)*1.2*s;
      c.fillStyle = e.col;
      c.beginPath(); c.moveTo(x + 2*s, teteY - 6.5*s);
      c.quadraticCurveTo(x - dir*4*s + pv, teteY - 14*s, x - dir*9*s + pv, teteY - 11*s);
      c.quadraticCurveTo(x - dir*3*s, teteY - 9*s, x + 2*s, teteY - 6.5*s); c.fill();
      break;
    }
  }
  // contre-jour sur la tête
  c.strokeStyle = teinte(LUM.col, 1, 0.55); c.lineWidth = 0.8*s;
  c.beginPath(); c.ellipse(x, teteY, 4.2*s, 4.7*s, 0, LUM.cote > 0 ? -1.3 : Math.PI - 0.5, LUM.cote > 0 ? 0.5 : Math.PI + 1.3); c.stroke();

  // bras du devant
  const face = dir > 0 ? [ad, cd, md] : [ag, cg, mg];
  membre(face[0].x, face[0].y, face[1].x, face[1].y, face[2].x, face[2].y, 2.6*s, manche);
  c.strokeStyle = teinte(LUM.col, 1, 0.35); c.lineWidth = 0.6*s;
  c.beginPath(); c.moveTo(face[0].x + LUM.cote*1*s, face[0].y); c.lineTo(face[1].x + LUM.cote*1*s, face[1].y); c.stroke();
  main(face[2].x, face[2].y, s, peau);

  // le drapeau du meneur, tenu à pleine main
  if(e.drapeau){
    const lev = e.lev || 0, hauteur = 40*prof*1.32*p.taille;
    const pied = md.y + lerp(16, 10, lev)*s;
    petitDrapeau((md.x - Intro.W/2)/Intro.s, (pied - Intro.H/2)/Intro.s, hauteur, e.col, t);
    main(md.x, md.y, s, peau);
    if(lev > 0.5) halo(md.x + 14*s, md.y - 28*s, 46*s, e.col, 0.2*lev);
  }
}

function personne(u, v, p, t, e){ personnage(u, v, p, t, e); }
// le meneur : plus grand, tricorne à plume, cape aux couleurs du pays
function meneur(u, v, col, t, e){ personnage(u, v, CHEF, t, Object.assign({col}, e)); }

/* ---------- le navire ---------- */
function navire(u, v, sc, t, voile, col, roulis=1, sillage=0, passagers=0, vigie=0){
  const c = Intro.cx, s = Intro.s*sc;
  const a = Math.sin(t*1.4)*0.035*roulis, dy = Math.sin(t*1.9)*2*s*roulis;
  const x0 = X(u), y0 = Y(v) + dy;
  // reflet sombre sous la coque
  const gr = c.createRadialGradient(x0, y0 + 10*s, 0, x0, y0 + 10*s, 90*s);
  gr.addColorStop(0, 'rgba(5,10,20,.45)'); gr.addColorStop(1, 'rgba(5,10,20,0)');
  c.fillStyle = gr; c.beginPath(); c.ellipse(x0, y0 + 12*s, 90*s, 14*s, 0, 0, 7); c.fill();
  // sillage et écume
  if(sillage > 0){
    for(let i=0;i<18;i++){
      const q = i/18, ph = t*3 + i*0.9;
      c.fillStyle = `rgba(235,245,255,${sillage*(1-q)*0.45})`;
      c.beginPath();
      c.ellipse(x0 - (60 + i*16)*s, y0 + (8 + Math.sin(ph)*1.5 + q*6)*s, (6 + q*18)*s, (1.2 + q*1.6)*s, 0, 0, 7);
      c.fill();
    }
    for(let i=0;i<10;i++){
      const age = (t*1.6 + alea(i)) % 1;
      c.fillStyle = `rgba(245,250,255,${sillage*(1-age)*0.8})`;
      c.beginPath(); c.arc(x0 + (78 + age*12)*s, y0 + (4 - age*14 + age*age*16)*s, (1 + alea(i+3)*1.6)*s, 0, 7); c.fill();
    }
  }
  c.save(); c.translate(x0, y0); c.rotate(a);
  // passagers sur le pont : têtes et épaules au-dessus du bastingage
  for(let i=0;i<passagers;i++){
    const p = FOULE[i % FOULE.length], px = (-34 + (i*37 % 90))*s, bob = Math.sin(t*2 + i)*0.6*s;
    c.fillStyle = teinte(p.habit, 0.85); c.fillRect(px - 3.2*s, -27*s + bob, 6.4*s, 9*s);
    c.fillStyle = p.peau; c.beginPath(); c.arc(px, -30*s + bob, 2.9*s, 0, 7); c.fill();
    c.fillStyle = p.cheveux; c.beginPath(); c.arc(px, -31*s + bob, 3*s, Math.PI, 0); c.fill();
  }
  // la vigie, à la proue : elle tend le bras vers la terre
  if(vigie > 0){
    const vx = 66*s, w = Math.sin(t*8)*1.5*s;
    c.fillStyle = '#5a4a3e'; c.fillRect(vx - 3.4*s, -32*s, 6.8*s, 12*s);
    c.fillStyle = '#e3b892'; c.beginPath(); c.arc(vx, -35.5*s, 3*s, 0, 7); c.fill();
    c.fillStyle = '#2a1d14'; c.beginPath(); c.arc(vx, -36.5*s, 3.1*s, Math.PI, 0); c.fill();
    c.strokeStyle = '#5a4a3e'; c.lineWidth = 2.2*s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(vx + 2*s, -30*s); c.lineTo(vx + lerp(4, 14, vigie)*s, lerp(-24, -42, vigie)*s + w); c.stroke();
  }
  // coque, gaillard arrière relevé
  const gh = c.createLinearGradient(0, -28*s, 0, 12*s);
  gh.addColorStop(0, '#8a5d3e'); gh.addColorStop(0.45, '#583a28'); gh.addColorStop(1, '#23160f');
  c.fillStyle = gh;
  c.beginPath(); c.moveTo(-76*s, -30*s); c.lineTo(-48*s, -30*s); c.lineTo(-44*s, -17*s); c.lineTo(80*s, -19*s);
  c.quadraticCurveTo(68*s, 6*s, 44*s, 10*s); c.lineTo(-52*s, 10*s);
  c.quadraticCurveTo(-70*s, 2*s, -76*s, -30*s); c.fill();
  c.strokeStyle = 'rgba(20,10,5,.35)'; c.lineWidth = 0.9*s;
  for(const k of [-11, -4, 3]){
    c.beginPath(); c.moveTo(-70*s, k*s); c.quadraticCurveTo(10*s, (k + 3)*s, 72*s, (k - 4)*s); c.stroke();
  }
  c.strokeStyle = '#b3865c'; c.lineWidth = 1.6*s;
  c.beginPath(); c.moveTo(-76*s, -30*s); c.lineTo(-48*s, -30*s); c.moveTo(-44*s, -17*s); c.lineTo(80*s, -19*s); c.stroke();
  c.fillStyle = col; c.fillRect(-60*s, -9*s, 118*s, 2.6*s);             // liseré aux couleurs du pays
  // fenêtres de la poupe, éclairées la nuit
  for(let k=0;k<3;k++){
    c.fillStyle = LUM.nuit > 0.3 ? '#ffd48a' : '#2a1a10';
    c.fillRect((-70 + k*7)*s, -25*s, 4*s, 4*s);
  }
  if(LUM.nuit > 0.3) halo(-62*s, -23*s, 36*s, '#ffb45a', 0.5*LUM.nuit);
  // beaupré et gréement
  c.strokeStyle = '#3a2a1f'; c.lineWidth = 2.4*s;
  c.beginPath(); c.moveTo(76*s, -19*s); c.lineTo(108*s, -32*s); c.stroke();
  c.strokeStyle = 'rgba(40,30,20,.7)'; c.lineWidth = 0.8*s;
  c.beginPath();
  c.moveTo(0, -120*s); c.lineTo(108*s, -32*s);
  c.moveTo(0, -120*s); c.lineTo(-74*s, -30*s);
  for(const k of [-30, -22, -14]){ c.moveTo(0, -96*s); c.lineTo(k*s, -18*s); }
  for(const k of [14, 22, 30]){ c.moveTo(0, -96*s); c.lineTo(k*s, -19*s); }
  c.stroke();
  // mât et vergue
  const gm = c.createLinearGradient(-2*s, 0, 2*s, 0); gm.addColorStop(0, '#5a4130'); gm.addColorStop(1, '#2a1c12');
  c.strokeStyle = gm; c.lineWidth = 3.4*s;
  c.beginPath(); c.moveTo(0, -18*s); c.lineTo(0, -122*s); c.stroke();
  c.strokeStyle = '#3a2a1f'; c.lineWidth = 2.6*s;
  c.beginPath(); c.moveTo(-36*s, -104*s); c.lineTo(36*s, -104*s); c.stroke();
  // voile : roulée sur la vergue, puis hissée et gonflée
  const h = 78*voile*s, gonfle = (7 + Math.sin(t*2)*2.5)*s*voile;
  if(voile > 0.02){
    const gv = c.createLinearGradient(-32*s, 0, 32*s + gonfle, 0);
    gv.addColorStop(0, '#cbbd9c'); gv.addColorStop(0.55, '#f6efdc'); gv.addColorStop(1, '#d9ccad');
    c.fillStyle = gv;
    c.beginPath(); c.moveTo(-32*s, -104*s); c.lineTo(32*s, -104*s);
    c.quadraticCurveTo(32*s + gonfle, -104*s + h/2, 30*s, -104*s + h);
    c.lineTo(-30*s, -104*s + h);
    c.quadraticCurveTo(-32*s + gonfle, -104*s + h/2, -32*s, -104*s); c.fill();
    c.strokeStyle = 'rgba(120,100,70,.25)'; c.lineWidth = 0.7*s;
    for(let k=-2;k<=2;k++){
      c.beginPath(); c.moveTo(k*12*s, -104*s); c.quadraticCurveTo(k*12*s + gonfle, -104*s + h/2, k*12*s, -104*s + h); c.stroke();
    }
    c.fillStyle = col; c.globalAlpha = 0.9;
    c.beginPath();
    c.moveTo(-31.5*s + gonfle*0.9, -104*s + h*0.4); c.quadraticCurveTo(gonfle*1.2, -104*s + h*0.4, 31*s + gonfle*0.9, -104*s + h*0.4);
    c.lineTo(31*s + gonfle*0.9, -104*s + h*0.58); c.quadraticCurveTo(gonfle*1.2, -104*s + h*0.58, -31.5*s + gonfle*0.9, -104*s + h*0.58);
    c.fill(); c.globalAlpha = 1;
    // foc triangulaire
    const f = borne((voile - 0.4)/0.6, 0, 1);
    if(f > 0){
      c.fillStyle = '#ece3cc';
      c.beginPath(); c.moveTo(6*s, -110*s); c.lineTo(lerp(6, 104, f)*s, lerp(-110, -33, f)*s);
      c.quadraticCurveTo(40*s, -40*s, 12*s, -26*s); c.closePath(); c.fill();
    }
  }
  c.fillStyle = '#d8ccb0'; c.fillRect(-34*s, -107.5*s, 68*s, 4*s);          // voile ferlée
  // pavillon en tête de mât
  const on = Math.sin(t*3)*2*s;
  c.fillStyle = col;
  c.beginPath(); c.moveTo(0, -122*s); c.quadraticCurveTo(12*s, -122*s + on, 26*s, -117*s);
  c.quadraticCurveTo(12*s, -113*s + on, 0, -111*s); c.fill();
  c.restore();
  if(LUM.nuit > 0.3) halo(x0 + 70*s, y0 - 26*s, 30*s, '#ffc070', 0.35*LUM.nuit);   // fanal de proue
}

/* ===========================================================
   LES SCÈNES
   =========================================================== */

// 1 et 2 — le quai : l'appel, puis l'embarquement
function sceneQuai(t, col){
  const tc = k01(t, 0, 17), c = Intro.cx;
  LUM.col = '#ffab70'; LUM.cote = 1; LUM.nuit = 0;
  ciel(mix('#241a42', '#140f2c', tc), mix('#8a4466', '#5a2f55', tc), mix('#ff9d5c', '#d9644a', tc));
  etoiles(t, k01(t, 8, 17)*0.6);
  nuages(t, mix('#ffc79a', '#d98270', tc), mix('#6a3a5e', '#3a2448', tc), 0.85);
  // soleil couchant qui plonge
  const vs = HORIZON - 14 + tc*26;
  astre(380, vs, 30, '#ffe0a0', '#ff8a40', 1);
  relief(HORIZON, 26, 'rgba(90,50,90,.75)', 2.1, 0);
  // le soleil passe derrière l'horizon : on masque ce qui dépasse sous la mer
  mer(t, mix('#a4566a', '#7a3e5a', tc), '#1c1a34', '#ffc08a');
  colonne(t, 380, 34, '#ffc684', 0.9*(1 - tc*0.5));
  paillettes(t, '#ffd9a8', 0.8);
  brume('#ffb080', 0.25);
  oiseaux(t, 5, -200, -160, 'rgba(40,20,40,.85)');

  // la terre ferme et le quai
  const gs = c.createLinearGradient(0, Y(62), 0, Intro.H);
  gs.addColorStop(0, '#3a2f3c'); gs.addColorStop(1, '#16121c');
  c.fillStyle = gs;
  c.beginPath(); c.moveTo(-4, Y(62)); c.lineTo(X(150), Y(62)); c.lineTo(X(170), Intro.H); c.lineTo(-4, Intro.H); c.fill();
  c.strokeStyle = teinte(LUM.col, 1, 0.45); c.lineWidth = 1.5*Intro.s;
  c.beginPath(); c.moveTo(X(-900), Y(62)); c.lineTo(X(150), Y(62)); c.lineTo(X(170), Intro.H); c.stroke();
  // pavés
  c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1*Intro.s;
  for(let k=0;k<6;k++){ const v = 72 + k*k*6; c.beginPath(); c.moveTo(-4, Y(v)); c.lineTo(X(150 + v*0.1), Y(v)); c.stroke(); }
  // ponton
  c.fillStyle = '#5a4432'; c.fillRect(X(150), Y(90), 132*Intro.s, 8*Intro.s);
  c.fillStyle = teinte(LUM.col, 1, 0.35); c.fillRect(X(150), Y(90), 132*Intro.s, 1.4*Intro.s);
  c.fillStyle = '#2e2219';
  for(let i=0;i<4;i++) c.fillRect(X(160 + i*34), Y(98), 4*Intro.s, 24*Intro.s);
  maisons(t);
  lanterne(-560, 78, t, 1); lanterne(-230, 78, t, 2); lanterne(150, 90, t, 3);
  tonneau(90, 88); tonneau(108, 92, 0.9); tonneau(-140, 86, 0.9);

  const tl = t - 9;
  const hisse = doux(k01(tl, 5.3, 6.6));
  const depart = doux(k01(tl, 6.4, 8.2));

  // caisse du meneur
  const gk = c.createLinearGradient(X(-66), 0, X(-22), 0);
  gk.addColorStop(0, '#3e2d20'); gk.addColorStop(1, '#7a5a3e');
  c.fillStyle = gk; c.fillRect(X(-66), Y(104), 44*Intro.s, 22*Intro.s);
  c.strokeStyle = '#2a1d14'; c.lineWidth = 1.5*Intro.s; c.strokeRect(X(-66), Y(104), 44*Intro.s, 22*Intro.s);
  c.beginPath(); c.moveTo(X(-66), Y(104)); c.lineTo(X(-22), Y(126)); c.stroke();

  const QUAI = {u:270, v:96};
  // la foule : elle arrive, écoute, acclame quand le drapeau se lève, puis embarque
  let aBord = 0;
  const gens = FOULE.map((p, i) => {
    let u, v, marche = false, bras, saut = 0, dir = 1;
    const arrive = 0.3 + i*0.38;
    if(t < arrive) return null;
    const ka = k01(t, arrive, arrive + 2.2);
    u = lerp(-780, p.u, ka); v = lerp(p.v + 10, p.v, ka); marche = ka < 1;
    // l'appel est lancé : les plus enthousiastes lèvent les bras, certains sautent
    if(!marche && t > 5.3 + p.enthousiasme*0.8 && t < 8.4 && p.enthousiasme > 0.25){ bras = 'leves'; saut = p.enthousiasme > 0.6 ? 1 : 0; }
    if(tl > 0){
      const part = 0.2 + i*0.18;
      const dist = Math.hypot(QUAI.u - p.u, QUAI.v - p.v), kd = borne((tl - part)*260/dist, 0, 1);
      if(kd >= 1){ aBord++; return null; }               // à bord
      if(kd > 0){ u = lerp(p.u, QUAI.u, kd); v = lerp(p.v, QUAI.v, kd); marche = true; bras = undefined; saut = 0; }
    }
    return {u, v, p, e:{marche, bras, saut, dir}};
  }).filter(Boolean);

  // le navire : amarré, puis voile hissée, puis au large
  navire(330 + depart*760, 112, 0.95, t, hisse, col, 1, depart > 0 && depart < 1 ? 1 : 0, Math.min(10, aBord));

  gens.sort((a, b) => a.v - b.v).forEach(g => personne(g.u, g.v, g.p, t, g.e));

  // le meneur : il harangue, lève le drapeau, puis part le dernier
  if(tl < 0){
    const leve = doux(k01(t, 4.4, 5.2)) * (1 - 0.25*doux(k01(t, 7.5, 8.5)));
    meneur(-44, 104, col, t, {drapeau:true, lev:leve, bras: t < 4.4 ? 'parle' : undefined});
  } else {
    const kd = borne((tl - 3.6)*300/320, 0, 1);
    if(kd < 1){
      const u = lerp(-44, QUAI.u, kd), v = kd > 0 ? lerp(104, QUAI.v, kd) : 104;
      meneur(u, v, col, t, {marche: kd > 0, drapeau:true, lev: 1 - kd*0.6});
    }
  }
}

// 3 — la traversée : du jour à la nuit, puis l'aube et la terre
function sceneMer(t, col){
  const tl = t - 17, c = Intro.cx;
  const cles = [                     // [instant, haut du ciel, milieu, horizon, mer claire, mer sombre]
    [0,   '#2f64a8', '#6fa3d6', '#c4def0', '#5a92c0', '#163e66'],
    [3.2, '#2e3f7a', '#8a5a8a', '#f09a6a', '#8a6a8a', '#1c2a50'],
    [4.8, '#060b22', '#101a3c', '#23305a', '#1c2a50', '#060c1e'],
    [7.2, '#060b22', '#101a3c', '#23305a', '#1c2a50', '#060c1e'],
    [9,   '#3a3470', '#b2607a', '#ffb07a', '#b07a7a', '#1c2c52'],
    [10,  '#4a64a4', '#c8849a', '#ffd09a', '#c0948a', '#23406a'],
  ];
  let i = 0; while(i < cles.length-2 && tl > cles[i+1][0]) i++;
  const A = cles[i], B = cles[i+1], k = k01(tl, A[0], B[0]);
  const m = j => mix(A[j], B[j], k);
  const nuit = k01(tl, 3.8, 4.8) * (1 - k01(tl, 7.2, 8.6));
  const aube = k01(tl, 7.6, 10);
  LUM.nuit = nuit; LUM.cote = aube > 0.3 ? 1 : -1;
  LUM.col = nuit > 0.5 ? '#a8bcff' : (aube > 0.2 ? '#ffc088' : '#fff0d8');
  ciel(m(1), m(2), m(3));
  etoiles(t, nuit);
  etoileFilante(t, 23, nuit);
  // soleil du jour qui descend, lune de la nuit, soleil levant
  const jour = 1 - k01(tl, 2.6, 4.4);
  if(jour > 0) astre(-360, lerp(-150, HORIZON + 6, k01(tl, 0, 4.4)), 22, '#fff4d0', '#ffb070', jour);
  if(nuit > 0) astre(-300, -190, 16, '#fbf8e8', '#9fb0e8', nuit);
  if(aube > 0) astre(420, lerp(HORIZON + 20, HORIZON - 30, aube), 26, '#fff0c0', '#ff9a50', aube);
  nuages(t*1.6, m(3), m(1), 0.5 + nuit*0.2);
  // la terre, au loin
  const ile = k01(tl, 5.6, 8.4);
  if(ile > 0){
    c.fillStyle = mix('#0c1628', '#3a5a4a', aube);
    c.beginPath(); c.moveTo(X(250), Y(HORIZON));
    c.quadraticCurveTo(X(330), Y(HORIZON - 34*ile), X(420), Y(HORIZON - 12*ile));
    c.quadraticCurveTo(X(470), Y(HORIZON - 26*ile), X(540), Y(HORIZON - 8*ile));
    c.quadraticCurveTo(X(590), Y(HORIZON - 14*ile), X(640), Y(HORIZON)); c.fill();
  }
  mer(t, m(4), m(5), nuit > 0.5 ? '#9fb4e8' : '#e8f4ff', tl*40);
  if(jour > 0) colonne(t, -360, 26, '#ffe6b0', jour*0.7);
  if(nuit > 0) colonne(t, -300, 18, '#dfe6ff', nuit*0.7);
  if(aube > 0) colonne(t, 420, 30, '#ffc890', aube*0.9);
  paillettes(t, nuit > 0.5 ? '#9fe0ff' : '#ffffff', 0.6 + nuit*0.4, 90);   // la nuit, la mer luit
  brume(m(3), 0.3);
  if(jour > 0.5 || aube > 0.5) oiseaux(t, 3, 200, -120, 'rgba(30,30,50,.7)');
  navire(-40, 96, 1.1, t, 1, col, 1.5, 1, 9, doux(k01(tl, 6.6, 7.3)));   // la vigie voit la terre
}

// 4 et 5 — l'arrivée, puis le regard vers l'horizon
function sceneIle(t, col, rivaux){
  const tl = t - 27, c = Intro.cx;
  const pan = -350 * doux(k01(t, 34, 36.6)), fond = pan * 0.5;
  LUM.col = '#fff1c8'; LUM.cote = -1; LUM.nuit = 0;
  ciel('#2e6db8', '#78b0e2', '#e4f0f4');
  nuages(t, '#ffffff', '#b8cde0', 0.9);
  astre(-460 + fond*0.3, -250, 24, '#fffbe8', '#ffe29a', 1);
  rayons(X(-460 + fond*0.3), Y(-250), t, '#fff3c8', 0.07);
  oiseaux(t, 4, 100, -150, 'rgba(40,50,70,.75)');
  relief(HORIZON, 18, 'rgba(120,160,170,.55)', 5.3, fond*0.6);
  // rivaux : d'autres îles, d'autres feux, d'autres drapeaux
  rivaux.forEach((r, i) => {
    const u = 230 + i * 84 + fond, v = HORIZON, hh = 30 + (i%3)*8;
    c.fillStyle = '#5f8a7c';
    c.beginPath(); c.moveTo(X(u - 56), Y(v));
    c.quadraticCurveTo(X(u - 10), Y(v - hh), X(u + 56), Y(v)); c.fill();
    c.fillStyle = '#4a7464';
    c.beginPath(); c.moveTo(X(u - 30), Y(v));
    c.quadraticCurveTo(X(u + 8), Y(v - hh*0.7), X(u + 40), Y(v)); c.fill();
    c.fillStyle = '#35604c';
    for(let k=0;k<5;k++){ c.beginPath(); c.arc(X(u - 26 + k*12), Y(v - 3 - Math.sin(k)*3), (2.4 + alea(k+i)*1.4)*Intro.s, 0, 7); c.fill(); }
    if(t > 33.4){
      const apparait = k01(t, 33.4 + i*0.25, 34.4 + i*0.25);
      c.globalAlpha = apparait;
      c.fillStyle = '#6a4a30'; c.fillRect(X(u - 4), Y(v - 9), 7*Intro.s, 5*Intro.s);
      c.fillStyle = '#4a3020';
      c.beginPath(); c.moveTo(X(u - 5.5), Y(v - 9)); c.lineTo(X(u - 0.5), Y(v - 13)); c.lineTo(X(u + 4.5), Y(v - 9)); c.fill();
      fumee(u - 10, v - 8, t, i*0.37, 0.4*apparait);
      petitDrapeau(u + 10, v - 6, 28, r.col, t, i);
      halo(X(u + 16), Y(v - 30), 26*Intro.s, r.col, 0.45*apparait);
      c.globalAlpha = 1;
    }
  });
  mer(t, '#78b8d8', '#1d6a98', '#f0faff');
  colonne(t, -460 + fond*0.3, 30, '#fff6d8', 0.35);
  paillettes(t, '#ffffff', 0.9);
  brume('#ffffff', 0.3);

  // la plage : lagon, sable mouillé, sable sec, écume qui va et vient
  const P = pan, ecume = 5 + Math.sin(t*1.1)*6;
  c.fillStyle = 'rgba(90,210,210,.45)';
  c.beginPath(); c.moveTo(-4, Y(64)); c.lineTo(X(210 + P), Y(66));
  c.quadraticCurveTo(X(300 + P), Y(140), X(400 + P), Intro.H); c.lineTo(-4, Intro.H); c.fill();
  c.fillStyle = '#b89c68';
  c.beginPath(); c.moveTo(-4, Y(68)); c.lineTo(X(158 + P + ecume), Y(72));
  c.quadraticCurveTo(X(240 + P + ecume), Y(140), X(332 + P + ecume), Intro.H); c.lineTo(-4, Intro.H); c.fill();
  const gs = c.createLinearGradient(0, Y(70), 0, Intro.H);
  gs.addColorStop(0, '#e8d3a0'); gs.addColorStop(1, '#cfb07a');
  c.fillStyle = gs;
  c.beginPath(); c.moveTo(-4, Y(70)); c.lineTo(X(150 + P), Y(74));
  c.quadraticCurveTo(X(230 + P), Y(140), X(320 + P), Intro.H); c.lineTo(-4, Intro.H); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2.6*Intro.s;
  c.beginPath(); c.moveTo(X(158 + P + ecume), Y(72)); c.quadraticCurveTo(X(240 + P + ecume), Y(140), X(332 + P + ecume), Intro.H); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.4*Intro.s;
  c.beginPath(); c.moveTo(X(172 + P + ecume*1.6), Y(72)); c.quadraticCurveTo(X(256 + P + ecume*1.6), Y(140), X(350 + P + ecume*1.6), Intro.H); c.stroke();
  // grain du sable
  c.fillStyle = 'rgba(120,90,50,.18)';
  for(let k=0;k<120;k++){
    const u = -900 + alea(k)*1050 + P, v = 76 + Math.pow(alea(k+50), 0.8)*240;
    if(u > 150 + P + (v - 74)*0.9) continue;
    c.fillRect(X(u), Y(v), 1.6*Intro.s, 1.2*Intro.s);
  }
  touffe(-560 + P, 92, t); touffe(-470 + P, 84, t, 0.8); touffe(-600 + P, 104, t, 1.2); touffe(-380 + P, 82, t, 0.7);
  palmier(-520 + P, 88, t, 1.1); palmier(-430 + P, 80, t, 0.9); palmier(-640 + P, 96, t, 1.25);

  const DEPART = {u:250, v:118};             // au bord de l'eau : ils arrivent en chaloupe
  let restent = 0;
  const gens = FOULE.map((p, i) => {
    const part = 0.4 + i*0.22, cible = {u: p.u + 60, v: p.v + 14};
    const k = k01(tl, part, part + 2.6);
    if(k <= 0){ restent++; return null; }
    const e = {marche: k < 1, dir: k < 1 ? -1 : 1};
    // le drapeau est planté : la joie
    if(k >= 1 && tl > 4.3 + p.enthousiasme*0.5 && tl < 6.8){ e.bras = 'leves'; e.saut = p.enthousiasme > 0.45 ? 1 : 0; }
    // pas seuls : on se tourne vers l'horizon, certains le montrent du doigt
    if(t > 34.3){ e.dir = 1; if(p.enthousiasme > 0.55) e.bras = 'pointe'; }
    return {u: lerp(DEPART.u, cible.u, k) + P, v: lerp(DEPART.v, cible.v, k), p, e};
  }).filter(Boolean);

  navire(430 + P, 104, 0.9, t, 0.15, col, 0.6, 0, Math.min(8, restent));
  gens.sort((a, b) => a.v - b.v).forEach(g => personne(g.u, g.v, g.p, t, g.e));

  // le meneur rejoint la plage et plante le drapeau
  const km = doux(k01(tl, 0.2, 3.0));
  const um = lerp(DEPART.u, -20, km) + P, vm = lerp(DEPART.v, 132, km);
  const plante = k01(tl, 3.3, 4.2);
  if(plante > 0){
    // le drapeau s'enfonce dans le sable puis se dresse
    petitDrapeau(-4 + P, 134, 64*doux(plante), col, t);
    const eclat = k01(tl, 3.9, 4.3) * (1 - k01(tl, 4.3, 6.5));
    halo(X(16 + P), Y(134 - 56), 140*Intro.s, col, 0.35*eclat);
  }
  const eMeneur = {marche: km > 0 && km < 1, dir: km < 1 ? -1 : 1};
  if(plante <= 0){ eMeneur.drapeau = true; eMeneur.lev = 0.3; }
  else if(t > 34.3) eMeneur.bras = 'pointe';
  else if(tl > 4.3 && tl < 6.8) eMeneur.bras = 'leves';
  meneur(um, vm, col, t, eMeneur);
}

/* ---------- finitions : grain, vignettage ---------- */
function finitions(){
  const c = Intro.cx, W = Intro.W, H = Intro.H;
  const g = c.createRadialGradient(W/2, H/2, Math.min(W, H)*0.32, W/2, H/2, Math.hypot(W, H)*0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  if(!Intro.bruit){
    const b = document.createElement('canvas'); b.width = b.height = 180;
    const bx = b.getContext('2d'), d = bx.createImageData(180, 180);
    for(let i=0;i<d.data.length;i+=4){ const v = Math.random()*255|0; d.data[i] = d.data[i+1] = d.data[i+2] = v; d.data[i+3] = 255; }
    bx.putImageData(d, 0, 0);
    Intro.bruit = c.createPattern(b, 'repeat');
  }
  c.save();
  c.globalAlpha = 0.06; c.globalCompositeOperation = 'overlay';
  c.translate(-Math.random()*180, -Math.random()*180);
  c.fillStyle = Intro.bruit; c.fillRect(0, 0, W + 180, H + 180);
  c.restore();
}

/* ---------- le script : sous-titres et sons ---------- */
function sousTitres(){
  const p = S.player, n = S.nations.length - 1;
  const nom = `<b style="color:${p.col}">${echap(p.nom)}</b>`;
  // les mots en <em> sont ceux qu'il faut retenir : ils ressortent en or
  return [
    [0.6,  4.3,  "Il n'y avait <em>plus rien</em> pour nous ici."],
    [4.6,  9,    "« <em>Suivez-moi</em> : au-delà de la mer, <em>une terre nous attend</em>. »"],
    [9.6,  16.4, 'Ils furent <em>des centaines</em> à le croire.'],
    [17.8, 23,   'Des <em>semaines de mer</em>…'],
    [24,   26.8, '« <em>Terre !</em> »'],
    [28,   33.8, `Ici naîtra ${nom}.`],
    [34.2, 36.6, "Mais nous n'étions <em>pas seuls</em>."],
    [36.8, 39.4, n > 1 ? `<em>${n} peuples</em> convoitaient déjà ces terres.`
                       : '<em>Un autre peuple</em> convoitait déjà ces terres.'],
    [40,   DUREE, `${n + 1} nations. <em>À toi de régner.</em>`],
  ];
}
/* ===========================================================
   MOTEUR
   =========================================================== */

function dimensionner(){
  const cv = Intro.cv, dpr = Math.min(3, window.devicePixelRatio || 1);   // pleine résolution de l'écran
  const W = cv.clientWidth || window.innerWidth, H = cv.clientHeight || window.innerHeight;
  if(W === Intro.W && H === Intro.H && cv.width === Math.round(W*dpr)) return;
  Intro.W = W; Intro.H = H;
  cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  Intro.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // en portrait on resserre le cadre plutôt que de rapetisser la scène
  Intro.sBase = Math.max(Math.min(W/1000, H/620), Math.min(W/640, H/900));
  Intro.cx.imageSmoothingQuality = 'high';
}

// les mots apparaissent l'un après l'autre : l'œil suit la phrase au lieu de la sauter
function motParMot(html){
  return html.split(/ (?![^<]*>)/).map((m, i) =>
    `<i class="mot" style="animation-delay:${i*90}ms">${m}</i>`).join(' ');
}

function tempsIntro(){ return (performance.now() - Intro.t0)/1000 + Intro.decalage; }

function image(){
  if(!Intro.actif) return;
  Intro.anim = requestAnimationFrame(image);
  dimensionner();
  const t = tempsIntro(), c = Intro.cx, col = S.player.col;

  // la caméra avance ou recule lentement dans chaque lieu : l'image ne reste jamais figée
  const zoom = t < 17 ? lerp(1, 1.08, doux(k01(t, 0, 17)))
             : t < 27 ? lerp(1.07, 1, doux(k01(t, 17, 27)))
             :          lerp(1, 1.06, doux(k01(t, 27, 39)));
  Intro.s = Intro.sBase * zoom;
  c.clearRect(0, 0, Intro.W, Intro.H);

  if(t < 17)      sceneQuai(t, col);
  else if(t < 27) sceneMer(t, col);
  else            sceneIle(t, col, Intro.rivaux);
  finitions();

  // fondus au noir entre les lieux
  const noir = Math.max(k01(t, 16.4, 17) * (t < 17), (1 - k01(t, 17, 17.7)) * (t >= 17 && t < 18),
                        k01(t, 26.4, 27) * (t < 27), (1 - k01(t, 27, 27.7)) * (t >= 27 && t < 28),
                        1 - k01(t, 0, 0.8));
  if(noir > 0){ c.fillStyle = `rgba(4,8,16,${noir})`; c.fillRect(0, 0, Intro.W, Intro.H); }

  // la toile s'efface et découvre la vraie carte
  Intro.cv.style.opacity = 1 - k01(t, DEBUT_DEZOOM, DEBUT_DEZOOM + 1.5);
  document.getElementById('intro').classList.toggle('fondu', t >= DEBUT_DEZOOM);
  if(t >= DEBUT_DEZOOM) dezoom(t);

  // sous-titre courant
  const st = Intro.lignes.find(([a, b]) => t >= a && t < b);
  const html = st ? st[2] : '';
  if(html !== Intro.texte){
    Intro.texte = html;
    document.getElementById('introTexte').innerHTML = html ? `<span>${motParMot(html)}</span>` : '';
  }
  if(typeof IntroMusique !== 'undefined') IntroMusique.suivre(t);

  if(t >= DUREE) terminer(false);
}

function dezoom(t){
  if(!Intro.cam){
    // la cible : la vue d'ensemble telle que le jeu la calcule
    toutVoir();
    const cible = {x:S.cam.x, y:S.cam.y, z:S.cam.z};
    centrer(S.player.capitale || tuilesDe(S.player)[0]);
    const depart = {x:S.cam.x, y:S.cam.y, z:Math.min(7, Math.max(3, cible.z*10))};
    Intro.cam = {depart, cible};
  }
  const {depart, cible} = Intro.cam, k = doux(k01(t, DEBUT_DEZOOM, DUREE));
  S.cam.x = lerp(depart.x, cible.x, k);
  S.cam.y = lerp(depart.y, cible.y, k);
  // zoom en logarithme : la vitesse perçue reste constante
  S.cam.z = Math.exp(lerp(Math.log(depart.z), Math.log(cible.z), k));
}

function terminer(passe){
  if(!Intro.actif) return;
  Intro.actif = false;
  cancelAnimationFrame(Intro.anim);
  // passée : la musique s'efface vite ; jouée jusqu'au bout : le dernier accord résonne
  if(typeof IntroMusique !== 'undefined') IntroMusique.couper(passe ? 0.8 : 3.5);
  window.removeEventListener('keydown', Intro.clavier, true);
  if(passe || !Intro.cam) toutVoir();
  const el = document.getElementById('intro');
  el.classList.add('hidden'); el.classList.remove('fondu');
  document.getElementById('introTexte').innerHTML = '';
  const fin = Intro.fin; Intro.fin = null;
  if(fin) fin();
}

// avance jusqu'au sous-titre suivant
function avancer(){
  const t = tempsIntro(), suivant = Intro.lignes.find(([a]) => a > t + 0.05);
  if(suivant){
    Intro.decalage += suivant[0] - t;
    if(typeof IntroMusique !== 'undefined') IntroMusique.saut(tempsIntro());
  }
  else terminer(true);
}

window.jouerIntro = function(fin){
  const racine = document.getElementById('intro');
  if(!racine || !S.player){ fin && fin(); return; }
  if(Intro.actif) terminer(true);

  Intro.cv = document.getElementById('introcv');
  Intro.cx = Intro.cv.getContext('2d');
  Intro.W = Intro.H = 0;
  Intro.fin = fin; Intro.cam = null; Intro.decalage = 0; Intro.texte = '';
  Intro.lignes = sousTitres();
  Intro.rivaux = S.nations.slice(1, 7);
  Intro.cv.style.opacity = 1;
  racine.classList.remove('hidden', 'fondu');

  Intro.clavier = e => {
    // rien ne doit atteindre le jeu pendant l'introduction (Espace relancerait le temps)
    e.stopImmediatePropagation();
    if(e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();   // pas de défilement de page
    if(['Escape', 'Enter', ' ', 'Spacebar'].includes(e.key)) terminer(true);
  };
  window.addEventListener('keydown', Intro.clavier, true);

  Intro.actif = true;
  Intro.t0 = performance.now();
  if(typeof IntroMusique !== 'undefined') IntroMusique.demarrer();
  Intro.anim = requestAnimationFrame(image);
};

// branchements de la couche
const passer = document.getElementById('introPasser');
if(passer) passer.onclick = e => { e.stopPropagation(); terminer(true); };
const racine = document.getElementById('intro');
if(racine) racine.onclick = () => { if(Intro.actif) avancer(); };

})();
