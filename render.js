/* ===========================================================
   RENDU — relief cuit dans une image + décors vectoriels animés
   =========================================================== */

const cv = document.getElementById('map');
const cx = cv.getContext('2d');

let VW = 1200, VH = 700;      // dimensions logiques (indépendantes du zoom écran)
let temps = 0, dernier = 0;
let survol = null;
const lift = new Map();
const FX = [];
const nuages = [];

// image du relief
let carteImg = null, OX = 0, OY = 0, IW = 0, IH = 0;

/* ---------- couleurs ---------- */
function hex2rgb(h){ return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
function sh(col, f, a=1){
  const [r,g,b] = typeof col==='string'? hex2rgb(col) : col;
  return `rgba(${clamp(r*f,0,255)|0},${clamp(g*f,0,255)|0},${clamp(b*f,0,255)|0},${a})`;
}
function bruitTuile(t){ const n = Math.sin(t.q*127.1 + t.r*311.7)*43758.5453; return n - Math.floor(n); }

/* ===========================================================
   CUISSON DU RELIEF
   =========================================================== */

function construireCarte(){
  preparerTables();
  const centres = [...S.tiles.values()].map(t=>({t, x:HS*Math.sqrt(3)*(t.q+t.r/2), y:HS*1.5*t.r}));
  const minX = Math.min(...centres.map(c=>c.x)) - HS*1.1;
  const maxX = Math.max(...centres.map(c=>c.x)) + HS*1.1;
  const minY = Math.min(...centres.map(c=>c.y)) - HS*1.1;
  const maxY = Math.max(...centres.map(c=>c.y)) + HS*1.1;

  OX = minX;
  OY = minY*SQ - 2.1*ZH;
  IW = Math.ceil(maxX - OX + 4);
  IH = Math.ceil(maxY*SQ + 0.6*ZH - OY);

  carteImg = document.createElement('canvas');
  carteImg.width = IW; carteImg.height = IH;
  const g = carteImg.getContext('2d');
  g.fillStyle = '#0b2c5c'; g.fillRect(0,0,IW,IH);   // même haute mer que le fond d'écran

  const nx = Math.ceil((maxX-minX)/PAS) + 2;
  const ligne = ()=> ({h:new Float32Array(nx), e:new Array(nx)});
  let cur = ligne(), suiv = ligne();
  const calc = (wy, L)=>{
    for(let i=0;i<nx;i++){
      const wx = minX + i*PAS;
      const e = echantillon(wx, wy);
      L.e[i] = e; L.h[i] = hauteurMonde(wx, wy, e);
    }
  };

  calc(minY, cur);
  for(let wy = minY; wy <= maxY; wy += PAS){
    calc(wy + PAS, suiv);
    for(let i=1;i<nx-1;i++){
      const wx = minX + i*PAS;
      const h = cur.h[i];
      const gx = (cur.h[i+1] - cur.h[i-1])/(2*PAS)*ZH;
      const gy = (suiv.h[i] - cur.h[i])/PAS*ZH;
      const pente = Math.min(1.6, Math.hypot(gx, gy));
      const {c, eau} = couleurSol(cur.e[i], h, pente);
      let lum;
      if(eau){
        const ond = Math.sin(wx*0.035 + wy*0.02 + Math.sin(wy*0.01)*2)*0.018;
        lum = 0.96 + ond;
      } else {
        lum = 0.80 + gx*0.62 - gy*0.24;           // lumière rasante venue de la gauche
        lum -= clamp(pente-0.9, 0, 1)*0.12;        // les à-pics restent sombres
      }
      lum = clamp(lum, 0.42, 1.4);

      const y1 = wy*SQ - h*ZH - OY;
      const y2 = (wy+PAS)*SQ - suiv.h[i]*ZH - OY;
      const haut = Math.max(PAS*SQ + 1, y2 - y1 + 1);
      g.fillStyle = sh(c, lum);
      g.fillRect(wx - OX, y1, PAS + 1.2, haut);
      if(haut > PAS*SQ*5){            // vrai à-pic : dégradé vertical, pas de bande nette
        const n = Math.min(6, Math.floor(haut/PAS));
        for(let k=1;k<=n;k++){
          g.fillStyle = sh(c, lum*(1 - 0.09*k), 0.5);
          g.fillRect(wx - OX, y1 + PAS*SQ + (haut-PAS*SQ)*(k-1)/n, PAS + 1.2, (haut-PAS*SQ)/n + 1);
        }
      }
    }
    const tmp = cur; cur = suiv; suiv = tmp;
  }
  cuireVegetation(g);
  calculerGeo();
  preparerMini();
}

// arbres, rochers, cactus et herbes cuits dans l'image
function cuireVegetation(g){
  const items = [];
  for(const t of S.tiles.values()){
    if(t.terr === 'ocean') continue;
    const c = {x:HS*Math.sqrt(3)*(t.q+t.r/2), y:HS*1.5*t.r};
    const densite = {foret:16, plaine:5, montagne:7, desert:4, cote:3}[t.terr] || 0;
    for(let i=0;i<densite;i++){
      const a = hh(t.q*31+i, t.r*17+i*7)*6.283, d = Math.sqrt(hh(i, t.q+t.r*13))*HS*0.82;
      const wx = c.x + Math.cos(a)*d, wy = c.y + Math.sin(a)*d*1.0;
      const h = hauteurMonde(wx, wy);
      if(h < 0.06) continue;
      items.push({wx, wy, h, terr:t.terr, k:hh(i*3+t.q, t.r)});
    }
  }
  items.sort((a,b)=> a.wy - b.wy);
  for(const it of items){
    const x = it.wx - OX, y = it.wy*SQ - it.h*ZH - OY;
    g.fillStyle = 'rgba(12,20,30,.22)';
    g.beginPath(); g.ellipse(x, y+1, 3.4, 1.5, 0, 0, 7); g.fill();
    if(it.terr === 'foret' || (it.terr === 'plaine' && it.k > 0.72)){
      const ht = 9 + it.k*7;
      g.fillStyle = '#4a3521';
      g.fillRect(x-0.8, y-ht*0.35, 1.6, ht*0.35);
      g.fillStyle = it.k > 0.5 ? '#2a6b35' : '#23592c';
      g.beginPath(); g.moveTo(x-4.2, y-ht*0.3); g.lineTo(x, y-ht); g.lineTo(x+4.2, y-ht*0.3); g.closePath(); g.fill();
      g.fillStyle = it.k > 0.5 ? '#327a3d' : '#2a6733';
      g.beginPath(); g.moveTo(x-3.2, y-ht*0.58); g.lineTo(x, y-ht*1.15); g.lineTo(x+3.2, y-ht*0.58); g.closePath(); g.fill();
    } else if(it.terr === 'montagne'){
      const s = 3 + it.k*4;
      g.fillStyle = '#6d675c';
      g.beginPath(); g.moveTo(x-s, y); g.lineTo(x-s*0.4, y-s*1.5); g.lineTo(x+s*0.6, y-s*1.1);
      g.lineTo(x+s, y); g.closePath(); g.fill();
      g.fillStyle = '#857f72';
      g.beginPath(); g.moveTo(x-s*0.4, y-s*1.5); g.lineTo(x+s*0.6, y-s*1.1); g.lineTo(x+s*0.1, y-s*0.6); g.closePath(); g.fill();
    } else if(it.terr === 'desert'){
      g.strokeStyle = '#4d7a43'; g.lineWidth = 2.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y-8);
      g.moveTo(x, y-4); g.lineTo(x-3, y-6.5); g.moveTo(x, y-5.5); g.lineTo(x+3, y-8); g.stroke();
    } else {
      g.strokeStyle = 'rgba(150,200,130,.55)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x+1.5, y-4); g.moveTo(x, y); g.lineTo(x-1.5, y-3.5); g.stroke();
    }
  }
}

// géométrie de chaque province : centre et coins avec leur altitude réelle
function calculerGeo(){
  for(const t of S.tiles.values()){
    const cxw = HS*Math.sqrt(3)*(t.q + t.r/2), cyw = HS*1.5*t.r;
    const coins = [];
    for(let i=0;i<6;i++){
      const a = Math.PI/180*(60*i-30);
      const wx = cxw + HS*0.99*Math.cos(a), wy = cyw + HS*0.99*Math.sin(a);
      coins.push({wx, wy, h: Math.max(0, hauteurMonde(wx, wy))});
    }
    t.geo = {wx:cxw, wy:cyw, h: Math.max(0, hauteurMonde(cxw, cyw)), coins};
  }
}

/* ===========================================================
   PROJECTION
   =========================================================== */

function projeter(wx, wy, h){
  const z = S.cam.z;
  return {x:(wx + S.cam.x)*z + VW/2, y:((wy*SQ - h*ZH) + S.cam.y*SQ)*z + VH/2};
}
function ecran(t){
  const l = lift.get(t) || 0;
  return projeter(t.geo.wx, t.geo.wy, t.geo.h + l);
}
function coinsEcran(t, k=1){
  const l = lift.get(t) || 0;
  return t.geo.coins.map(c=>{
    const wx = t.geo.wx + (c.wx - t.geo.wx)*k, wy = t.geo.wy + (c.wy - t.geo.wy)*k;
    const p = projeter(wx, wy, c.h + l);
    return [p.x, p.y];
  });
}
// côté de l'hexagone (coins e et e+1) qui fait face à chaque direction de DIRS
const COTE = [0, 5, 4, 3, 2, 1];

function trace(pts){
  cx.beginPath();
  pts.forEach((p,i)=> i? cx.lineTo(p[0],p[1]) : cx.moveTo(p[0],p[1]));
  cx.closePath();
}
function hexPos(t){ return {x:HS*Math.sqrt(3)*(t.q + t.r/2), y:HS*1.5*t.r}; }

/* ---------- adaptation à toutes les tailles d'écran ---------- */
function resize(){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  VW = cv.clientWidth || 800; VH = cv.clientHeight || 600;
  cv.width = Math.round(VW*dpr); cv.height = Math.round(VH*dpr);
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', ()=>{ resize(); adapterInterface(); });

// zoom qui fait tenir tout le monde à l'écran
function zoomAjuste(){
  if(!IW) return 1;
  return clamp(Math.min(VW/(IW*1.04), VH/(IH*1.04)), 0.25, 1.6);
}
function toutVoir(){
  S.cam.z = zoomAjuste();
  const cxw = OX + IW/2;
  S.cam.x = -cxw;
  S.cam.y = -((OY + IH/2) )/SQ;
  camCible = null;
}

/* ===========================================================
   PETITS VOLUMES
   =========================================================== */

function boite(x, y, w, h, col){
  const d = w*SQ;
  cx.fillStyle = sh(col,1.12);
  trace([[x,y-h-d/2],[x+w/2,y-h],[x,y-h+d/2],[x-w/2,y-h]]); cx.fill();
  cx.fillStyle = sh(col,0.72);
  cx.beginPath(); cx.moveTo(x-w/2,y-h); cx.lineTo(x,y-h+d/2); cx.lineTo(x,y+d/2); cx.lineTo(x-w/2,y); cx.closePath(); cx.fill();
  cx.fillStyle = sh(col,0.5);
  cx.beginPath(); cx.moveTo(x+w/2,y-h); cx.lineTo(x,y-h+d/2); cx.lineTo(x,y+d/2); cx.lineTo(x+w/2,y); cx.closePath(); cx.fill();
}
function cone(x, y, w, h, col){
  cx.fillStyle = sh(col,1.05);
  cx.beginPath(); cx.moveTo(x-w/2,y); cx.lineTo(x,y-h); cx.lineTo(x,y+w*SQ/2); cx.closePath(); cx.fill();
  cx.fillStyle = sh(col,0.62);
  cx.beginPath(); cx.moveTo(x+w/2,y); cx.lineTo(x,y-h); cx.lineTo(x,y+w*SQ/2); cx.closePath(); cx.fill();
}
function drapeau(x, y, h, col, t=0){
  cx.strokeStyle='#d8d8de'; cx.lineWidth=Math.max(1,h*0.08);
  cx.beginPath(); cx.moveTo(x,y); cx.lineTo(x,y-h); cx.stroke();
  const w = h*0.62, on = Math.sin(temps*3+t)*h*0.07;
  cx.fillStyle = col;
  cx.beginPath(); cx.moveTo(x,y-h);
  cx.quadraticCurveTo(x+w*0.5, y-h+on, x+w, y-h+h*0.12);
  cx.quadraticCurveTo(x+w*0.5, y-h+h*0.2+on, x, y-h+h*0.34);
  cx.closePath(); cx.fill();
}
function fumee(x, y, s, t){
  for(let i=0;i<4;i++){
    const p = (temps*0.45 + i*0.25 + t) % 1;
    cx.fillStyle = `rgba(210,215,225,${0.3*(1-p)})`;
    cx.beginPath(); cx.arc(x + Math.sin(p*6+t)*s*0.6, y - p*s*3.4, s*(0.35+p*0.8), 0, 7); cx.fill();
  }
}

/* ---------- bâtiments ---------- */
function batiment(t, x, y, z, col){
  const s = z;
  switch(t.bld){
    case 'ferme':
      cx.fillStyle = 'rgba(201,163,74,.85)';
      trace(coinsEcran(t, 0.5)); cx.fill();
      boite(x-4*s, y+2*s, 15*s, 10*s, '#b4483c');
      cone(x-4*s, y-12*s, 17*s, 8*s, '#8c3329');
      break;
    case 'mine':
      boite(x, y+3*s, 16*s, 8*s, '#6f6f7a');
      cone(x+9*s, y+1*s, 16*s, 13*s, '#5d5d68');
      cx.fillStyle='#22262e';
      cx.beginPath(); cx.ellipse(x-2*s, y-3*s, 4*s, 5*s, 0, 0, 7); cx.fill();
      break;
    case 'port': {
      cx.fillStyle='#8a6a42'; cx.fillRect(x-16*s, y-1*s, 24*s, 4*s);
      boite(x-12*s, y+2*s, 12*s, 9*s, '#a8763f');
      const bob = Math.sin(temps*1.8)*2*s;
      cx.fillStyle='#d8dde5';
      cx.beginPath(); cx.moveTo(x+4*s, y+6*s+bob); cx.lineTo(x+20*s,y+6*s+bob);
      cx.lineTo(x+17*s,y+12*s+bob); cx.lineTo(x+7*s,y+12*s+bob); cx.closePath(); cx.fill();
      cx.strokeStyle='#eef1f6'; cx.lineWidth=1.4*s;
      cx.beginPath(); cx.moveTo(x+12*s,y+6*s+bob); cx.lineTo(x+12*s,y-6*s+bob); cx.stroke();
      cx.fillStyle='#e9edf4';
      cx.beginPath(); cx.moveTo(x+12*s,y-6*s+bob); cx.lineTo(x+20*s,y+3*s+bob); cx.lineTo(x+12*s,y+3*s+bob); cx.closePath(); cx.fill();
      break; }
    case 'usine':
      boite(x-3*s, y+4*s, 26*s, 14*s, '#7a8290');
      boite(x+10*s, y+1*s, 8*s, 24*s, '#6a727e');
      fumee(x+10*s, y-23*s, 4.5*s, bruitTuile(t)*6);
      cx.fillStyle='rgba(255,215,120,.85)';
      for(let i=0;i<3;i++) cx.fillRect(x-13*s+i*7*s, y-4*s, 4*s, 4*s);
      break;
    case 'centrale': {
      boite(x, y+4*s, 20*s, 20*s, '#5f6875');
      const pulse = 0.55 + Math.sin(temps*3)*0.35;
      cx.fillStyle = `rgba(120,220,255,${pulse})`;
      cx.beginPath(); cx.arc(x, y-18*s, 6*s, 0, 7); cx.fill();
      cx.fillStyle = `rgba(120,220,255,${pulse*0.22})`;
      cx.beginPath(); cx.arc(x, y-18*s, 13*s, 0, 7); cx.fill();
      break; }
    case 'universite':
      boite(x, y+4*s, 24*s, 12*s, '#d9dce4');
      cx.fillStyle='#4f8fd6';
      cx.beginPath(); cx.arc(x, y-14*s, 10*s, Math.PI, 0); cx.fill();
      drapeau(x, y-24*s, 12*s, '#7fd0ff');
      break;
    case 'caserne':
      boite(x, y+4*s, 26*s, 13*s, '#8b8577');
      cx.fillStyle = sh('#8b8577',1.15);
      for(let i=-1;i<=1;i++) cx.fillRect(x+i*9*s-3*s, y-17*s, 6*s, 5*s);
      boite(x-13*s, y+3*s, 8*s, 18*s, '#7b7568');
      drapeau(x-13*s, y-16*s, 13*s, col);
      break;
  }
}

/* ---------- garnison ---------- */
function soldat(x, y, s, col, t){
  const bal = Math.sin(temps*2.2 + t)*0.6*s;
  cx.fillStyle = 'rgba(15,22,34,.35)';
  cx.beginPath(); cx.ellipse(x, y+1*s, 3.4*s, 1.4*s, 0, 0, 7); cx.fill();
  cx.fillStyle = col; cx.fillRect(x-1.6*s+bal, y-7*s, 3.2*s, 6*s);
  cx.fillStyle = sh(hex2rgb(col), 0.6);
  cx.beginPath(); cx.arc(x+bal, y-8.2*s, 2.1*s, Math.PI, 0); cx.fill();
}
function charFig(x, y, s, col, t){
  const av = Math.sin(temps*1.1 + t)*1.6*s;
  cx.fillStyle = 'rgba(20,28,42,.4)';
  cx.beginPath(); cx.ellipse(x+av, y+1.5*s, 7*s, 2.6*s, 0, 0, 7); cx.fill();
  boite(x+av, y, 11*s, 4.5*s, col);
  cx.fillStyle = sh(hex2rgb(col), 0.75); cx.fillRect(x+av-1*s, y-9*s, 9*s, 1.6*s);
  cx.fillStyle = '#26303f'; cx.fillRect(x+av-6*s, y-1*s, 12*s, 2*s);
}
function avionFig(x, y, s, col, t){
  const a = temps*0.9 + t, R = 28*s;
  const ax = x + Math.cos(a)*R, ay = y - 34*s + Math.sin(a)*R*SQ;
  cx.fillStyle = 'rgba(10,16,28,.22)';
  cx.beginPath(); cx.ellipse(ax, y+2*s, 5*s, 2*s, 0, 0, 7); cx.fill();
  cx.save(); cx.translate(ax, ay); cx.rotate(a + Math.PI/2);
  cx.fillStyle = col;
  cx.beginPath(); cx.moveTo(0,-5*s); cx.lineTo(4*s,5*s); cx.lineTo(0,3*s); cx.lineTo(-4*s,5*s); cx.closePath(); cx.fill();
  cx.restore();
}
function garnison(n, x, y, z){
  const a = n.armee, s = z; let i = 0;
  const pose = ()=> [x - 24*s + (i%3)*16*s, y + 11*s + Math.floor(i/3)*6*s, i++];
  for(let k=0;k<Math.min(3, a.infanterie);k++){ const [px,py,t]=pose(); soldat(px,py,s,n.col,t*1.7); }
  for(let k=0;k<Math.min(2, a.chars);k++){ const [px,py,t]=pose(); charFig(px,py,s,n.col,t*2.3); }
  for(let k=0;k<Math.min(2, a.avions);k++) avionFig(x, y, s, n.col, k*3.1);
}

/* ===========================================================
   EFFETS — bataille « au contact », sans violence
   =========================================================== */

function fxBataille(tuile, colA, colD, gagne, txt){
  FX.push({type:'bat', t:tuile, vie:2.2, max:2.2, colA, colD, gagne});
  FX.push({type:'txt', t:tuile, vie:2.4, txt, col: gagne?'#8fe3b4':'#ffcf8a', dy:0});
}
function fxTexte(tuile, txt, col){ FX.push({type:'txt', t:tuile, vie:1.8, txt, col, dy:0}); }

function majFX(dt){
  for(let i=FX.length-1;i>=0;i--){
    const f = FX[i];
    f.vie -= dt;
    if(f.type==='txt') f.dy += 26*dt;
    if(f.vie<=0) FX.splice(i,1);
  }
}
function dessinerFX(){
  const z = S.cam.z;
  for(const f of FX){
    if(!f.t.geo) continue;
    const p = ecran(f.t);
    if(f.type==='bat'){
      const k = 1 - f.vie/f.max;                       // 0 → 1
      const app = Math.min(1, k*2.2);                  // phase d'approche
      const pousse = k>0.45 ? (k-0.45)/0.55 : 0;
      const dec = (1-app)*34*z + (f.gagne? -pousse*9*z : pousse*6*z);

      cx.globalAlpha = clamp(f.vie/f.max*1.6, 0, 1);
      // poussière du contact
      const r = 8*z + k*34*z;
      cx.strokeStyle = `rgba(226,214,190,${0.5*(1-k)})`; cx.lineWidth = 2.4*z;
      cx.beginPath(); cx.ellipse(p.x, p.y, r, r*SQ, 0, 0, 7); cx.stroke();
      for(let i=0;i<7;i++){
        const a = i*0.9 + k*2;
        cx.fillStyle = `rgba(214,203,178,${0.28*(1-k)})`;
        cx.beginPath();
        cx.arc(p.x + Math.cos(a)*r*0.7, p.y + Math.sin(a)*r*0.7*SQ - k*10*z, (3+i*0.6)*z, 0, 7);
        cx.fill();
      }
      // deux lignes de fanions qui se rejoignent au centre
      for(let s=0;s<2;s++){
        const dir = s? 1 : -1, col = s? f.colD : f.colA;
        for(let i=0;i<3;i++){
          const x = p.x + dir*(dec + 9*z + i*0) - dir*i*0*z;
          const yy = p.y + (i-1)*7*z;
          const bal = Math.sin(temps*7 + i + s*2)*1.6*z;
          cx.strokeStyle = '#e8ecf5'; cx.lineWidth = 1.4*z;
          cx.beginPath(); cx.moveTo(x, yy); cx.lineTo(x, yy-13*z); cx.stroke();
          cx.fillStyle = col;
          cx.beginPath(); cx.moveTo(x, yy-13*z);
          cx.lineTo(x + dir*9*z, yy-10.5*z + bal);
          cx.lineTo(x, yy-8*z); cx.closePath(); cx.fill();
        }
      }
      // bouclier central : le « choc »
      const pulse = 0.35 + Math.sin(k*18)*0.2*(1-k);
      cx.strokeStyle = `rgba(255,255,255,${pulse})`; cx.lineWidth = 2*z;
      cx.beginPath(); cx.ellipse(p.x, p.y - 6*z, 13*z, 13*z*SQ, 0, 0, 7); cx.stroke();
      cx.globalAlpha = 1;
    } else {
      cx.globalAlpha = clamp(f.vie/1.4, 0, 1);
      cx.font = `700 ${13.5*z}px "Segoe UI",sans-serif`;
      cx.textAlign = 'center';
      cx.lineWidth = 3.5; cx.strokeStyle = '#080d17';
      cx.strokeText(f.txt, p.x, p.y - 44*z - f.dy);
      cx.fillStyle = f.col; cx.fillText(f.txt, p.x, p.y - 44*z - f.dy);
      cx.globalAlpha = 1;
    }
  }
}

/* ---------- nuages ---------- */
function initNuages(){
  nuages.length = 0;
  for(let i=0;i<12;i++) nuages.push({
    x:(Math.random()-.5)*2400, y:(Math.random()-.5)*1600,
    s:55+Math.random()*95, v:5+Math.random()*9, o:.03+Math.random()*.035});
}
function dessinerNuages(dt){
  const z = S.cam.z;
  for(const n of nuages){
    n.x += n.v*dt;
    if(n.x > 1400) n.x = -1400;
    const p = projeter(n.x, n.y, 2.6);
    cx.fillStyle = `rgba(228,238,255,${n.o})`;
    cx.beginPath(); cx.ellipse(p.x, p.y, n.s*z, n.s*0.3*z, 0, 0, 7); cx.fill();
    cx.beginPath(); cx.ellipse(p.x + n.s*0.45*z, p.y + 4*z, n.s*0.55*z, n.s*0.2*z, 0, 0, 7); cx.fill();
  }
}

/* ===========================================================
   BOUCLE DE RENDU
   =========================================================== */

function dessiner(ts){
  const now = ts!==undefined ? ts/1000 : temps;
  const dt = Math.min(0.05, (now - dernier) || 0.016);
  dernier = now; temps = now;

  cx.fillStyle = '#0b2c5c'; cx.fillRect(0,0,VW,VH);   // haute mer : prolonge l'image du relief

  majCamera(dt);
  const z = S.cam.z;

  // relief cuit
  if(carteImg){
    const p = projeter(OX, 0, 0);
    cx.imageSmoothingEnabled = true;
    cx.drawImage(carteImg, p.x, (OY + S.cam.y*SQ)*z + VH/2, IW*z, IH*z);
  }

  // animation de soulèvement au survol
  for(const t of S.tiles.values()){
    const c = (t===survol && t.terr!=='ocean') ? 0.10 : (t===S.sel ? 0.05 : 0);
    const cur = lift.get(t) || 0;
    if(Math.abs(cur-c) > 0.001) lift.set(t, cur + (c-cur)*Math.min(1, dt*9));
  }

  const visibles = [];
  for(const t of S.tiles.values()){
    if(!t.geo) continue;
    const p = ecran(t);
    const m = HS*2.4*z;
    if(p.x < -m || p.y < -m*3 || p.x > VW+m || p.y > VH+m) continue;
    visibles.push([t,p]);
  }
  visibles.sort((a,b)=> (a[0].r - b[0].r) || (a[0].q - b[0].q));

  for(const [t,p] of visibles) calqueTuile(t, p, z);
  for(const [t,p] of visibles) propsTuile(t, p, z);

  dessinerNuages(dt);
  dessinerFX();
  majFX(dt);
  dessinerMini();
}

// teintes nationales, occupation, frontières
function calqueTuile(t, p, z){
  if(t.terr === 'ocean'){
    const b = bruitTuile(t);
    cx.strokeStyle = `rgba(190,225,255,${0.045 + Math.sin(temps*1.5 + b*6)*0.035})`;
    cx.lineWidth = 1.6*z;
    cx.beginPath();
    cx.ellipse(p.x + Math.sin(temps + b*6)*6*z, p.y, 16*z, 4*z, 0, Math.PI*0.1, Math.PI*0.9);
    cx.stroke();
    return;
  }
  const n = t.owner!==null ? S.nations[t.owner] : null;
  const pts = coinsEcran(t);

  if(n){
    let col = hex2rgb(n.col);
    if(t.occ){                                   // province en cours d'invasion
      const o = hex2rgb(S.nations[t.occ.par].col), k = t.occ.val*0.85;
      col = [col[0]+(o[0]-col[0])*k, col[1]+(o[1]-col[1])*k, col[2]+(o[2]-col[2])*k];
    }
    trace(pts); cx.fillStyle = sh(col, 1, t.owner===S.player.id ? 0.34 : 0.29); cx.fill();

    // frontière : tous les côtés qui donnent sur l'extérieur, en double trait
    const bords = [];
    for(let i=0;i<6;i++){
      const v = T(t.q+DIRS[i][0], t.r+DIRS[i][1]);
      if(v && v.owner===t.owner) continue;       // côté intérieur au pays : rien
      const e = COTE[i];                         // côté de l'hexagone face à cette direction
      bords.push([pts[e], pts[(e+1)%6]]);
    }
    if(bords.length){
      cx.lineJoin = 'round'; cx.lineCap = 'round';
      cx.strokeStyle = 'rgba(6,11,20,.65)';      // liseré sombre, pour détacher du sol
      cx.lineWidth = (t.owner===S.player.id ? 5.4 : 4.6)*z;
      cx.beginPath();
      for(const [a,b] of bords){ cx.moveTo(a[0],a[1]); cx.lineTo(b[0],b[1]); }
      cx.stroke();
      cx.strokeStyle = sh(hex2rgb(n.col), 1.15, .98);
      cx.lineWidth = (t.owner===S.player.id ? 3 : 2.4)*z;
      cx.beginPath();
      for(const [a,b] of bords){ cx.moveTo(a[0],a[1]); cx.lineTo(b[0],b[1]); }
      cx.stroke();
      if(t.owner===S.player.id){                 // halo sur tes propres frontières
        cx.strokeStyle = sh(hex2rgb(n.col), 1.4, .28);
        cx.lineWidth = 8*z;
        cx.beginPath();
        for(const [a,b] of bords){ cx.moveTo(a[0],a[1]); cx.lineTo(b[0],b[1]); }
        cx.stroke();
      }
    }
  }
  if(t.fort > 0){
    cx.strokeStyle = 'rgba(226,231,240,.4)'; cx.lineWidth = 1.8*z;
    trace(coinsEcran(t, 0.82)); cx.stroke();
  }
  if(t === S.sel){
    const pul = 0.5 + Math.sin(temps*4)*0.3;
    trace(coinsEcran(t, 1.02));
    cx.strokeStyle = `rgba(255,255,255,${pul})`; cx.lineWidth = 2.4*z; cx.stroke();
  } else if(t === survol){
    trace(coinsEcran(t, 1.01));
    cx.strokeStyle = 'rgba(255,255,255,.35)'; cx.lineWidth = 1.8*z; cx.stroke();
  }
}

// bâtiments, capitales, jauges d'occupation
function propsTuile(t, p, z){
  if(t.terr === 'ocean' || z < 0.42) return;
  const n = t.owner!==null ? S.nations[t.owner] : null;
  if(t.bld) batiment(t, p.x, p.y, z, n? n.col : '#999');
  if(n && n.capitale === t){
    boite(p.x + 15*z, p.y - 3*z, 9*z, 22*z, '#b9bcc6');
    drapeau(p.x + 15*z, p.y - 25*z, 16*z, n.col, t.q);
    garnison(n, p.x, p.y, z);
  }
  if(t.occ){                                     // jauge d'avancée du front
    const w = 30*z, y = p.y - 30*z;
    cx.fillStyle = 'rgba(8,13,23,.75)';
    cx.fillRect(p.x - w/2 - 1, y - 1, w + 2, 6*z + 2);
    cx.fillStyle = S.nations[t.occ.par].col;
    cx.fillRect(p.x - w/2, y, w*clamp(t.occ.val,0,1), 6*z);
    cx.strokeStyle = 'rgba(255,255,255,.35)'; cx.lineWidth = 1;
    cx.strokeRect(p.x - w/2, y, w, 6*z);
  }
}

/* ===========================================================
   MINI-CARTE
   =========================================================== */

const mcv = document.getElementById('minicv');
const mcx = mcv.getContext('2d');
let MS = 1, MOX = 0, MOY = 0, miniVisible = true;

function preparerMini(){
  const xs = [], ys = [];
  for(const t of S.tiles.values()){
    xs.push(t.centre.x); ys.push(t.centre.y);
  }
  const minX = Math.min(...xs) - HS, maxX = Math.max(...xs) + HS;
  const minY = (Math.min(...ys) - HS)*SQ, maxY = (Math.max(...ys) + HS)*SQ;
  MS = Math.min((mcv.width - 8)/(maxX-minX), (mcv.height - 8)/(maxY-minY));
  MOX = -minX*MS + (mcv.width  - (maxX-minX)*MS)/2;
  MOY = -minY*MS + (mcv.height - (maxY-minY)*MS)/2;
}
const miniPt = (wx, wy)=> [wx*MS + MOX, wy*SQ*MS + MOY];

function dessinerMini(){
  if(!miniVisible || !MS) return;
  const W = mcv.width, H = mcv.height;
  mcx.fillStyle = '#0a1a2e'; mcx.fillRect(0,0,W,H);

  const rayon = HS*MS*0.99;
  for(const t of S.tiles.values()){
    const [x,y] = miniPt(t.centre.x, t.centre.y);
    const n = t.owner!==null ? S.nations[t.owner] : null;
    // petite forme d'hexagone, écrasée comme la grande carte
    mcx.beginPath();
    for(let i=0;i<6;i++){
      const a = Math.PI/180*(60*i-30);
      const px = x + rayon*Math.cos(a), py = y + rayon*Math.sin(a)*SQ;
      i? mcx.lineTo(px,py) : mcx.moveTo(px,py);
    }
    mcx.closePath();
    if(t.terr === 'ocean'){ mcx.fillStyle = '#13294a'; mcx.fill(); continue; }
    let base = {cote:'#b2a075', plaine:'#4c7f42', foret:'#2c5f36',
                montagne:'#6e6a63', desert:'#bda568'}[t.terr];
    mcx.fillStyle = base; mcx.fill();
    if(n){
      let col = hex2rgb(n.col);
      if(t.occ){
        const o = hex2rgb(S.nations[t.occ.par].col), k = t.occ.val*0.85;
        col = [col[0]+(o[0]-col[0])*k, col[1]+(o[1]-col[1])*k, col[2]+(o[2]-col[2])*k];
      }
      mcx.fillStyle = sh(col, 1, n.joueur ? 0.85 : 0.72); mcx.fill();
    }
  }
  // frontières nationales
  mcx.lineCap = 'round';
  for(const t of S.tiles.values()){
    if(t.owner===null) continue;
    const n = S.nations[t.owner];
    const [x,y] = miniPt(t.centre.x, t.centre.y);
    const pts = [];
    for(let i=0;i<6;i++){
      const a = Math.PI/180*(60*i-30);
      pts.push([x + rayon*Math.cos(a), y + rayon*Math.sin(a)*SQ]);
    }
    mcx.strokeStyle = n.joueur ? '#ffffff' : sh(hex2rgb(n.col), 1.5);
    mcx.lineWidth = n.joueur ? 1.5 : 1;
    mcx.beginPath();
    for(let i=0;i<6;i++){
      const v = T(t.q+DIRS[i][0], t.r+DIRS[i][1]);
      if(v && v.owner===t.owner) continue;
      const e = COTE[i];
      mcx.moveTo(pts[e][0], pts[e][1]);
      mcx.lineTo(pts[(e+1)%6][0], pts[(e+1)%6][1]);
    }
    mcx.stroke();
  }
  // capitales
  for(const n of S.nations){
    if(!n.capitale || n.capitale.owner !== n.id) continue;
    const [x,y] = miniPt(n.capitale.centre.x, n.capitale.centre.y);
    mcx.fillStyle = '#fff';
    mcx.beginPath(); mcx.arc(x, y, n.joueur?2.6:1.9, 0, 7); mcx.fill();
    mcx.strokeStyle = '#0a1120'; mcx.lineWidth = 1; mcx.stroke();
  }
  // province sélectionnée
  if(S.sel){
    const [x,y] = miniPt(S.sel.centre.x, S.sel.centre.y);
    mcx.strokeStyle = '#fff'; mcx.lineWidth = 1.4;
    mcx.beginPath(); mcx.arc(x, y, rayon*1.3, 0, 7); mcx.stroke();
  }
  // cadre de la vue actuelle
  const c = [[0,0],[VW,0],[VW,VH],[0,VH]].map(([sx,sy])=>{
    const wx = (sx - VW/2)/S.cam.z - S.cam.x;
    const wy = (((sy - VH/2)/S.cam.z) - S.cam.y*SQ)/SQ;
    return [wx*MS + MOX, wy*SQ*MS + MOY];
  });
  mcx.strokeStyle = 'rgba(255,255,255,.85)'; mcx.lineWidth = 1.4;
  mcx.beginPath();
  c.forEach((p,i)=> i? mcx.lineTo(p[0],p[1]) : mcx.moveTo(p[0],p[1]));
  mcx.closePath(); mcx.stroke();
  mcx.strokeStyle = 'rgba(0,0,0,.5)'; mcx.lineWidth = 3;
  mcx.stroke();
}

function miniVersMonde(mx, my){
  return {x: (mx - MOX)/MS, y: (my - MOY)/(MS*SQ)};
}
let miniDrag = false;
function miniAller(e){
  const r = mcv.getBoundingClientRect();
  const p = miniVersMonde((e.clientX-r.left)*mcv.width/r.width,
                          (e.clientY-r.top)*mcv.height/r.height);
  S.cam.x = -p.x; S.cam.y = -p.y; camCible = null;
}
mcv.addEventListener('mousedown', e=>{ miniDrag = true; miniAller(e); e.stopPropagation(); });
window.addEventListener('mousemove', e=>{ if(miniDrag) miniAller(e); });
window.addEventListener('mouseup', ()=>{ miniDrag = false; });
document.getElementById('miniToggle').onclick = ()=> basculerMini();
function basculerMini(){
  miniVisible = !miniVisible;
  const m = document.getElementById('mini');
  m.classList.toggle('replie', !miniVisible);
  document.getElementById('miniToggle').textContent = miniVisible ? '−' : '+';
}

/* ===========================================================
   SOURIS, CLAVIER, CAMÉRA
   =========================================================== */

function dansPolygone(px, py, pts){
  let d = false;
  for(let i=0, j=pts.length-1; i<pts.length; j=i++){
    const [xi,yi]=pts[i], [xj,yj]=pts[j];
    if((yi>py)!==(yj>py) && px < (xj-xi)*(py-yi)/(yj-yi)+xi) d=!d;
  }
  return d;
}
function tuileSous(mx, my){
  const liste = [...S.tiles.values()].filter(t=>t.geo).sort((a,b)=> (b.r-a.r) || (b.q-a.q));
  for(const t of liste) if(dansPolygone(mx, my, coinsEcran(t))) return t;
  return null;
}

let drag = null;
cv.addEventListener('mousedown', e=>{ drag={x:e.clientX,y:e.clientY,moved:false}; cv.classList.add('drag'); });
window.addEventListener('mouseup', e=>{
  if(drag && !drag.moved && e.target===cv) clicCarte(e);
  drag=null; cv.classList.remove('drag');
});
window.addEventListener('mousemove', e=>{
  if(!drag) return;
  const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
  if(Math.abs(dx)+Math.abs(dy)>4) drag.moved=true;
  S.cam.x += dx/S.cam.z; S.cam.y += dy/(S.cam.z*SQ);
  camCible = null;
  drag.x=e.clientX; drag.y=e.clientY;
});
cv.addEventListener('mousemove', e=>{
  const r = cv.getBoundingClientRect();
  survol = tuileSous(e.clientX-r.left, e.clientY-r.top);
  infobulle(e);
});
cv.addEventListener('mouseleave', ()=>{
  survol = null; document.getElementById('tip').classList.add('hidden');
});
cv.addEventListener('wheel', e=>{
  e.preventDefault();
  S.cam.z = clamp(S.cam.z * (e.deltaY<0?1.12:0.89), 0.25, 2.2);
},{passive:false});

// tactile : glisser pour déplacer, pincer pour zoomer
let pinch = null;
cv.addEventListener('touchstart', e=>{
  if(e.touches.length===1) drag = {x:e.touches[0].clientX, y:e.touches[0].clientY, moved:false};
  else if(e.touches.length===2) pinch = dist2(e.touches);
},{passive:true});
cv.addEventListener('touchmove', e=>{
  if(e.touches.length===2 && pinch){
    const d = dist2(e.touches);
    S.cam.z = clamp(S.cam.z * d/pinch, 0.25, 2.2); pinch = d;
  } else if(drag && e.touches.length===1){
    const t = e.touches[0];
    S.cam.x += (t.clientX-drag.x)/S.cam.z; S.cam.y += (t.clientY-drag.y)/(S.cam.z*SQ);
    drag.x = t.clientX; drag.y = t.clientY; camCible = null;
  }
  e.preventDefault();
},{passive:false});
cv.addEventListener('touchend', ()=>{ pinch=null; drag=null; },{passive:true});
function dist2(t){ return Math.hypot(t[0].clientX-t[1].clientX, t[0].clientY-t[1].clientY); }

function infobulle(e){
  const tip = document.getElementById('tip');
  if(survol && survol.terr!=='ocean'){
    const own = survol.owner!==null ? S.nations[survol.owner] : null;
    tip.innerHTML =
      `<b>${TERRAIN[survol.terr].nom}</b><span class="tsep">${survol.pop.toFixed(1)}k hab.</span>`
      + (own? `<div><i class="flag" style="background:${own.col}"></i>${own.nom}</div>`
            : '<div class="muted">Terre inoccupée</div>')
      + (survol.bld? `<div>${ic(survol.bld)} ${BUILDINGS[survol.bld].nom}</div>` : '')
      + (survol.fort? `<div class="muted">Fortifications +${survol.fort}%</div>` : '')
      + (survol.occ? `<div style="color:${S.nations[survol.occ.par].col}">Occupée à ${Math.round(survol.occ.val*100)}% par ${S.nations[survol.occ.par].nom}</div>` : '');
    tip.style.left = Math.min(e.clientX+16, window.innerWidth-250)+'px';
    tip.style.top  = Math.min(e.clientY+16, window.innerHeight-130)+'px';
    tip.classList.remove('hidden');
  } else tip.classList.add('hidden');
}

function clicCarte(e){
  const r = cv.getBoundingClientRect();
  const t = tuileSous(e.clientX-r.left, e.clientY-r.top);
  if(t){ S.sel = t; ongletActif('province'); majUI(); }
}

let camCible = null;
function centrer(t, doux=false){
  const p = hexPos(t);
  if(doux) camCible = {x:-p.x, y:-p.y};
  else { S.cam.x = -p.x; S.cam.y = -p.y; camCible = null; }
}
const touches = new Set();
function majCamera(dt){
  if(camCible){
    S.cam.x += (camCible.x - S.cam.x) * Math.min(1, dt*4);
    S.cam.y += (camCible.y - S.cam.y) * Math.min(1, dt*4);
    if(Math.abs(camCible.x-S.cam.x)<0.6 && Math.abs(camCible.y-S.cam.y)<0.6) camCible = null;
  }
  const v = 460*dt/S.cam.z;
  if(touches.has('ArrowLeft') ||touches.has('KeyA')){ S.cam.x += v;     camCible=null; }
  if(touches.has('ArrowRight')||touches.has('KeyD')){ S.cam.x -= v;     camCible=null; }
  if(touches.has('ArrowUp')   ||touches.has('KeyW')){ S.cam.y += v/SQ;  camCible=null; }
  if(touches.has('ArrowDown') ||touches.has('KeyS')){ S.cam.y -= v/SQ;  camCible=null; }
}
window.addEventListener('keydown', e=>{
  if(document.getElementById('aide') && !document.getElementById('aide').classList.contains('hidden')) return;
  touches.add(e.code);
  if(e.code==='KeyC') centrer(S.player.capitale, true);
  if(e.code==='KeyF') toutVoir();
  if(e.code==='KeyM') basculerMini();
  if(e.code==='Equal'||e.code==='NumpadAdd')      S.cam.z = clamp(S.cam.z*1.15, 0.25, 2.2);
  if(e.code==='Minus'||e.code==='NumpadSubtract') S.cam.z = clamp(S.cam.z*0.87, 0.25, 2.2);
});
window.addEventListener('keyup', e=> touches.delete(e.code));
