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
