/* Icônes vectorielles (SVG inline) — remplacent les emojis dans l'UI */
const P = {
  or:        '<circle cx="12" cy="12" r="7.5"/><path d="M12 8v8M9.8 9.8h3.7a2.2 2.2 0 0 1 0 4.4H9.8"/>',
  mat:       '<path d="M3 8.5h8v4H3zM13 8.5h8v4h-8zM6 13.5h12v4H6z"/>',
  food:      '<path d="M12 21V9M12 13c-3 0-4.5-2-4.5-5 3 0 4.5 2 4.5 5zM12 13c3 0 4.5-2 4.5-5-3 0-4.5 2-4.5 5zM12 9c0-2.5 1-4 2.5-5C15.5 6 14.5 8 12 9z"/>',
  pop:       '<circle cx="8.5" cy="8" r="3"/><path d="M3 20c0-3.3 2.5-5.5 5.5-5.5S14 16.7 14 20"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M15 14.8c3 0 6 1.7 6 5.2"/>',
  energie:   '<path d="M13.5 2.5 5 13.5h6L10.5 21.5 19 10.5h-6z"/>',
  sci:       '<path d="M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3M9 3h6M7.6 14.5h8.8"/>',
  bonheur:   '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c.9 1.4 2.1 2.1 3.5 2.1s2.6-.7 3.5-2.1M9 9.5h.01M15 9.5h.01"/>',
  temps:     '<circle cx="12" cy="12" r="9"/><path d="M12 6.8V12l3.4 2"/>',
  pause:     '<rect x="6.5" y="4.5" width="4" height="15" rx="1"/><rect x="13.5" y="4.5" width="4" height="15" rx="1"/>',

  infanterie:'<path d="M12 3.5c-4 0-6.5 2.6-6.5 6v1.8h13V9.5c0-3.4-2.5-6-6.5-6zM5.5 11.3h13M9 11.3v3.4M15 11.3v3.4M7 20.5c1-2 2.9-3 5-3s4 1 5 3"/>',
  artillerie:'<path d="M3 17.5h6.5M4.5 17.5 15 7l3 3-10.4 7.5M17 5.5 19.5 8M2.5 20.5h13"/><circle cx="7" cy="19" r="1.6"/>',
  chars:     '<rect x="2.5" y="12.5" width="19" height="6" rx="3"/><path d="M6 12.5V9.5h8v3M11 9.5 21 7M6.5 15.5h11"/>',
  avions:    '<path d="M12 2.5c1.4 0 2 1.6 2 3.6v3.3l7 4.2v2.4l-7-2.2v3.6l2.3 1.8v1.8L12 19.6l-4.3 1.4v-1.8L10 17.4v-3.6l-7 2.2v-2.4l7-4.2V6.1c0-2 .6-3.6 2-3.6z"/>',
  navires:   '<path d="M3 15.5h18l-2.6 4.2a2 2 0 0 1-1.7 1H7.3a2 2 0 0 1-1.7-1zM6.5 15.5v-5h11v5M12 10.5V4M12 4l5 2.5-5 2"/>',

  ferme:     '<path d="M3.5 20.5v-9L12 6.5l8.5 5v9zM9 20.5v-5h6v5M3.5 11.5h17"/>',
  mine:     '<path d="M4 20.5 13.5 11M3.5 9.5c2.6-3 6.3-3.6 9-1.6M20.5 9.5c-2.6-3-6.3-3.6-9-1.6M11.5 7.9l1.2 1.2"/><path d="M15 13.5l5 5"/>',
  port:      '<circle cx="12" cy="5" r="2"/><path d="M12 7v13M6.5 11.5h11M4 14c0 4 3.6 6.5 8 6.5s8-2.5 8-6.5"/>',
  usine:     '<path d="M3 20.5v-9l5 3v-3l5 3v-3l5 3v6zM16.5 8.5l.6-5h2.9l.6 5"/><path d="M7 16.5h2M13 16.5h2"/>',
  centrale:  '<path d="M7 20.5 9 4h6l2 16.5zM5 20.5h14"/><path d="M12.8 8.5 10.5 12h3l-2.3 3.5"/>',
  universite:'<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v5.5c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3V11M20 10v5"/>',
  caserne:   '<path d="M12 3 4 6v6c0 4.7 3.3 8.3 8 9.5 4.7-1.2 8-4.8 8-9.5V6z"/><path d="M9 12.5 11 14.5 15.5 10"/>',

  chat:      '<path d="M20.5 12.5c0 4-3.8 7.2-8.5 7.2-1 0-2-.15-2.9-.42L4 21l1.5-4.1A6.9 6.9 0 0 1 3.5 12.5c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2z"/><path d="M8.5 11.5h7M8.5 14.5h4"/>',
  envoyer:   '<path d="M21 3 10.5 13.5M21 3l-6.5 18-4-8-8-4z"/>',
  reglages:  '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3"/>',
  ia:        '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 7V3.5M9.5 12.5h.01M14.5 12.5h.01M9 16h6"/><path d="M1.5 12v3M22.5 12v3"/>',
  etoile:    '<path d="M12 3.5l2.6 5.6 6 .8-4.4 4.3 1.1 6.1-5.3-3-5.3 3 1.1-6.1L3.4 9.9l6-.8z"/>',
  guerre:    '<path d="M4 4l10 10M20 4 10 14M4 20l3.5-3.5M20 20l-3.5-3.5M3 3h3l1.5 1.5M21 3h-3l-1.5 1.5"/><path d="M13.5 15.5 16 18l4 4M10.5 15.5 8 18l-4 4"/>',
  paix:      '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M4.2 8.5h15.6M4.2 15.5h15.6"/>',
  don:       '<rect x="3.5" y="9.5" width="17" height="11" rx="1.5"/><path d="M2.5 6.5h19v3h-19zM12 6.5v14M12 6.5C10 3 6 3.5 6.5 6c.4 2 3.5 1 5.5.5zM12 6.5C14 3 18 3.5 17.5 6c-.4 2-3.5 1-5.5.5z"/>',
  pacte:     '<path d="M5 4.5h11l3.5 3.5v11.5H5z"/><path d="M8.5 9.5h7M8.5 13h7M8.5 16.5h4"/>',
  alliance:  '<path d="M8 13.5 10.5 16l3-3 3 3 3.5-3.5M3.5 10.5 7 7l3 2.5M10 9.5 13 7l4 3.5"/><path d="M3 12.5 6 15M18 15l3-2.5"/>',
  batir:     '<path d="M14.5 3.5a4.5 4.5 0 0 0-6 6l-5 5v3.5H7l5-5a4.5 4.5 0 0 0 6-6L15.5 9 13 6.5z"/>',
  raser:     '<path d="M4 20.5h16M6.5 20.5V11l6-6 5 5-6 6M14 8 9 13"/>',
  fortifier: '<path d="M3.5 7.5h17M3.5 12h17M3.5 16.5h17M8 7.5V3M16 7.5V3M11.5 12V7.5M8 16.5V12M16 16.5V12M11.5 21v-4.5"/>',
  coloniser: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 10 10.5 8.5 16l5.5-2z"/>',
  recherche: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/><path d="M8 10.5h5M10.5 8v5"/>',
  verrou:    '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  ok:        '<path d="M4 12.5 9.5 18 20 6"/>',
  monde:     '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  attaque:   '<path d="M3 21 12 12M12 12 21 3h-4l-7 7M3 3h4l7 7"/><path d="M15.5 15.5 21 21M8.5 15.5 3 21"/>',
};

function ic(nom, cls=''){
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${P[nom]||''}</svg>`;
}
