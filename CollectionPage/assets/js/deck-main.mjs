/**
 * 簡報啟動層 — 掛載點查詢、資料取得、接線。
 *
 * 鍵盤契約（沿用 README 第 4 部 §3.5 的兩條硬規則，並為簡報擴充）：
 *   ↓ → PageDown Space  下一頁        ↑ ← PageUp  上一頁
 *   Home / End          第一頁 / 最後一頁
 *   Esc                 離開嵌入內容；**未進入嵌入時不產生任何動作**（不劫持按鍵）
 */

import { createDeck } from './deck.mjs';

const DATA_URL = new URL('../../data/deck.json', import.meta.url).href;
const BASE_URL = new URL('../../', import.meta.url).href;

const NEXT_KEYS = ['ArrowDown', 'ArrowRight', 'PageDown'];
const PREV_KEYS = ['ArrowUp', 'ArrowLeft', 'PageUp'];

function queryMount(doc) {
  const $ = (s) => doc.querySelector(s);
  return {
    root: $('[data-deck]'),
    scroller: $('[data-deck-scroller]'),
    slides: $('[data-deck-slides]'),
    dots: $('[data-deck-dots]'),
    progress: $('[data-deck-progress]'),
    counter: $('[data-deck-counter]'),
    live: $('[data-deck-live]'),
    prevBtn: $('[data-deck-prev]'),
    nextBtn: $('[data-deck-next]'),
    motionBtn: $('[data-motion-toggle]'),
  };
}

/** 站內減少動態開關。預設值由系統偏好帶入（README §0.6.4 的建議） */
function wireMotionToggle(doc, btn) {
  if (!btn) return;
  const root = doc.documentElement;
  const systemPrefers = () => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  };
  let mode = null;
  try { mode = localStorage.getItem('motion'); } catch { /* 私密模式：靜默降級 */ }
  if (mode !== 'reduced' && mode !== 'full') mode = systemPrefers() ? 'reduced' : 'full';

  const apply = (m) => {
    root.setAttribute('data-motion', m);
    btn.setAttribute('aria-pressed', String(m === 'reduced'));
    btn.textContent = m === 'reduced' ? '動態：關' : '動態：開';
    try { localStorage.setItem('motion', m); } catch { /* noop */ }
  };
  apply(mode);
  btn.addEventListener('click', () => apply(root.getAttribute('data-motion') === 'reduced' ? 'full' : 'reduced'));
}

/** 只有進入視窗的那一頁播放進場動畫，離畫面的頁面不動 */
function wireVisibility(mount) {
  if (!mount.slides || typeof IntersectionObserver !== 'function') return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.classList.toggle('is-visible', e.isIntersecting);
  }, { threshold: 0.25 });
  for (const el of mount.slides.querySelectorAll('[data-slide]')) io.observe(el);
}

function wireEmbeds(mount, deck) {
  if (!mount.slides) return;
  mount.slides.addEventListener('click', (event) => {
    const holder = event.target.closest?.('.embed')?.querySelector('[data-embed-frame]');
    if (event.target.closest?.('[data-embed-enter]')) {
      deck.embeds.enter(holder);
      const bar = event.target.closest('.embed__bar');
      bar?.querySelector('[data-embed-enter]')?.setAttribute('hidden', '');
      bar?.querySelector('[data-embed-leave]')?.removeAttribute('hidden');
      return;
    }
    if (event.target.closest?.('[data-embed-leave]')) {
      deck.embeds.leave(holder);
      const bar = event.target.closest('.embed__bar');
      bar?.querySelector('[data-embed-leave]')?.setAttribute('hidden', '');
      bar?.querySelector('[data-embed-enter]')?.removeAttribute('hidden');
    }
  });
}

/** 目前是否有嵌入處於「已進入」狀態 */
const enteredHolder = (doc) => doc.querySelector('[data-embed-frame][data-embed-entered="true"]');

function wireKeyboard(doc, deck) {
  doc.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;

    // 焦點在表單控制項時不攔截方向鍵
    const tag = (event.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (event.key === 'Escape') {
      const holder = enteredHolder(doc);
      if (!holder) return;                    // 未進入嵌入 → 不產生任何動作
      deck.embeds.leave(holder);
      const bar = holder.closest('.embed')?.querySelector('.embed__bar');
      bar?.querySelector('[data-embed-leave]')?.setAttribute('hidden', '');
      bar?.querySelector('[data-embed-enter]')?.removeAttribute('hidden');
      event.preventDefault();
      return;
    }

    // 已進入嵌入時，翻頁鍵交給內層文件，不劫持
    if (enteredHolder(doc)) return;

    if (NEXT_KEYS.includes(event.key) || (event.key === ' ' && !event.shiftKey)) {
      deck.next(); event.preventDefault(); return;
    }
    if (PREV_KEYS.includes(event.key) || (event.key === ' ' && event.shiftKey)) {
      deck.prev(); event.preventDefault(); return;
    }
    if (event.key === 'Home') { deck.first(); event.preventDefault(); return; }
    if (event.key === 'End') { deck.last(); event.preventDefault(); }
  });
}

export async function bootstrap(doc = document) {
  const mount = queryMount(doc);
  if (!mount.root) return null;

  wireMotionToggle(doc, mount.motionBtn);

  let data = { slides: [] };
  try {
    const res = await fetch(DATA_URL, { cache: 'no-cache' });
    if (res.ok) data = await res.json();
  } catch (err) {
    console.warn('[deck] 無法取得簡報資料，維持靜態內容', err.message);
  }

  const deck = createDeck({
    data, mount, baseUrl: BASE_URL,
    location: window.location, history: window.history,
  });

  deck.init();
  wireVisibility(mount);
  wireEmbeds(mount, deck);
  wireKeyboard(doc, deck);

  mount.prevBtn?.addEventListener('click', () => deck.prev());
  mount.nextBtn?.addEventListener('click', () => deck.next());
  mount.dots?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-goto]');
    if (btn) deck.goTo(btn.dataset.goto, { source: 'dots' });
  });

  if (deck.warnings.length) console.warn('[deck] 資料警告', deck.warnings);
  mount.root.dataset.deckReady = 'true';
  return deck;
}

if (typeof document !== 'undefined') {
  const start = () => bootstrap(document).catch((err) => {
    console.error('[deck] 啟動失敗，維持靜態內容', err);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
