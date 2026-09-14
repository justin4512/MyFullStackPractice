/**
 * 輸入層 — 鍵盤契約與事件代理（README 第 4 部 §3.5）。
 *
 * 兩條硬規則：
 *  1. 切換後焦點不移動——本模組不對切換控制項呼叫 focus()（NFR-1.4）。
 *  2. 不形成鍵盤陷阱——所有控制項皆為原生 <button>，本模組只補方向鍵與 Escape。
 */

const INDEX_BTN = '.index-list__btn';
const CONTROL_SELECTOR = '[data-action]';

/**
 * 建立鍵盤與點擊的事件代理。
 *
 * @param {{
 *   root: Element,
 *   actions: {
 *     next?: Function, prev?: Function, first?: Function, last?: Function,
 *     select?: (id: string) => void,
 *     setFilter?: (cat: string|null) => void,
 *     clearFilter?: Function,
 *     closeOverlay?: () => boolean
 *   },
 *   isOverlayOpen?: () => boolean
 * }} deps
 */
export function createKeyboard(deps = {}) {
  const { root, actions = {}, isOverlayOpen = () => false } = deps;
  let onClick = null;
  let onKeyDown = null;

  const call = (name, ...args) => {
    const fn = actions[name];
    if (typeof fn === 'function') { fn(...args); return true; }
    return false;
  };

  function handleClick(event) {
    const target = event.target;
    if (!target || !target.closest) return;

    const indexBtn = target.closest(INDEX_BTN);
    if (indexBtn && root.contains(indexBtn)) {
      const id = indexBtn.dataset && indexBtn.dataset.projectId;
      if (id) { call('select', id); }
      return;
    }

    const filterChip = target.closest('[data-filter]');
    if (filterChip && root.contains(filterChip)) {
      const value = filterChip.dataset.filter || null;
      call('setFilter', value === '' ? null : value);
      return;
    }

    const control = target.closest(CONTROL_SELECTOR);
    if (control && root.contains(control)) {
      const action = control.dataset.action;
      if (action === 'next') call('next');
      else if (action === 'prev') call('prev');
      else if (action === 'first') call('first');
      else if (action === 'last') call('last');
      else if (action === 'clear-filter') call('clearFilter');
    }
  }

  /** 索引清單內的漫遊焦點：方向鍵移動焦點，不切換作品 */
  function moveIndexFocus(current, delta) {
    const items = [...root.querySelectorAll(INDEX_BTN)];
    const i = items.indexOf(current);
    if (i < 0 || items.length === 0) return false;
    const next = items[Math.min(items.length - 1, Math.max(0, i + delta))];
    if (next && next !== current) next.focus();
    return true;
  }

  function focusIndexEdge(current, edge) {
    const items = [...root.querySelectorAll(INDEX_BTN)];
    if (items.length === 0) return false;
    const target = edge === 'first' ? items[0] : items[items.length - 1];
    if (target && target !== current) target.focus();
    return true;
  }

  function handleKeyDown(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;

    const active = event.target;
    const inIndexList = !!(active && active.closest && active.closest(INDEX_BTN));
    const onControl = !!(active && active.closest && active.closest(CONTROL_SELECTOR));

    switch (event.key) {
      case 'Escape': {
        // 無覆蓋層時不產生任何動作——不劫持按鍵
        if (!isOverlayOpen()) return;
        if (call('closeOverlay')) event.preventDefault();
        return;
      }
      case 'ArrowRight': {
        if (inIndexList) { if (moveIndexFocus(active.closest(INDEX_BTN), 1)) event.preventDefault(); return; }
        if (onControl) { call('next'); event.preventDefault(); }
        return; // 其他位置不攔截
      }
      case 'ArrowLeft': {
        if (inIndexList) { if (moveIndexFocus(active.closest(INDEX_BTN), -1)) event.preventDefault(); return; }
        if (onControl) { call('prev'); event.preventDefault(); }
        return;
      }
      case 'ArrowDown': {
        if (inIndexList) { if (moveIndexFocus(active.closest(INDEX_BTN), 1)) event.preventDefault(); }
        return;
      }
      case 'ArrowUp': {
        if (inIndexList) { if (moveIndexFocus(active.closest(INDEX_BTN), -1)) event.preventDefault(); }
        return;
      }
      case 'Home': {
        if (inIndexList) { if (focusIndexEdge(active.closest(INDEX_BTN), 'first')) event.preventDefault(); return; }
        if (onControl) { call('first'); event.preventDefault(); }
        return;
      }
      case 'End': {
        if (inIndexList) { if (focusIndexEdge(active.closest(INDEX_BTN), 'last')) event.preventDefault(); return; }
        if (onControl) { call('last'); event.preventDefault(); }
        return;
      }
      default:
        // Enter／Space 交給原生 <button> 處理，不攔截
    }
  }

  return {
    attach() {
      if (!root || onClick) return;
      onClick = handleClick;
      onKeyDown = handleKeyDown;
      root.addEventListener('click', onClick);
      root.addEventListener('keydown', onKeyDown);
    },
    detach() {
      if (!root) return;
      if (onClick) root.removeEventListener('click', onClick);
      if (onKeyDown) root.removeEventListener('keydown', onKeyDown);
      onClick = null;
      onKeyDown = null;
    },
    // 供測試直接呼叫，不需真實事件系統
    _handleClick: handleClick,
    _handleKeyDown: handleKeyDown,
  };
}

/** 本模組實際攔截的按鍵——供測試斷言「不攔截其他按鍵」 */
export const HANDLED_KEYS = Object.freeze([
  'Escape', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End',
]);
