/**
 * 簡報控制器 — 唯一入口 `goTo()`。
 *
 * 沿用前一版架構的核心紀律（README 第 4 部 §3.1）：所有改變「當前頁」的路徑
 * ——捲動、鍵盤、頁碼點、深連結、上一頁——全部收斂到 goTo()／setCurrent()，
 * 不存在第二條會改狀態的程式路徑。
 *
 * 捲動策略：**原生 scroll-snap，不劫持捲動**（README 第 8 部 FR-4.4）。
 * 目前頁由 IntersectionObserver 觀測得出，而不是由 JS 計算後強制對齊。
 */

import { createRouter } from './router.mjs';
import { createEmbedManager } from './embed.mjs';
import { renderDeck, renderDots, normalizeDeck, progressPercent } from './slides.mjs';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** 邊界運算：只計算，不改狀態（沿用 store.stepIndex 的分工原則） */
export function stepSlide(currentIndex, total, delta) {
  if (!Number.isInteger(total) || total <= 0) return null;
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= total) return null;
  const next = currentIndex + delta;
  if (next < 0 || next >= total) return null;   // 簡報不回繞——最後一頁之後就是結束
  return next;
}

export function createDeck(config = {}) {
  const {
    data,
    mount = {},
    location: loc,
    history: hist,
    matchMedia: mm = (typeof window !== 'undefined' ? window.matchMedia?.bind(window) : null),
    baseUrl = '',
    observe = true,
  } = config;

  const { slides, warnings, meta } = normalizeDeck(data);

  let reducedMotion = false;
  if (typeof mm === 'function') {
    try {
      const q = mm(REDUCED_MOTION_QUERY);
      reducedMotion = !!(q && q.matches);
      const onChange = (e) => { reducedMotion = !!e.matches; };
      q?.addEventListener?.('change', onChange) ?? q?.addListener?.(onChange);
    } catch { reducedMotion = false; }
  }

  let currentIndex = 0;
  let lastAnnouncement = '';
  let observer = null;
  let suppressHistory = false;

  const embeds = createEmbedManager({ root: mount.slides, radius: 1, baseUrl });

  const router = createRouter({
    location: loc,
    history: hist,
    queryKey: "slide",
    onPopState: (detail) => {
      const id = detail && detail.id ? detail.id : (slides[0] && slides[0].id);
      if (id) api.goTo(id, { source: 'history' });
    },
  });

  const indexOf = (idOrIndex) => {
    if (Number.isInteger(idOrIndex)) return (idOrIndex >= 0 && idOrIndex < slides.length) ? idOrIndex : -1;
    return slides.findIndex((s) => s.id === idOrIndex);
  };

  const elementFor = (i) => (mount.slides
    ? mount.slides.querySelector(`[data-slide-index="${i}"]`) : null);

  function announce(text) {
    lastAnnouncement = text;
    if (mount.live) mount.live.textContent = text;
  }

  /** 同步所有隨當前頁變動的介面。**唯一會寫入這些狀態的地方。** */
  function syncChrome() {
    const slide = slides[currentIndex];
    if (!slide) return;

    if (mount.dots) {
      for (const btn of mount.dots.querySelectorAll('[data-goto]')) {
        if (btn.dataset.goto === slide.id) btn.setAttribute('aria-current', 'true');
        else btn.removeAttribute('aria-current');
      }
    }
    if (mount.progress) {
      const pct = progressPercent(currentIndex, slides.length);
      mount.progress.style.setProperty('--progress', `${pct}%`);
      mount.progress.setAttribute('aria-valuenow', String(currentIndex + 1));
    }
    if (mount.counter) {
      mount.counter.textContent = `${currentIndex + 1} / ${slides.length}`;
    }
    if (mount.prevBtn) mount.prevBtn.disabled = currentIndex === 0;
    if (mount.nextBtn) mount.nextBtn.disabled = currentIndex === slides.length - 1;
    // 固定介面在 .deck 之外，主題必須掛到 <html> 才拿得到
    if (mount.root) mount.root.dataset.currentTheme = slide.theme;
    if (typeof document !== "undefined") document.documentElement.dataset.currentTheme = slide.theme;

    embeds.sync(currentIndex);
  }

  /**
   * 設定當前頁。由 goTo()（主動）與 IntersectionObserver（被動捲動）共用。
   * @param {number} i
   * @param {{source?:string}} opts
   */
  function setCurrent(i, opts = {}) {
    const { source = 'scroll' } = opts;
    if (!Number.isInteger(i) || i < 0 || i >= slides.length) return false;
    if (i === currentIndex && source !== 'init') { syncChrome(); return false; }

    currentIndex = i;
    const slide = slides[i];
    syncChrome();

    if (!suppressHistory && source !== 'history') {
      const write = (source === 'init' || source === 'deeplink') ? router.replace : router.push;
      write(slide.id, i + 1);
    }
    announce(`第 ${i + 1} 頁，共 ${slides.length} 頁：${(slide.title || slide.id).replace(/\n/g, ' ')}`);
    return true;
  }

  /**
   * **唯一入口。** 捲動到指定頁；實際的位置變更仍由 IntersectionObserver 確認。
   * @param {string|number} target id 或索引
   */
  function goTo(target, opts = {}) {
    const { source = 'control', behavior } = opts;
    const i = indexOf(target);
    if (i < 0) return false;

    const el = elementFor(i);
    if (el && el.scrollIntoView) {
      // 減少動態時不做平滑捲動——那是位移動畫（README 第 3 部 §5.2 第 6 項）
      const mode = behavior || (reducedMotion ? 'auto' : 'smooth');
      // history 還原期間抑制回寫，避免 popstate → goTo → pushState → popstate 迴圈
      if (source === 'history') {
        suppressHistory = true;
        el.scrollIntoView({ behavior: 'auto', block: 'start' });
        setCurrent(i, { source });
        suppressHistory = false;
        return true;
      }
      el.scrollIntoView({ behavior: mode, block: 'start' });
    }
    return setCurrent(i, { source });
  }

  function startObserver() {
    if (!observe || !mount.slides || typeof IntersectionObserver !== 'function') return;
    observer = new IntersectionObserver((entries) => {
      // 取交集比例最高者為當前頁——比「第一個進入視窗」穩定
      let best = null;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
      }
      if (!best) return;
      const i = Number(best.target.dataset.slideIndex);
      if (Number.isInteger(i)) setCurrent(i, { source: 'scroll' });
    }, { root: mount.scroller || null, threshold: [0.5, 0.75] });

    for (const el of mount.slides.querySelectorAll('[data-slide]')) observer.observe(el);
  }

  const api = {
    goTo,
    next: () => {
      const i = stepSlide(currentIndex, slides.length, 1);
      return i === null ? false : goTo(i);
    },
    prev: () => {
      const i = stepSlide(currentIndex, slides.length, -1);
      return i === null ? false : goTo(i);
    },
    first: () => goTo(0),
    last: () => goTo(slides.length - 1),

    render() {
      if (mount.slides) mount.slides.innerHTML = renderDeck(slides, { baseUrl });
      if (mount.dots) mount.dots.innerHTML = renderDots(slides, currentIndex);
      if (mount.progress) mount.progress.setAttribute('aria-valuemax', String(slides.length));
      syncChrome();
    },

    init() {
      api.render();
      const resolved = router.resolve(slides.map((s) => s.id));
      const startIndex = Math.max(0, indexOf(resolved.id));
      setCurrent(startIndex, { source: resolved.requestedId ? 'deeplink' : 'init' });
      if (startIndex > 0) {
        const el = elementFor(startIndex);
        el?.scrollIntoView?.({ behavior: 'auto', block: 'start' });
      }
      startObserver();
      router.listen();
      return { resolved, warnings };
    },

    dispose() { observer?.disconnect(); router.dispose(); },

    // ── 唯讀查詢 ──────────────────────────────────────────
    get slides() { return slides.slice(); },
    get meta() { return meta; },
    get warnings() { return warnings.slice(); },
    get currentIndex() { return currentIndex; },
    get currentId() { return slides[currentIndex]?.id ?? null; },
    get total() { return slides.length; },
    get prefersReducedMotion() { return reducedMotion; },
    get lastAnnouncement() { return lastAnnouncement; },
    get embeds() { return embeds; },
    get router() { return router; },
  };

  return api;
}
