/**
 * 嵌入層 — iframe 的生命週期、沙箱與降級。
 *
 * 三個必須處理的問題（純函式部分可在無瀏覽器環境測試）：
 *
 * ① **鍵盤陷阱**：焦點一旦進入 iframe，Tab 由內層文件接管，使用者可能出不來。
 *    這直接違反 NFR-1.2「不得形成鍵盤陷阱」。因此嵌入預設 `tabindex="-1"` 且
 *    以 `inert` 隔離，必須由使用者顯式「進入」，並在頁面上提供明確的離開方式。
 *
 * ② **效能**：七頁七個 iframe 會讓首屏崩掉。只有接近視窗的頁面才掛載，
 *    離開夠遠就卸載——`src` 設為空字串會真正終止內層文件。
 *
 * ③ **失效降級**：嵌入失敗不得留下空白（NFR-2.5 / BP-11）。
 *    一律提供「在新分頁開啟」的替代路徑。
 */

/** 允許的嵌入類型與其預設長寬比 */
export const EMBED_KINDS = Object.freeze({
  site: '16/10',
  slides: '16/9',
  video: '16/9',
  pdf: '4/3',
});

/** 預設沙箱：刻意不含 allow-top-navigation，嵌入內容不得把母頁面導走 */
export const DEFAULT_SANDBOX = 'allow-scripts allow-popups allow-forms';

/**
 * 正規化一份嵌入設定。**純函式**。
 * @param {object} embed
 * @returns {{ok:boolean, src:string, title:string, ratio:string, sandbox:string,
 *            kind:string, placeholder:string|null, fallbackHref:string|null, fallbackLabel:string}}
 */
export function normalizeEmbed(embed) {
  const e = embed || {};
  const kind = EMBED_KINDS[e.kind] ? e.kind : 'site';
  const src = typeof e.src === 'string' ? e.src.trim() : '';
  return {
    ok: src.length > 0,
    src,
    kind,
    title: (typeof e.title === 'string' && e.title.trim()) || '嵌入的作品內容',
    ratio: e.ratio || EMBED_KINDS[kind],
    sandbox: typeof e.sandbox === 'string' && e.sandbox.trim() ? e.sandbox : DEFAULT_SANDBOX,
    placeholder: e.placeholder || null,
    fallbackHref: e.fallbackHref || (src.length > 0 ? src : null),
    fallbackLabel: e.fallbackLabel || '在新分頁開啟',
  };
}

/**
 * 依「與當前頁的距離」決定該掛載或卸載。**純函式**。
 * @param {number} slideIndex
 * @param {number} currentIndex
 * @param {number} [radius] 掛載半徑；預設只保留前後各一頁
 * @returns {boolean}
 */
export function shouldMount(slideIndex, currentIndex, radius = 1) {
  if (!Number.isInteger(slideIndex) || !Number.isInteger(currentIndex)) return false;
  return Math.abs(slideIndex - currentIndex) <= radius;
}

/**
 * 建立嵌入管理器。掛載／卸載由 deck 依當前頁驅動。
 * @param {{root: Element, radius?: number, baseUrl?: string}} deps
 */
export function createEmbedManager(deps = {}) {
  const { root, radius = 1, baseUrl = '' } = deps;
  const stats = { mounted: 0, unmounted: 0, failed: 0 };

  const resolve = (p) => (baseUrl && p && !/^(https?:|data:|\/)/.test(p) ? baseUrl + p : p);

  const frames = () => (root ? [...root.querySelectorAll('[data-embed-frame]')] : []);

  function mount(holder) {
    if (!holder || holder.dataset.embedState === 'mounted') return false;
    const src = holder.dataset.embedSrc;
    if (!src) return false;
    const frame = holder.querySelector('iframe');
    if (!frame) return false;
    frame.src = resolve(src);
    holder.dataset.embedState = 'mounted';
    stats.mounted += 1;
    return true;
  }

  function unmount(holder) {
    if (!holder || holder.dataset.embedState !== 'mounted') return false;
    const frame = holder.querySelector('iframe');
    if (frame) frame.removeAttribute('src');   // 真正終止內層文件，釋放記憶體
    holder.dataset.embedState = 'idle';
    // 卸載時一併退出「已進入」狀態，避免焦點停在已消失的文件中
    if (holder.dataset.embedEntered === 'true') leave(holder);
    stats.unmounted += 1;
    return true;
  }

  /** 使用者顯式進入嵌入內容：解除隔離並把焦點交給 iframe */
  function enter(holder) {
    if (!holder) return false;
    const frame = holder.querySelector('iframe');
    if (!frame) return false;
    holder.dataset.embedEntered = 'true';
    frame.removeAttribute('tabindex');
    frame.removeAttribute('aria-hidden');
    if (holder.inert !== undefined) holder.inert = false;
    frame.focus?.();
    return true;
  }

  /** 離開嵌入內容：重新隔離，焦點回到頁面上的「進入」按鈕 */
  function leave(holder) {
    if (!holder) return false;
    const frame = holder.querySelector('iframe');
    if (frame) {
      frame.setAttribute('tabindex', '-1');
      frame.setAttribute('aria-hidden', 'true');
    }
    holder.dataset.embedEntered = 'false';
    const btn = holder.parentElement?.querySelector('[data-embed-enter]');
    btn?.focus?.();
    return true;
  }

  /** 依當前頁索引同步所有嵌入的掛載狀態 */
  function sync(currentIndex) {
    for (const holder of frames()) {
      const i = Number(holder.dataset.embedIndex);
      if (shouldMount(i, currentIndex, radius)) mount(holder);
      else unmount(holder);
    }
  }

  return {
    sync, mount, unmount, enter, leave,
    get stats() { return { ...stats }; },
    get mountedCount() { return frames().filter((f) => f.dataset.embedState === 'mounted').length; },
  };
}
