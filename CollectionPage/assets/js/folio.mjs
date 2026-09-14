/**
 * 控制器層 — 狀態機宿主．唯一渲染路徑 show()．aria-live 廣播。
 *
 * 「要改變當前作品，只能經過 show()」——四條進入路徑（相對控制項／索引清單／
 * 分類篩選／深連結與上一頁）全部收斂於此（README 第 4 部 §3.1）。
 */

import { createStore, normalizeProjects } from './store.mjs';
import { createTransitionRunner, resolveDirectionForSource } from './transition.mjs';
import { createRouter } from './router.mjs';
import * as view from './view.mjs';

export const STATE = Object.freeze({
  INIT: 'init',
  IDLE: 'idle',
  TRANSITIONING: 'transitioning',
  EMPTY: 'empty',
  SINGLE: 'single',
  CLAMPED: 'clamped',
});

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * @param {{
 *   projects: object[],
 *   siteConfig?: object,
 *   mount?: Record<string, Element|null>,
 *   location?: object,
 *   history?: object,
 *   matchMedia?: Function,
 *   clock?: {setTimeout:Function, clearTimeout:Function},
 *   normalize?: boolean
 * }} config
 */
export function createFolio(config = {}) {
  const {
    projects = [],
    siteConfig = {},
    mount = {},
    location: loc,
    history: hist,
    matchMedia: mm = (typeof window !== 'undefined' ? window.matchMedia?.bind(window) : null),
    clock = {
      setTimeout: (...args) => globalThis.setTimeout(...args),
      clearTimeout: (...args) => globalThis.clearTimeout(...args),
    },
    normalize = true,
  } = config;

  const normalized = normalize
    ? normalizeProjects(projects, { knownCategories: siteConfig.categories })
    : { projects, errors: [], warnings: [], infos: [] };

  const store = createStore(normalized.projects, siteConfig);

  // ── 減少動態偏好：監聽執行期變化（NFR-1.9）────────────────────
  let reducedMotion = false;
  let motionQuery = null;
  if (typeof mm === 'function') {
    try {
      motionQuery = mm(REDUCED_MOTION_QUERY);
      reducedMotion = !!(motionQuery && motionQuery.matches);
      const onChange = (e) => { reducedMotion = !!e.matches; };
      if (motionQuery?.addEventListener) motionQuery.addEventListener('change', onChange);
      else if (motionQuery?.addListener) motionQuery.addListener(onChange);
    } catch { reducedMotion = false; }
  }

  const transition = createTransitionRunner({
    getTarget: () => mount.visual || null,
    getPanel: () => mount.panel || null,
    clock,
    reducedMotion: () => reducedMotion,
    viewportWidth: () => (typeof window !== 'undefined' ? window.innerWidth : 0),
  });

  const router = createRouter({
    location: loc,
    history: hist,
    onPopState: (detail) => {
      const id = detail && detail.id ? detail.id : store.visibleIds()[0] || null;
      if (id) api.show(id, { source: 'history' });
    },
  });

  let state = STATE.INIT;
  let rendered = false;
  let lastAnnouncement = '';
  let notice = '';
  /** 上次渲染索引清單時的可見集合簽章——用來判斷能否原地更新 */
  let indexSignature = null;

  const set = (el, html) => { if (el) el.innerHTML = html; };

  /**
   * 索引清單：可見集合未變時**原地更新 aria-current**，不重建 DOM。
   *
   * SDD §6.4 把「重繪整份清單」列為作品數變多時的效能優化，但它其實是
   * 正確性要求：重建 DOM 會摧毀當前焦點，違反 NFR-1.4「切換後焦點不移動」。
   * 只有可見集合真的改變時（篩選）才重建。
   */
  function renderIndex(visible) {
    if (!mount.indexList) return;
    const signature = visible.map((p) => p.id).join('|');
    if (signature !== indexSignature) {
      mount.indexList.innerHTML = view.renderIndexList(visible, store.currentId);
      indexSignature = signature;
      return;
    }
    for (const btn of mount.indexList.querySelectorAll('[data-project-id]')) {
      if (btn.dataset.projectId === store.currentId) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    }
  }

  function announce(text) {
    lastAnnouncement = text;
    if (mount.live) mount.live.textContent = text;
  }

  /** 狀態由 render() 統一決定，不允許在其他地方硬寫 */
  function deriveState() {
    const visible = store.visible();
    if (visible.length === 0) return STATE.EMPTY;
    if (visible.length === 1) return STATE.SINGLE;
    if (store.orderMode === 'clamp') {
      const b = store.atBoundary;
      if (b.first || b.last) return STATE.CLAMPED;
    }
    return STATE.IDLE;
  }

  function syncControls() {
    const visible = store.visible();
    const b = store.atBoundary;
    const disablePrev = visible.length <= 1 || (store.orderMode === 'clamp' && b.first);
    const disableNext = visible.length <= 1 || (store.orderMode === 'clamp' && b.last);
    if (mount.prevBtn) mount.prevBtn.disabled = disablePrev;
    if (mount.nextBtn) mount.nextBtn.disabled = disableNext;
  }

  function render() {
    state = deriveState();
    const visible = store.visible();
    const current = store.findById(store.currentId);

    set(mount.notice, view.renderNotice(notice));

    if (state === STATE.EMPTY) {
      set(mount.visual, '');
      set(mount.panel, view.renderEmpty(
        store.filter ? { reason: 'filtered', filter: store.filter } : { reason: 'no-data' },
      ));
      set(mount.position, view.renderPosition({ index: 0, total: 0 }));
      set(mount.indexList, '');
      indexSignature = '';
      syncControls();
      rendered = true;
      return;
    }

    set(mount.visual, view.renderVisual(current, { eager: !rendered, baseUrl: siteConfig.assetBase }));
    set(mount.panel, view.renderHighlights(current).html);
    set(mount.position, view.renderPosition(store.position()));
    renderIndex(visible);
    if (mount.filterBar && store.needsFilterBar()) {
      set(mount.filterBar, view.renderFilterBar(store.categories(), store.filter));
      mount.filterBar.hidden = false;
    } else if (mount.filterBar) {
      mount.filterBar.hidden = true;
    }
    syncControls();
    rendered = true;
  }

  /**
   * **唯一入口。** 其餘所有意圖函式都是它的衍生。
   *
   * @param {string} id
   * @param {{animate?:boolean, source?:string, syncHistory?:boolean|'replace', fromIndex?:number}} [opts]
   */
  function show(id, opts = {}) {
    const {
      animate = true,
      source = 'control',
      syncHistory = true,
      fromIndex,
    } = opts;

    const visible = store.visible();
    if (visible.length === 0) { render(); return false; }

    // 1. 解析來源索引與目標索引
    const from = Number.isInteger(fromIndex) ? fromIndex : store.indexOfVisible(store.currentId);

    // 2. 目標不在可見集合 → 對齊到子集合第一件
    let targetId = id;
    if (!visible.some((p) => p.id === targetId)) targetId = visible[0].id;
    const to = visible.findIndex((p) => p.id === targetId);

    // 3. 與當前同一件且已渲染過 → 不渲染、不寫入歷史
    if (rendered && targetId === store.currentId) return false;

    // 4. 狀態先落地
    store.select(targetId);

    // 5. 丟棄舊動畫（同步且冪等）
    transition.cancelInFlight();

    // 6. 輸出最終狀態
    render();

    // 7. 歷史與狀態同步
    if (syncHistory) {
      const index = store.position().index;
      if (syncHistory === 'replace' || source === 'init' || source === 'deeplink') {
        router.replace(targetId, index);
      } else if (source !== 'history') {
        router.push(targetId, index);
      }
    }

    // 8. 動畫僅為漸進增強
    if (animate) {
      const direction = resolveDirectionForSource({ source, fromIndex: from, toIndex: to });
      const plan = transition.play(direction);
      if (plan) state = STATE.TRANSITIONING;
    }

    // 9. aria-live 廣播
    const project = store.findById(targetId);
    const pos = store.position();
    if (project) announce(`已切換至第 ${pos.index} 件，共 ${pos.total} 件：${project.title}。${project.summary}`);

    return true;
  }

  function relative(delta) {
    const result = store.step(delta);
    if (!result.id) {
      // clamp 模式抵達邊界：不移動，但仍需同步控制項狀態
      render();
      return false;
    }
    const from = store.indexOfVisible(store.currentId);
    return show(result.id, { source: 'control', fromIndex: from });
  }

  const api = {
    show,
    next: () => relative(1),
    prev: () => relative(-1),
    first() {
      const list = store.visible();
      return list.length ? show(list[0].id, { source: 'control', fromIndex: store.indexOfVisible(store.currentId) }) : false;
    },
    last() {
      const list = store.visible();
      return list.length ? show(list[list.length - 1].id, { source: 'control', fromIndex: store.indexOfVisible(store.currentId) }) : false;
    },
    select(id) {
      return show(id, { source: 'index', fromIndex: store.indexOfVisible(store.currentId) });
    },
    setFilter(category) {
      const before = store.currentId;
      const result = store.setFilter(category);
      if (result.empty) { render(); announce(`「${category}」分類目前沒有作品。`); return true; }
      if (result.alignedTo !== before) {
        // 對齊到子集合第一件；篩選無空間前後語意 → 無方向淡入
        store.select(before); // 還原後交由 show() 統一落地，維持單一入口
        return show(result.alignedTo, { source: 'filter', syncHistory: 'replace' });
      }
      render();
      return true;
    },
    clearFilter() { return api.setFilter(null); },

    /** 初始化：解析深連結 → 顯示 → replaceState 對齊 */
    init() {
      const ids = store.visibleIds();
      if (ids.length === 0) { render(); router.listen(); return { id: null, fallback: false }; }
      const resolved = router.resolve(ids);
      notice = resolved.message || '';
      store.select(ids[0]);
      rendered = false;
      show(resolved.id || ids[0], {
        source: resolved.requestedId ? 'deeplink' : 'init',
        animate: false,
        syncHistory: 'replace',
      });
      // 首次渲染時 show() 會因「同一件」而提前返回，此處確保畫面已輸出
      if (!rendered) render();
      router.listen();
      return resolved;
    },

    render,
    dispose() { transition.cancelInFlight(); router.dispose(); },

    // ── 唯讀查詢（getter，外部無法直接寫入）────────────────────
    get state() { return state; },
    get currentId() { return store.currentId; },
    get current() { return store.findById(store.currentId); },
    get position() { return store.position(); },
    get prefersReducedMotion() { return reducedMotion; },
    get lastAnnouncement() { return lastAnnouncement; },
    get notice() { return notice; },
    get store() { return store; },
    get transition() { return transition; },
    get router() { return router; },
    get diagnostics() { return normalized; },
  };

  return api;
}
