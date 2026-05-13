/**
 * Symbol library for AnimML. Each symbol is a `<symbol>` element
 * inlined into the generated SVG's <defs>. Color is applied via
 * `currentColor` and `--_fill` CSS variables on the <use>.
 */

export const SYM_SIZE = {
  browser: [100, 75],
  server: [100, 75],
  hexagon: [90, 80],
  cylinder: [80, 90],
  cloud: [110, 75],
  diamond: [80, 60],
  queue: [90, 75],
  cache: [90, 70],
  user: [70, 85],
  box: [100, 65],
  pill: [90, 38],
};

export const SYMBOL_DEFS = `
<symbol id="sym-browser" viewBox="0 0 80 60" overflow="visible">
  <rect x="0.75" y="0.75" width="78.5" height="58.5" rx="3"
        fill="var(--_fill,none)" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
  <line x1="0.75" y1="14" x2="79.25" y2="14"
        stroke="currentColor" stroke-width="var(--sw,1.5)"/>
  <circle cx="7"  cy="7.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1"/>
  <circle cx="16" cy="7.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1"/>
  <circle cx="25" cy="7.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1"/>
  <rect x="8"  y="21" width="44" height="3" rx="1.5" fill="currentColor" opacity="0.4"/>
  <rect x="8"  y="29" width="34" height="3" rx="1.5" fill="currentColor" opacity="0.25"/>
  <rect x="8"  y="37" width="39" height="3" rx="1.5" fill="currentColor" opacity="0.25"/>
</symbol>
<symbol id="sym-server" viewBox="0 0 80 60" overflow="visible">
  <rect x="0.75" y="0.75"  width="78.5" height="17"   rx="2"
        fill="var(--_fill,none)" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
  <rect x="0.75" y="21.75" width="78.5" height="17"   rx="2"
        fill="var(--_fill,none)" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
  <rect x="0.75" y="42.75" width="78.5" height="16.5" rx="2"
        fill="var(--_fill,none)" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
  <circle cx="70" cy="9.25"  r="2.5" fill="none" stroke="currentColor" stroke-width="1"/>
  <circle cx="70" cy="30.25" r="2.5" fill="none" stroke="currentColor" stroke-width="1"/>
  <circle cx="70" cy="51"    r="2.5" fill="none" stroke="currentColor" stroke-width="1"/>
</symbol>
<symbol id="sym-hexagon" viewBox="0 0 80 70" overflow="visible">
  <polygon points="40,1 78,21 78,49 40,69 2,49 2,21"
           fill="var(--_fill,none)" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
  <circle cx="40" cy="35" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
</symbol>
<symbol id="sym-cylinder" viewBox="0 0 80 70" overflow="visible">
  <rect x="0.75" y="15" width="78.5" height="42"
        fill="var(--_fill,none)" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
  <ellipse cx="40" cy="15" rx="39.25" ry="10"
           fill="var(--_fill,none)" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
  <path d="M 0.75,57 A 39.25,10 0 0 0 79.25,57"
        fill="none" stroke="currentColor" stroke-width="var(--sw,1.5)" opacity="0.45"/>
</symbol>
<symbol id="sym-cloud" viewBox="0 0 90 60" overflow="visible">
  <path d="M20,52 C8,52 2,44 2,36 C2,28 8,22 16,22
           C16,12 24,4 36,4 C46,4 54,10 56,20
           C60,18 66,18 70,22 C76,22 88,28 88,38
           C88,46 82,52 74,52 Z"
        fill="var(--_fill,none)" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
</symbol>
<symbol id="sym-diamond" viewBox="0 0 80 60" overflow="visible">
  <polygon points="40,1 79,30 40,59 1,30"
           fill="var(--_fill,none)" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
</symbol>
<symbol id="sym-queue" viewBox="0 0 80 60" overflow="visible">
  <rect x="0.75" y="0.75"  width="78.5" height="14" rx="2"
        fill="var(--_fill,none)" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
  <rect x="4"    y="16.75" width="72"   height="14" rx="2"
        fill="var(--_fill,none)" stroke="currentColor" stroke-width="1.2" opacity="0.7"/>
  <rect x="8"    y="32.75" width="64"   height="14" rx="2"
        fill="var(--_fill,none)" stroke="currentColor" stroke-width="1"   opacity="0.45"/>
  <rect x="12"   y="48.75" width="56"   height="10" rx="2"
        fill="var(--_fill,none)" stroke="currentColor" stroke-width="0.8" opacity="0.25"/>
</symbol>
<symbol id="sym-cache" viewBox="0 0 80 55" overflow="visible">
  <ellipse cx="40" cy="10" rx="38" ry="9"
           fill="var(--_fill,none)" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
  <line x1="2"  y1="10" x2="2"  y2="35" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
  <line x1="78" y1="10" x2="78" y2="35" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
  <ellipse cx="40" cy="35" rx="38" ry="9"
           fill="var(--_fill,none)" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
  <path d="M 2,22 A 38,9 0 0 0 78,22"
        fill="none" stroke="currentColor" stroke-width="1" opacity="0.4"/>
</symbol>
<symbol id="sym-user" viewBox="0 0 60 70" overflow="visible">
  <circle cx="30" cy="18" r="14"
          fill="var(--_fill,none)" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
  <path d="M 1,68 C 1,50 10,38 30,38 C 50,38 59,50 59,68"
        fill="var(--_fill,none)" stroke="currentColor" stroke-width="var(--sw,1.5)"
        stroke-linecap="round"/>
</symbol>
<symbol id="sym-box" viewBox="0 0 80 50" overflow="visible">
  <rect x="0.75" y="0.75" width="78.5" height="48.5" rx="6"
        fill="var(--_fill,none)" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
</symbol>
<symbol id="sym-pill" viewBox="0 0 80 30" overflow="visible">
  <rect x="0.75" y="0.75" width="78.5" height="28.5" rx="14.25"
        fill="var(--_fill,none)" stroke="currentColor" stroke-width="var(--sw,1.5)"/>
</symbol>
`;

export const ANIM_STYLEKIT = `
:root {
  --bg: #181818;
  --bg-surface: #202020;
  --bg-container: rgba(255,255,255,0.03);

  --cyan:   #00d8ff;   --cyan-dim:   rgba(0,216,255,0.09);
  --green:  #4afa7a;   --green-dim:  rgba(74,250,122,0.09);
  --purple: #bd93f9;   --purple-dim: rgba(189,147,249,0.09);
  --pink:   #ff79c6;   --pink-dim:   rgba(255,121,198,0.09);
  --yellow: #f1fa8c;   --yellow-dim: rgba(241,250,140,0.09);
  --orange: #ffb86c;   --orange-dim: rgba(255,184,108,0.09);
  --red:    #ff5555;   --red-dim:    rgba(255,85,85,0.09);
  --accent: #8faacc;   --accent-dim: rgba(143,170,204,0.09);
  --white:  #f8f8f2;   --white-dim:  rgba(248,248,242,0.06);
  --dim:    #4a4a48;   --dim-dim:    rgba(74,74,72,0.10);

  --font: 'Monaspace Neon', ui-monospace, monospace;

  --sw:        1.5;
  --sw-active: 2.5;
  --sw-edge:   1.5;

  --ease-reveal: cubic-bezier(0.4,0,0.2,1);
  --ease-pulse:  cubic-bezier(0.34,1.56,0.64,1);
}
`;
