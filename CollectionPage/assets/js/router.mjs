/**
 * 路由層 — 深連結解析／history 契約／popstate。
 * 不 import folio.mjs（README 第 4 部 §1.2 依賴規則）。
 */

export const DEFAULT_QUERY_KEY = "project";

/** 深連結的查詢參數名。作品輯用 project，簡報用 slide。 */
export const QUERY_KEY = DEFAULT_QUERY_KEY;

/**
 * 解析深連結。**純函式**，可在無瀏覽器環境測試。
 *
 * @param {string} search location.search，例如 "?project=quiet-hours"
 * @param {string[]} validIds 目前有效的作品 id（已排序）
 * @returns {{id: string|null, requestedId: string|null, fallback: boolean, message: string|null}}
 */
export function resolveDeepLink(search, validIds, queryKey = QUERY_KEY) {
  const ids = Array.isArray(validIds) ? validIds : [];
  const first = ids.length ? ids[0] : null;

  let requestedId = null;
  try {
    const params = new URLSearchParams(typeof search === 'string' ? search : '');
    requestedId = params.get(queryKey);
  } catch {
    requestedId = null;
  }

  if (!requestedId) {
    return { id: first, requestedId: null, fallback: false, message: null };
  }
  if (ids.includes(requestedId)) {
    return { id: requestedId, requestedId, fallback: false, message: null };
  }
  return {
    id: first,
    requestedId,
    fallback: true,
    message: first
      ? `找不到作品「${requestedId}」，已顯示第一件。`
      : `找不到作品「${requestedId}」，目前沒有可顯示的作品。`,
  };
}

/**
 * 由作品 id 組出 URL。
 * @param {string} id
 * @param {string} [pathname]
 */
export function urlForProject(id, pathname = "/", queryKey = QUERY_KEY) {
  const base = typeof pathname === "string" && pathname ? pathname : "/";
  return id ? `${base}?${queryKey}=${encodeURIComponent(id)}` : base;
}

/**
 * 建立路由控制器。
 *
 * @param {{
 *   location?: {search?: string, pathname?: string},
 *   history?: {pushState?: Function, replaceState?: Function, state?: any},
 *   onPopState?: (detail: {id: string|null, index: number|null}) => void,
 *   addEventListener?: Function,
 *   removeEventListener?: Function
 * }} deps
 */
export function createRouter(deps = {}) {
  const {
    location: loc = (typeof window !== 'undefined' ? window.location : { search: '', pathname: '/' }),
    history: hist = (typeof window !== 'undefined' ? window.history : null),
    onPopState = () => {},
    addEventListener: addEL = (typeof window !== 'undefined' ? window.addEventListener.bind(window) : null),
    removeEventListener: removeEL = (typeof window !== "undefined" ? window.removeEventListener.bind(window) : null),
    queryKey = QUERY_KEY,
  } = deps;

  /** 還原期間抑制回寫，避免 popstate → show → pushState → popstate 的無限迴圈 */
  let suspended = false;
  let handler = null;
  const stats = { pushed: 0, replaced: 0, failed: 0, popped: 0, suppressed: 0 };

  /**
   * 寫入歷史。**pushState 失敗不得連帶破壞作品切換**——
   * 使用者真正要的是看到下一件作品（README 第 4 部 §3.4）。
   * @returns {boolean} 是否成功寫入
   */
  function write(method, id, index) {
    if (suspended) { stats.suppressed += 1; return false; }
    if (!hist || typeof hist[method] !== 'function') { stats.failed += 1; return false; }
    try {
      hist[method]({ id, index }, "", urlForProject(id, loc.pathname, queryKey));
      stats[method === 'pushState' ? 'pushed' : 'replaced'] += 1;
      return true;
    } catch {
      // file:// 或 sandboxed iframe 下 pushState 會拋錯——吞掉，僅失去 URL 同步
      stats.failed += 1;
      return false;
    }
  }

  const api = {
    /** 解析初始 URL；不寫入歷史，由呼叫端決定 */
    resolve(validIds) { return resolveDeepLink(loc.search || "", validIds, queryKey); },

    /** 切換作品時寫入，使上一頁可逐格回溯 */
    push(id, index) { return write('pushState', id, index); },

    /** 初次載入／深連結對齊：不新增歷史項目 */
    replace(id, index) { return write('replaceState', id, index); },

    /** 在還原期間執行 fn，期間所有歷史回寫都會被抑制 */
    duringRestore(fn) {
      suspended = true;
      try { return fn(); } finally { suspended = false; }
    },

    get suspended() { return suspended; },
    get stats() { return { ...stats }; },

    /** 開始監聽 popstate */
    listen() {
      if (!addEL || handler) return;
      handler = (event) => {
        stats.popped += 1;
        const state = (event && event.state) || null;
        const detail = state && typeof state === 'object'
          ? { id: state.id ?? null, index: Number.isInteger(state.index) ? state.index : null }
          : api.resolve(null).id !== undefined ? { id: null, index: null } : { id: null, index: null };
        api.duringRestore(() => onPopState(detail));
      };
      addEL('popstate', handler);
    },

    dispose() {
      if (removeEL && handler) removeEL('popstate', handler);
      handler = null;
    },
  };

  return api;
}
