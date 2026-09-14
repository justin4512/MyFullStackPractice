/**
 * 轉場層 — 方向判定／動畫計畫（純資料）／中斷安全執行器。
 * 不 import folio.mjs 或 router.mjs（README 第 4 部 §1.2 依賴規則）。
 */

import {
  DURATION, EASING, CLEANUP_GRACE_MS, distanceFor, CHOREOGRAPHY,
} from './tokens.mjs';

/** 無空間前後語意的來源：一律無方向淡入（README 第 4 部 §3.3） */
const DIRECTIONLESS_SOURCES = ['history', 'init', 'deeplink', 'filter'];

/**
 * 由相對位置判定方向——不是由「按了哪個按鈕」判定。
 * 因此索引清單從第 5 項跳到第 2 項會正確地往左滑。
 * @param {number} fromIndex 0-based
 * @param {number} toIndex 0-based
 * @returns {'next'|'prev'|'none'}
 */
export function resolveDirection(fromIndex, toIndex) {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return 'none';
  if (fromIndex === toIndex) return 'none';
  return toIndex > fromIndex ? 'next' : 'prev';
}

/**
 * 併入來源語意的方向判定。
 * @param {{source?:string, fromIndex?:number, toIndex?:number}} arg
 * @returns {'next'|'prev'|'none'}
 */
export function resolveDirectionForSource({ source, fromIndex, toIndex } = {}) {
  if (DIRECTIONLESS_SOURCES.includes(source)) return 'none';
  return resolveDirection(fromIndex, toIndex);
}

/**
 * 產生動畫計畫——**純資料，可在無瀏覽器環境斷言**。
 *
 * 回傳 null 代表「不播放動畫，畫面即最終狀態」（FR-2.6）。
 * 注意：關鍵影格由 opacity 0 起始，但元素的**基準 CSS 狀態永遠是可見的**；
 * 動畫不執行時內容依然完整呈現。
 *
 * @param {{direction?:string, reducedMotion?:boolean, viewportWidth?:number}} [opts]
 * @returns {{mode:string,duration:number,easing:string,distancePx:number,keyframes:object[]}|null}
 */
export function planTransition(opts = {}) {
  const { direction = 'none', reducedMotion = false, viewportWidth } = opts;

  if (direction === 'none') return null;
  if (direction !== 'next' && direction !== 'prev') return null;

  if (reducedMotion) {
    // 完全不位移，而非「位移距離縮小版」；分層編排整份作廢，不是縮短的編排
    return {
      mode: 'fade',
      duration: DURATION.reducedFade,
      easing: EASING.reduced,
      distancePx: 0,
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      layers: [],
    };
  }

  const distancePx = distanceFor(viewportWidth);
  const sign = direction === 'next' ? 1 : -1;

  const layers = CHOREOGRAPHY.layers.map((layer) => {
    const dx = Math.round(distancePx * layer.distanceScale) * sign;
    const dy = layer.liftPx || 0;
    const from = { opacity: 0, transform: `translate3d(${dx}px, ${dy}px, 0)` };
    const to = { opacity: 1, transform: 'translate3d(0, 0, 0)' };
    return {
      name: layer.name,
      delay: layer.delay,
      duration: layer.duration,
      stagger: layer.stagger || 0,
      staggerCap: layer.staggerCap || 0,
      dx,
      dy,
      distancePx: Math.abs(dx),
      // 主視覺的影像另有一層縮放，形成視差深度
      zoom: layer.zoomFrom
        ? { from: layer.zoomFrom, duration: layer.zoomDuration || layer.duration,
            keyframes: [{ transform: `scale(${layer.zoomFrom})` }, { transform: "scale(1)" }] }
        : null,
      keyframes: [from, to],
    };
  });

  return {
    mode: 'slide',
    duration: DURATION.base,
    easing: EASING.base,
    distancePx,
    // 保留頂層 keyframes：主視覺層，也是既有斷言與 WAAPI 後備路徑的對象
    keyframes: layers[0].keyframes,
    layers,
  };
}

/** 計算保險清理的延遲：min(duration, cap) + 餘裕 */
export function safetyDelayFor(duration) {
  const d = Number.isFinite(duration) ? duration : DURATION.base;
  return Math.min(d, DURATION.cap) + CLEANUP_GRACE_MS;
}

const ENTER_CLASS = 'is-entering';
const ACTIVE_CLASS = 'is-transitioning';

/**
 * 中斷安全的轉場執行器。五條硬規則見 README 第 4 部 §4.4。
 *
 * @param {{
 *   getTarget: () => (Element|null),
 *   clock?: {setTimeout:Function, clearTimeout:Function},
 *   reducedMotion?: () => boolean,
 *   viewportWidth?: () => number
 * }} deps
 */
export function createTransitionRunner(deps = {}) {
  const {
    getTarget = () => null,
    /**
     * 分層編排的第二個目標（說明欄位）。回傳 null 時退化為單層動畫——
     * 既有以 getTarget 建立的測試因此不受影響。
     */
    getPanel = () => null,
    // 必須 bind 到 globalThis：把全域 setTimeout 當成物件方法呼叫，
    // 瀏覽器會因 this 不是 window 而拋 Illegal invocation。
    clock = {
      setTimeout: (...args) => globalThis.setTimeout(...args),
      clearTimeout: (...args) => globalThis.clearTimeout(...args),
    },
    reducedMotion = () => false,
    viewportWidth = () => (typeof window !== 'undefined' ? window.innerWidth : 0),
  } = deps;

  /** @type {symbol|null} 當前動畫的識別權杖 */
  let token = null;
  let timer = null;
  let listenerTarget = null;
  let listener = null;
  // cancelCalls 與 cancelled 刻意分開：前者證明「規則 1 每次切換前都有呼叫」，
  // 後者記錄「實際取消掉了幾個進行中的動畫」。只看後者無法分辨「沒呼叫」與「呼叫了但沒東西可取消」。
  const stats = { played: 0, cancelCalls: 0, cancelled: 0, settled: 0, safetySettled: 0 };

  /** 所有參與編排的元素；順序固定，index 0 為主視覺（動畫事件的來源） */
  const allTargets = () => [getTarget(), getPanel()].filter(Boolean);

  function stripClasses(el) {
    if (!el || !el.classList) return;
    el.classList.remove(ENTER_CLASS, ACTIVE_CLASS);
  }

  function stripAll() { for (const el of allTargets()) stripClasses(el); }

  /** 把某一層的計畫寫成 CSS 自訂屬性——時長與距離的唯一來源仍是 tokens.mjs */
  function applyLayer(el, plan, layer) {
    if (!el) return;
    if (el.style && el.style.setProperty) {
      el.style.setProperty('--transition-duration', `${layer.duration}ms`);
      el.style.setProperty('--transition-easing', plan.easing);
      el.style.setProperty('--transition-delay', `${layer.delay}ms`);
      el.style.setProperty('--transition-distance', `${layer.dx}px`);
      el.style.setProperty('--transition-lift', `${layer.dy || 0}px`);
      if (layer.stagger) el.style.setProperty('--transition-stagger', `${layer.stagger}ms`);
      if (layer.zoom) {
        el.style.setProperty("--transition-zoom", String(layer.zoom.from));
        el.style.setProperty("--transition-zoom-duration", `${layer.zoom.duration}ms`);
      }
    }
    if (el.classList) el.classList.add(ACTIVE_CLASS, ENTER_CLASS);
    if (el.dataset) el.dataset.transitionMode = plan.mode;
  }

  function detachListener() {
    if (listenerTarget && listener && listenerTarget.removeEventListener) {
      listenerTarget.removeEventListener('animationend', listener);
    }
    listenerTarget = null;
    listener = null;
  }

  /** 規則 5：取消後畫面必須停在最終（＝基準）狀態 */
  function cancelInFlight() {
    stats.cancelCalls += 1;
    if (token === null && timer === null) return false;
    if (timer !== null) { clock.clearTimeout(timer); timer = null; }
    detachListener();
    stripAll();
    token = null;
    stats.cancelled += 1;
    return true;
  }

  /** 規則 2：settle 只負責收尾，不觸及狀態 */
  function settle(forToken, viaSafety) {
    if (forToken !== token) return false; // 舊動畫的計時器不得為新動畫收尾
    if (timer !== null) { clock.clearTimeout(timer); timer = null; }
    detachListener();
    stripAll();
    token = null;
    stats.settled += 1;
    if (viaSafety) stats.safetySettled += 1;
    return true;
  }

  /**
   * 播放一次轉場。
   * @param {'next'|'prev'|'none'} direction
   * @returns {object|null} 實際採用的計畫；null 代表未播放動畫
   */
  function play(direction) {
    cancelInFlight(); // 規則 1：同步且冪等

    const plan = planTransition({
      direction,
      reducedMotion: reducedMotion(),
      viewportWidth: viewportWidth(),
    });
    if (!plan) return null;

    const el = getTarget();
    if (!el || !el.classList) return plan;

    const my = Symbol('transition');
    token = my;
    stats.played += 1;

    const visualLayer = (plan.layers && plan.layers[0])
      || { duration: plan.duration, delay: 0, dx: direction === 'next' ? plan.distancePx : -plan.distancePx, dy: 0 };
    applyLayer(el, plan, visualLayer);

    // 說明欄位：head 與 field 兩層由 CSS 以後代選擇器與 --transition-stagger 展開
    const panel = getPanel();
    const panelLayer = plan.layers && plan.layers.find((l) => l.name === 'field');
    if (panel && panelLayer) applyLayer(panel, plan, panelLayer);

    if (el.addEventListener) {
      listener = () => settle(my, false);
      listenerTarget = el;
      el.addEventListener('animationend', listener, { once: true });
    }

    // 規則 3：另設保險清理。分頁切到背景時 animationend 可能永不派送。
    // 以整段編排的長度（最後一層的 delay + duration）為基準，而非只看主視覺，
    // 否則保險清理會在說明欄位還在動的時候就把類別拔掉。
    const envelope = (plan.layers || []).reduce(
      (max, l) => Math.max(
        max,
        l.delay + (l.stagger * l.staggerCap) + Math.max(l.duration, l.zoom ? l.zoom.duration : 0),
      ),
      plan.duration,
    );
    timer = clock.setTimeout(() => settle(my, true), safetyDelayFor(envelope));

    return plan;
  }

  return {
    play,
    cancelInFlight,
    get pending() { return token !== null; },
    get stats() { return { ...stats }; },
  };
}

/**
 * 焦點保留斷言（供 E2E 與整合測試使用，NFR-1.4）。
 * @returns {boolean} 切換前後焦點是否為同一元素
 */
export function assertFocusRetained(before, after) {
  return before === after;
}
