// Big picture icons for the chapter menu on the title page: one per chapter, all in the same style
// (gold line drawings with a little colour, on a dark round badge). Plain inline SVG, no files.
const GOLD = '#ffd77a', DEEP = '#141a36';
const badge = (inner) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="32" cy="32" r="30" fill="${DEEP}" stroke="${GOLD}" stroke-width="2"/>
  <g fill="none" stroke="${GOLD}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;

export const CHAPTER_ICONS = {
  // Campfire: crossed logs and a flame, with a spark
  1: badge(`<path d="M17 47 L47 39 M17 39 L47 47" stroke="#c48a52" stroke-width="4"/>
    <path d="M32 41 C22 37 24 27 30 21 C30 27 34 28 34 24 C40 29 43 37 32 41 Z" fill="#ff8a3a" stroke="#ffb347"/>
    <path d="M32 40 C28 37 29 32 32 29 C35 33 36 37 32 40 Z" fill="#ffe27a" stroke="none"/>
    <circle cx="41" cy="18" r="1.3" fill="#ffb347" stroke="none"/>`),
  // Stonehenge: a trilithon with the midsummer Sun rising between the stones
  2: badge(`<circle cx="32" cy="38" r="7" fill="#ffb347" stroke="none" opacity="0.9"/>
    <path d="M12 46 L52 46" stroke="#7a8a5a"/>
    <rect x="16" y="22" width="9" height="24" rx="1.5" fill="#8f8a7e"/><rect x="39" y="22" width="9" height="24" rx="1.5" fill="#8f8a7e"/>
    <rect x="14" y="16" width="36" height="7" rx="1.5" fill="#a59f90"/>`),
  // The Nile: a pyramid by the river, with Sirius bright above it
  3: badge(`<path d="M14 44 L32 20 L50 44 Z" fill="#d9b26a"/><path d="M32 20 L36 44" opacity="0.6"/>
    <path d="M10 49 C18 46 24 52 32 49 C40 46 46 52 54 49" stroke="#5aa7e0"/>
    <path d="M47 10 L47 20 M42 15 L52 15 M43.5 11.5 L50.5 18.5 M50.5 11.5 L43.5 18.5" stroke="#dff0ff" stroke-width="1.6"/>
    <circle cx="47" cy="15" r="2.2" fill="#ffffff" stroke="none"/>`),
  // Babylon: the ziggurat under a red eclipsed Moon
  4: badge(`<circle cx="44" cy="17" r="7" fill="#a8341e" stroke="#e0643a"/><path d="M39 13 A7 7 0 0 1 50 21" stroke="#ffb38a" stroke-width="1.4" opacity="0.8"/>
    <path d="M12 48 L52 48 L48 41 L16 41 Z M18 41 L22 34 L42 34 L46 41 M24 34 L27 27 L37 27 L40 34" fill="#c89a5a"/>
    <path d="M30 27 L30 22 L34 22 L34 27"/>`),
  // Greece: a temple front, and the round Earth's shadow on the Moon
  5: badge(`<path d="M13 25 L32 14 L51 25 Z" fill="#e8e2d0"/><path d="M14 27 L50 27"/>
    <path d="M19 29 L19 44 M26 29 L26 44 M33 29 L33 44 M40 29 L40 44 M46 29 L46 44" stroke="#e8e2d0" stroke-width="3"/>
    <path d="M12 47 L52 47"/>`),
  // Antikythera: a bronze gear wheel with its little pointer
  6: badge(`<path d="M32 13 l3 5 5-1 1 5 5 1-1 5 5 3-5 3 1 5-5 1-1 5-5-1-3 5-3-5-5 1-1-5-5-1 1-5-5-3 5-3-1-5 5-1 1-5 5 1 z" fill="#4f8f73" stroke="#9ad0a0"/>
    <circle cx="32" cy="32" r="6" fill="${DEEP}" stroke="#9ad0a0"/><path d="M32 32 L41 25" stroke="${GOLD}" stroke-width="2.6"/>
    <circle cx="32" cy="32" r="1.8" fill="${GOLD}" stroke="none"/>`),
  // Ptolemy: Earth in the middle of nested spheres, Mars riding its small circle
  7: badge(`<circle cx="32" cy="32" r="21" opacity="0.55"/><circle cx="32" cy="32" r="14" opacity="0.8"/>
    <circle cx="32" cy="32" r="5" fill="#3f7fd0" stroke="#9cc8ff"/>
    <circle cx="46" cy="21" r="5" stroke="#e0643a" stroke-width="1.6"/><circle cx="50" cy="19" r="2.2" fill="#e0643a" stroke="none"/>
    <circle cx="18" cy="42" r="2.6" fill="#ffd77a" stroke="none"/>`),
  // Copernicus: the Sun in the middle, the planets' circles round it
  8: badge(`<circle cx="32" cy="32" r="22" opacity="0.5"/><circle cx="32" cy="32" r="15" opacity="0.7"/><circle cx="32" cy="32" r="9" opacity="0.9"/>
    <circle cx="32" cy="32" r="4.5" fill="${GOLD}" stroke="none"/>
    <circle cx="47" cy="32" r="2.6" fill="#3f7fd0" stroke="none"/><circle cx="20" cy="17" r="2.2" fill="#e0643a" stroke="none"/>`),
  // Kepler: an ellipse with the Sun at one focus
  10: badge(`<ellipse cx="32" cy="32" rx="21" ry="14" opacity="0.85"/><circle cx="40" cy="32" r="4.5" fill="${GOLD}" stroke="none"/>
    <circle cx="24" cy="32" r="1.6" fill="#cfd8ff" stroke="none"/><circle cx="18" cy="22" r="3" fill="#e0643a" stroke="none"/>`),
  // Newton: an apple, and a cannonball's orbit round a little Earth with a mountain
  12: badge(`<circle cx="32" cy="34" r="20" opacity="0.6" stroke-dasharray="3 3"/><circle cx="32" cy="34" r="12" fill="#3f7fd0" stroke="#9cc8ff"/>
    <path d="M29 23 L32 16 L35 23" fill="#8a7a60" stroke="#c8b898" stroke-width="1.6"/><circle cx="50" cy="26" r="2.4" fill="${GOLD}" stroke="none"/>
    <circle cx="16" cy="15" r="5" fill="#c8281c" stroke="#ff7a5a" stroke-width="1.4"/><path d="M16 10 L17 6" stroke="#6aa040" stroke-width="1.6"/>`),
  // Tycho: the W of Cassiopeia with the bright new star above it
  9: badge(`<path d="M14 40 L22 32 L30 42 L38 33 L48 40" stroke-width="2" opacity="0.8"/>
    <path d="M32 12 l3 8 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z" fill="${GOLD}" stroke="none"/>`),
};
