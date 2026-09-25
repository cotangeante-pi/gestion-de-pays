/* ===========================================================
   ADAPTATEUR DE PLATEFORME
   Le jeu ne parle jamais au SDK directement : il parle à SDK.*,
   qui traduit. Si le SDK est absent (ouverture du fichier en
   local, itch.io, portage ailleurs) ou si son API change, tout
   dégrade en silence — le jeu ne doit jamais tomber à cause
   d'une régie publicitaire.
   =========================================================== */

const SDK = {
  pret: false,
  enJeu: false,
  dernierePub: 0,
  ENTRE_PUBS: 3 * 60 * 1000,      // jamais deux coupures à moins de trois minutes

  // --- accès brut, toujours facultatif ---
  brut(){
    try { return (typeof window !== 'undefined' && window.CrazyGames && window.CrazyGames.SDK) || null; }
    catch(e){ return null; }
  },

  // toute traversée du SDK passe par là : une API absente ne casse rien
  tenter(chemin, ...args){
    const s = this.brut();
    if(!s) return null;
    try {
      const cible = chemin.split('.').reduce((o, k) => (o ? o[k] : null), s);
      return (typeof cible === 'function') ? cible.apply(null, args) : null;
    } catch(e){ return null; }
  },

  /* --- cycle de vie --- */
  async demarrer(){
    const s = this.brut();
    if(!s){ this.pret = false; return false; }
    try {
      if(typeof s.init === 'function') await s.init();
      this.pret = true;
    } catch(e){ this.pret = false; }
    return this.pret;
  },

  chargementDebut(){ this.tenter('game.loadingStart'); },
  chargementFin(){   this.tenter('game.loadingStop'); },

  // le jeu tourne vraiment : ni menu, ni écran de fin, ni pause
  partieDebut(){
    if(this.enJeu) return;
    this.enJeu = true;
    this.tenter('game.gameplayStart');
  },
  partieFin(){
    if(!this.enJeu) return;
    this.enJeu = false;
    this.tenter('game.gameplayStop');
  },

  // un bon moment de jeu : victoire, province conquise, alliance scellée
  moment(){ this.tenter('game.happytime'); },

  /* --- publicité : uniquement entre deux parties, jamais pendant --- */
  coupure(apres){
    const fini = typeof apres === 'function' ? apres : ()=>{};
    const s = this.brut();
    const maintenant = Date.now();
    if(!s || maintenant - this.dernierePub < this.ENTRE_PUBS){ fini(); return; }
    this.dernierePub = maintenant;

    // le jeu doit être en pause pendant la coupure : on le déclare explicitement
    const reprendre = ()=>{ this.partieDebut(); fini(); };
    const etait = this.enJeu;
    this.partieFin();
    const lance = this.tenter('ad.requestAd', 'midgame', {
      adStarted: ()=>{},
      adFinished: ()=> { if(etait) reprendre(); else fini(); },
      adError: ()=> { if(etait) reprendre(); else fini(); },
    });
    // si l'appel n'a rien renvoyé et qu'aucun rappel ne viendra, on ne bloque pas le joueur
    if(lance === null){ if(etait) reprendre(); else fini(); }
  },
};
