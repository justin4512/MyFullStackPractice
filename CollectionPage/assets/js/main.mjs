/**
 * 啟動層 — 查詢掛載點 → 取得資料 → 建立控制器 → 接上事件 → 自動啟動。
 *
 * 本模組只把**已存在的標記**接上行為，不生成任何必要文字——
 * 這是 FR-2.6（動畫／JS 失敗時內容仍完整可讀）在架構層的落實。
 */

import { createFolio } from './folio.mjs';
import { createKeyboard } from './keyboard.mjs';

const DATA_URL = new URL("../../data/projects.json", import.meta.url).href;
const SITE_URL = new URL("../../data/site.json", import.meta.url).href;

function queryMount(doc) {
  const $ = (sel) => doc.querySelector(sel);
  return {
    root: $('[data-folio]'),
    visual: $('[data-folio-visual]'),
    panel: $('[data-folio-panel]'),
    position: $('[data-folio-position]'),
    indexList: $('[data-folio-index]'),
    filterBar: $('[data-folio-filter]'),
    live: $('[data-folio-live]'),
    notice: $('[data-folio-notice]'),
    prevBtn: $('[data-action="prev"]'),
    nextBtn: $('[data-action="next"]'),
  };
}

async function loadJson(url, fallback) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[folio] 無法取得 ${url}：${err.message}`);
    return fallback;
  }
}

/** 主題三態：light / dark / system（移除屬性）*/
function wireTheme(doc) {
  const group = doc.querySelector('[data-theme-toggle]');
  if (!group) return;
  const apply = (mode) => {
    if (mode === 'light' || mode === 'dark') doc.documentElement.setAttribute('data-theme', mode);
    else doc.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('theme', mode); } catch { /* 私密模式：靜默降級 */ }
    for (const btn of group.querySelectorAll('[data-theme-option]')) {
      btn.setAttribute('aria-checked', String(btn.dataset.themeOption === mode));
    }
  };
  let saved = 'system';
  try { saved = localStorage.getItem('theme') || 'system'; } catch { /* noop */ }
  apply(saved);
  group.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-theme-option]');
    if (btn) apply(btn.dataset.themeOption);
  });
}

export async function bootstrap(doc = document) {
  const mount = queryMount(doc);
  if (!mount.root) return null;

  wireTheme(doc);

  const [data, siteConfig] = await Promise.all([
    loadJson(DATA_URL, { projects: [] }),
    loadJson(SITE_URL, {}),
  ]);

  // 資產路徑以站台根目錄為基準；本頁可能不在根目錄（例如 works/folio/）
  const assetBase = new URL("../../", import.meta.url).href;

  const folio = createFolio({
    projects: data && data.projects ? data.projects : [],
    siteConfig: { ...siteConfig, assetBase },
    mount,
    location: window.location,
    history: window.history,
  });

  const keyboard = createKeyboard({
    root: mount.root,
    actions: {
      next: () => folio.next(),
      prev: () => folio.prev(),
      first: () => folio.first(),
      last: () => folio.last(),
      select: (id) => folio.select(id),
      setFilter: (cat) => folio.setFilter(cat),
      clearFilter: () => folio.clearFilter(),
    },
  });

  folio.init();
  keyboard.attach();

  // 資料層診斷：ERROR 在建置期已被擋下，此處為執行期的最後一道可見性
  const { errors, warnings } = folio.diagnostics;
  if (errors.length) console.error('[folio] 資料錯誤', errors);
  if (warnings.length) console.warn('[folio] 資料警告', warnings);

  mount.root.dataset.folioReady = 'true';
  return { folio, keyboard };
}

// 自動啟動守衛：import 時不得產生副作用（README 第 4 部 §1.2）
if (typeof document !== 'undefined') {
  const start = () => {
    bootstrap(document).catch((err) => {
      // 啟動失敗不得讓頁面變成空白——伺服器渲染的內容維持可讀
      console.error('[folio] 啟動失敗，維持靜態內容', err);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
