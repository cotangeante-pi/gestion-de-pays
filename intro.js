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
  cam: null, joues: new Set(), texte: '',
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
// habits de la foule : des tons sourds, pour que la couleur du pays ressorte
const HABITS = ['#6b5a48','#4f5d6e','#7a6a55','#5d4a3f','#48596a','#6e6352','#5a4f63','#735d4a'];
const FOULE = Array.from({length:16}, (_, i) => ({
  // place autour du meneur, les rangs proches sont plus grands
  u: -330 + (i%6)*42 + (Math.floor(i/6)%2)*20,
  v: 104 + Math.floor(i/6)*30 + (i%3)*4,
  habit: HABITS[i % HABITS.length],
  phase: i*1.7,
}));

/* ---------- décor ---------- */
function ciel(haut, bas){
  const c = Intro.cx, g = c.createLinearGradient(0, 0, 0, Y(HORIZON));
  g.addColorStop(0, haut); g.addColorStop(1, bas);
  c.fillStyle = g; c.fillRect(0, 0, Intro.W, Y(HORIZON) + 1);
}
function mer(t, couleur, reflet, decale=0){
  const c = Intro.cx, W = Intro.W, H = Intro.H;
  c.fillStyle = couleur; c.fillRect(0, Y(HORIZON), W, H);
  // houle en couches : plus proche = plus ample et plus rapide
  for(let k=0;k<5;k++){
    const v = HORIZON + 14 + k*k*9, amp = (1.2 + k*1.6)*Intro.s, lg = (60 + k*40)*Intro.s;
    const vit = (18 + k*22) * Intro.s;
    c.strokeStyle = reflet; c.globalAlpha = 0.18 + k*0.07; c.lineWidth = Math.max(1, (0.8 + k*0.5)*Intro.s);
    c.beginPath();
    for(let x=-20; x<=W+20; x+=6){
      const y = Y(v) + Math.sin((x + t*vit + decale*Intro.s + k*97) / lg * Math.PI*2) * amp;
      x === -20 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
  }
  c.globalAlpha = 1;
}
function etoiles(t, a){
  if(a <= 0) return;
  const c = Intro.cx;
  for(const e of ETOILES){
    c.globalAlpha = a * (0.5 + 0.5*Math.sin(t*2 + e.p));
    c.fillStyle = '#e8eeff';
    c.fillRect(X(e.u), Y(e.v), Math.max(1, 1.6*Intro.s), Math.max(1, 1.6*Intro.s));
  }
  c.globalAlpha = 1;
}
function maisons(du){
  const c = Intro.cx, s = Intro.s;
  c.fillStyle = '#1c1a26';
  for(let i=0;i<7;i++){
    const u = -760 + i*95 + du, l = 60 + (i*37)%30, h = 38 + (i*53)%26, v = 78 + (i%2)*6;
    c.fillRect(X(u), Y(v - h), l*s, h*s);
    c.beginPath(); c.moveTo(X(u-6), Y(v-h)); c.lineTo(X(u + l/2), Y(v-h-24)); c.lineTo(X(u+l+6), Y(v-h)); c.fill();
    c.fillStyle = '#e8b35a55'; c.fillRect(X(u + l*0.3), Y(v - h*0.6), 8*s, 9*s);   // une fenêtre éclairée
    c.fillStyle = '#1c1a26';
  }
}
function palmier(u, v, t, sc=1){
  const c = Intro.cx, s = Intro.s*sc, bal = Math.sin(t*1.3 + u)*3;
  c.strokeStyle = '#4a3a28'; c.lineWidth = 5*s; c.lineCap = 'round';
  c.beginPath(); c.moveTo(X(u), Y(v)); c.quadraticCurveTo(X(u+8*sc), Y(v-40*sc), X(u+4*sc+bal), Y(v-78*sc)); c.stroke();
  c.fillStyle = '#2f5a3a';
  for(let i=0;i<6;i++){
    const a = -Math.PI/2 + (i-2.5)*0.55, bx = X(u+4*sc+bal), by = Y(v-78*sc);
    c.beginPath(); c.moveTo(bx, by);
    c.quadraticCurveTo(bx + Math.cos(a-0.3)*30*s, by + Math.sin(a-0.3)*30*s - 6*s,
                       bx + Math.cos(a)*46*s, by + Math.sin(a)*46*s + 14*s);
    c.quadraticCurveTo(bx + Math.cos(a+0.3)*26*s, by + Math.sin(a+0.3)*26*s, bx, by);
    c.fill();
  }
}
function fumee(u, v, t, graine){
  const c = Intro.cx, s = Intro.s;
  for(let i=0;i<7;i++){
    const age = ((t*0.35 + i/7 + graine) % 1);
    c.fillStyle = `rgba(200,200,210,${0.35*(1-age)})`;
    c.beginPath();
    c.arc(X(u + Math.sin(age*5 + graine*9)*6 + age*14), Y(v - age*70), (3 + age*9)*s, 0, 7);
    c.fill();
  }
}
function petitDrapeau(u, v, h, col, t, graine=0){
  const c = Intro.cx, s = Intro.s, on = Math.sin(t*3 + graine)*h*0.07*s;
  c.strokeStyle = '#d8d8de'; c.lineWidth = Math.max(1, h*0.07*s);
  c.beginPath(); c.moveTo(X(u), Y(v)); c.lineTo(X(u), Y(v-h)); c.stroke();
  const w = h*0.62*s, x = X(u), y = Y(v-h);
  c.fillStyle = col;
  c.beginPath(); c.moveTo(x, y);
  c.quadraticCurveTo(x+w*0.5, y+on, x+w, y+h*0.12*s);
  c.quadraticCurveTo(x+w*0.5, y+h*0.2*s+on, x, y+h*0.34*s);
  c.closePath(); c.fill();
}

/* ---------- personnages ---------- */
function personne(u, v, habit, t, phase, marche, dos=false){
  const c = Intro.cx, sc = 0.8 + (v - 90)/260, s = Intro.s*sc;
  const x = X(u), y = Y(v), pas = marche ? Math.sin(t*9 + phase) : 0;
  const bal = marche ? Math.abs(pas)*1.2*s : Math.sin(t*1.8 + phase)*0.5*s;
  c.fillStyle = 'rgba(10,12,20,.35)';
  c.beginPath(); c.ellipse(x, y+1*s, 7*s, 2.2*s, 0, 0, 7); c.fill();
  // jambes
  c.strokeStyle = '#2a2530'; c.lineWidth = 2.6*s; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x-1.5*s, y-12*s); c.lineTo(x-1.5*s + pas*4*s, y);
  c.moveTo(x+1.5*s, y-12*s); c.lineTo(x+1.5*s - pas*4*s, y); c.stroke();
  // corps
  c.fillStyle = habit;
  c.beginPath();
  c.moveTo(x-5*s, y-12*s - bal); c.lineTo(x+5*s, y-12*s - bal);
  c.lineTo(x+3.6*s, y-26*s - bal); c.lineTo(x-3.6*s, y-26*s - bal); c.closePath(); c.fill();
  // tête
  c.fillStyle = dos ? '#3b2c22' : '#c9a282';
  c.beginPath(); c.arc(x, y-30*s - bal, 4.2*s, 0, 7); c.fill();
  c.fillStyle = '#3b2c22';
  c.beginPath(); c.arc(x, y-31*s - bal, 4.3*s, Math.PI, 0); c.fill();
}
// le meneur : plus grand, une cape aux couleurs du pays, et le drapeau à la main
function meneur(u, v, col, t, marche, brasLeve, drapeau=true){
  const c = Intro.cx, sc = 1.15 + (v - 90)/260, s = Intro.s*sc;
  const x = X(u), y = Y(v), pas = marche ? Math.sin(t*9) : 0;
  c.fillStyle = 'rgba(10,12,20,.35)';
  c.beginPath(); c.ellipse(x, y+1*s, 8*s, 2.4*s, 0, 0, 7); c.fill();
  c.strokeStyle = '#231e28'; c.lineWidth = 2.8*s; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x-1.5*s, y-12*s); c.lineTo(x-1.5*s + pas*4*s, y);
  c.moveTo(x+1.5*s, y-12*s); c.lineTo(x+1.5*s - pas*4*s, y); c.stroke();
  // cape qui flotte
  const vent = Math.sin(t*2.4)*2*s;
  c.fillStyle = teinte(col, 0.7);
  c.beginPath(); c.moveTo(x-4*s, y-26*s); c.lineTo(x-10*s + vent, y-4*s); c.lineTo(x+2*s, y-6*s); c.closePath(); c.fill();
  c.fillStyle = '#3a3440';
  c.beginPath(); c.moveTo(x-5*s, y-12*s); c.lineTo(x+5*s, y-12*s);
  c.lineTo(x+3.8*s, y-27*s); c.lineTo(x-3.8*s, y-27*s); c.closePath(); c.fill();
  c.fillStyle = col; c.fillRect(x-4*s, y-17*s, 8*s, 2*s);               // ceinture
  c.fillStyle = '#c9a282'; c.beginPath(); c.arc(x, y-31*s, 4.4*s, 0, 7); c.fill();
  c.fillStyle = '#2a1f18'; c.beginPath(); c.arc(x, y-32*s, 4.5*s, Math.PI, 0); c.fill();
  // bras et hampe : levés quand il harangue
  const lev = brasLeve, mx = x + 4*s, my = y - 24*s;
  const hx = mx + lerp(6, 3, lev)*s, hy = my + lerp(4, -12, lev)*s;
  c.strokeStyle = '#3a3440'; c.lineWidth = 2.4*s;
  c.beginPath(); c.moveTo(mx, my); c.lineTo(hx, hy); c.stroke();
  if(drapeau){
    const hauteur = 40*sc, pied = hy + lerp(20, 12, lev)*s;
    const u2 = (hx - Intro.W/2)/Intro.s, v2 = (pied - Intro.H/2)/Intro.s;
    petitDrapeau(u2, v2, hauteur, col, t);
  }
}

/* ---------- le navire ---------- */
function navire(u, v, sc, t, voile, col, roulis=1){
  const c = Intro.cx, s = Intro.s*sc;
  const a = Math.sin(t*1.4)*0.035*roulis, dy = Math.sin(t*1.9)*2*s*roulis;
  c.save(); c.translate(X(u), Y(v) + dy); c.rotate(a);
  // coque
  c.fillStyle = '#4a3326';
  c.beginPath(); c.moveTo(-70*s, -14*s); c.lineTo(78*s, -16*s);
  c.quadraticCurveTo(66*s, 6*s, 44*s, 10*s); c.lineTo(-52*s, 10*s);
  c.quadraticCurveTo(-66*s, 2*s, -70*s, -14*s); c.fill();
  c.fillStyle = '#6b4a36'; c.fillRect(-66*s, -16*s, 140*s, 4*s);
  c.fillStyle = col; c.fillRect(-58*s, -8*s, 116*s, 2.4*s);             // liseré aux couleurs du pays
  // mât
  c.strokeStyle = '#3a2a1f'; c.lineWidth = 3*s;
  c.beginPath(); c.moveTo(0, -16*s); c.lineTo(0, -118*s); c.stroke();
  c.beginPath(); c.moveTo(-34*s, -104*s); c.lineTo(34*s, -104*s); c.stroke();
  // voile : roulée sur la vergue, puis hissée et gonflée
  const h = 78*voile*s, gonfle = (6 + Math.sin(t*2)*2)*s*voile;
  if(voile > 0.02){
    c.fillStyle = '#e9dfc8';
    c.beginPath(); c.moveTo(-32*s, -104*s); c.lineTo(32*s, -104*s);
    c.quadraticCurveTo(32*s + gonfle, -104*s + h/2, 30*s, -104*s + h);
    c.lineTo(-30*s, -104*s + h);
    c.quadraticCurveTo(-32*s + gonfle, -104*s + h/2, -32*s, -104*s); c.fill();
    c.fillStyle = col; c.globalAlpha = 0.85;
    c.fillRect(-30*s, -104*s + h*0.42, 60*s, h*0.16);
    c.globalAlpha = 1;
  }
  c.fillStyle = '#d8ccb0'; c.fillRect(-33*s, -107*s, 66*s, 4*s);          // voile ferlée
  // pavillon en tête de mât
  const on = Math.sin(t*3)*2*s;
  c.fillStyle = col;
  c.beginPath(); c.moveTo(0, -118*s); c.quadraticCurveTo(10*s, -118*s + on, 22*s, -114*s);
  c.quadraticCurveTo(10*s, -110*s + on, 0, -108*s); c.fill();
  c.restore();
}

/* ===========================================================
   LES SCÈNES
   =========================================================== */

// 1 et 2 — le quai : l'appel, puis l'embarquement
function sceneQuai(t, col){
  const tc = k01(t, 0, 17);
  ciel(mix('#2a1f45', '#1c1836', tc), mix('#e08a4f', '#b0604a', tc));
  // soleil couchant
  const c = Intro.cx;
  c.fillStyle = '#f6c37a'; c.globalAlpha = 0.85;
  c.beginPath(); c.arc(X(380), Y(HORIZON - 12 + tc*20), 34*Intro.s, Math.PI, 0); c.fill();
  c.globalAlpha = 1;
  mer(t, '#2d3350', '#f0a86b');
  // la terre ferme et le quai
  c.fillStyle = '#2b2630';
  c.beginPath(); c.moveTo(0, Y(62)); c.lineTo(X(150), Y(62)); c.lineTo(X(170), Intro.H); c.lineTo(0, Intro.H); c.fill();
  c.fillStyle = '#4a3a2e'; c.fillRect(X(150), Y(92), 130*Intro.s, 7*Intro.s);
  for(let i=0;i<4;i++) c.fillRect(X(160 + i*34), Y(92), 4*Intro.s, 26*Intro.s);
  maisons(0);

  // le navire : amarré, puis voile hissée, puis au large
  const tl = t - 9;
  const hisse = doux(k01(tl, 5.3, 6.6));
  const depart = doux(k01(tl, 6.4, 8.2));
  navire(330 + depart*760, 112, 0.95, t, hisse, col);

  // caisse du meneur
  c.fillStyle = '#5a4332'; c.fillRect(X(-66), Y(104), 44*Intro.s, 22*Intro.s);
  c.strokeStyle = '#3a2a1f'; c.lineWidth = 1.5*Intro.s; c.strokeRect(X(-66), Y(104), 44*Intro.s, 22*Intro.s);

  const QUAI = {u:270, v:96};
  // la foule : elle arrive une à une, puis embarque
  const gens = FOULE.map((p, i) => {
    let u, v, marche = false;
    const arrive = 0.3 + i*0.38;
    if(t < arrive) return null;
    const ka = k01(t, arrive, arrive + 2.2);
    u = lerp(-780, p.u, ka); v = lerp(p.v + 10, p.v, ka); marche = ka < 1;
    if(tl > 0){
      const part = 0.2 + i*0.18;
      const dist = Math.hypot(QUAI.u - p.u, QUAI.v - p.v), kd = borne((tl - part)*260/dist, 0, 1);
      if(kd >= 1) return null;                           // à bord
      if(kd > 0){ u = lerp(p.u, QUAI.u, kd); v = lerp(p.v, QUAI.v, kd); marche = true; }
    }
    return {u, v, marche, p};
  }).filter(Boolean);
  gens.sort((a, b) => a.v - b.v).forEach(g => personne(g.u, g.v, g.p.habit, t, g.p.phase, g.marche, !g.marche));

  // le meneur : il harangue, puis part le dernier
  if(tl < 0){
    const leve = doux(k01(t, 4.4, 5.2));
    meneur(-44, 104, col, t, false, leve);
  } else {
    const kd = borne((tl - 3.6)*300/320, 0, 1);
    if(kd < 1){
      const u = lerp(-44, QUAI.u, kd), v = kd > 0 ? lerp(104, QUAI.v, kd) : 104;
      meneur(u, v, col, t, kd > 0, 1 - kd*0.6);
    }
  }
}

// 3 — la traversée : du jour à la nuit, puis l'aube et la terre
function sceneMer(t, col){
  const tl = t - 17;
  const cles = [                     // [instant, haut du ciel, horizon, mer]
    [0,   '#3f78b8', '#a9cbe6', '#2a5d8f'],
    [3.2, '#3a4f8c', '#e5936a', '#2d4a78'],
    [4.8, '#0b1230', '#243056', '#101c38'],
    [7.2, '#0b1230', '#243056', '#101c38'],
    [9,   '#51407a', '#f2b27c', '#35507a'],
    [10,  '#5a6ea8', '#f5c894', '#3a5c88'],
  ];
  let i = 0; while(i < cles.length-2 && tl > cles[i+1][0]) i++;
  const [ta, h1, b1, m1] = cles[i], [tb, h2, b2, m2] = cles[i+1];
  const k = k01(tl, ta, tb);
  ciel(mix(h1, h2, k), mix(b1, b2, k));
  const nuit = k01(tl, 3.8, 4.8) * (1 - k01(tl, 7.2, 8.6));
  etoiles(t, nuit);
  const c = Intro.cx;
  // lune
  if(nuit > 0){
    c.globalAlpha = nuit; c.fillStyle = '#f2f0e0';
    c.beginPath(); c.arc(X(-300), Y(-190), 18*Intro.s, 0, 7); c.fill(); c.globalAlpha = 1;
  }
  // la terre, au loin
  const ile = k01(tl, 5.6, 8.4);
  if(ile > 0){
    c.fillStyle = mix('#1a2a3a', '#2f5a3a', k01(tl, 7.5, 10));
    c.beginPath(); c.moveTo(X(260), Y(HORIZON));
    c.quadraticCurveTo(X(360), Y(HORIZON - 30*ile), X(480), Y(HORIZON - 8*ile));
    c.quadraticCurveTo(X(540), Y(HORIZON - 16*ile), X(620), Y(HORIZON)); c.fill();
  }
  mer(t, mix(m1, m2, k), nuit > 0.5 ? '#8ea4d8' : '#dfefff', tl*40);
  navire(-40, 96, 1.1, t, 1, col, 1.5);
}

// 4 et 5 — l'arrivée, puis le regard vers l'horizon
function sceneIle(t, col, rivaux){
  const tl = t - 27;
  const pan = -350 * doux(k01(t, 34, 36.6)), fond = pan * 0.5;
  ciel('#5a86c0', '#cfe3f0');
  const c = Intro.cx;
  // rivaux : d'autres îles, d'autres feux, d'autres drapeaux
  rivaux.forEach((r, i) => {
    const u = 250 + i * 70 + fond, v = HORIZON;
    c.fillStyle = '#6f8f86';
    c.beginPath(); c.moveTo(X(u - 40), Y(v));
    c.quadraticCurveTo(X(u), Y(v - 18 - (i%3)*4), X(u + 40), Y(v)); c.fill();
    if(t > 33.4){
      fumee(u - 6, v - 8, t, i*0.37);
      petitDrapeau(u + 8, v - 8, 16, r.col, t, i);
    }
  });
  mer(t, '#3f7fae', '#e8f6ff');
  // la plage
  c.fillStyle = '#d9c28e';
  c.beginPath(); c.moveTo(0, Y(70)); c.lineTo(X(150 + pan), Y(74));
  c.quadraticCurveTo(X(230 + pan), Y(140), X(320 + pan), Intro.H); c.lineTo(0, Intro.H); c.fill();
  c.fillStyle = '#e9d6a6';
  c.beginPath(); c.moveTo(X(150 + pan), Y(74)); c.quadraticCurveTo(X(230 + pan), Y(140), X(320 + pan), Intro.H);
  c.lineTo(X(300 + pan), Intro.H); c.quadraticCurveTo(X(212 + pan), Y(140), X(140 + pan), Y(74)); c.fill();
  palmier(-520 + pan, 88, t, 1.1); palmier(-430 + pan, 80, t, 0.9); palmier(-640 + pan, 96, t, 1.25);

  navire(430 + pan, 104, 0.9, t, 0.15, col, 0.6);

  const DEPART = {u:250, v:118};             // au bord de l'eau : ils arrivent en chaloupe
  const gens = FOULE.map((p, i) => {
    const part = 0.4 + i*0.22, cible = {u: p.u + 60, v: p.v + 14};
    const k = k01(tl, part, part + 2.6);
    if(k <= 0) return null;
    return {u: lerp(DEPART.u, cible.u, k) + pan, v: lerp(DEPART.v, cible.v, k), marche: k < 1, p};
  }).filter(Boolean);
  gens.sort((a, b) => a.v - b.v).forEach(g => personne(g.u, g.v, g.p.habit, t, g.p.phase, g.marche, t > 34));

  // le meneur rejoint la plage et plante le drapeau
  const km = doux(k01(tl, 0.2, 3.0));
  const um = lerp(DEPART.u, -20, km) + pan, vm = lerp(DEPART.v, 132, km);
  const plante = k01(tl, 3.3, 4.2);
  if(plante > 0) petitDrapeau(-4 + pan, 134, 64*doux(plante), col, t);
  meneur(um, vm, col, t, km > 0 && km < 1, plante > 0 ? 0 : 0.3, plante <= 0);
}

/* ---------- le script : sous-titres et sons ---------- */
function sousTitres(){
  const p = S.player, n = S.nations.length - 1;
  const nom = `<b style="color:${p.col}">${echap(p.nom)}</b>`;
  return [
    [0.6,  4.3,  "Il n'y avait plus rien pour nous ici."],
    [4.6,  9,    "« Suivez-moi : au-delà de la mer, une terre nous attend. »"],
    [9.6,  16.4, 'Ils furent des centaines à le croire.'],
    [17.8, 23,   'Des semaines de mer…'],
    [24,   26.8, '« Terre ! »'],
    [28,   33.8, `Ici naîtra ${nom}.`],
    [34.2, 36.6, "Mais nous n'étions pas seuls."],
    [36.8, 39.4, n > 1 ? `${n} peuples convoitaient déjà ces terres.`
                       : 'Un autre peuple convoitait déjà ces terres.'],
    [40,   DUREE, `${n + 1} nations. À toi de régner.`],
  ];
}
const SONS = [[4.6,'avance'], [14.3,'coloniser'], [24,'decouverte'], [30.4,'traite'], [34.4,'message'], [40,'debut']];

/* ===========================================================
   MOTEUR
   =========================================================== */

function dimensionner(){
  const cv = Intro.cv, dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth || window.innerWidth, H = cv.clientHeight || window.innerHeight;
  if(W === Intro.W && H === Intro.H && cv.width === Math.round(W*dpr)) return;
  Intro.W = W; Intro.H = H;
  cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  Intro.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // en portrait on resserre le cadre plutôt que de rapetisser la scène
  Intro.s = Math.max(Math.min(W/1000, H/620), Math.min(W/640, H/900));
}

function tempsIntro(){ return (performance.now() - Intro.t0)/1000 + Intro.decalage; }

function image(){
  if(!Intro.actif) return;
  Intro.anim = requestAnimationFrame(image);
  dimensionner();
  const t = tempsIntro(), c = Intro.cx, col = S.player.col;

  if(t < 17)      sceneQuai(t, col);
  else if(t < 27) sceneMer(t, col);
  else            sceneIle(t, col, Intro.rivaux);

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
    const el = document.getElementById('introTexte');
    el.innerHTML = html ? `<span>${html}</span>` : '';
  }
  // sons : seulement ceux qu'on vient de franchir, pas ceux qu'on a sautés
  for(const [a, nom] of SONS)
    if(!Intro.joues.has(a) && t >= a){
      Intro.joues.add(a);
      if(t - a < 0.5 && typeof SON !== 'undefined') SON.jouer(nom);
    }

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
  if(suivant) Intro.decalage += suivant[0] - t;
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
  Intro.joues = new Set();
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
  Intro.anim = requestAnimationFrame(image);
};

// branchements de la couche
const passer = document.getElementById('introPasser');
if(passer) passer.onclick = e => { e.stopPropagation(); terminer(true); };
const racine = document.getElementById('intro');
if(racine) racine.onclick = () => { if(Intro.actif) avancer(); };

})();
