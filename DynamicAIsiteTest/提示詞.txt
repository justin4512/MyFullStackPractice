# SELENE — Lunar Expedition Earthrise Site Rebuild Prompt

> One-shot prompt for an AI code generator (Claude Code, Cursor, v0, Bolt, etc.). Paste this entire file as a single prompt into an empty directory. It contains the exact, complete source of every file in the project — follow it literally and the result is pixel-for-pixel the original.

## What this project is

"SELENE — Watch the Earth rise" is a one-page site for a fictional lunar expedition company. It opens behind a veil of cosmic dust — *Scroll to clear the dust* — and the scroll clears it onto the grey cratered surface of the Moon, where **the Earth climbs out from behind the horizon** under a widely tracked `EARTHRISE` title and a lone astronaut stands silhouetted on a rock in the foreground. A mission clock and the Earth's elevation tick in the corners. Below: the flight **Earth → Moon drawn as you scroll** — the four legs of the trajectory ink themselves one after another with a capsule riding the leg being drawn, and the distance flown ticks up to 384,400 km during the coast; a **mission log** as a reel of stills (Launch, Lunar orbit, Base Tranquillity, First steps) that slides sideways with the scroll, the frame nearest the middle in focus and the rest dimmed; three mission classes, each card carrying its length as a set of orbit rings; and a waitlist with a ticking launch-window countdown beside the manifest form. Type is Michroma for display, Manrope for text and IBM Plex Mono for the readouts.

## How the page works — read this before touching any number

Three things are load-bearing:

- **One rAF loop runs the page.** `src/lib/scroll.ts` advances Lenis and then lets every scroll-driven component read its own position and write styles directly. Nothing goes through React state while scrolling, so the page never re-renders mid-scroll. Do not move any of it into `useState`, and do not add a second scroll library or animation library.
- **The hero is six layers cut from one render**, stacked and pinned, each moved at its own rate by the scroll. There is no film and no WebGL: depth comes entirely from the layers sliding past each other, with `d` and `m` cuts of every layer for landscape and portrait screens.
- **The trajectory is drawn, not animated on a timer.** `Trajectory.tsx` pins for `SECTION_VH` 380 and spends `WINDOW` of it inking the four legs in order; the capsule and the distance counter are functions of the same progress.

Checks that must pass before you call it done: no sideways scroll at 390, 768, 1280 or 1920; the dust clears before the Earth starts to rise; and the reel's centre frame is always the one in focus.

## Reproduce this exactly

The goal is a **byte-identical rebuild**, not an interpretation. Every file below is the real, final source of a shipped project. Write each one out verbatim.

- **Do not "improve" anything.** Not the copy, not the colour values, not the timing constants, not the breakpoints.
- **Do not substitute libraries or approaches.** The dependency list below is complete and exact.
- **Use the pinned versions in `package.json` as written** — do not run `npm install <pkg>@latest`.
- **Do not add files.** The complete file list is exactly what appears under **File:** below, plus the downloaded assets.
- **Keep every accessibility attribute** — `aria-label`, `aria-hidden`, `alt` text, and every reduced-motion branch.
- **Keep the comments.** They record why each number has the value it does.
- If a scaffolding tool generates boilerplate (`App.css`, the Vite SVG logos, a starter `App.tsx`, a `README.md`), **delete it** rather than merging it in.

## Tech stack (required — do not substitute)

- Vite 6 + React 19 + **TypeScript** (`npm run lint` is `tsc --noEmit`)
- `@vitejs/plugin-react` — the React plugin
- Tailwind CSS v4 via the **`@tailwindcss/vite`** plugin — there is **no** `tailwind.config.js`; colours, fonts and type scale are an `@theme` block in `src/index.css`.
- **Lenis** for smooth scrolling, advanced from the page's single rAF loop. There is **no** GSAP, no Motion and no animation library: every scroll beat is plain arithmetic on scroll progress.
- Fonts by `<link>` in `index.html`: **Michroma**, **Manrope** and **IBM Plex Mono**, from Google Fonts. Those hosts are built to be linked to; leave the links as they are.
- The dependency list in `package.json` below is complete and exact — do not add, remove, or substitute a package.

### package.json

```json
{
  "name": "lunar",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port=3006 --host=0.0.0.0",
    "build": "vite build",
    "preview": "vite preview --port=3006",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "lenis": "^1.3.11",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.14",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^5.0.4",
    "tailwindcss": "^4.1.14",
    "typescript": "~5.8.2",
    "vite": "^6.2.3"
  }
}
```

## Assets — download them, do not hotlink

Every picture this page shows — the six Earthrise layers in two cuts, and the mission-log stills — lives in `public/` and none of it is in the code: 17 files, about 3MB. They ship as one archive; download and unpack it into `public/` as the **first build step**, so the files land under `public/layers/`, `public/media/`:

```bash
mkdir -p public
curl -L -o assets.zip "https://pub-1e5b4001b36b47e28e6a2fb775966a79.r2.dev/prompt-assets/selene/assets.zip"
unzip -q assets.zip -d public/
rm assets.zip
```

**The download URL above must not appear anywhere in the project you generate** — not in `index.html`, not in a component, not in CSS, not in a config file. It is the template library's own storage, not a CDN licensed to serve your site's traffic. A page that hotlinks it breaks the moment the asset is moved, and it bills your visitors' bandwidth to someone else. Download it once, commit it with your project, and serve it from your own hosting like any other asset you own.

## Steps to build

1. Scaffold a new Vite React + TypeScript project named `selene`, then delete every file the scaffolder generated under `src/` and `public/`.
2. Write `package.json` exactly as given above and install with it.
3. Download and unpack the assets as described in **Assets** above — do this before the first run, or the stage paints nothing.
4. Write `index.html`, `vite.config.ts`, `tsconfig.json` and `.gitignore`, then `src/main.tsx`, `src/App.tsx`, `src/index.css` and `src/content.ts`, with the exact contents below.
5. Write `src/lib/` and `src/hooks/` (and `src/gl/` and `src/stage/` where present) **before** the components — every section reads its scroll progress through them.
6. Write `src/components/`.
7. Re-read **How the page works** above before you touch a height, a scroll window or a frame count.
8. Run `npm run dev` and scroll slowly from the top to the bottom, then run `npm run lint` and `npm run build`; both must be clean.

## File: `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#05070c" />
    <title>SELENE — Watch the Earth rise</title>
    <meta name="description" content="SELENE is a concept for lunar expeditions: six to twenty-eight days, one view nobody forgets — the Earth rising over the Moon." />
    <meta property="og:title" content="SELENE — Watch the Earth rise" />
    <meta property="og:description" content="A concept for lunar expeditions." />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="/media/og.jpg" />
    <meta name="twitter:card" content="summary_large_image" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <!-- Display: Michroma (wide, engineered caps). Text: Manrope. Telemetry: IBM Plex Mono. -->
    <link
      href="https://fonts.googleapis.com/css2?family=Michroma&family=Manrope:wght@300..700&family=IBM+Plex+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <link rel="preload" as="image" href="/layers/d/sky.webp" media="(min-width: 768px)" fetchpriority="high" />
    <link rel="preload" as="image" href="/layers/m/sky.webp" media="(max-width: 767px)" fetchpriority="high" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## File: `package.json`

```json
{
  "name": "lunar",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port=3006 --host=0.0.0.0",
    "build": "vite build",
    "preview": "vite preview --port=3006",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "lenis": "^1.3.11",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.14",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^5.0.4",
    "tailwindcss": "^4.1.14",
    "typescript": "~5.8.2",
    "vite": "^6.2.3"
  }
}
```

## File: `vite.config.ts`

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Frame sequence and loop video live in public/ and are served as-is.
    target: 'es2020',
  },
});
```

## File: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

## File: `.gitignore`

```
node_modules
dist
```

## File: `src/main.tsx`

```tsx
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

// The pinned stages depend on scroll position; always start at the top.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

## File: `src/App.tsx`

```tsx
import {useEffect} from 'react';
import {Footer, Header} from './components/Chrome';
import {Earthrise} from './components/Earthrise';
import {MissionLog} from './components/MissionLog';
import {Missions} from './components/Missions';
import {Reserve} from './components/Reserve';
import {Trajectory} from './components/Trajectory';
import {useReducedMotion} from './hooks/useReducedMotion';
import {startScroll} from './lib/scroll';

export default function App() {
  const reduced = useReducedMotion();
  useEffect(() => startScroll(reduced), [reduced]);

  return (
    <>
      <Header />
      <main>
        <Earthrise />
        <MissionLog />
        <Trajectory />
        <Missions />
        <Reserve />
      </main>
      <Footer />
    </>
  );
}
```

## File: `src/index.css`

```css
@import "tailwindcss";

/* Lenis' own stylesheet (its package exports don't expose the .css path). */
html.lenis,
html.lenis body {
  height: auto;
}
.lenis:not(.lenis-autoToggle).lenis-stopped {
  overflow: clip;
}
.lenis.lenis-smooth iframe {
  pointer-events: none;
}

/* ------------------------------------------------------------------
   Type system
   Display: Michroma — wide, engineered caps. Used sparingly and always
            tracked out, like lettering on a hull.
   Text:    Manrope.
   Mono:    IBM Plex Mono for telemetry: coordinates, clocks, labels.
   ------------------------------------------------------------------ */
@theme {
  --font-display: "Michroma", "Eurostile", "Arial Black", sans-serif;
  --font-sans: "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;

  --color-void: #05070c;
  --color-void-2: #0b0f18;
  --color-regolith: #c9ccd3;
  --color-dust: #8b909b;
  --color-earth: #6fb6ff;
  --color-sunlit: #f2e6c9;

  --text-hero: clamp(2.25rem, 8.6vw, 9rem);
  --text-hero--line-height: 1;
  --text-hero--letter-spacing: 0.24em;

  --text-display: clamp(1.75rem, 4vw, 3.75rem);
  --text-display--line-height: 1.08;
  --text-display--letter-spacing: 0.02em;

  --text-lead: clamp(1.125rem, 1.6vw, 1.5rem);
  --text-lead--line-height: 1.45;
  --text-lead--letter-spacing: -0.01em;

  --text-body: clamp(0.9375rem, 1.05vw, 1.0625rem);
  --text-body--line-height: 1.65;
  --text-body--letter-spacing: -0.005em;

  --text-label: 0.6875rem;
  --text-label--line-height: 1.3;
  --text-label--letter-spacing: 0.16em;
}

@layer base {
  html {
    -webkit-text-size-adjust: 100%;
    background: var(--color-void);
  }
  body {
    margin: 0;
    background: var(--color-void);
    color: var(--color-regolith);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: clip;
  }
  ::selection {
    background: var(--color-earth);
    color: var(--color-void);
  }
  :focus-visible {
    outline: 1.5px solid var(--color-earth);
    outline-offset: 3px;
    border-radius: 4px;
  }
}

@layer utilities {
  .h-screen-s {
    height: 100svh;
  }

  /* HUD corner brackets. */
  .brackets {
    background:
      linear-gradient(currentColor, currentColor) top left / 14px 1px,
      linear-gradient(currentColor, currentColor) top left / 1px 14px,
      linear-gradient(currentColor, currentColor) top right / 14px 1px,
      linear-gradient(currentColor, currentColor) top right / 1px 14px,
      linear-gradient(currentColor, currentColor) bottom left / 14px 1px,
      linear-gradient(currentColor, currentColor) bottom left / 1px 14px,
      linear-gradient(currentColor, currentColor) bottom right / 14px 1px,
      linear-gradient(currentColor, currentColor) bottom right / 1px 14px;
    background-repeat: no-repeat;
  }

  [data-reveal] {
    opacity: 0;
    transform: translate3d(0, 24px, 0);
    transition:
      opacity 1s cubic-bezier(0.2, 0.7, 0.1, 1),
      transform 1s cubic-bezier(0.2, 0.7, 0.1, 1);
  }
  [data-reveal].is-in {
    opacity: 1;
    transform: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [data-reveal] {
      transform: none;
    }
  }
}

@keyframes leg-in {
  from {
    opacity: 0;
    transform: translate3d(0, 12px, 0);
  }
}
```

## File: `src/content.ts`

```ts
/**
 * Every word on the page. SELENE is a concept brand — names, dates and
 * missions are illustrative placeholders, and the page says so.
 */

export const brand = {
  name: 'Selene',
  wordmark: 'SELENE',
  email: 'crew@selene.space',
};

export const nav = [
  {label: 'Log', href: '#log'},
  {label: 'Trajectory', href: '#trajectory'},
  {label: 'Missions', href: '#missions'},
  {label: 'Reserve', href: '#reserve'},
];

export const hero = {
  title: 'EARTHRISE',
  kicker: 'A concept for lunar expeditions',
  site: 'Mare Tranquillitatis · 0.67°N 23.47°E',
};

export const intro = {
  eyebrow: 'Mission log',
  heading: 'The first holiday that leaves the planet.',
  body: 'Four days out, a week on the surface, and one view nobody has ever forgotten. This is the trip, frame by frame.',
};

export const log = [
  {tag: 'T−0', title: 'Launch', body: 'Nine minutes of thunder, then silence and the curve of the Earth.', image: '/media/cards/m1-launch.webp'},
  {tag: 'Day 3', title: 'Lunar orbit', body: 'The far side scrolls past the window. Your hand on the glass.', image: '/media/cards/m2-orbit.webp'},
  {tag: 'Day 4', title: 'Base Tranquillity', body: 'Pressurised domes, a hot meal, and a skylight pointed home.', image: '/media/cards/m3-base.webp'},
  {tag: 'Day 5', title: 'First steps', body: 'Footprints that will outlast every building you have ever seen.', image: '/media/cards/m4-walk.webp'},
];

/** Legs of the Earth → Moon trajectory, in drawing order. */
export const trajectory = {
  eyebrow: 'Trajectory',
  heading: '384,400 km, drawn as you scroll.',
  legs: [
    {day: 'Day 0', title: 'Parking orbit', body: 'Two laps of the Earth while the crew and craft are checked.'},
    {day: 'Day 0', title: 'Trans-lunar injection', body: 'A six-minute burn and you are on your way. No turning back for three days.'},
    {day: 'Day 3', title: 'Lunar orbit insertion', body: 'The engine fires behind the Moon, out of contact with Earth. Then: capture.'},
    {day: 'Day 4', title: 'Descent', body: 'Twelve minutes from orbit to the dust of Tranquillity.'},
  ],
};

export const missions = {
  eyebrow: 'Missions',
  heading: 'Three ways to leave.',
  note: 'Concept missions — durations illustrative.',
  items: [
    {name: 'Orbiter', days: 6, lines: ['Two lunar orbits', 'Far-side flyover', 'Earthrise from orbit'], cta: 'Join the Orbiter list'},
    {name: 'Lander', days: 10, lines: ['Four nights at Base Tranquillity', 'Two surface EVAs', 'Earthrise from the surface'], cta: 'Join the Lander list', featured: true},
    {name: 'Resident', days: 28, lines: ['A full lunar day and night', 'Rover traverse to the highlands', 'Science crew rotation'], cta: 'Join the Resident list'},
  ],
};

export const reserve = {
  eyebrow: 'Reserve',
  heading: 'Put your name on the manifest.',
  body: 'No payment, no commitment. We’ll write when the next window opens.',
  /** Illustrative launch window for the countdown (the Apollo 11 anniversary). */
  window: '2031-07-20T20:17:00Z',
  windowLabel: 'Next launch window (concept)',
};
```

## File: `src/components/Chrome.tsx`

```tsx
import {useState, type MouseEvent} from 'react';
import {brand, nav} from '../content';
import {scrollToHash} from '../lib/scroll';

function go(e: MouseEvent<HTMLAnchorElement>, then?: () => void) {
  const hash = e.currentTarget.getAttribute('href');
  if (!hash?.startsWith('#')) return;
  e.preventDefault();
  then?.();
  scrollToHash(hash);
}

/** A crescent: the mark. */
function Crescent({className = ''}: {className?: string}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M15.5 3.2A9 9 0 1 0 20.8 16 7.2 7.2 0 0 1 15.5 3.2Z" fill="currentColor" />
    </svg>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-0 z-50 text-white">
      <div className="flex items-center justify-between px-4 pt-4 sm:px-6 sm:pt-5 md:px-[3vw]">
        <a href="#top" onClick={(e) => go(e)} className="flex items-center gap-2.5" aria-label={`${brand.name} — back to top`}>
          <Crescent className="size-5" />
          <span className="font-display text-[0.9375rem] tracking-[0.36em]">{brand.wordmark}</span>
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {nav.map((item) => (
            <a key={item.href} href={item.href} onClick={(e) => go(e)} className="font-mono text-label text-white/75 uppercase transition-colors hover:text-white">
              {item.label}
            </a>
          ))}
          <a href="#reserve" onClick={(e) => go(e)} className="rounded-[4px] bg-white px-4 py-2.5 font-mono text-label text-void uppercase transition-colors hover:bg-earth">
            Reserve a seat
          </a>
        </nav>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="menu" className="font-mono text-label uppercase md:hidden">
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      <div id="menu" inert={!open} className={`fixed inset-0 -z-10 flex flex-col justify-center gap-6 bg-void/95 px-6 backdrop-blur-xl transition-opacity md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        {nav.map((item, i) => (
          <a key={item.href} href={item.href} onClick={(e) => go(e, () => setOpen(false))} className="flex items-baseline gap-4 font-display text-[1.75rem] tracking-[0.14em] uppercase">
            <span className="font-mono text-label text-earth">0{i + 1}</span>
            {item.label}
          </a>
        ))}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-void px-4 py-8 sm:px-6 md:px-[6vw]">
      <div className="flex flex-col gap-4 font-mono text-label text-regolith/50 uppercase md:flex-row md:items-center md:justify-between">
        <span className="flex items-center gap-2.5 text-white/80">
          <Crescent className="size-4" />
          {brand.wordmark} · a concept
        </span>
        <span>© {new Date().getFullYear()} · Imagery generated for this concept</span>
        <a href="#top" onClick={(e) => go(e)} className="hover:text-white">
          Back to the surface ↑
        </a>
      </div>
    </footer>
  );
}
```

## File: `src/components/Earthrise.tsx`

```tsx
import {useEffect, useRef} from 'react';
import {hero} from '../content';
import {useReducedMotion} from '../hooks/useReducedMotion';
import {clamp, easeOutCubic, lerp, pinProgress, range} from '../lib/math';
import {onFrame} from '../lib/scroll';

/**
 * The Earthrise. Six photographic layers cut from one render, stacked and
 * pinned; one scroll range moves each at its own rate:
 *
 *   0.00 – 0.18  a veil of cosmic dust drifts off the lens
 *   0.04 – 0.50  the Earth climbs out from behind the horizon
 *   0.10 – 0.50  EARTHRISE resolves between the plains and the crater
 *   0.28 – 0.60  the crater rim closes in around the view — you're inside
 *                it looking out — and the astronaut and ground rise
 *   0.70 – 1.00  everything tilts away upward and the ground swallows the
 *                frame to black, which is where the page continues
 *
 * A thin telemetry HUD rides on top: mission clock, the Earth's elevation
 * above the horizon, landing-site coordinates.
 */

const STAGE_VH = 440;

type LayerName = 'sky' | 'earth' | 'moonscape' | 'frame' | 'astronaut' | 'ground';
const ORDER: LayerName[] = ['sky', 'earth', 'moonscape', 'frame', 'astronaut', 'ground'];

/** All layers share one crop, so they stay registered at every viewport. */
const FIT = 'absolute inset-0 size-full object-cover object-[58%_50%] md:object-center';

type Mote = {x: number; y: number; r: number; s: number; a: number};

export function Earthrise() {
  const rootRef = useRef<HTMLElement>(null);
  const layerRefs = useRef<Partial<Record<LayerName, HTMLDivElement>>>({});
  const veilRef = useRef<HTMLDivElement>(null);
  const dustRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const elevRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  // Dust canvas size.
  useEffect(() => {
    const c = dustRef.current!;
    const sync = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = dustRef.current!;
    const ctx = canvas.getContext('2d')!;
    let seed = 11;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const motes: Mote[] = Array.from({length: 140}, () => ({x: rand(), y: rand(), r: 0.4 + rand() * 1.6, s: 0.3 + rand(), a: 0.2 + rand() * 0.6}));
    let lastP = -1;
    let lastTime = 0;

    const set = (name: LayerName, y: number, scale = 1, opacity = 1) => {
      const el = layerRefs.current[name];
      if (!el) return;
      el.style.transform = `translate3d(0, ${y}vh, 0) scale(${scale})`;
      el.style.opacity = String(opacity);
    };

    return onFrame((time) => {
      const dt = lastTime ? Math.min(0.1, (time - lastTime) / 1000) : 1 / 60;
      lastTime = time;
      const root = rootRef.current;
      if (!root) return;
      const {p, rect} = pinProgress(root);
      if (rect.bottom < 0) return;

      // Dust drifts every frame while it's visible.
      const veil = 1 - range(p, 0, 0.18);
      if (veil > 0.001) {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const dpr = canvas.width / Math.max(1, w);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#dfe6f2';
        for (const m of motes) {
          if (!reducedRef.current) {
            m.x += 0.006 * m.s * dt;
            m.y -= 0.004 * m.s * dt;
            if (m.x > 1) m.x -= 1;
            if (m.y < 0) m.y += 1;
          }
          ctx.globalAlpha = m.a * veil;
          ctx.beginPath();
          ctx.arc(m.x * w, (m.y - p * 0.6) * h, m.r * (1 + p * 4), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      if (Math.abs(p - lastP) < 0.00005) return;
      lastP = p;

      const exit = range(p, 0.7, 1);
      const settle = easeOutCubic(range(p, 0, 0.5));

      // Veil clears upward.
      veilRef.current!.style.opacity = String(veil);
      veilRef.current!.style.transform = `translate3d(0, ${-range(p, 0, 0.18) * 24}vh, 0) scale(${1 + range(p, 0, 0.18) * 0.25})`;
      canvas.style.opacity = String(veil);

      // Far → near, each faster than the one behind it.
      set('sky', lerp(0, -6, p), lerp(1.14, 1, settle));
      const rise = easeOutCubic(range(p, 0.04, 0.5));
      set('earth', lerp(34, 0, rise) - exit * 12, lerp(0.92, 1, rise));
      set('moonscape', lerp(9, 0, settle) - exit * 26);
      const rim = easeOutCubic(range(p, 0.28, 0.58));
      set('frame', -exit * 44, lerp(1.6, 1, rim), rim);
      const up = easeOutCubic(range(p, 0.36, 0.62));
      set('astronaut', lerp(28, 0, up) - exit * 58, 1, clamp(up * 2));
      const ground = easeOutCubic(range(p, 0.34, 0.6));
      set('ground', lerp(36, 0, ground) - exit * 78);

      // Title: resolves (tracking closes in), then yields to the crater.
      const tIn = easeOutCubic(range(p, 0.08, 0.24));
      const tOut = range(p, 0.42, 0.52);
      const title = titleRef.current!;
      title.style.opacity = String(tIn * (1 - tOut));
      title.style.letterSpacing = `${lerp(0.6, 0.24, tIn)}em`;
      title.style.transform = `translate3d(0, ${-p * 6}vh, 0)`;
      title.style.filter = tIn < 0.99 ? `blur(${(1 - tIn) * 10}px)` : '';

      // Telemetry.
      hudRef.current!.style.opacity = String(range(p, 0.02, 0.1) * (1 - range(p, 0.62, 0.72)));
      const secs = p * 5400;
      clockRef.current!.textContent = `T+ ${String(Math.floor(secs / 3600)).padStart(2, '0')}:${String(Math.floor((secs % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
      elevRef.current!.textContent = `${(rise * 12.4).toFixed(1)}°`;
    });
  }, []);

  const layer = (name: LayerName, extra = '') => (
    <div
      key={name}
      ref={(el) => {
        if (el) layerRefs.current[name] = el;
      }}
      className={`absolute inset-0 will-change-transform ${extra}`}
    >
      <picture>
        <source media="(max-width: 767px)" srcSet={`/layers/m/${name}.webp`} />
        <img src={`/layers/d/${name}.webp`} alt="" aria-hidden="true" className={FIT} decoding="async" fetchPriority={name === 'sky' ? 'high' : 'auto'} />
      </picture>
      {/* The ground carries a black apron below it, so when it climbs it
          fills the screen and hands straight over to the page below. */}
      {name === 'ground' && <div className="absolute inset-x-0 top-full h-[110vh] bg-void" />}
    </div>
  );

  return (
    <section id="top" ref={rootRef} aria-label="Earthrise" className="relative" style={{height: `${STAGE_VH}svh`}}>
      <div className="sticky top-0 h-screen-s overflow-hidden bg-void">
        {ORDER.slice(0, 3).map((n) => layer(n))}

        {/* Title sits between the plains and the crater. */}
        <div ref={titleRef} className="pointer-events-none absolute inset-x-0 top-[26%] text-center md:top-[30%]" style={{opacity: 0}}>
          <h1 className="font-display text-hero text-white [text-shadow:0_4px_40px_rgb(0_0_0/0.5)]" style={{marginRight: '-0.24em'}}>
            {hero.title}
          </h1>
          <p className="mt-4 font-mono text-label text-regolith/80 uppercase">{hero.kicker}</p>
        </div>

        {ORDER.slice(3).map((n) => layer(n))}

        {/* Cosmic dust on the lens. */}
        <div
          ref={veilRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 30% 40%, rgba(170,184,210,0.55), transparent 70%), radial-gradient(50% 60% at 75% 60%, rgba(120,140,180,0.5), transparent 70%), radial-gradient(80% 80% at 50% 50%, rgba(20,26,40,0.85), rgba(5,7,12,0.95))',
          }}
        >
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
            <p className="font-mono text-label text-regolith/80 uppercase">{hero.kicker}</p>
            <p className="mt-3 font-display text-[0.8125rem] tracking-[0.5em] text-white/90 uppercase" style={{marginRight: '-0.5em'}}>
              Scroll to clear the dust
            </p>
            <span aria-hidden="true" className="mt-6 inline-block animate-bounce text-regolith/70 motion-reduce:animate-none">
              ↓
            </span>
          </div>
        </div>
        <canvas ref={dustRef} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" />

        {/* Telemetry HUD. */}
        <div ref={hudRef} aria-hidden="true" className="pointer-events-none absolute inset-4 font-mono text-[0.625rem] tracking-[0.14em] text-regolith/75 uppercase sm:inset-6 md:text-label" style={{opacity: 0}}>
          <div className="brackets absolute inset-0 text-regolith/40" />
          <div className="absolute top-16 left-3 space-y-1 md:top-20 md:left-4">
            <p ref={clockRef}>T+ 00:00:00</p>
            <p className="text-regolith/50">Mission clock</p>
          </div>
          <div className="absolute top-16 right-3 space-y-1 text-right md:top-20 md:right-4">
            <p>
              Earth elev <span ref={elevRef} className="text-earth">0.0°</span>
            </p>
            <p className="text-regolith/50">Above horizon</p>
          </div>
          <div className="absolute bottom-3 left-3 md:bottom-4 md:left-4">{hero.site}</div>
          <div className="absolute right-3 bottom-3 flex items-center gap-2 md:right-4 md:bottom-4">
            Scroll <span className="inline-block animate-bounce motion-reduce:animate-none">↓</span>
          </div>
        </div>
      </div>
    </section>
  );
}
```

## File: `src/components/MissionLog.tsx`

```tsx
import {useEffect, useRef} from 'react';
import {intro, log} from '../content';
import {clamp, pinProgress, range} from '../lib/math';
import {onFrame} from '../lib/scroll';

/**
 * The mission, as a reel of stills. The section pins and the reel slides
 * sideways with the scroll; the frame nearest the middle is in focus, the
 * rest dim back, and each picture drifts against its frame.
 */

const SECTION_VH = 340;

export function MissionLog() {
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLOListElement>(null);
  const cardRefs = useRef<HTMLLIElement[]>([]);
  const imgRefs = useRef<HTMLImageElement[]>([]);
  const barRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let lastP = -1;
    return onFrame(() => {
      const root = rootRef.current;
      const track = trackRef.current;
      if (!root || !track) return;
      const {p, rect, vh} = pinProgress(root);
      if (rect.bottom < 0 || rect.top > vh) return;
      if (Math.abs(p - lastP) < 0.00005) return;
      lastP = p;

      const vw = window.innerWidth;
      const k = range(p, 0.04, 0.96);
      // offsetLeft is the untransformed layout position, so this is stable
      // while the track itself is being translated.
      const travel = Math.max(0, track.offsetLeft + track.scrollWidth - vw * 0.94);
      track.style.transform = `translate3d(${-k * travel}px, 0, 0)`;

      let nearest = 0;
      let best = Infinity;
      cardRefs.current.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const off = (r.left + r.width / 2 - vw * 0.62) / vw; // focus line right of centre
        const a = clamp(Math.abs(off) * 1.6);
        card.style.opacity = String(1 - a * 0.55);
        card.style.transform = `scale(${1 - a * 0.07})`;
        imgRefs.current[i].style.transform = `translate3d(${off * -60}px, 0, 0) scale(1.15)`;
        if (Math.abs(off) < best) {
          best = Math.abs(off);
          nearest = i;
        }
      });
      barRef.current!.style.transform = `scaleX(${k})`;
      countRef.current!.textContent = `0${nearest + 1}`;
    });
  }, []);

  return (
    <section ref={rootRef} id="log" aria-labelledby="log-title" className="relative bg-void" style={{height: `${SECTION_VH}svh`}}>
      <div className="sticky top-0 flex h-screen-s flex-col justify-center overflow-hidden pt-16 md:flex-row md:items-center md:pt-0">
        <div className="relative z-10 shrink-0 px-4 sm:px-6 md:w-[32vw] md:pl-[6vw] md:pr-10">
          <p className="font-mono text-label text-earth uppercase">{intro.eyebrow}</p>
          <h2 id="log-title" className="mt-4 font-display text-display text-white">
            {intro.heading}
          </h2>
          <p className="mt-5 max-w-[26rem] text-body text-regolith/70 max-md:hidden">{intro.body}</p>
          <div className="mt-8 flex items-center gap-4 font-mono text-label text-regolith/60 uppercase max-md:hidden" aria-hidden="true">
            <span>
              <span ref={countRef} className="text-white">
                01
              </span>{' '}
              / 0{log.length}
            </span>
            <span className="relative h-px w-32 bg-white/15">
              <span ref={barRef} className="absolute inset-0 origin-left bg-earth" style={{transform: 'scaleX(0)'}} />
            </span>
          </div>
        </div>

        <ol ref={trackRef} className="mt-8 flex gap-5 pl-4 will-change-transform sm:pl-6 md:mt-0 md:gap-7 md:pl-0">
          {log.map((entry, i) => (
            <li
              key={entry.title}
              ref={(el) => {
                if (el) cardRefs.current[i] = el;
              }}
              className="w-[70vw] shrink-0 origin-bottom sm:w-[44vw] md:w-[clamp(16rem,24vw,23rem)]"
            >
              <figure>
                <div className="relative aspect-[3/4] overflow-hidden rounded-[6px] bg-void-2">
                  <img
                    ref={(el) => {
                      if (el) imgRefs.current[i] = el;
                    }}
                    src={entry.image}
                    alt={`${entry.title}: ${entry.body}`}
                    width={840}
                    height={1120}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover will-change-transform"
                  />
                  <span className="absolute top-3 left-3 rounded-[3px] bg-void/70 px-2 py-1 font-mono text-[0.625rem] tracking-[0.14em] text-white uppercase backdrop-blur">
                    {entry.tag}
                  </span>
                </div>
                <figcaption className="mt-4 flex gap-4">
                  <span className="font-mono text-label text-earth">0{i + 1}</span>
                  <span>
                    <span className="block font-display text-[0.9375rem] tracking-[0.08em] text-white uppercase">{entry.title}</span>
                    <span className="mt-1.5 block text-[0.875rem] leading-relaxed text-regolith/65">{entry.body}</span>
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

## File: `src/components/Missions.tsx`

```tsx
import type {MouseEvent} from 'react';
import {missions} from '../content';
import {useReveals} from '../hooks/useReveals';
import {scrollToHash} from '../lib/scroll';

const toReserve = (e: MouseEvent<HTMLAnchorElement>, name: string) => {
  e.preventDefault();
  const select = document.querySelector<HTMLSelectElement>('#reserve select[name="mission"]');
  if (select) select.value = name;
  scrollToHash('#reserve');
};

/** Three mission classes. Each card carries its length as a set of orbit rings. */
export function Missions() {
  const ref = useReveals<HTMLElement>();
  return (
    <section ref={ref} id="missions" aria-labelledby="missions-title" className="relative bg-void px-4 py-28 sm:px-6 md:px-[6vw] md:py-40">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between" data-reveal>
        <div>
          <p className="font-mono text-label text-earth uppercase">{missions.eyebrow}</p>
          <h2 id="missions-title" className="mt-4 font-display text-display text-white">
            {missions.heading}
          </h2>
        </div>
        <p className="font-mono text-label text-regolith/50 uppercase">{missions.note}</p>
      </div>

      <ol className="mt-14 grid gap-4 md:mt-20 md:grid-cols-3 md:gap-5">
        {missions.items.map((m, i) => (
          <li
            key={m.name}
            data-reveal
            style={{transitionDelay: `${i * 110}ms`}}
            className={`group relative flex flex-col overflow-hidden rounded-[8px] p-6 ring-1 transition-[transform,box-shadow] duration-500 hover:-translate-y-1.5 md:p-8 ${
              m.featured ? 'bg-void-2 ring-earth/60 hover:shadow-[0_30px_80px_-30px_rgb(111_182_255/0.45)]' : 'bg-void-2/60 ring-white/10 hover:ring-white/25'
            }`}
          >
            {/* Orbit rings — one per week of the mission. */}
            <svg aria-hidden="true" viewBox="0 0 200 200" className="absolute -top-10 -right-10 size-48 text-white/10 transition-transform duration-[1.2s] group-hover:rotate-45">
              {Array.from({length: Math.ceil(m.days / 7)}, (_, k) => (
                <ellipse key={k} cx="100" cy="100" rx={40 + k * 18} ry={18 + k * 8} fill="none" stroke="currentColor" transform={`rotate(${-20 + k * 14} 100 100)`} />
              ))}
              <circle cx="100" cy="100" r="9" fill="currentColor" />
            </svg>

            {m.featured && <span className="self-start rounded-[3px] bg-earth px-2 py-1 font-mono text-[0.625rem] tracking-[0.14em] text-void uppercase">Most requested</span>}
            <h3 className={`font-display text-[1.25rem] tracking-[0.14em] text-white uppercase ${m.featured ? 'mt-5' : ''}`}>{m.name}</h3>
            <p className="mt-6 flex items-baseline gap-2">
              <span className="font-display text-[3.5rem] leading-none text-white">{m.days}</span>
              <span className="font-mono text-label text-regolith/60 uppercase">days</span>
            </p>
            <ul className="mt-8 space-y-2.5 border-t border-white/10 pt-6">
              {m.lines.map((l) => (
                <li key={l} className="flex gap-3 text-[0.9375rem] text-regolith/80">
                  <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-earth" />
                  {l}
                </li>
              ))}
            </ul>
            <a
              href="#reserve"
              onClick={(e) => toReserve(e, m.name)}
              className={`mt-10 rounded-[4px] px-5 py-3.5 text-center font-mono text-label uppercase transition-colors ${
                m.featured ? 'bg-earth text-void hover:bg-white' : 'text-white ring-1 ring-white/25 hover:bg-white hover:text-void'
              }`}
            >
              {m.cta}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

## File: `src/components/Reserve.tsx`

```tsx
import {useEffect, useState, type FormEvent} from 'react';
import {brand, missions, reserve} from '../content';
import {useReveals} from '../hooks/useReveals';

type Status = 'idle' | 'invalid' | 'sent';

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const ms = Math.max(0, new Date(target).getTime() - now);
  const s = Math.floor(ms / 1000);
  return {d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60};
}

/**
 * Waitlist. Ticking launch-window countdown on one side, the manifest form on
 * the other; the form hands a drafted message to the visitor's mail app.
 */
export function Reserve() {
  const ref = useReveals<HTMLElement>();
  const t = useCountdown(reserve.window);
  const [status, setStatus] = useState<Status>('idle');

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      setStatus('invalid');
      form.reportValidity();
      return;
    }
    const data = new FormData(form);
    const subject = encodeURIComponent(`Manifest: ${String(data.get('mission'))}`);
    const body = encodeURIComponent(`Name: ${String(data.get('name'))}\nEmail: ${String(data.get('email'))}\nMission: ${String(data.get('mission'))}`);
    window.location.href = `mailto:${brand.email}?subject=${subject}&body=${body}`;
    setStatus('sent');
  };

  const field =
    'w-full rounded-[4px] bg-white/[0.04] px-4 py-3.5 text-body text-white ring-1 ring-white/15 outline-none placeholder:text-regolith/40 focus:ring-earth user-invalid:ring-red-400/70';
  const units: [string, number][] = [
    ['Days', t.d],
    ['Hrs', t.h],
    ['Min', t.m],
    ['Sec', t.s],
  ];

  return (
    <section ref={ref} id="reserve" aria-labelledby="reserve-title" className="relative overflow-hidden bg-void px-4 pb-28 sm:px-6 md:px-[6vw] md:pb-40">
      {/* A sliver of the Earth rising at the bottom edge — the hero, bookended. */}
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-[62vw] left-1/2 size-[90vw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_30%,rgba(111,182,255,0.35),rgba(111,182,255,0.05)_55%,transparent_70%)]" />

      <div className="relative grid gap-12 border-t border-white/10 pt-20 md:grid-cols-2 md:gap-16 md:pt-28">
        <div data-reveal>
          <p className="font-mono text-label text-earth uppercase">{reserve.eyebrow}</p>
          <h2 id="reserve-title" className="mt-4 font-display text-display text-white">
            {reserve.heading}
          </h2>
          <p className="mt-5 max-w-[28rem] text-body text-regolith/70">{reserve.body}</p>

          <div className="mt-10">
            <p className="font-mono text-label text-regolith/50 uppercase">{reserve.windowLabel}</p>
            <div className="mt-3 flex gap-2 md:gap-3" role="timer" aria-label={`${t.d} days, ${t.h} hours, ${t.m} minutes until the next launch window`}>
              {units.map(([label, v]) => (
                <div key={label} className="brackets min-w-[4.25rem] px-3 py-3 text-center text-white/25 md:min-w-[5.5rem]">
                  <span className="block font-display text-[1.5rem] text-white tabular-nums md:text-[2.25rem]">{String(v).padStart(2, '0')}</span>
                  <span className="mt-1 block font-mono text-[0.625rem] tracking-[0.14em] text-regolith/60 uppercase">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <form noValidate onSubmit={onSubmit} aria-describedby="reserve-status" className="space-y-3" data-reveal>
          <label className="block">
            <span className="mb-1.5 block font-mono text-label text-regolith/60 uppercase">Name</span>
            <input name="name" required autoComplete="name" placeholder="As it should appear on the manifest" className={field} onInput={() => setStatus('idle')} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-mono text-label text-regolith/60 uppercase">Email</span>
            <input name="email" type="email" required autoComplete="email" placeholder="you@earth.com" className={field} onInput={() => setStatus('idle')} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-mono text-label text-regolith/60 uppercase">Mission</span>
            <select name="mission" defaultValue="Lander" className={`${field} appearance-none`}>
              {missions.items.map((m) => (
                <option key={m.name} value={m.name} className="bg-void">
                  {m.name} — {m.days} days
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="mt-2 w-full rounded-[4px] bg-white px-5 py-4 font-mono text-label text-void uppercase transition-colors hover:bg-earth">
            Add me to the manifest
          </button>
          <p id="reserve-status" role="status" className="min-h-[1.25rem] text-[0.8125rem] text-regolith/70">
            {status === 'invalid' && 'Name and a valid email, please — the manifest is strict.'}
            {status === 'sent' && `Your mail app should be open with your request drafted. If not: ${brand.email}.`}
          </p>
        </form>
      </div>
    </section>
  );
}
```

## File: `src/components/Trajectory.tsx`

```tsx
import {useEffect, useRef, useState} from 'react';
import {trajectory} from '../content';
import {clamp, easeOutCubic, pinProgress, range} from '../lib/math';
import {onFrame} from '../lib/scroll';

/**
 * Earth → Moon, drawn as you scroll. The section pins while the four legs of
 * the flight ink themselves one after another, a capsule riding the leg
 * being drawn; the distance flown ticks up to 384,400 km during the
 * coast. The Earth is cut from the hero's own Earth layer.
 */

const SECTION_VH = 380;
const WINDOW = [0.06, 0.92] as const;
const DISTANCE = 384400;

const EARTH = {cx: 230, cy: 320, r: 92};
const MOON = {cx: 985, cy: 300, r: 46};

const LEGS = [
  // Parking orbit: a lap and a bit around the Earth.
  `M${EARTH.cx} ${EARTH.cy - 128} a128 128 0 1 1 -0.1 0 a128 128 0 0 1 106 57`,
  // Trans-lunar coast.
  `M${EARTH.cx + 106} ${EARTH.cy - 71} C 520 40, 820 70, ${MOON.cx - 20} ${MOON.cy - 84}`,
  // Capture into lunar orbit.
  `M${MOON.cx - 20} ${MOON.cy - 84} a86 86 0 1 1 -0.1 0.2 a86 86 0 0 1 20 1`,
  // Descent to the surface.
  `M${MOON.cx} ${MOON.cy - 86} Q ${MOON.cx + 40} ${MOON.cy - 70} ${MOON.cx + 30} ${MOON.cy - 36}`,
];

// Where the Earth sits inside the 2688×1520 hero layer (measured from its alpha).
const LAYER = {cx: 0.657, cy: 0.498, d: 0.401};

export function Trajectory() {
  const rootRef = useRef<HTMLElement>(null);
  const legRefs = useRef<SVGPathElement[]>([]);
  const capsuleRef = useRef<SVGGElement>(null);
  const kmRef = useRef<HTMLSpanElement>(null);
  const [leg, setLeg] = useState(0);

  useEffect(() => {
    let lastP = -1;
    let current = 0;
    return onFrame(() => {
      const root = rootRef.current;
      if (!root) return;
      const {p, rect, vh} = pinProgress(root);
      if (rect.bottom < 0 || rect.top > vh) return;
      if (Math.abs(p - lastP) < 0.00005) return;
      lastP = p;

      const u = range(p, ...WINDOW) * LEGS.length;
      const s = clamp(Math.floor(u), 0, LEGS.length - 1);
      if (s !== current) {
        current = s;
        setLeg(s);
      }
      legRefs.current.forEach((path, i) => {
        const k = easeOutCubic(clamp(u - i));
        path.style.strokeDashoffset = String(1 - k);
        if (i === s) {
          const pt = path.getPointAtLength(path.getTotalLength() * k);
          capsuleRef.current!.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
        }
      });
      const coast = easeOutCubic(clamp(u - 1));
      kmRef.current!.textContent = Math.round(coast * DISTANCE).toLocaleString('en-US');
    });
  }, []);

  const current = trajectory.legs[leg];
  const earthW = (EARTH.r * 2) / LAYER.d;
  const earthH = earthW * (1520 / 2688);

  return (
    <section ref={rootRef} id="trajectory" aria-labelledby="trajectory-title" className="relative bg-void" style={{height: `${SECTION_VH}svh`}}>
      <div className="sticky top-0 flex h-screen-s flex-col overflow-hidden px-4 pt-20 pb-8 sm:px-6 md:px-[6vw] md:pt-24">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-label text-earth uppercase">{trajectory.eyebrow}</p>
            <h2 id="trajectory-title" className="mt-3 max-w-[20ch] font-display text-display text-white">
              {trajectory.heading}
            </h2>
          </div>
          <p className="font-mono text-label text-regolith/60 uppercase" aria-live="off">
            Distance flown <span ref={kmRef} className="text-white tabular-nums">0</span> km
          </p>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center">
          <svg viewBox="0 0 1200 600" className="h-auto max-h-full w-full" role="img" aria-label="The flight path from Earth to the Moon, drawn in four legs.">
            <defs>
              <clipPath id="earth-clip">
                <circle cx={EARTH.cx} cy={EARTH.cy} r={EARTH.r} />
              </clipPath>
              <radialGradient id="moon-shade" cx="35%" cy="35%" r="75%">
                <stop offset="0" stopColor="#e4e6ea" />
                <stop offset="0.7" stopColor="#8b909b" />
                <stop offset="1" stopColor="#2a2e36" />
              </radialGradient>
              <radialGradient id="earth-glow">
                <stop offset="0.8" stopColor="#6fb6ff" stopOpacity="0.35" />
                <stop offset="1" stopColor="#6fb6ff" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Faint star field. */}
            <g fill="#fff">
              {Array.from({length: 70}, (_, i) => (
                <circle key={i} cx={(i * 173) % 1200} cy={(i * 97) % 600} r={i % 7 === 0 ? 1.4 : 0.7} opacity={0.15 + ((i * 37) % 50) / 100} />
              ))}
            </g>

            <circle cx={EARTH.cx} cy={EARTH.cy} r={EARTH.r * 1.18} fill="url(#earth-glow)" />
            <image
              href="/layers/m/earth.webp"
              x={EARTH.cx - LAYER.cx * earthW}
              y={EARTH.cy - LAYER.cy * earthH}
              width={earthW}
              height={earthH}
              clipPath="url(#earth-clip)"
              preserveAspectRatio="none"
            />
            <circle cx={MOON.cx} cy={MOON.cy} r={MOON.r} fill="url(#moon-shade)" />
            <g fill="#5d626c" opacity="0.6">
              <circle cx={MOON.cx - 14} cy={MOON.cy - 10} r="7" />
              <circle cx={MOON.cx + 12} cy={MOON.cy + 14} r="5" />
              <circle cx={MOON.cx + 18} cy={MOON.cy - 18} r="3.5" />
            </g>

            {/* Ghost of the full route, then the inked legs over it. */}
            {LEGS.map((d, i) => (
              <path key={`g${i}`} d={d} fill="none" stroke="#fff" strokeOpacity="0.08" strokeWidth="1.5" strokeDasharray="3 6" />
            ))}
            {LEGS.map((d, i) => (
              <path
                key={i}
                ref={(el) => {
                  if (el) legRefs.current[i] = el;
                }}
                d={d}
                pathLength={1}
                fill="none"
                stroke={i === 1 ? '#6fb6ff' : '#f2e6c9'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="1 1"
                strokeDashoffset="1"
              />
            ))}

            <g ref={capsuleRef} transform={`translate(${EARTH.cx} ${EARTH.cy - 128})`}>
              <circle r="11" fill="#6fb6ff" opacity="0.25" />
              <circle r="4.5" fill="#fff" />
            </g>

            <g fontFamily="IBM Plex Mono, monospace" fontSize="13" letterSpacing="2" fill="#8b909b">
              <text x={EARTH.cx} y={EARTH.cy + EARTH.r + 58} textAnchor="middle">
                EARTH
              </text>
              <text x={MOON.cx} y={MOON.cy + MOON.r + 70} textAnchor="middle">
                MOON
              </text>
            </g>
          </svg>
        </div>

        {/* Current leg. */}
        <div className="grid gap-4 border-t border-white/10 pt-5 md:grid-cols-[auto_1fr_auto] md:items-end md:gap-10">
          <p className="font-mono text-label text-earth uppercase">
            {current.day} · Leg {leg + 1}/{trajectory.legs.length}
          </p>
          <div key={leg} className="animate-[leg-in_0.6s_cubic-bezier(0.2,0.7,0.1,1)]" aria-live="polite">
            <h3 className="font-display text-[1.125rem] tracking-[0.08em] text-white uppercase md:text-[1.375rem]">{current.title}</h3>
            <p className="mt-1.5 max-w-[40rem] text-body text-regolith/70">{current.body}</p>
          </div>
          <div className="flex gap-1.5" aria-hidden="true">
            {trajectory.legs.map((_, i) => (
              <span key={i} className={`h-1 w-8 rounded-full transition-colors duration-500 ${i <= leg ? 'bg-earth' : 'bg-white/15'}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

## File: `src/hooks/useFitText.ts`

```ts
import {useLayoutEffect, useRef} from 'react';

/**
 * Sizes a single line of text (the element must be `inline-block` and
 * `whitespace-nowrap`) so it spans its parent's content box exactly —
 * the wordmark runs edge to edge at every width without guessing at vw
 * values for a font whose advance widths we don't control.
 */
export function useFitText<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    const PROBE = 100;
    const fit = () => {
      el.style.fontSize = `${PROBE}px`;
      const styles = getComputedStyle(parent);
      const available =
        parent.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
      // offsetWidth is the layout box — unaffected by the per-letter
      // transforms the hero applies while scrolling (scrollWidth is not).
      const natural = el.offsetWidth;
      if (natural > 0) el.style.fontSize = `${(PROBE * available) / natural}px`;
    };

    fit();
    // Re-fit once the web font swaps in; its metrics differ from the fallback.
    document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  return ref;
}
```

## File: `src/hooks/useReducedMotion.ts`

```ts
import {useEffect, useState} from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
```

## File: `src/hooks/useReveals.ts`

```ts
import {useEffect, useRef} from 'react';

/**
 * Watches every `[data-reveal]` element inside the returned ref's element and
 * adds `.is-in` the first time each one is seen.
 *
 * Each section owns its own observer (rather than one page-level query at
 * mount) so elements that mount later — or re-mount on hot reload — are
 * never left stuck in their hidden state.
 */
export function useReveals<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      },
      {rootMargin: '0px 0px -10% 0px'},
    );

    const watch = () =>
      root.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => io.observe(el));
    watch();

    // Pick up anything React adds later.
    const mo = new MutationObserver(watch);
    mo.observe(root, {childList: true, subtree: true});

    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return ref;
}
```

## File: `src/lib/math.ts`

```ts
export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Where `v` sits between `a` and `b`, clamped to 0–1. */
export const range = (v: number, a: number, b: number) => clamp((v - a) / (b - a));

export const smoothstep = (t: number) => t * t * (3 - 2 * t);

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const easeInQuad = (t: number) => t * t;

/**
 * Scroll progress through a tall section whose child is `position: sticky`.
 * 0 when the section's top meets the viewport top, 1 when the sticky child
 * is about to unpin.
 */
export function pinProgress(el: HTMLElement): {p: number; rect: DOMRect; vh: number} {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const span = Math.max(1, rect.height - vh);
  return {p: clamp(-rect.top / span), rect, vh};
}
```

## File: `src/lib/scroll.ts`

```ts
import Lenis from 'lenis';

/**
 * One rAF loop for the whole page. Lenis advances first, then every
 * scroll-driven component reads its own rect and writes styles directly —
 * nothing here goes through React state, so scrolling never re-renders.
 */

type Tick = (time: number) => void;

const subscribers = new Set<Tick>();
let lenis: Lenis | null = null;

export function startScroll(reducedMotion: boolean): () => void {
  if (!reducedMotion) {
    lenis = new Lenis({lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9});
  }

  let raf = 0;
  const loop = (time: number) => {
    lenis?.raf(time);
    subscribers.forEach((fn) => fn(time));
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    lenis?.destroy();
    lenis = null;
  };
}

export function onFrame(fn: Tick): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/** Smooth-scrolls to an in-page hash like `#services`, or to the top for `#top`. */
export function scrollToHash(hash: string) {
  const target = hash === '#top' ? 0 : document.querySelector<HTMLElement>(hash);
  if (target === null) return;
  if (lenis) {
    lenis.scrollTo(target, {duration: 1.6});
  } else if (typeof target === 'number') {
    window.scrollTo({top: target});
  } else {
    target.scrollIntoView();
  }
  history.replaceState(null, '', hash === '#top' ? ' ' : hash);
}
```

## File: `src/vite-env.d.ts`

```ts
/// <reference types="vite/client" />
```

## Design notes (context, not instructions to change anything)

- **The rise is choreographed per layer.** Dust drifts off the lens first, then the Earth climbs from behind the horizon while the foreground and the astronaut move at their own rates, so the surface reads as distance rather than as a flat picture.
- **The reel focuses by distance from centre.** `MissionLog.tsx` dims and blurs every frame by how far it is from the middle of the screen, and each picture drifts against its frame as it passes.
- **The waitlist is composed, not sent.** The form hands a drafted message to the visitor's mail app; there is no backend.
- **The big wordmark is sized by measurement, not by `vw`.** `useFitText` sets the font size so the single line spans its parent exactly, reading `offsetWidth` rather than `scrollWidth` so per-letter transforms do not feed back into the fit, and it re-fits once the web font swaps in.
- **SELENE is invented.** Names, dates and missions are illustrative placeholders, and the page says the imagery was generated for the concept; replace the copy in `src/content.ts` before you ship.