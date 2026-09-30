/* ===========================================================
   SONS ET VOIX
   Aucun fichier audio : chaque son est composé à la volée avec
   la Web Audio API — des notes douces, courtes, à faible volume,
   prises dans une gamme pentatonique pour ne jamais grincer.
   Les grands moments sont salués par une petite voix (synthèse
   vocale du navigateur, en français), jamais plus d'une fois
   toutes les quelques secondes.
   Trois réglages : tout (sons + voix), sons seuls, silence.
   =========================================================== */

const SON = {
  ctx: null,
  maitre: null,
  mode: 'tout',                 // 'tout' | 'sons' | 'muet'
  derniereVoix: 0,
  derniers: {},                 // anti-rafale : un même son ne se répète pas trop vite
  VOIX_ECART: 5000,

  actif(){ return this.mode !== 'muet'; },
  voixActive(){ return this.mode === 'tout'; },

  // le navigateur n'autorise le son qu'après un geste du joueur
  contexte(){
    if(!this.actif()) return null;
    try{
      if(!this.ctx){
        const AC = window.AudioContext || window.webkitAudioContext;
        if(!AC) return null;
        this.ctx = new AC();
        this.maitre = this.ctx.createGain();
        this.maitre.gain.value = 0.9;
        this.maitre.connect(this.ctx.destination);
      }
      if(this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }catch(e){ return null; }
  },

  /* --- une note : forme d'onde, fréquence, départ, durée, volume --- */
  note(f, debut, duree, vol, type = 'sine', glisse = null){
    const a = this.ctx, t0 = a.currentTime + debut;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if(glisse) o.frequency.exponentialRampToValueAtTime(glisse, t0 + duree);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, duree/4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
    // un filtre adoucit les formes d'onde riches (triangle, dent de scie)
    const filtre = a.createBiquadFilter();
    filtre.type = 'lowpass'; filtre.frequency.value = type === 'sine' ? 8000 : 1800;
    o.connect(filtre); filtre.connect(g); g.connect(this.maitre);
    o.start(t0); o.stop(t0 + duree + 0.05);
  },

  /* --- un petit « toc » de bois ou de tambour --- */
  frappe(f, debut, vol){
    this.note(f, debut, 0.12, vol, 'triangle', f*0.55);
  },

  /* --- catalogue : chaque événement du jeu a sa signature --- */
  SONS: {
    clic:        s => s.note(900, 0, 0.05, 0.025, 'sine', 700),
    onglet:      s => s.note(620, 0, 0.07, 0.03, 'sine', 820),
    selection:   s => s.note(520, 0, 0.08, 0.035, 'triangle', 660),
    batir:       s => { s.frappe(330, 0, 0.09); s.frappe(392, 0.11, 0.08); s.note(784, 0.22, 0.25, 0.03); },
    pieces:      s => { s.note(1318, 0, 0.09, 0.04); s.note(1760, 0.07, 0.2, 0.04); },
    coloniser:   s => [523, 659, 784].forEach((f,i)=> s.note(f, i*0.09, 0.35, 0.05, 'triangle')),
    recruter:    s => { s.frappe(147, 0, 0.12); s.frappe(147, 0.14, 0.1); s.frappe(196, 0.28, 0.12); },
    recherche:   s => [1047, 1319, 1568].forEach((f,i)=> s.note(f, i*0.05, 0.18, 0.025)),
    decouverte:  s => [784, 988, 1175, 1568].forEach((f,i)=> s.note(f, i*0.08, 0.5, 0.04)),
    guerre:      s => { s.note(196, 0, 0.55, 0.06, 'sawtooth'); s.note(147, 0.45, 0.8, 0.06, 'sawtooth');
                        s.frappe(98, 0, 0.12); s.frappe(98, 0.45, 0.12); },
    paix:        s => [523, 659, 784].forEach(f => s.note(f, 0, 1.4, 0.035)),
    traite:      s => [392, 523, 659, 784].forEach((f,i)=> s.note(f, i*0.1, 0.6, 0.04, 'triangle')),
    refus:       s => { s.note(330, 0, 0.18, 0.04, 'triangle'); s.note(262, 0.16, 0.3, 0.04, 'triangle'); },
    bataille:    s => { s.frappe(110, 0, 0.1); s.frappe(131, 0.1, 0.08); s.frappe(110, 0.2, 0.1); },
    avance:      s => [392, 523].forEach((f,i)=> s.note(f, i*0.1, 0.3, 0.04, 'triangle')),
    recul:       s => [392, 311].forEach((f,i)=> s.note(f, i*0.12, 0.35, 0.04, 'triangle')),
    conquete:    s => [523, 659, 784, 1047].forEach((f,i)=> s.note(f, i*0.1, i===3?0.8:0.3, 0.05, 'triangle')),
    perte:       s => [440, 349, 294].forEach((f,i)=> s.note(f, i*0.16, 0.5, 0.045, 'triangle')),
    alerte:      s => { s.note(660, 0, 0.18, 0.04); s.note(660, 0.25, 0.18, 0.04); },
    message:     s => s.note(587, 0, 0.14, 0.04, 'sine', 880),
    envoi:       s => s.note(700, 0, 0.08, 0.025, 'sine', 1000),
    bonus:       s => [659, 988].forEach((f,i)=> s.note(f, i*0.08, 0.3, 0.04)),
    malus:       s => [494, 370].forEach((f,i)=> s.note(f, i*0.12, 0.35, 0.035, 'triangle')),
    sauver:      s => s.note(1047, 0, 0.35, 0.03),
    debut:       s => [392, 523, 659, 784].forEach((f,i)=> s.note(f, i*0.14, 0.7, 0.04, 'triangle')),
    victoire:    s => [[523,0],[523,.15],[523,.3],[659,.45],[784,.75],[659,.95],[784,1.1],[1047,1.3]]
                        .forEach(([f,d],i)=> s.note(f, d, i===7?1.2:0.25, 0.05, 'triangle')),
    defaite:     s => [392, 370, 349, 262].forEach((f,i)=> s.note(f, i*0.3, 0.6, 0.04, 'triangle')),
    tuto:        s => [784, 1047].forEach((f,i)=> s.note(f, i*0.07, 0.25, 0.03)),
    reussi:      s => [659, 784, 1047].forEach((f,i)=> s.note(f, i*0.07, 0.35, 0.04)),
  },

  jouer(nom){
    if(!this.actif()) return;
    const maintenant = Date.now();
    if(maintenant - (this.derniers[nom] || 0) < 120) return;
    this.derniers[nom] = maintenant;
    const s = this.SONS[nom];
    if(!s || !this.contexte()) return;
    try{ s(this); }catch(e){ /* le son n'est jamais indispensable */ }
  },

  /* --- la petite voix --- */
  voixFr: null,
  choisirVoix(){
    if(!('speechSynthesis' in window)) return null;
    const v = speechSynthesis.getVoices().filter(x => /^fr/i.test(x.lang));
    // les voix « naturelles » ou « Google » sonnent mieux quand elles existent
    this.voixFr = v.find(x => /natural|google|amelie|audrey|thomas/i.test(x.name)) || v[0] || null;
    return this.voixFr;
  },
  dire(texte, force){
    if(!this.voixActive() || !('speechSynthesis' in window)) return;
    const maintenant = Date.now();
    if(!force && maintenant - this.derniereVoix < this.VOIX_ECART) return;
    this.derniereVoix = maintenant;
    try{
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texte);
      u.lang = 'fr-FR'; u.rate = 0.8; u.pitch = 1.05; u.volume = 0.8;
      const v = this.voixFr || this.choisirVoix();
      if(v) u.voice = v;
      speechSynthesis.speak(u);
    }catch(e){}
  },
  // une phrase au hasard, pour ne pas entendre toujours la même
  direUn(liste, force){ this.dire(liste[Math.floor(Math.random()*liste.length)], force); },

  /* --- réglage mémorisé d'une partie à l'autre --- */
  CLE: 'nation-son',
  charger(){
    try{ const m = localStorage.getItem(this.CLE); if(['tout','sons','muet'].includes(m)) this.mode = m; }catch(e){}
  },
  basculer(){
    this.mode = {tout:'sons', sons:'muet', muet:'tout'}[this.mode];
    try{ localStorage.setItem(this.CLE, this.mode); }catch(e){}
    if(this.mode !== 'tout' && 'speechSynthesis' in window) speechSynthesis.cancel();
    this.majBouton();
    if(this.mode === 'tout') this.dire('La voix est activée.', true);
    else this.jouer('clic');
  },
  majBouton(){
    const b = document.getElementById('btnSon');
    if(!b) return;
    b.textContent = {tout:'🔊', sons:'🔉', muet:'🔇'}[this.mode];
    b.title = {tout:'Sons et voix — clique pour couper la voix',
               sons:'Sons sans voix — clique pour tout couper',
               muet:'Silence — clique pour réactiver sons et voix'}[this.mode];
  },
};

/* --- phrases de la petite voix --- */
const PHRASES = {
  bravo:     ['Bravo !', 'Bien joué !', 'Excellent !', 'Magnifique !', 'Superbe !'],
  conquete:  ['Province conquise !', 'Bravo, une province de plus !', 'Victoire sur le front !'],
  colonie:   ['Nouvelle province !', 'Ton royaume s\'agrandit !'],
  decouverte:['Découverte !', 'Nouvelle technologie !', 'Tes savants ont réussi !'],
  traite:    ['Accord conclu !', 'Marché conclu !', 'Traité signé !'],
  alliance:  ['Alliance conclue !', 'Tu as un nouvel allié !'],
  paix:      ['La paix est signée.', 'Enfin la paix.'],
  guerre:    ['C\'est la guerre !', 'Aux armes !'],
  perte:     ['Province perdue…', 'Aïe, une province tombe.'],
  capitale:  ['Ta capitale est tombée !'],
  elimine:   ['Une nation est rayée de la carte !'],
  debut:     ['Que ton règne commence !', 'Ton pays est né. À toi de jouer !'],
  victoire:  ['Victoire ! Bravo, tu as gagné !', 'Bravo ! Tu es le plus grand royaume !'],
  defaite:   ['Défaite… Tu feras mieux la prochaine fois !'],
  trahison:  ['Trahison ! Le monde entier le sait.'],
  ruine:     ['Attention, tes caisses sont vides !'],
};

SON.charger();
if('speechSynthesis' in window){
  SON.choisirVoix();
  speechSynthesis.onvoiceschanged = ()=> SON.choisirVoix();
}

/* --- un léger clic sur chaque bouton, sans rien toucher au code des boutons --- */
document.addEventListener('click', e => {
  const b = e.target.closest('button, .conv, .puce, [data-voir]');
  if(!b || b.disabled || b.id === 'btnSon') return;
  if(b.classList.contains('tab')) SON.jouer('onglet');
  else if(!b.matches('[data-build],[data-buy],[data-colon],[data-colonmer],[data-tech],[data-don],[data-attaque],[data-debarque]'))
    SON.jouer('clic');
}, true);

/* --- le journal du règne sert de fil d'événements : chaque ligne marquante sonne --- */
function sonDuJournal(txt, cls){
  const t = txt.replace(/<[^>]+>/g, '');
  const moi = S.player ? S.player.nom : '';
  const concerneMoi = moi && t.includes(moi);

  if(/Recherche terminée/.test(t))                     { SON.jouer('decouverte'); SON.direUn(PHRASES.decouverte); }
  else if(/Recherche lancée/.test(t))                  SON.jouer('recherche');
  else if(/construit\.$/.test(t))                      SON.jouer('batir');
  else if(/Nouvelle province colonisée|Comptoir fondé/.test(t)) { SON.jouer('coloniser'); SON.direUn(PHRASES.colonie); }
  else if(/recrutée?s? \(/.test(t))                    SON.jouer('recruter');
  else if(/^Au loin/.test(t))                          { /* les affaires des autres restent discrètes */ }
  else if(/déclare la guerre/.test(t))                 { SON.jouer('guerre'); SON.direUn(PHRASES.guerre); }
  else if(/^Paix entre/.test(t))                       { SON.jouer('paix'); SON.direUn(PHRASES.paix); }
  else if(/Alliance conclue/.test(t))                  { SON.jouer('traite'); SON.direUn(PHRASES.alliance); }
  else if(/Pacte de non-agression avec/.test(t))       { SON.jouer('traite'); SON.direUn(PHRASES.traite); }
  else if(/^❌/.test(t))                               SON.jouer('refus');
  else if(/Ta capitale est tombée/.test(t))            { SON.jouer('perte'); SON.direUn(PHRASES.capitale, true); }
  else if(/Ta capitale est reprise/.test(t))           { SON.jouer('conquete'); SON.direUn(PHRASES.bravo); }
  else if(/achève l'occupation/.test(t))               { if(cls === 'good'){ SON.jouer('conquete'); SON.direUn(PHRASES.conquete); }
                                                         else { SON.jouer('perte'); SON.direUn(PHRASES.perte); } }
  else if(/n'existe plus/.test(t))                     { SON.jouer('victoire'); SON.direUn(PHRASES.elimine); }
  else if(/ contre /.test(t) && /pertes/.test(t))      SON.jouer(cls === 'good' ? 'avance' : 'recul');
  else if(/Don offert/.test(t))                        SON.jouer('pieces');
  else if(/gisement|percée|Fête nationale|Des colons fondent/.test(t)) SON.jouer('bonus');
  else if(/épidémie|Tempêtes/.test(t))                 SON.jouer('malus');
  else if(/Caisses vides/.test(t))                     { SON.jouer('alerte'); SON.direUn(PHRASES.ruine); }
  else if(/trahison|Pacte rompu/i.test(t))             { SON.jouer('alerte'); SON.direUn(PHRASES.trahison); }
  else if(/Partie sauvegardée/.test(t))                SON.jouer('sauver');
  else if(/Ton pays est né/.test(t))                   { SON.jouer('debut'); SON.direUn(PHRASES.debut, true); }
  else if(/te cède une province/.test(t))              { SON.jouer('conquete'); SON.direUn(PHRASES.bravo); }
  else if(/t'écrit\./.test(t))                         SON.jouer('message');
  else if(concerneMoi && cls === 'good')               SON.jouer('bonus');
  else if(concerneMoi && cls === 'bad')                SON.jouer('malus');
}

/* --- bouton de la barre : tout → sons seuls → silence --- */
(()=>{
  const b = document.getElementById('btnSon');
  if(b){ b.onclick = ()=> SON.basculer(); SON.majBouton(); }
})();
