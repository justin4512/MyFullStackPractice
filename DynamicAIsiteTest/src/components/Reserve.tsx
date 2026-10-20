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
