/* ===========================================================
   MUSIQUE DE L'INTRODUCTION — un thème d'aventure
   Un petit orchestre synthétisé à la volée (Web Audio) : cordes,
   cuivres, harpe, timbales, cymbales, dans une salle réverbérante.
   Aucun fichier : chaque note est calculée, et la partition suit
   le récit seconde par seconde.
   =========================================================== */

const IntroMusique = (function(){

/* ---------- notes ---------- */
const DEMI = {C:-9, D:-7, E:-5, F:-4, G:-2, A:0, B:2};
function hz(nom){
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(nom);
  let n = DEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] - 4)*12;
  return 440 * Math.pow(2, n/12);
}
const ACC = {                          // accords, voix graves → aiguës
  Dm:['D3','A3','D4','F4'], Bb:['Bb2','F3','Bb3','D4'], F:['F2','C3','F3','A3','C4'],
  C:['C3','G3','C4','E4'], Gm:['G2','D3','G3','Bb3'], A:['A2','E3','A3','C#4','E4'],
  D:['D3','A3','D4','F#4','A4'], G:['G2','D3','G3','B3','D4'], Bb7:['Bb2','F3','A3','D4'],
  Dmb9:['D3','A3','Eb4','F4'], Eb:['Eb3','Bb3','Eb4','G4'],
};

/* ---------- état ---------- */
const M = {ctx:null, bus:null, salle:null, bruit:null, partition:null, jusqu:0, actif:false};

function contexte(){
  if(typeof SON === 'undefined' || !SON.actif()) return null;     // mode muet : pas de musique
  return SON.contexte();
}

// une salle de concert : réponse impulsionnelle stéréo qui décroît sur 3 s
function salle(a){
  if(M.salle && M.salle.context === a) return M.salle;
  const L = Math.round(a.sampleRate * 3.2), b = a.createBuffer(2, L, a.sampleRate);
  for(let ch=0; ch<2; ch++){
    const d = b.getChannelData(ch);
    for(let i=0;i<L;i++) d[i] = (Math.random()*2 - 1) * Math.pow(1 - i/L, 2.6);
  }
  const conv = a.createConvolver(); conv.buffer = b;
  const retour = a.createGain(); retour.gain.value = 0.55;
  conv.connect(retour); retour.connect(SON.maitre);
  M.salle = conv;
  return conv;
}
function bruit(a){
  if(M.bruit && M.bruit.sampleRate === a.sampleRate) return M.bruit;
  const L = a.sampleRate * 2, b = a.createBuffer(1, L, a.sampleRate), d = b.getChannelData(0);
  for(let i=0;i<L;i++) d[i] = Math.random()*2 - 1;
  return (M.bruit = b);
}
// chaque lecture a son propre bus : on peut l'éteindre en fondu sans toucher au reste du jeu
function nouveauBus(a){
  const bus = a.createGain(); bus.gain.value = 0.62;
  const comp = a.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.25;
  bus.connect(comp); comp.connect(SON.maitre);
  const envoi = a.createGain(); envoi.gain.value = 0.5;
  comp.connect(envoi); envoi.connect(salle(a));
  return bus;
}
function eteindre(bus, duree){
  if(!bus) return;
  const a = bus.context, g = bus.gain;
  try{
    g.cancelScheduledValues(a.currentTime);
    g.setValueAtTime(g.value, a.currentTime);
    g.linearRampToValueAtTime(0.0001, a.currentTime + duree);
    setTimeout(()=>{ try{ bus.disconnect(); }catch(e){} }, duree*1000 + 200);
  }catch(e){}
}

/* ---------- instruments ---------- */
function enveloppe(a, T, att, dur, rel, vol){
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, T);
  g.gain.linearRampToValueAtTime(vol, T + att);
  g.gain.setValueAtTime(vol, T + Math.max(att, dur));
  g.gain.exponentialRampToValueAtTime(0.0001, T + Math.max(att, dur) + rel);
  return g;
}
// cordes : deux dents de scie désaccordées par note, un vibrato lent, un filtre doux
function cordes(a, bus, T, notes, dur, vol, clair=1400){
  const fin = T + dur + 1.6;
  const vib = a.createOscillator(), prof = a.createGain();
  vib.frequency.value = 5.2; prof.gain.value = 6;
  vib.connect(prof); vib.start(T); vib.stop(fin);
  const filtre = a.createBiquadFilter(); filtre.type = 'lowpass'; filtre.frequency.value = clair; filtre.Q.value = 0.4;
  const env = enveloppe(a, T, Math.min(0.9, dur*0.35), dur, 1.4, vol / Math.sqrt(notes.length));
  filtre.connect(env); env.connect(bus);
  for(const n of notes) for(const d of [-7, 7]){
    const o = a.createOscillator(); o.type = 'sawtooth';
    o.frequency.value = hz(n); o.detune.value = d; prof.connect(o.detune);
    o.connect(filtre); o.start(T); o.stop(fin);
  }
}
// cordes pincées en pulsation (ostinato)
function pizz(a, bus, T, n, vol){
  const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n);
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2200, T); f.frequency.exponentialRampToValueAtTime(400, T + 0.25);
  const g = enveloppe(a, T, 0.01, 0.02, 0.28, vol);
  o.connect(f); f.connect(g); g.connect(bus); o.start(T); o.stop(T + 0.4);
}
// cuivres : l'éclat monte avec l'attaque, comme un cor qui s'ouvre
function cuivre(a, bus, T, n, dur, vol){
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(350, T); f.frequency.linearRampToValueAtTime(2600, T + 0.08); f.frequency.linearRampToValueAtTime(1500, T + 0.35);
  const g = enveloppe(a, T, 0.05, dur, 0.35, vol);
  f.connect(g); g.connect(bus);
  const vib = a.createOscillator(), prof = a.createGain();
  vib.frequency.value = 5; prof.gain.setValueAtTime(0, T); prof.gain.linearRampToValueAtTime(9, T + Math.min(dur, 0.8));
  vib.connect(prof); vib.start(T); vib.stop(T + dur + 0.5);
  for(const [type, d, m] of [['sawtooth', -4, 1], ['sawtooth', 5, 1], ['square', 0, 0.5]]){
    const o = a.createOscillator(); o.type = type; o.frequency.value = hz(n) * m; o.detune.value = d;
    prof.connect(o.detune); o.connect(f); o.start(T); o.stop(T + dur + 0.5);
  }
}
// harpe : une corde pincée, claire, qui s'éteint doucement
function harpe(a, bus, T, n, vol){
  for(const [m, v, type] of [[1, 1, 'triangle'], [2, 0.35, 'sine'], [3, 0.12, 'sine']]){
    const o = a.createOscillator(); o.type = type; o.frequency.value = hz(n)*m;
    const g = enveloppe(a, T, 0.004, 0.01, 1.6/m, vol*v);
    o.connect(g); g.connect(bus); o.start(T); o.stop(T + 2);
  }
}
// timbale : une peau qui résonne, plus le choc de la mailloche
function timbale(a, bus, T, n, vol){
  const o = a.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(hz(n)*1.45, T); o.frequency.exponentialRampToValueAtTime(hz(n), T + 0.07);
  const g = enveloppe(a, T, 0.005, 0.02, 1.3, vol);
  o.connect(g); g.connect(bus); o.start(T); o.stop(T + 1.5);
  const b = a.createBufferSource(); b.buffer = bruit(a);
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
  const gb = enveloppe(a, T, 0.002, 0.01, 0.12, vol*0.6);
  b.connect(f); f.connect(gb); gb.connect(bus); b.start(T, Math.random()); b.stop(T + 0.2);
}
// cymbale frappée ou en crescendo
function cymbale(a, bus, T, vol, monte=0){
  const b = a.createBufferSource(); b.buffer = bruit(a); b.loop = true;
  const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5500;
  const g = a.createGain();
  if(monte > 0){
    g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(vol, T + monte);
    g.gain.exponentialRampToValueAtTime(0.0001, T + monte + 0.25);
  } else {
    g.gain.setValueAtTime(vol, T); g.gain.exponentialRampToValueAtTime(0.0001, T + 2.8);
  }
  b.connect(f); f.connect(g); g.connect(bus); b.start(T, Math.random()); b.stop(T + monte + 3);
}
// roulement de caisse claire qui enfle
function roulement(a, bus, T, dur, vol){
  const b = a.createBufferSource(); b.buffer = bruit(a); b.loop = true;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.7;
  const trem = a.createGain(); trem.gain.value = 0.5;
  const lfo = a.createOscillator(), lp = a.createGain(); lfo.frequency.value = 22; lp.gain.value = 0.5;
  lfo.connect(lp); lp.connect(trem.gain); lfo.start(T); lfo.stop(T + dur + 0.3);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(vol, T + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, T + dur + 0.2);
  b.connect(f); f.connect(trem); trem.connect(g); g.connect(bus); b.start(T, Math.random()); b.stop(T + dur + 0.3);
}
// bourdon grave, pour l'assise
function bourdon(a, bus, T, n, dur, vol){
  const g = enveloppe(a, T, 1.2, dur, 1.5, vol);
  g.connect(bus);
  for(const [type, m] of [['sine', 1], ['triangle', 2]]){
    const o = a.createOscillator(); o.type = type; o.frequency.value = hz(n)*m;
    o.connect(g); o.start(T); o.stop(T + dur + 1.6);
  }
}

/* ===========================================================
   LA PARTITION — calée sur le récit (secondes de l'intro)
   =========================================================== */
function partition(){
  const P = [];
  const ev = (t, f) => P.push({t, f});
  const accord = (t, nom, dur, vol, clair) => ev(t, (a, b, T) => cordes(a, b, T, ACC[nom], dur, vol, clair));
  const theme = (t0, notes, vol) => {          // [note, durée] enchaînées
    let t = t0;
    for(const [n, d] of notes){ const tt = t; ev(tt, (a, b, T) => cuivre(a, b, T, n, d*0.92, vol)); t += d; }
  };
  const arpege = (t0, t1, pas, notes, vol) => {
    let i = 0;
    for(let t = t0; t < t1; t += pas, i++){ const n = notes[i % notes.length]; ev(t, (a, b, T) => harpe(a, b, T, n, vol)); }
  };

  // I. L'appel — ré mineur, une harpe, un bourdon, puis le cor du meneur
  ev(0, (a, b, T) => bourdon(a, b, T, 'D2', 9, 0.10));
  accord(0.2, 'Dm', 4.2, 0.10, 900);
  accord(4.4, 'Bb', 2.4, 0.12, 1100);
  accord(6.8, 'C', 2.6, 0.12, 1200);
  arpege(0.6, 9.2, 0.3125, ['D4','F4','A4','D5','A4','F4'], 0.05);
  ev(4.6, (a, b, T) => timbale(a, b, T, 'D2', 0.28));
  theme(4.6, [['A3',0.5],['D4',0.35],['E4',0.35],['F4',0.9],['G4',0.4],['A4',1.0],['G4',0.4],['F4',1.1]], 0.085);

  // II. Le départ — l'ostinato se met en marche, les timbales battent
  accord(9.4, 'Dm', 2.5, 0.13, 1300);
  accord(11.9, 'Bb', 2.4, 0.14, 1400);
  accord(14.3, 'F', 1.2, 0.16, 1800);
  accord(15.5, 'C', 1.4, 0.15, 1800);
  for(let t = 9.4, i = 0; t < 16.6; t += 0.3125, i++){
    const n = t < 11.9 ? (i%2 ? 'A3' : 'D3') : t < 14.3 ? (i%2 ? 'F3' : 'Bb2') : t < 15.5 ? (i%2 ? 'C4' : 'F3') : (i%2 ? 'G3' : 'C3');
    const vol = 0.05 + 0.05*((t - 9.4)/7.2);
    ev(t, (a, b, T) => pizz(a, b, T, n, vol));
  }
  for(let t = 9.4; t < 16.6; t += 1.25) ev(t, (a, b, T) => timbale(a, b, T, 'D2', 0.22));
  ev(13.7, (a, b, T) => roulement(a, b, T, 0.6, 0.08));
  ev(14.3, (a, b, T) => cymbale(a, b, T, 0.10));
  theme(14.3, [['D4',0.3],['D4',0.15],['F4',0.3],['A4',0.8],['G4',0.3],['F4',0.3],['G4',0.7]], 0.10);

  // III. La traversée — la nuit en mer, puis la terre en vue
  accord(17.2, 'Dm', 3.2, 0.10, 800);
  accord(20.2, 'Bb7', 2.8, 0.10, 900);
  ev(17.2, (a, b, T) => bourdon(a, b, T, 'D2', 6, 0.08));
  arpege(17.4, 20.2, 0.625, ['A4','D5','F5','E5'], 0.045);
  arpege(20.2, 23, 0.625, ['F5','D5','A4','C5'], 0.045);
  for(const [t, n] of [[21.1,'A5'],[21.9,'D6'],[22.4,'F5'],[22.9,'E6']]) ev(t, (a, b, T) => harpe(a, b, T, n, 0.035));
  accord(23, 'C', 1.0, 0.14, 1600);
  ev(23, (a, b, T) => roulement(a, b, T, 1.0, 0.12));
  for(let k = 0; k < 8; k++) ev(23.1 + k*0.11, (a, b, T) => timbale(a, b, T, 'C2', 0.1 + k*0.02));
  // « Terre ! »
  accord(24, 'F', 2.3, 0.20, 2400);
  ev(24, (a, b, T) => cymbale(a, b, T, 0.13));
  ev(24, (a, b, T) => timbale(a, b, T, 'F2', 0.4));
  theme(24, [['C4',0.25],['F4',0.25],['A4',0.25],['C5',1.6]], 0.11);
  accord(25.8, 'C', 1.4, 0.10, 1000);

  // IV. L'arrivée — ré majeur, le thème héroïque, le drapeau planté
  accord(27.6, 'D', 2.6, 0.13, 1600);
  accord(30.4, 'A', 1.5, 0.15, 2000);
  accord(31.9, 'G', 1.2, 0.13, 1700);
  accord(33.1, 'D', 1.1, 0.12, 1500);
  arpege(27.8, 34, 0.3125, ['D4','F#4','A4','D5','A4','F#4'], 0.04);
  for(let t = 27.7, i = 0; t < 34; t += 0.625, i++) ev(t, (a, b, T) => timbale(a, b, T, i%2 ? 'A1' : 'D2', 0.13));
  theme(28, [['A3',0.35],['D4',0.35],['E4',0.35],['F#4',0.9],['E4',0.45],['A4',1.4],['G4',0.4],['F#4',0.4],['E4',0.5],['D4',1.0]], 0.10);
  ev(29.9, (a, b, T) => cymbale(a, b, T, 0.09, 0.5));
  ev(30.4, (a, b, T) => cymbale(a, b, T, 0.12));
  ev(30.4, (a, b, T) => timbale(a, b, T, 'D2', 0.42));

  // V. Pas seuls — l'harmonie se trouble, un cœur qui bat
  accord(34.2, 'Dmb9', 2.4, 0.12, 700);
  ev(34.2, (a, b, T) => bourdon(a, b, T, 'D2', 4.6, 0.12));
  accord(36.6, 'Bb', 1.4, 0.13, 900);
  accord(38, 'A', 1.0, 0.15, 1500);
  for(const t of [34.4, 35.6, 36.8, 38.0]){
    ev(t, (a, b, T) => timbale(a, b, T, 'D2', 0.3));
    ev(t + 0.28, (a, b, T) => timbale(a, b, T, 'D2', 0.2));
  }
  ev(36.8, (a, b, T) => cuivre(a, b, T, 'Bb2', 1.0, 0.09));
  ev(36.8, (a, b, T) => cuivre(a, b, T, 'F3', 1.0, 0.07));
  ev(38.2, (a, b, T) => roulement(a, b, T, 0.8, 0.13));
  ev(38.4, (a, b, T) => cymbale(a, b, T, 0.1, 0.6));

  // VI. La carte — le grand final, jusqu'au dernier accord qui résonne
  accord(39, 'D', 1.8, 0.18, 2400);
  accord(40.8, 'G', 1.2, 0.17, 2400);
  accord(42, 'A', 0.8, 0.18, 2400);
  accord(42.8, 'D', 3.2, 0.20, 2600);
  ev(39, (a, b, T) => bourdon(a, b, T, 'D2', 7, 0.12));
  ev(39, (a, b, T) => cymbale(a, b, T, 0.13));
  ev(39, (a, b, T) => timbale(a, b, T, 'D2', 0.45));
  arpege(39, 42.8, 0.156, ['D4','F#4','A4','D5','F#5','A5','D6','A5','F#5','D5','A4','F#4'], 0.035);
  theme(39, [['D4',0.3],['D4',0.15],['F#4',0.3],['A4',0.95],['B4',0.45],['A4',0.45],['F#4',0.4],['G4',0.4],['A4',0.4],['D5',2.6]], 0.12);
  theme(39, [['A3',0.75],['A3',0.95],['D4',0.9],['E4',0.8],['F#4',2.6]], 0.07);
  for(let k = 0; k < 10; k++) ev(41.9 + k*0.08, (a, b, T) => timbale(a, b, T, 'A1', 0.12 + k*0.025));
  ev(42.8, (a, b, T) => timbale(a, b, T, 'D2', 0.5));
  ev(42.8, (a, b, T) => cymbale(a, b, T, 0.14));

  return P.sort((x, y) => x.t - y.t);
}

/* ===========================================================
   LECTURE — la partition suit l'horloge de l'intro
   =========================================================== */
const AVANCE = 0.6;          // secondes programmées à l'avance

return {
  demarrer(){
    this.couper(0.2);
    const a = contexte();
    if(!a) return;
    M.ctx = a; M.bus = nouveauBus(a); M.jusqu = 0; M.actif = true;
    if(!M.partition) M.partition = partition();
  },
  // appelé à chaque image avec le temps de l'intro
  suivre(t){
    if(!M.actif || !M.ctx) return;
    const a = M.ctx, fin = t + AVANCE;
    for(const e of M.partition){
      if(e.t < M.jusqu) continue;
      if(e.t >= fin) break;
      const retard = t - e.t;
      if(retard > 0.15) continue;                       // trop tard : on ne joue pas une note à contretemps
      try{ e.f(a, M.bus, a.currentTime + Math.max(0, e.t - t)); }catch(err){}
    }
    M.jusqu = Math.max(M.jusqu, fin);
  },
  // un clic a fait sauter le récit : on repart proprement du nouvel instant
  saut(t){
    if(!M.actif || !M.ctx) return;
    eteindre(M.bus, 0.35);
    M.bus = nouveauBus(M.ctx); M.jusqu = t;
    // l'accord en cours reprend, pour ne pas tomber dans un silence
    const tenu = [...M.partition].reverse().find(e => e.t <= t && e.t > t - 2.5);
    if(tenu) try{ tenu.f(M.ctx, M.bus, M.ctx.currentTime + 0.05); }catch(err){}
  },
  couper(duree=0.8){
    if(M.bus) eteindre(M.bus, duree);
    M.bus = null; M.actif = false;
  },
};
})();
