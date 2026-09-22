/* ===========================================================
   RELIEF — carte de hauteurs continue (par pixel)
   Le terrain n'est plus une mosaïque d'hexagones : chaque point
   du monde a sa propre altitude, interpolée entre les provinces
   voisines et perturbée par un bruit fractal.
   =========================================================== */

const HS  = 34;     // rayon d'une province
const SQ  = 0.58;   // écrasement isométrique
const ZH  = 40;     // hauteur du relief (px par unité d'altitude)
const PAS = 2;      // finesse d'échantillonnage du sol
const RAY2 = (34*1.95)**2;   // rayon de fondu entre provinces (collines larges)

// altitude et rugosité propres à chaque terrain
const ALT = {ocean:-0.34, cote:0.09, plaine:0.32, desert:0.26, foret:0.42, montagne:1.02};
const RUG = {ocean:0.02,  cote:0.06, plaine:0.13, desert:0.15, foret:0.18, montagne:0.34};
const COL = {ocean:'#14385f', cote:'#cdb98a', plaine:'#5b9a4a', desert:'#cdb266',
             foret:'#2e7038', montagne:'#7b7466'};

/* ---------- bruit ---------- */
function hh(x,y){ const n = Math.sin(x*127.1 + y*311.7)*43758.5453; return n - Math.floor(n); }
function liss(t){ return t*t*(3-2*t); }
function bruitVal(x,y){
  const xi=Math.floor(x), yi=Math.floor(y), xf=liss(x-xi), yf=liss(y-yi);
  const a=hh(xi,yi), b=hh(xi+1,yi), c=hh(xi,yi+1), d=hh(xi+1,yi+1);
  return (a+(b-a)*xf) + ((c+(d-c)*xf) - (a+(b-a)*xf))*yf;
}
function fbm(x,y,oct=4){
  let v=0, amp=0.5, f=1;
  for(let i=0;i<oct;i++){ v += bruitVal(x*f, y*f)*amp; f*=2.03; amp*=0.5; }
  return v;
}
function crete(x,y){ return 1 - Math.abs(fbm(x,y,3)*2 - 1); }   // bruit « arêtes »

/* ---------- monde → province ---------- */
function versAxial(wx, wy){
  return {q:(Math.sqrt(3)/3*wx - wy/3)/HS, r:(2/3*wy)/HS};
}
function arrondirHex(q, r){
  let x=q, z=r, y=-x-z;
  let rx=Math.round(x), ry=Math.round(y), rz=Math.round(z);
  const dx=Math.abs(rx-x), dy=Math.abs(ry-y), dz=Math.abs(rz-z);
  if(dx>dy && dx>dz) rx=-ry-rz; else if(dy>dz) ry=-rx-rz; else rz=-rx-ry;
  return {q:rx, r:rz};
}

// tables précalculées (évite de reparser les couleurs des millions de fois)
const COLRGB = {};
function preparerTables(){
  for(const k in COL) COLRGB[k] = hex2rgb(COL[k]);
  for(const t of S.tiles.values())
    t.centre = {x: HS*Math.sqrt(3)*(t.q + t.r/2), y: HS*1.5*t.r};
}

// mélange pondéré des provinces autour d'un point : altitude, rugosité, couleur
function echantillon(wx, wy){
  const a = versAxial(wx, wy), c = arrondirHex(a.q, a.r);
  let alt=0, rug=0, r=0, g=0, b=0, w=0, mer=0;
  for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++){
    const t = T(c.q+i, c.r+j);
    if(!t) continue;
    const dx = t.centre.x - wx, dy = t.centre.y - wy;
    let k = 1 - (dx*dx + dy*dy)/RAY2;
    if(k<=0) continue;
    k = k*k;
    const col = COLRGB[t.terr];
    alt += ALT[t.terr]*k; rug += RUG[t.terr]*k;
    r += col[0]*k; g += col[1]*k; b += col[2]*k;
    if(t.terr==='ocean') mer += k;
    w += k;
  }
  if(w<=0) return {alt:ALT.ocean, rug:RUG.ocean, col:COLRGB.ocean, mer:1};   // haute mer
  return {alt:alt/w, rug:rug/w, col:[r/w,g/w,b/w], mer:mer/w};
}

// altitude d'un point quelconque du monde
function hauteurMonde(wx, wy, e){
  e = e || echantillon(wx, wy);
  let h = e.alt;
  // collines larges partout + détail plus fin
  h += (fbm(wx*0.0045, wy*0.0045, 3) - 0.5) * (0.18 + e.rug*1.4);
  h += (fbm(wx*0.016,  wy*0.016,  3) - 0.5) * e.rug * 1.5;
  if(h > 0.55){                                   // les massifs se bombent doucement
    const t = liss(clamp((h-0.55)/0.7, 0, 1));
    h += t*0.42 + (crete(wx*0.012, wy*0.012) - 0.5)*e.rug*0.8*t;
  }
  if(h > 0 && h < 0.16) h *= 0.55 + fbm(wx*0.05, wy*0.05, 2)*0.25;  // plages douces
  return Math.min(h, 1.9);                        // on borne les sommets
}

/* ---------- couleur du sol ---------- */
function couleurSol(e, h, pente){
  let c = e.col.slice();
  if(h < 0.015){                                   // mer : la couleur suit la profondeur
    const p = clamp(-h*1.9, 0, 1);
    c = [ 46 + (11-46)*p, 108 + (44-108)*p, 148 + (92-148)*p ];
    return {c, eau:true};
  }
  if(h < 0.15){                                    // sable
    const t = 1 - h/0.15;
    c = [c[0]+(214-c[0])*t*0.85, c[1]+(196-c[1])*t*0.85, c[2]+(150-c[2])*t*0.85];
  }
  if(pente > 0.75){                                // roche sur les pentes fortes
    const t = clamp((pente-0.75)/0.9, 0, 1)*0.75;
    c = [c[0]+(122-c[0])*t, c[1]+(116-c[1])*t, c[2]+(104-c[2])*t];
  }
  if(h > 0.95){                                    // neige des sommets
    const t = clamp((h-0.95)/0.5, 0, 1)*(1-clamp(pente-1.1,0,1)*0.6);
    c = [c[0]+(238-c[0])*t, c[1]+(244-c[1])*t, c[2]+(252-c[2])*t];
  }
  return {c, eau:false};
}
