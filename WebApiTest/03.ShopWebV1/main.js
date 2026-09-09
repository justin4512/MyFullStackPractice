/* ============================================================================
   賈斯汀 AI 課程商業應用網站 ─ 前端主程式
   ---------------------------------------------------------------------------
   架構分區（對應 docs/03_SDD.md）：
     ① API 設定區      ← 唯一需要修改的設定處
     ② 內建示範資料
     ③ 純函式區        ← 無副作用、可被 tests.js 單元測試
     ④ 應用狀態
     ⑤ 資料存取（fetch 封裝）
     ⑥ 渲染層
     ⑦ 互動與事件
     ⑧ 啟動與測試出口
============================================================================ */
'use strict';

/**
 * 版本戳記
 * 改版後若行為沒變，多半是瀏覽器用了快取的舊檔。
 * 請按 Ctrl + F5（或 Shift + 重新整理）強制重載，
 * 並確認畫面右下角頁尾與 F12 主控台顯示的版本號與此處一致。
 */
const APP_VERSION = 'v1.4.1';

/* ============================================================================
   ① API 設定區 ★★★ 只要改這一段 ★★★
============================================================================ */

/**
 * Google Apps Script Web App 的網址。
 * 部署方式：Apps Script → 部署 → 新增部署 → 類型「網頁應用程式」
 *           → 執行身分：我　→ 具有存取權的使用者：所有人 → 複製 /exec 結尾網址。
 *
 * 範例：
 *   const API_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
 *
 * ※ 留空字串時，網站會自動切換為「離線展示模式」，使用內建示範課程，
 *    方便你先看畫面、之後再串接後端。
 */
const API_URL = 'https://script.google.com/macros/s/AKfycbyhvfFLaKGz0yHXZQPVQpDhC9qU0xbWUBZM70FYIiHvcpfpyF5zFUaYKm6DxBQ89DpDRg/exec'; // ← ★ 請在此貼上你的 GAS Web App 網址

/** 後端 action 名稱（與 Apps Script 的 doGet / doPost 對應） */
const ACTIONS = {
  READ:   'read',    // GET  讀取 menu 工作表
  ORDER:  'order',   // POST 建立訂單，寫入 orders 工作表（扣除名額）
  ADD:    'add',     // POST 新增課程至 menu 工作表
  DELETE: 'delete',  // POST 依 id 刪除 menu 工作表中的課程
  RETURN: 'return'   // POST 依訂單編號退貨，名額回補
};

/** 試算表工作表名稱（讀取訂單清單時使用） */
const SHEET_ORDERS = 'orders';

/** 每堂課的開課人數上限（名額計算基準） */
const COURSE_CAPACITY = 50;

/** 剩餘名額低於此數字時，顯示紅色「欲購從速」警語 */
const LOW_SEAT_THRESHOLD = 25;

/** 網路請求逾時（毫秒），避免使用者面對永遠轉圈的載入動畫 */
const REQUEST_TIMEOUT = 15000;

/**
 * 翻牌特價設定
 * 第一次翻開課程卡時隨機抽出折數並「鎖定」，同一門課之後翻幾次都是同一個折數。
 * DISCOUNT_MIN / MAX 為折數（75 = 75 折 = 定價 ×0.75）。
 */
const DISCOUNT_MIN = 75;   // 最低（最優惠）75 折
const DISCOUNT_MAX = 99;   // 最高 99 折
const DISCOUNT_STORAGE_KEY = 'justin-ai-course-discounts';   // localStorage 保存鎖定結果

/* ========================= 設定區結束（以下不需修改） ====================== */


/* ============================================================================
   ② 內建示範資料（離線模式使用；欄位與 Google 試算表 menu 完全一致）
============================================================================ */
const DEMO_COURSES = [
  { id:'AI-101', name:'生成式 AI 職場生產力倍增實戰', category:'職場應用', description:'學習如何使用 ChatGPT、Claude 與 Office 輔助工具，大幅提升日常工作、簡報製作與 Email 撰寫效率。', price:3200, imageUrl:'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=80', status:'剩餘 15 個名額' },
  { id:'AI-102', name:'Midjourney & DALL-E 商業視覺設計', category:'視覺設計', description:'掌握 AI 繪圖提示詞技巧，快速生成高質感行銷海報、電商 Banner 及產品包裝概念圖。', price:4500, imageUrl:'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=80', status:'剩餘 8 個名額' },
  { id:'AI-103', name:'AI 驅動的數據分析與商業洞察', category:'商業分析', description:'運用 Python 與 AI 輔助工具自動化分析銷售數據，快速產出高價值商業預測報告。', price:5800, imageUrl:'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80', status:'額滿即將截止 (剩 3 名)' },
  { id:'AI-104', name:'無程式碼 AI 自動化工作流 (Make/n8n)', category:'流程自動化', description:'無需寫程式！打造自動化客戶回覆系統、數據同步與社群媒體貼文自動排程。', price:4200, imageUrl:'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80', status:'剩餘 12 個名額' },
  { id:'AI-105', name:'企業專用 RAG 知識庫與 AI 智能客服建置', category:'技術實作', description:'結合企業內部文件打造高準確度的專屬 AI 知識庫與 24/7 自動化智能客服小幫手。', price:6800, imageUrl:'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80', status:'熱銷中 (剩 5 名)' },
  { id:'AI-106', name:'AI 數位行銷文案與社群經營全攻略', category:'數位行銷', description:'教你用 AI 打造高轉換爆款文案、自動排程 SEO 文章與精準社群廣告投放素材。', price:3600, imageUrl:'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80', status:'剩餘 20 個名額' },
  { id:'AI-107', name:'Python + LLM 大語言模型應用開發', category:'程式開發', description:'從 OpenAI API 入門到 LangChain 實作，完整掌握建構專業級 AI 應用程式的核心技術。', price:7500, imageUrl:'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80', status:'剩餘 6 個名額' },
  { id:'AI-108', name:'AI 影音創作與自動化短影音剪輯', category:'影音創作', description:'運用 AI 自動生成腳本、配音、配樂與字幕，快速產出 TikTok / Reels 爆款短影音。', price:4800, imageUrl:'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=800&q=80', status:'剩餘 10 個名額' },
  { id:'AI-109', name:'AI 時代的 UI/UX 設計與原型快速開發', category:'視覺設計', description:'結合 AI 快速製作 Wireframe、高保真 User Interface 與自動生成使用者測試報告。', price:5200, imageUrl:'https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?auto=format&fit=crop&w=800&q=80', status:'剩餘 14 個名額' },
  { id:'AI-110', name:'AI Agent 智能代理人實作工作坊', category:'技術實作', description:'學習如何設計能自動拆解任務、自主使用工具並執行複雜商業流程的 AI Agent。', price:8200, imageUrl:'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80', status:'最後名額 (剩 2 名)' }
];


/* ============================================================================
   ③ 純函式區（無副作用 ─ 可單元測試，見 tests.html）
============================================================================ */

/**
 * 將任意值安全轉為數字（自動去除 NT$、逗號、空白等雜訊）
 * @returns {number} 無法解析時回傳 0
 */
function toNumber(value) {
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[^\d.-]/g, '');
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

/**
 * 解析剩餘名額。
 * 規則：① 數字型別直接採用　② 字串取第一個整數　③ 無數字但含「額滿」→ 0
 *       ④ 空值視為全新課程 → 回傳開課上限　⑤ 結果一律夾擠於 0 ~ capacity
 * @param {string|number|null} status  試算表 status 欄位
 * @param {number} capacity            開課人數上限
 * @returns {number} 剩餘名額
 */
function parseSeats(status, capacity = COURSE_CAPACITY) {
  const cap = toNumber(capacity) || COURSE_CAPACITY;

  if (typeof status === 'number' && isFinite(status)) {
    return Math.max(0, Math.min(cap, Math.floor(status)));
  }
  if (status === null || status === undefined) return cap;

  const text = String(status).trim();
  if (text === '') return cap;

  const matched = text.match(/-?\d+/);
  if (matched) {
    return Math.max(0, Math.min(cap, parseInt(matched[0], 10)));
  }
  // 沒有數字時，靠關鍵字判斷是否已無名額
  if (/(額滿|已滿|滿了|售罄|截止|關閉|停售)/.test(text)) return 0;
  return cap;
}

/**
 * 依剩餘名額產生顯示文字與樣式等級
 * @returns {{level:'normal'|'low'|'soldout', text:string}}
 */
function seatLabel(remaining, capacity = COURSE_CAPACITY) {
  const left = Math.max(0, Math.min(toNumber(capacity) || COURSE_CAPACITY, toNumber(remaining)));
  if (left <= 0)                    return { level: 'soldout', text: '名額已滿' };
  if (left < LOW_SEAT_THRESHOLD)    return { level: 'low',     text: `僅剩 ${left} 名，欲購從速` };
  return { level: 'normal', text: `還剩 ${left} 個名額` };
}

/**
 * 圖片網址清洗（防呆）
 * 試算表常見的三種髒資料：
 *   ① Markdown 連結格式「[顯示文字](https://...)」→ 取出括號內的真實網址
 *   ② 純文字說明，例如「查看圖片」「無」→ 視為沒有圖片，交由 SVG 佔位圖處理
 *   ③ 前後空白、換行 → 一律 trim
 * @returns {string} 可直接放入 img.src 的網址；無效時回傳空字串
 */
function sanitizeImageUrl(value) {
  if (value === null || value === undefined) return '';
  let text = String(value).trim();
  if (text === '') return '';

  // Markdown 連結 [文字](網址)
  const markdown = text.match(/\]\(\s*((?:https?:\/\/|data:image\/)[^\s)]+)\s*\)/i);
  if (markdown) text = markdown[1];

  // 只接受 http(s) 與內聯圖片，其餘（例如「查看圖片」）一律視為無圖
  if (!/^(https?:\/\/|data:image\/)/i.test(text)) return '';
  return text;
}

/**
 * 判斷是否為試算表的空白列（末端殘留的空列常見於手動編輯後）
 * id 與 name 皆為空即視為空白列，避免渲染出「未命名課程」的幽靈卡片。
 */
function isBlankCourseRow(raw) {
  const row = raw && typeof raw === 'object' ? raw : {};
  let id = '', name = '';
  Object.keys(row).forEach(function (key) {
    const k = String(key).trim().toLowerCase();
    if (k === 'id')   id   = String(row[key] === null || row[key] === undefined ? '' : row[key]).trim();
    if (k === 'name') name = String(row[key] === null || row[key] === undefined ? '' : row[key]).trim();
  });
  return id === '' && name === '';
}

/**
 * 將試算表原始列轉為前端課程模型（容忍欄位大小寫不一致與缺欄）
 * ※ 圖片一律取「imageUrl」欄位（大小寫不拘），並經 sanitizeImageUrl 清洗；
 *   其他名稱含 imageUrl 的欄位（例如「imageUrl (更換後穩定網址)」）不會被誤用。
 */
function normalizeCourse(raw, index = 0) {
  const row = raw && typeof raw === 'object' ? raw : {};

  // 建立「小寫欄位名 → 值」的對照表，讓 ImageUrl / IMAGEURL / imageurl 都能取到
  const lower = {};
  Object.keys(row).forEach(function (key) {
    lower[String(key).trim().toLowerCase()] = row[key];
  });
  const pick = function (name) {
    const v = lower[name];
    return v === null || v === undefined ? '' : String(v).trim();
  };

  const status = pick('status');
  return {
    id:          pick('id') || ('TMP-' + (index + 1)),
    name:        pick('name') || '未命名課程',
    category:    pick('category') || '未分類',
    description: pick('description') || '這門課程尚未填寫描述。',
    price:       toNumber(lower['price']),
    imageUrl:    sanitizeImageUrl(lower['imageurl']),
    status:      status,
    remaining:   parseSeats(status, COURSE_CAPACITY)
  };
}

/** 金額格式化：3200 →「NT$ 3,200」 */
function formatCurrency(value) {
  const n = Math.round(toNumber(value));
  return 'NT$ ' + n.toLocaleString('zh-TW');
}

/** HTML 跳脫，避免試算表內容造成 XSS */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------------------------- 翻牌特價（折扣） -------------------------- */

/**
 * 隨機折數（含頭尾）：75 ~ 99 折
 * @returns {number} 整數折數
 */
function randomDiscount() {
  return Math.floor(Math.random() * (DISCOUNT_MAX - DISCOUNT_MIN + 1)) + DISCOUNT_MIN;
}

/**
 * 折數正規化：超出範圍或非數字一律視為「無折扣」（100）
 */
function normalizeDiscount(value) {
  const n = Math.round(toNumber(value));
  if (!n || n >= 100) return 100;
  return Math.max(DISCOUNT_MIN, Math.min(DISCOUNT_MAX, n));
}

/**
 * 套用折扣後的價格（四捨五入到整數元）
 * @param {number} price    定價
 * @param {number} discount 折數（75~99；100 或未提供代表原價）
 */
function applyDiscount(price, discount) {
  const base = toNumber(price);
  const d = normalizeDiscount(discount);
  if (d >= 100) return Math.round(base);
  return Math.round(base * d / 100);
}

/** 折數顯示文字：88 →「本次課程可打 88 折」 */
function discountText(discount) {
  const d = normalizeDiscount(discount);
  return d >= 100 ? '原價供應' : ('本次課程可打 ' + d + ' 折');
}

/**
 * 鎖定折數（純函式）：同一門課只在第一次翻牌時抽籤，之後永遠沿用。
 * @param {Object} map      已鎖定的折數對照表 { courseId: 折數 }
 * @param {string} id       課程 id
 * @param {number} [value]  指定折數（測試用）；未提供時隨機抽出
 * @returns {{map:Object, discount:number, isNew:boolean}} 新的對照表與該課折數
 */
function lockDiscount(map, id, value) {
  const table = map && typeof map === 'object' ? map : {};
  const key = String(id || '').trim();
  if (key === '') return { map: table, discount: 100, isNew: false };

  if (table[key]) {
    return { map: table, discount: normalizeDiscount(table[key]), isNew: false };
  }
  const discount = normalizeDiscount(value === undefined ? randomDiscount() : value);
  const next = Object.assign({}, table);
  next[key] = discount;
  return { map: next, discount: discount, isNew: true };
}

/* ---------------------------- 購物車 Reducer ---------------------------- */

/** 加入課程（已存在則數量 +1）；回傳新陣列，不修改原陣列 */
function cartAdd(cart, course) {
  const list = Array.isArray(cart) ? cart : [];
  if (!course || !course.id) return list.slice();

  const exists = list.some(function (i) { return i.id === course.id; });
  if (exists) {
    return list.map(function (i) {
      if (i.id !== course.id) return i;
      const max = toNumber(i.remaining) || 0;
      // ※ 除了數量，價格與折數也一併同步為「本次加入時的最新值」，
      //   避免第一次加入時折扣尚未鎖定，導致後續都沿用未折扣的舊價格。
      return Object.assign({}, i, {
        qty: Math.min(i.qty + 1, max || i.qty + 1),
        basePrice: toNumber(course.price),
        discount: normalizeDiscount(course.discount),
        price: applyDiscount(course.price, course.discount),
        remaining: toNumber(course.remaining)
      });
    });
  }
  return list.concat([{
    id: course.id,
    name: course.name,
    basePrice: toNumber(course.price),                      // 定價
    discount: normalizeDiscount(course.discount),           // 翻牌鎖定的折數（100＝原價）
    price: applyDiscount(course.price, course.discount),    // 實際計價（折後）
    imageUrl: course.imageUrl || '',
    remaining: toNumber(course.remaining),
    qty: 1
  }]);
}

/**
 * 調整數量。數量歸零時自動移除；超過剩餘名額時不再增加並回報 capped。
 * @returns {{items:Array, capped:boolean, removed:boolean}}
 */
function cartChangeQty(cart, id, delta) {
  const list = Array.isArray(cart) ? cart : [];
  const target = list.find(function (i) { return i.id === id; });
  if (!target) return { items: list.slice(), capped: false, removed: false };

  const max = toNumber(target.remaining);
  const next = target.qty + toNumber(delta);

  if (next <= 0) {
    return { items: list.filter(function (i) { return i.id !== id; }), capped: false, removed: true };
  }
  if (max > 0 && next > max) {
    return { items: list.slice(), capped: true, removed: false };
  }
  return {
    items: list.map(function (i) { return i.id === id ? Object.assign({}, i, { qty: next }) : i; }),
    capped: false,
    removed: false
  };
}

/** 移除指定課程 */
function cartRemove(cart, id) {
  const list = Array.isArray(cart) ? cart : [];
  return list.filter(function (i) { return i.id !== id; });
}

/** 計算合計：count＝課程門數、qty＝總堂數、total＝總金額 */
function cartTotals(cart) {
  const list = Array.isArray(cart) ? cart : [];
  return list.reduce(function (acc, i) {
    acc.count += 1;
    acc.qty   += toNumber(i.qty);
    acc.total += toNumber(i.price) * toNumber(i.qty);
    return acc;
  }, { count: 0, qty: 0, total: 0 });
}

/* ---------------------------- Payload 組裝 ------------------------------ */

/** 組出送單用的 JSON（action: 'order'） */
function buildOrderPayload(customerName, cart) {
  const list = Array.isArray(cart) ? cart : [];
  const items = list.map(function (i) {
    return {
      id: i.id,
      name: i.name,
      price: toNumber(i.price),                                   // 折後單價（實際計價）
      basePrice: toNumber(i.basePrice === undefined ? i.price : i.basePrice),
      discount: normalizeDiscount(i.discount),                    // 翻牌鎖定的折數
      qty: toNumber(i.qty),
      subtotal: toNumber(i.price) * toNumber(i.qty)
    };
  });
  return {
    action: ACTIONS.ORDER,
    customerName: String(customerName === null || customerName === undefined ? '' : customerName).trim(),
    items: items,
    totalPrice: cartTotals(list).total
  };
}

/**
 * 組出新增課程用的 JSON（action: 'add'）
 * seats＝管理員選擇的開課名額，會寫入試算表 status 欄位作為初始剩餘名額。
 */
function buildAddPayload(form) {
  const f = form || {};
  const seats = f.seats === undefined || f.seats === '' ? COURSE_CAPACITY : Math.round(toNumber(f.seats));
  return {
    action: ACTIONS.ADD,
    name: String(f.name || '').trim(),
    category: String(f.category || '').trim(),
    description: String(f.description || '').trim(),
    price: toNumber(f.price),
    imageUrl: String(f.imageUrl || '').trim(),
    seats: Math.max(1, Math.min(COURSE_CAPACITY, seats)),
    status: Math.max(1, Math.min(COURSE_CAPACITY, seats))   // 試算表以數字保存剩餘名額
  };
}

/** 組出刪除課程用的 JSON（action: 'delete'） */
function buildDeletePayload(id) {
  return { action: ACTIONS.DELETE, id: String(id === null || id === undefined ? '' : id).trim() };
}

/** 組出退貨用的 JSON（action: 'return'）；後端會依訂單明細把名額加回 menu */
function buildReturnPayload(orderId) {
  return { action: ACTIONS.RETURN, orderId: String(orderId === null || orderId === undefined ? '' : orderId).trim() };
}

/* ------------------------------ 驗證函式 -------------------------------- */

/** 送單前驗證 */
function validateOrder(customerName, cart) {
  const name = String(customerName || '').trim();
  const list = Array.isArray(cart) ? cart : [];
  if (list.length === 0) return { ok: false, field: 'cart', message: '請先加入至少一門課程再送出喔！' };
  if (name === '')       return { ok: false, field: 'customerName', message: '請填寫顧客姓名，我們才知道座位要留給誰。' };
  if (name.length > 30)  return { ok: false, field: 'customerName', message: '顧客姓名長度請勿超過 30 個字。' };
  return { ok: true };
}

/** 新增課程表單驗證 */
function validateCourseForm(form) {
  const f = form || {};
  const name = String(f.name || '').trim();
  const category = String(f.category || '').trim();
  const description = String(f.description || '').trim();
  const priceRaw = String(f.price === null || f.price === undefined ? '' : f.price).trim();

  if (name === '')        return { ok: false, field: 'name',        message: '請填寫「課程名稱」。' };
  if (category === '')    return { ok: false, field: 'category',    message: '請填寫「課程分類」。' };
  if (priceRaw === '')    return { ok: false, field: 'price',       message: '請填寫「課程價格」。' };
  if (!/^\d+(\.\d+)?$/.test(priceRaw) || toNumber(priceRaw) < 0) {
    return { ok: false, field: 'price', message: '「課程價格」需為 0 以上的數字。' };
  }
  if (description === '') return { ok: false, field: 'description', message: '請填寫「課程描述」。' };

  // 開課名額：1 ~ COURSE_CAPACITY（未填視為滿編）
  if (f.seats !== undefined && String(f.seats).trim() !== '') {
    const seats = Math.round(toNumber(f.seats));
    if (seats < 1 || seats > COURSE_CAPACITY) {
      return { ok: false, field: 'seats', message: '「開課名額」需介於 1 ~ ' + COURSE_CAPACITY + ' 人。' };
    }
  }
  return { ok: true };
}

/* ---------------------------- API 回應解析 ------------------------------ */

/**
 * 統一解析後端回應
 * @returns {{ok:boolean, data:Array|Object|null, message:string}}
 */
function parseApiResponse(json) {
  if (!json || typeof json !== 'object') {
    return { ok: false, data: null, message: '後端回應格式錯誤（非 JSON 物件）。' };
  }
  const ok = json.status === 'success';
  return {
    ok: ok,
    data: json.data === undefined ? null : json.data,
    message: json.message || (ok ? '操作成功' : '後端回報錯誤，請稍後再試。')
  };
}

/* --------------------------- 圖片佔位 SVG ------------------------------- */

/**
 * 產生內聯 SVG 佔位圖（data URI）；圖片載入失敗時使用，確保永不破圖。
 */
function placeholderSvg(title) {
  const text = escapeHtml(String(title || 'AI 課程').slice(0, 8));
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">',
      '<defs>',
        '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
          '<stop offset="0%" stop-color="#17496f"/>',
          '<stop offset="55%" stop-color="#2f7fb8"/>',
          '<stop offset="100%" stop-color="#4bb3d4"/>',
        '</linearGradient>',
      '</defs>',
      '<rect width="400" height="300" fill="url(#g)"/>',
      '<g fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2">',
        '<circle cx="200" cy="126" r="42"/>',
        '<path d="M200 84v-16M200 184v16M158 126h-18M260 126h18"/>',
        '<path d="M182 126h36M200 108v36"/>',
        '<path d="M330 40 292 60l14 5 5 16z"/>',
      '</g>',
      '<text x="200" y="228" text-anchor="middle" fill="rgba(255,255,255,.94)" ',
        'font-family="Noto Sans TC, sans-serif" font-size="24" font-weight="700">', text, '</text>',
      '<text x="200" y="256" text-anchor="middle" fill="rgba(255,255,255,.66)" ',
        'font-family="Noto Sans TC, sans-serif" font-size="13">課程圖片準備中</text>',
    '</svg>'
  ].join('');
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}


/* ============================================================================
   ④ 應用狀態（單一資料來源；所有畫面由此推導）
============================================================================ */
const state = {
  courses: [],          // 課程清單（已 normalize）
  cart: [],             // 選課車項目
  adminMode: false,     // 是否為管理員模式
  activeCategory: '全部',
  keyword: '',
  loading: false,       // 課程載入中
  busy: false,          // 寫入類請求進行中
  offline: false,       // 是否為離線展示模式
  pendingDeleteId: null,// 待確認刪除的課程 id
  discounts: {}         // 翻牌鎖定的折數 { courseId: 折數 }
};

/* --- 折數持久化：同一台裝置重新整理後仍沿用第一次翻牌的折數 --- */
function loadDiscounts() {
  try {
    const raw = localStorage.getItem(DISCOUNT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};

    // 清洗：只保留合法折數（75~99），把 100 或損毀的值視為「尚未抽籤」
    const clean = {};
    Object.keys(parsed).forEach(function (key) {
      const d = Math.round(toNumber(parsed[key]));
      if (d >= DISCOUNT_MIN && d <= DISCOUNT_MAX) clean[key] = d;
    });
    return clean;
  } catch (e) {
    return {};   // 隱私模式或封鎖儲存時，退回「僅本次瀏覽有效」
  }
}
function saveDiscounts(map) {
  try {
    localStorage.setItem(DISCOUNT_STORAGE_KEY, JSON.stringify(map));
  } catch (e) { /* 忽略：不影響功能 */ }
}

/** 取得某課程目前鎖定的折數（尚未翻牌則為 100＝原價） */
function getDiscount(courseId) {
  return normalizeDiscount(state.discounts[courseId]);
}

/** DOM 快取 */
const $ = function (id) { return document.getElementById(id); };
const el = {};


/* ============================================================================
   ⑤ 資料存取層（所有 fetch 都在這裡，統一錯誤處理）
============================================================================ */

/** 帶逾時的 fetch，避免請求卡住讓載入動畫轉不停 */
function fetchWithTimeout(url, options) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const opts = Object.assign({}, options, controller ? { signal: controller.signal } : {});
  const timer = setTimeout(function () { if (controller) controller.abort(); }, REQUEST_TIMEOUT);

  return fetch(url, opts).finally(function () { clearTimeout(timer); });
}

/**
 * GET 讀取（action=read）
 * @returns {Promise<{ok:boolean, data:Array|null, message:string}>}
 */
async function apiGet(action, extraParams) {
  try {
    let url = API_URL + (API_URL.indexOf('?') > -1 ? '&' : '?') + 'action=' + encodeURIComponent(action);

    // 額外查詢參數（例如 sheet=orders）
    const params = extraParams || {};
    Object.keys(params).forEach(function (key) {
      url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    });

    // 加上時間戳並停用快取：避免瀏覽器沿用舊的 GAS 回應（圖片/名額顯示成舊資料的元凶）
    url += '&_ts=' + Date.now();

    const res = await fetchWithTimeout(url, { method: 'GET', redirect: 'follow', cache: 'no-store' });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); }
    catch (e) { return { ok: false, data: null, message: '後端回應不是合法的 JSON，請確認 GAS 已正確部署。' }; }
    return parseApiResponse(json);
  } catch (err) {
    const aborted = err && err.name === 'AbortError';
    return { ok: false, data: null, message: aborted ? '連線逾時，請檢查網路或稍後再試。' : ('連線失敗：' + (err && err.message ? err.message : '未知錯誤')) };
  }
}

/**
 * POST 寫入（order / add / delete）
 * ※ 刻意不設定 Content-Type，讓瀏覽器以 text/plain 送出，
 *    避免觸發 CORS 預檢（preflight）導致 Google Apps Script 拒絕請求。
 */
async function apiPost(payload) {
  try {
    const res = await fetchWithTimeout(API_URL, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); }
    catch (e) { return { ok: false, data: null, message: '後端回應不是合法的 JSON，請確認 GAS 已正確部署。' }; }
    return parseApiResponse(json);
  } catch (err) {
    const aborted = err && err.name === 'AbortError';
    return { ok: false, data: null, message: aborted ? '連線逾時，訂單尚未送出，請稍後再試。' : ('連線失敗：' + (err && err.message ? err.message : '未知錯誤')) };
  }
}

/** 離線展示模式下的模擬回應（讓未串接 API 時也能完整體驗流程） */
function mockApi(payload) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      if (payload.action === ACTIONS.ORDER) {
        const stamp = new Date();
        const seq = String(stamp.getTime()).slice(-4);
        resolve({ ok: true, data: { orderId: 'DEMO-' + stamp.getFullYear() + String(stamp.getMonth() + 1).padStart(2, '0') + String(stamp.getDate()).padStart(2, '0') + '-' + seq }, message: '（離線展示）訂單已模擬建立' });
      } else if (payload.action === ACTIONS.ADD) {
        resolve({ ok: true, data: Object.assign({ id: 'DEMO-' + Date.now().toString().slice(-5) }, payload), message: '（離線展示）課程已模擬新增' });
      } else if (payload.action === ACTIONS.RETURN) {
        resolve({ ok: true, data: { orderId: payload.orderId, restoredSeats: [] }, message: '（離線展示）已模擬退貨，名額回補需串接後端才會實際生效' });
      } else {
        resolve({ ok: true, data: null, message: '（離線展示）已模擬刪除' });
      }
    }, 900);
  });
}

/** 依模式選擇真實 API 或模擬 API */
function sendAction(payload) {
  return state.offline ? mockApi(payload) : apiPost(payload);
}

/**
 * 載入課程清單（含骨架動畫與降級處理）
 */
async function loadCourses(options) {
  const opts = options || {};
  state.loading = true;
  renderSkeleton();

  // 未設定 API_URL → 直接進入離線展示模式
  if (!API_URL || !API_URL.trim()) {
    await delay(650); // 讓骨架動畫有存在感，避免畫面閃爍
    state.offline = true;
    state.courses = DEMO_COURSES.map(normalizeCourse);
    state.loading = false;
    showOfflineBar('目前為離線展示資料。請於 main.js 最上方的「API 設定區」填入你的 API_URL 以串接 Google 試算表。');
    renderAll();
    return;
  }

  const res = await apiGet(ACTIONS.READ);
  state.loading = false;

  if (res.ok && Array.isArray(res.data)) {
    state.offline = false;
    hideOfflineBar();
    // 先濾掉試算表末端的空白列，再正規化，避免出現「未命名課程」幽靈卡片
    state.courses = res.data
      .filter(function (row) { return !isBlankCourseRow(row); })
      .map(normalizeCourse);
    renderAll();
    if (!opts.silent) showToast('課程清單已更新，共 ' + state.courses.length + ' 門課程。', 'success');
  } else {
    // 降級：改用示範資料，但明確告知使用者
    state.offline = true;
    state.courses = DEMO_COURSES.map(normalizeCourse);
    showOfflineBar('無法連線至後端（' + res.message + '）。目前顯示的是離線展示資料。');
    renderAll();
    showToast('課程載入失敗，已切換為離線展示模式。', 'error');
  }
}

/** 小工具：延遲 */
function delay(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}


/* ============================================================================
   ⑥ 渲染層（state → DOM）
============================================================================ */

/** 依關鍵字與分類篩選課程 */
function getVisibleCourses() {
  const kw = state.keyword.trim().toLowerCase();
  return state.courses.filter(function (c) {
    const matchCat = state.activeCategory === '全部' || c.category === state.activeCategory;
    if (!matchCat) return false;
    if (!kw) return true;
    return (c.name + ' ' + c.description + ' ' + c.category + ' ' + c.id).toLowerCase().indexOf(kw) > -1;
  });
}

/** 骨架載入卡（初次載入 / 重新整理時） */
function renderSkeleton(count) {
  const n = count || 8;
  let html = '';
  for (let i = 0; i < n; i++) {
    html += '<div class="skeleton-card">' +
              '<div class="sk-img"></div>' +
              '<div class="sk-body">' +
                '<div class="sk-line sk-line--80"></div>' +
                '<div class="sk-line sk-line--60"></div>' +
                '<div class="sk-line sk-line--40"></div>' +
              '</div>' +
            '</div>';
  }
  el.courseGrid.innerHTML = html;
  el.courseGrid.setAttribute('aria-busy', 'true');
  el.emptyState.hidden = true;
  el.countChip.textContent = '課程載入中…';
}

/** 分類篩選晶片 */
function renderCategories() {
  const cats = ['全部'];
  state.courses.forEach(function (c) {
    if (cats.indexOf(c.category) === -1) cats.push(c.category);
  });

  el.categoryBar.innerHTML = cats.map(function (cat) {
    const active = cat === state.activeCategory ? ' is-active' : '';
    return '<button type="button" class="cat-chip' + active + '" data-cat="' + escapeHtml(cat) + '" role="tab">' +
             escapeHtml(cat) +
           '</button>';
  }).join('');

  // 同步管理員表單的分類建議清單
  el.categoryList.innerHTML = cats.slice(1).map(function (c) {
    return '<option value="' + escapeHtml(c) + '"></option>';
  }).join('');
}

/** 單張課程卡的 HTML（桌遊風格：正面視覺 / 背面資訊 / 魔法翻牌特效） */
function courseCardHtml(course, index) {
  const seat = seatLabel(course.remaining);
  const soldout = course.remaining <= 0;
  const percent = Math.max(0, Math.min(100, (course.remaining / COURSE_CAPACITY) * 100));
  const img = course.imageUrl ? escapeHtml(course.imageUrl) : placeholderSvg(course.name);

  // 翻牌特價：已翻過的卡片沿用鎖定折數；尚未翻牌則顯示「翻牌有特價」
  const discount = getDiscount(course.id);
  const hasDeal = discount < 100;
  const finalPrice = applyDiscount(course.price, discount);

  const seatIcon = soldout
    ? '<svg viewBox="0 0 24 24" class="ico"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></svg>'
    : '<svg viewBox="0 0 24 24" class="ico"><path d="M17 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3.5"/><path d="M21 20v-2a4 4 0 0 0-3-3.9"/></svg>';

  return '' +
  '<article class="course-card" data-id="' + escapeHtml(course.id) + '" style="animation-delay:' + (index * 55) + 'ms">' +

    // 刪除按鈕（管理員模式才顯示，位於翻轉層之外，正反面皆可點）
    '<button type="button" class="card-delete" data-action="delete-course" ' +
            'aria-label="刪除課程：' + escapeHtml(course.name) + '" title="刪除此課程">' +
      '<svg viewBox="0 0 24 24" class="ico"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v5M14 11v5"/></svg>' +
    '</button>' +

    /* 透明命中層：與刪除鈕同樣位於 3D 翻轉容器之外，覆蓋背面「加入課程」按鈕的位置。
       用途是繞過部分瀏覽器在 preserve-3d 子樹中無法命中背面按鈕的問題，
       僅在卡片翻到背面時才啟用（見 style.css 的 .card-hit）。 */
    (soldout ? '' :
      '<button type="button" class="card-hit" data-action="add-to-cart" tabindex="-1" ' +
              'aria-hidden="true" title="加入課程：' + escapeHtml(course.name) + '"></button>') +

    /* 魔法特效層（位於翻轉容器外，才能讓火花飛出卡片邊界） */
    '<span class="card-magic" aria-hidden="true">' +
      '<span class="magic-glow"></span>' +
      '<span class="magic-ring"></span>' +
      '<i class="spk spk--1"></i><i class="spk spk--2"></i><i class="spk spk--3"></i>' +
      '<i class="spk spk--4"></i><i class="spk spk--5"></i><i class="spk spk--6"></i>' +
      '<i class="spk spk--7"></i><i class="spk spk--8"></i>' +
    '</span>' +

    '<div class="card-inner">' +

      /* ---------- 正面 ---------- */
      '<div class="card-face card-front">' +
        '<div class="card-imgbox">' +
          '<img src="' + img + '" alt="' + escapeHtml(course.name) + '" loading="lazy" ' +
               'onerror="JustinAI.onImgError(this)" data-title="' + escapeHtml(course.name) + '" />' +
          '<span class="card-ribbon">' + escapeHtml(course.category) + '</span>' +
          '<span class="card-serial">NO. ' + escapeHtml(course.id) + '</span>' +
        '</div>' +
        '<div class="card-front-body">' +
          '<h3 class="card-name">' + escapeHtml(course.name) + '</h3>' +
          '<div class="card-front-foot">' +
            // 正面固定顯示定價，不揭露折扣
            '<span class="card-price"><small>NT$</small> ' +
              Math.round(course.price).toLocaleString('zh-TW') +
            '</span>' +
            '<span class="flip-hint">' + FLIP_HINT_HTML + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* ---------- 背面 ---------- */
      '<div class="card-face card-back">' +
        '<span class="back-cat">' + escapeHtml(course.category) + '</span>' +
        '<h3 class="back-name">' + escapeHtml(course.name) + '</h3>' +
        '<div class="back-divider"></div>' +
        '<p class="back-desc">' + escapeHtml(course.description) + '</p>' +
        '<div class="back-foot">' +
          // 翻牌驚喜：折數與折後新價格只在背面揭曉（尚未翻牌時由 JS 於翻牌瞬間補上）
          '<div class="deal-line' + (hasDeal ? '' : ' is-hidden') + '">' +
            '<span class="deal-badge">' + (hasDeal ? discount + ' 折' : '') + '</span>' +
            '<span class="deal-text">' + (hasDeal ? discountText(discount) : '') + '</span>' +
          '</div>' +
          '<div class="deal-price' + (hasDeal ? '' : ' is-hidden') + '">' +
            '<s>' + (hasDeal ? formatCurrency(course.price) : '') + '</s>' +
            '<i class="arrow">→</i>' +
            '<b>' + (hasDeal ? formatCurrency(finalPrice) : '') + '</b>' +
          '</div>' +
          '<span class="seat-line seat-' + seat.level + '">' + seatIcon + seat.text + '</span>' +
          '<div class="seat-meter' + (seat.level === 'low' ? ' is-low' : '') + '">' +
            '<i style="width:' + percent + '%"></i>' +
          '</div>' +
          '<button type="button" class="add-btn" data-action="add-to-cart"' + (soldout ? ' disabled' : '') + '>' +
            (soldout
              ? '名額已滿'
              : '加入課程　<span class="btn-price">' + formatCurrency(finalPrice) + '</span>') +
          '</button>' +
        '</div>' +
      '</div>' +

    '</div>' +
  '</article>';
}

/**
 * 卡片正面的翻牌提示（固定文案）
 * ※ 正面只揭露定價與「翻牌有驚喜」，折數與折後價一律留在背面才揭曉。
 */
const FLIP_HINT_HTML =
  '<svg viewBox="0 0 24 24" class="ico">' +
    '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>' +
    '<path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>' +
  '</svg>翻牌有驚喜';

/**
 * 翻牌瞬間揭曉折扣：第一次翻牌抽籤並鎖定，之後沿用同一折數。
 * 直接就地更新該張卡片的 DOM（不整頁重繪，避免打斷翻牌動畫）。
 */
function revealDeal(card) {
  if (!card) return;
  const id = card.getAttribute('data-id');
  const course = state.courses.find(function (c) { return c.id === id; });
  if (!course) return;

  const already = getDiscount(id) < 100;

  // 未抽籤、或存到損毀值（含 100）→ 先清掉再抽，避免永遠卡在「無折扣」
  const source = Object.assign({}, state.discounts);
  if (!already) delete source[id];

  const result = lockDiscount(source, id);

  if (result.isNew) {
    state.discounts = result.map;
    saveDiscounts(state.discounts);

    // 施法特效：金色光暈 + 符文環 + 火花（動畫結束後移除，下次翻牌不再重播）
    card.classList.add('is-casting');
    setTimeout(function () { card.classList.remove('is-casting'); }, 1500);
  }
  applyDealToCard(card, course, result.discount);
}

/**
 * 將折扣結果寫進卡片 DOM
 * ※ 只更新「背面」：正面永遠維持定價與「翻牌有驚喜」，驚喜感留到翻開才揭曉。
 */
function applyDealToCard(card, course, discount) {
  const d = normalizeDiscount(discount);
  if (d >= 100) return;

  const finalPrice = applyDiscount(course.price, d);

  // 背面：折扣說明列
  const dealLine = card.querySelector('.deal-line');
  if (dealLine) {
    dealLine.classList.remove('is-hidden');
    dealLine.querySelector('.deal-badge').textContent = d + ' 折';
    dealLine.querySelector('.deal-text').textContent = discountText(d);
  }

  // 背面：原價刪除線 → 折後新價格
  const dealPrice = card.querySelector('.deal-price');
  if (dealPrice) {
    dealPrice.classList.remove('is-hidden');
    dealPrice.querySelector('s').textContent = formatCurrency(course.price);
    dealPrice.querySelector('b').textContent = formatCurrency(finalPrice);
  }

  // 背面：加入課程按鈕的金額
  const btnPrice = card.querySelector('.add-btn .btn-price');
  if (btnPrice) btnPrice.textContent = formatCurrency(finalPrice);
}

/** 渲染課程網格 */
function renderCourses() {
  const list = getVisibleCourses();

  el.courseGrid.setAttribute('aria-busy', 'false');
  el.countChip.textContent = '共 ' + list.length + ' 門課程';

  if (list.length === 0) {
    el.courseGrid.innerHTML = '';
    el.emptyState.hidden = false;
    return;
  }
  el.emptyState.hidden = true;
  el.courseGrid.innerHTML = list.map(courseCardHtml).join('');
}

/** 渲染選課車 */
function renderCart() {
  const totals = cartTotals(state.cart);

  // 徽章數字（含彈跳動畫）
  [el.cartBadge, el.fabBadge].forEach(function (node) {
    if (node.textContent !== String(totals.qty)) {
      node.textContent = totals.qty;
      node.classList.remove('is-bump');
      void node.offsetWidth;          // 強制重繪以重播動畫
      node.classList.add('is-bump');
    }
  });

  if (state.cart.length === 0) {
    el.cartBody.innerHTML = '';
    el.cartEmpty.hidden = false;
    el.cartSummary.hidden = true;
    return;
  }
  el.cartEmpty.hidden = true;
  el.cartSummary.hidden = false;

  el.cartBody.innerHTML = state.cart.map(function (item) {
    const img = item.imageUrl ? escapeHtml(item.imageUrl) : placeholderSvg(item.name);
    const atMax = toNumber(item.remaining) > 0 && item.qty >= toNumber(item.remaining);
    const d = normalizeDiscount(item.discount);
    const base = toNumber(item.basePrice === undefined ? item.price : item.basePrice);
    return '' +
    '<div class="cart-item" data-id="' + escapeHtml(item.id) + '">' +
      '<img class="ci-thumb" src="' + img + '" alt="" onerror="JustinAI.onImgError(this)" data-title="' + escapeHtml(item.name) + '" />' +
      '<div class="ci-main">' +
        '<div class="ci-name">' + escapeHtml(item.name) +
          (d < 100 ? '<span class="ci-deal">' + d + ' 折</span>' : '') +
        '</div>' +
        '<div class="ci-row">' +
          '<span class="ci-unit">' +
            (d < 100 ? '<s>' + formatCurrency(base) + '</s> ' : '') +
            formatCurrency(item.price) + ' × ' + item.qty +
          '</span>' +
          '<span class="ci-sub">' + formatCurrency(item.price * item.qty) + '</span>' +
        '</div>' +
        '<div class="ci-row">' +
          '<span class="qty">' +
            '<button type="button" data-action="dec" aria-label="減少數量">−</button>' +
            '<span class="qty-num">' + item.qty + '</span>' +
            '<button type="button" data-action="inc" aria-label="增加數量"' + (atMax ? ' disabled title="已達剩餘名額上限"' : '') + '>＋</button>' +
          '</span>' +
          '<button type="button" class="ci-del" data-action="remove" aria-label="移除此課程">' +
            '<svg viewBox="0 0 24 24" class="ico"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  el.sumCount.textContent = totals.count + ' 門';
  el.sumQty.textContent   = totals.qty + ' 堂';
  el.sumTotal.textContent = formatCurrency(totals.total);

  // 金額變動的閃動回饋
  el.sumTotal.classList.remove('is-flash');
  void el.sumTotal.offsetWidth;
  el.sumTotal.classList.add('is-flash');
}

/** 一次重繪整個畫面 */
function renderAll() {
  renderCategories();
  renderCourses();
  renderCart();
}


/* ============================================================================
   ⑦ 互動與事件
============================================================================ */

/* ------------------------------ 提示元件 -------------------------------- */

const TOAST_ICONS = {
  success: '<svg viewBox="0 0 24 24" class="ico"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
  error:   '<svg viewBox="0 0 24 24" class="ico"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></svg>',
  warn:    '<svg viewBox="0 0 24 24" class="ico"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  info:    '<svg viewBox="0 0 24 24" class="ico"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
};

/** 浮動提示（3.5 秒自動消失） */
function showToast(message, type) {
  const kind = type || 'info';
  const node = document.createElement('div');
  node.className = 'toast toast--' + kind;
  node.innerHTML = (TOAST_ICONS[kind] || TOAST_ICONS.info) + '<span>' + escapeHtml(message) + '</span>';
  el.toastStack.appendChild(node);

  setTimeout(function () {
    node.classList.add('is-out');
    setTimeout(function () { node.remove(); }, 320);
  }, 3500);
}

/** 全螢幕墨滴載入遮罩 */
function setBusy(isBusy, text) {
  state.busy = isBusy;
  el.busyText.textContent = text || '處理中，請稍候…';
  el.busyOverlay.hidden = !isBusy;
}

/** 成功提示框 */
function showSuccessModal(opts) {
  const o = opts || {};
  el.successTitle.textContent = o.title || '操作成功！';
  el.successDesc.textContent  = o.desc  || '';
  if (o.orderId) {
    el.orderIdText.textContent = o.orderId;
    el.orderSlip.hidden = false;
  } else {
    el.orderSlip.hidden = true;
  }
  el.successModal.hidden = false;
}

function closeSuccessModal() { el.successModal.hidden = true; }

/**
 * 二次確認對話框（回傳 Promise<boolean>）
 * @param {string} subject 對象名稱（課程名稱或訂單編號）
 * @param {Object} [options] { title, desc, okText } 未提供時採「刪除課程」的預設文案
 */
function showConfirm(subject, options) {
  const o = options || {};
  el.confirmTitle.textContent = o.title || '確認刪除課程？';
  el.confirmDesc.textContent = o.desc ||
    ('即將刪除「' + subject + '」。此操作會同步刪除 Google 試算表中的資料，且無法復原。');
  el.confirmOk.textContent = o.okText || '確認刪除';
  el.confirmModal.hidden = false;

  return new Promise(function (resolve) {
    const done = function (result) {
      el.confirmModal.hidden = true;
      el.confirmOk.removeEventListener('click', onOk);
      el.confirmCancel.removeEventListener('click', onCancel);
      el.confirmModal.querySelector('.modal-mask').removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk = function () { done(true); };
    const onCancel = function () { done(false); };

    el.confirmOk.addEventListener('click', onOk);
    el.confirmCancel.addEventListener('click', onCancel);
    el.confirmModal.querySelector('.modal-mask').addEventListener('click', onCancel);
  });
}

/** 離線提示列 */
function showOfflineBar(text) {
  el.offlineText.textContent = text;
  el.offlineBar.hidden = false;
}
function hideOfflineBar() { el.offlineBar.hidden = true; }

/** 欄位錯誤提示（紅框 + 震動 + 聚焦） */
function markFieldError(input) {
  if (!input) return;
  const wrapper = input.closest('.field');
  if (!wrapper) return;
  wrapper.classList.remove('has-error');
  void wrapper.offsetWidth;
  wrapper.classList.add('has-error');
  input.focus();
  setTimeout(function () { wrapper.classList.remove('has-error'); }, 1600);
}

/* --------------------------- 圖片錯誤處理 ------------------------------- */

/**
 * 圖片載入失敗時改用內聯 SVG（於 HTML 的 onerror 屬性呼叫）
 * ※ 立即移除 onerror，避免替代圖再次失敗造成無窮迴圈。
 */
function onImgError(img) {
  img.onerror = null;
  img.src = placeholderSvg(img.getAttribute('data-title') || 'AI 課程');
}

/* ------------------------------ 業務流程 -------------------------------- */

/** 加入課程 */
function handleAddToCart(courseId, buttonEl) {
  const course = state.courses.find(function (c) { return c.id === courseId; });
  if (!course) return;

  if (course.remaining <= 0) {
    showToast('這門課程名額已滿，請選擇其他課程。', 'warn');
    return;
  }
  const before = state.cart.find(function (i) { return i.id === courseId; });
  if (before && before.qty >= course.remaining) {
    showToast('「' + course.name + '」僅剩 ' + course.remaining + ' 個名額。', 'warn');
    return;
  }

  /* --------------------------------------------------------------------
     折扣以「加入購物車的當下」為準：
     卡片是靠 CSS :hover 翻牌，但 JS 的 mouseover 不一定同步觸發
     （例如頁面捲動讓卡片移到靜止的游標下、鍵盤操作、程式捲動），
     若此時尚未抽籤就加入購物車，就會用到未折扣的價格。
     因此這裡再保險一次：還沒抽過就立刻抽並鎖定，之後永遠沿用同一折數。
  -------------------------------------------------------------------- */
  const card = el.courseGrid.querySelector('.course-card[data-id="' + cssEscape(courseId) + '"]');
  if (getDiscount(courseId) >= 100) {          // 未抽籤、或存到損毀值（含 100）都重抽
    const map = Object.assign({}, state.discounts);
    delete map[courseId];
    const locked = lockDiscount(map, courseId);
    state.discounts = locked.map;
    saveDiscounts(state.discounts);
    if (card) applyDealToCard(card, course, locked.discount);
  }

  // 帶入翻牌鎖定的折數，購物車與訂單一律以折後價計算
  const discount = getDiscount(courseId);
  state.cart = cartAdd(state.cart, Object.assign({}, course, { discount: discount }));
  renderCart();

  // 按鈕短暫回饋
  if (buttonEl) {
    const original = buttonEl.textContent;
    buttonEl.classList.add('is-added');
    buttonEl.textContent = '已加入選課車 ✓';
    setTimeout(function () {
      buttonEl.classList.remove('is-added');
      buttonEl.textContent = original;
    }, 1000);
  }
  showToast(discount < 100
    ? '已將「' + course.name + '」以 ' + discount + ' 折加入選課車。'
    : '已將「' + course.name + '」加入選課車。', 'success');
}

/** 調整數量 */
function handleQtyChange(courseId, delta) {
  const result = cartChangeQty(state.cart, courseId, delta);

  if (result.capped) {
    const item = state.cart.find(function (i) { return i.id === courseId; });
    showToast('此課程僅剩 ' + (item ? item.remaining : 0) + ' 個名額。', 'warn');
    return;
  }

  if (result.removed) {
    // 先播放離場動畫，再更新資料
    const row = el.cartBody.querySelector('.cart-item[data-id="' + cssEscape(courseId) + '"]');
    if (row) {
      row.classList.add('is-leaving');
      setTimeout(function () { state.cart = result.items; renderCart(); }, 300);
      return;
    }
  }
  state.cart = result.items;
  renderCart();
}

/** 移除課程 */
function handleRemove(courseId) {
  const row = el.cartBody.querySelector('.cart-item[data-id="' + cssEscape(courseId) + '"]');
  const apply = function () { state.cart = cartRemove(state.cart, courseId); renderCart(); };
  if (row) {
    row.classList.add('is-leaving');
    setTimeout(apply, 300);
  } else {
    apply();
  }
}

/**
 * 套用名額異動
 * @param {Array|null} serverSeats 後端回傳的 [{id, remaining, status}]（order 為 updatedSeats、return 為 restoredSeats）
 * @param {Array} items            前端項目 [{id, qty}]，作為後端未回傳時的備援計算依據
 * @param {number} direction       -1＝下單扣除、+1＝退貨回補
 */
function applySeatUpdates(serverSeats, items, direction) {
  // ① 後端已回傳精確名額 → 直接採用（單一真實來源）
  if (Array.isArray(serverSeats) && serverSeats.length > 0) {
    serverSeats.forEach(function (seat) {
      const course = state.courses.find(function (c) { return c.id === seat.id; });
      if (!course) return;
      course.remaining = Math.max(0, Math.min(COURSE_CAPACITY, toNumber(seat.remaining)));
      course.status = (seat.status === undefined || seat.status === null || seat.status === '')
        ? String(course.remaining)
        : seat.status;
    });
    return;
  }

  // ② 後端未回傳 → 本地樂觀更新，下一次 read 會校正
  (items || []).forEach(function (item) {
    const course = state.courses.find(function (c) { return c.id === item.id; });
    if (!course) return;
    const next = course.remaining + (direction * toNumber(item.qty));
    course.remaining = Math.max(0, Math.min(COURSE_CAPACITY, next));
    course.status = String(course.remaining);
  });
}

/**
 * 送單前對帳：以目前鎖定的折數與課程定價重算購物車每一列。
 * 這是最後一道防線 ─ 確保「送出的金額」永遠等於「畫面顯示的金額」。
 * @returns {boolean} 是否有任何項目被修正
 */
function syncCartPricing() {
  let changed = false;

  state.cart = state.cart.map(function (item) {
    const course = state.courses.find(function (c) { return c.id === item.id; });
    const basePrice = course ? toNumber(course.price) : toNumber(item.basePrice === undefined ? item.price : item.basePrice);
    const discount = getDiscount(item.id);
    const price = applyDiscount(basePrice, discount);

    if (item.discount !== discount || item.price !== price || item.basePrice !== basePrice) {
      changed = true;
      return Object.assign({}, item, { basePrice: basePrice, discount: discount, price: price });
    }
    return item;
  });

  if (changed) renderCart();
  return changed;
}

/** 送出訂單（action: 'order'） */
async function handleSubmitOrder() {
  const name = el.customerName.value;
  syncCartPricing();   // 先對帳，再驗證與送出
  const check = validateOrder(name, state.cart);

  if (!check.ok) {
    showToast(check.message, 'warn');
    if (check.field === 'customerName') markFieldError(el.customerName);
    if (check.field === 'cart') openCartDrawer();
    return;
  }

  const payload = buildOrderPayload(name, state.cart);

  el.submitOrderBtn.classList.add('is-loading');
  setBusy(true, '正在為你保留座位…');

  const res = await sendAction(payload);

  setBusy(false);
  el.submitOrderBtn.classList.remove('is-loading');

  if (!res.ok) {
    showToast('送出失敗：' + res.message, 'error');
    return;   // 保留購物車內容，方便重試
  }

  /* 折扣對帳：比對「送出的折數」與「後端實際套用的折數」
     不一致代表後端版本過舊或未套用折扣 → 明確示警，避免默默以定價成交 */
  const serverItems = res.data && res.data.items;
  if (Array.isArray(serverItems)) {
    const mismatched = serverItems.filter(function (si) {
      const sent = payload.items.find(function (i) { return i.id === si.id; });
      return sent && normalizeDiscount(si.discount) !== normalizeDiscount(sent.discount);
    });
    if (mismatched.length > 0) {
      showToast('注意：後端未套用翻牌折扣（' + mismatched.length + ' 門課以定價寫入），請重新部署最新的 Code.gs。', 'error');
      console.warn('折扣未被後端套用：', mismatched);
    }
  }

  // 名額更新：優先採用後端回傳的 updatedSeats（單一真實來源），否則本地樂觀扣除
  applySeatUpdates(res.data && res.data.updatedSeats, payload.items, -1);

  const orderId = res.data && (res.data.orderId || res.data.orderID || res.data.id);
  state.cart = [];
  el.customerName.value = '';
  renderCourses();
  renderCart();
  closeCartDrawer();

  showSuccessModal({
    title: '報名成功！',
    desc: state.offline
      ? '（離線展示模式）已模擬送出，串接 API_URL 後將實際寫入 orders 工作表。'
      : '共 ' + payload.items.length + ' 門課程、總金額 ' + formatCurrency(payload.totalPrice) + '，我們會盡快與你聯繫。',
    orderId: orderId || ''
  });

  // 非離線模式時，靜默重新載入以取得後端最新名額
  if (!state.offline) loadCourses({ silent: true });
}

/** 新增課程（action: 'add'） */
async function handleAddCourse(event) {
  event.preventDefault();

  const form = {
    name: el.fName.value,
    category: el.fCategory.value,
    description: el.fDesc.value,
    price: el.fPrice.value,
    imageUrl: el.fImage.value,
    seats: el.fSeats.value        // 管理員選擇的開課名額
  };

  const check = validateCourseForm(form);
  if (!check.ok) {
    showToast(check.message, 'warn');
    const map = { name: el.fName, category: el.fCategory, price: el.fPrice, description: el.fDesc, seats: el.fSeats };
    markFieldError(map[check.field]);
    return;
  }

  const payload = buildAddPayload(form);

  el.addCourseBtn.classList.add('is-loading');
  setBusy(true, '正在寫入課程資料…');

  const res = await sendAction(payload);

  setBusy(false);
  el.addCourseBtn.classList.remove('is-loading');

  if (!res.ok) {
    showToast('新增失敗：' + res.message, 'error');
    return;
  }

  el.courseForm.reset();

  if (state.offline) {
    // 離線模式：直接把新課程加入本地清單，讓流程可完整體驗
    state.courses = state.courses.concat([normalizeCourse(res.data || payload, state.courses.length)]);
    renderAll();
    highlightNewCard(state.courses[state.courses.length - 1].id);
  } else {
    await loadCourses({ silent: true });
    if (res.data && res.data.id) highlightNewCard(res.data.id);
  }

  showSuccessModal({
    title: '課程新增成功！',
    desc: '「' + payload.name + '」已加入課程牌組，開課名額 ' + payload.seats + ' 人。'
  });
}

/* ------------------------------ 退貨流程 -------------------------------- */

/**
 * 載入 orders 工作表，填入退貨欄位的 datalist，讓管理員可直接挑選訂單編號。
 * 讀取失敗時不影響退貨功能（仍可手動輸入訂單編號）。
 */
async function loadOrdersForRefund() {
  if (state.offline || !API_URL) {
    el.orderList.innerHTML = '';
    return;
  }
  const res = await apiGet(ACTIONS.READ, { sheet: SHEET_ORDERS });
  if (!res.ok || !Array.isArray(res.data)) return;

  // 只取最近 50 筆，由新到舊
  const rows = res.data.slice(-50).reverse();
  let returnedCount = 0;

  el.orderList.innerHTML = rows.map(function (row) {
    const lower = {};
    Object.keys(row).forEach(function (k) { lower[String(k).trim().toLowerCase()] = row[k]; });

    const id = String(lower['orderid'] || '').trim();
    if (!id) return '';

    // 已退貨的訂單不再列入清單，避免重複退貨
    const flag = String(lower['status'] || '').trim();
    if (/(已退貨|退貨完成|已取消|作廢)/.test(flag)) { returnedCount++; return ''; }

    const who = String(lower['customername'] || '').trim();
    const amount = toNumber(lower['totalprice']);
    const label = who + '　' + formatCurrency(amount) + (flag ? '　' + flag : '');

    return '<option value="' + escapeHtml(id) + '">' + escapeHtml(label) + '</option>';
  }).join('');

  const available = el.orderList.children.length;
  el.returnOrderId.placeholder = available > 0
    ? '可退貨訂單 ' + available + ' 筆（點此下拉選擇）'
    : '目前沒有可退貨的訂單';
  if (returnedCount > 0) {
    console.info('已排除 ' + returnedCount + ' 筆已退貨訂單。');
  }
}

/** 送出退貨（action: 'return'）；後端依訂單明細把名額加回 menu */
async function handleReturnOrder() {
  const orderId = el.returnOrderId.value.trim();

  if (orderId === '') {
    showToast('請輸入或選擇要退貨的訂單編號。', 'warn');
    markFieldError(el.returnOrderId);
    return;
  }

  const confirmed = await showConfirm('訂單 ' + orderId, {
    title: '確認辦理退貨？',
    desc: '將依訂單「' + orderId + '」的課程明細把名額加回試算表，並把該筆訂單標記為已退貨。',
    okText: '確認退貨'
  });
  if (!confirmed) return;

  el.returnBtn.classList.add('is-loading');
  setBusy(true, '正在辦理退貨並回補名額…');

  const res = await sendAction(buildReturnPayload(orderId));

  setBusy(false);
  el.returnBtn.classList.remove('is-loading');

  if (!res.ok) {
    showToast('退貨失敗：' + res.message, 'error');
    return;
  }

  const restored = res.data && res.data.restoredSeats;
  applySeatUpdates(restored, [], 1);
  renderCourses();
  el.returnOrderId.value = '';

  const detail = Array.isArray(restored) && restored.length > 0
    ? restored.map(function (s) { return s.id + '（回補後 ' + s.remaining + ' 名）'; }).join('、')
    : '';

  showSuccessModal({
    title: '退貨完成！',
    desc: state.offline
      ? '（離線展示模式）已模擬退貨；串接 API_URL 後才會實際回補試算表名額。'
      : '訂單 ' + orderId + ' 已退貨，名額已回補：' + (detail || '（後端未回傳明細）'),
    orderId: orderId
  });

  if (!state.offline) {
    await loadCourses({ silent: true });
    loadOrdersForRefund();
  }
}

/** 讓新卡片以高亮動畫呈現並捲動到可視範圍 */
function highlightNewCard(id) {
  const card = el.courseGrid.querySelector('.course-card[data-id="' + cssEscape(id) + '"]');
  if (!card) return;
  card.classList.add('is-new');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(function () { card.classList.remove('is-new'); }, 4600);
}

/** 刪除課程（action: 'delete'） */
async function handleDeleteCourse(courseId) {
  const course = state.courses.find(function (c) { return c.id === courseId; });
  if (!course) return;

  const confirmed = await showConfirm(course.name);
  if (!confirmed) return;

  setBusy(true, '正在刪除課程資料…');
  const res = await sendAction(buildDeletePayload(courseId));
  setBusy(false);

  if (!res.ok) {
    showToast('刪除失敗：' + res.message, 'error');
    return;
  }

  // 播放碎裂動畫後再移除資料
  const card = el.courseGrid.querySelector('.course-card[data-id="' + cssEscape(courseId) + '"]');
  if (card) card.classList.add('is-removing');

  setTimeout(function () {
    state.courses = state.courses.filter(function (c) { return c.id !== courseId; });
    state.cart = cartRemove(state.cart, courseId);   // 購物車中若有此課程一併移除
    renderAll();
  }, 520);

  showToast('已刪除課程「' + course.name + '」。', 'success');
}

/** 切換管理員模式 */
function toggleAdminMode() {
  state.adminMode = !state.adminMode;

  document.body.classList.toggle('admin-on', state.adminMode);
  el.adminPanel.classList.toggle('is-open', state.adminMode);
  el.adminPanel.setAttribute('aria-hidden', String(!state.adminMode));
  el.adminToggle.setAttribute('aria-expanded', String(state.adminMode));
  el.adminToggleText.textContent = state.adminMode ? '離開管理員模式' : '切換為管理員模式';
  el.modeBadge.textContent = state.adminMode ? '管理員模式' : '顧客模式';

  if (state.adminMode) {
    showToast('已進入管理員模式：可新增課程、辦理退貨，或點擊卡片右上角刪除。', 'info');
    setTimeout(function () { el.fName.focus(); }, 420);
    loadOrdersForRefund();   // 載入訂單清單供退貨選擇（失敗不影響手動輸入）
  } else {
    showToast('已回到顧客模式。', 'info');
  }
}

/* --------------------------- 手機選課車抽屜 ------------------------------ */
function openCartDrawer() {
  el.cartCol.classList.add('is-open');
  document.body.classList.add('cart-open');   // 抽屜開啟時隱藏浮動按鈕，避免遮住送出鍵
}
function closeCartDrawer() {
  el.cartCol.classList.remove('is-open');
  document.body.classList.remove('cart-open');
}

/* ------------------------------ 小工具 ---------------------------------- */

/** 供 querySelector 使用的字串跳脫（相容舊瀏覽器） */
function cssEscape(value) {
  const s = String(value);
  return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/["\\\]]/g, '\\$&');
}

/** 防抖（搜尋輸入用） */
function debounce(fn, wait) {
  let timer = null;
  return function () {
    const args = arguments, ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
  };
}

/** 是否為「無 hover 能力」或「偏好減少動態」的裝置 → 改用點擊翻牌 */
function isTapFlipDevice() {
  return window.matchMedia('(hover: none)').matches ||
         window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ------------------------------ 事件綁定 -------------------------------- */
function bindEvents() {

  /* 管理員模式切換 */
  el.adminToggle.addEventListener('click', toggleAdminMode);

  /* 新增課程表單 */
  el.courseForm.addEventListener('submit', handleAddCourse);

  /* 退貨（名額回補） */
  el.returnBtn.addEventListener('click', handleReturnOrder);
  el.returnOrderId.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); handleReturnOrder(); }
  });

  /* 課程網格：事件委派（加入課程 / 刪除課程 / 點擊翻牌） */
  el.courseGrid.addEventListener('click', function (e) {
    const card = e.target.closest('.course-card');
    if (!card) return;
    const id = card.getAttribute('data-id');
    const actionBtn = e.target.closest('[data-action]');
    const action = actionBtn ? actionBtn.getAttribute('data-action') : '';

    if (action === 'add-to-cart') {
      // 視覺回饋一律套用在背面那顆看得見的按鈕（點擊可能來自透明命中層）
      handleAddToCart(id, card.querySelector('.add-btn'));
      return;
    }
    if (action === 'delete-course') {
      handleDeleteCourse(id);
      return;
    }

    // 觸控裝置 / 偏好減少動態：第一次點擊先翻牌，翻牌後再點底部的「加入課程」
    if (isTapFlipDevice()) {
      card.classList.toggle('is-flipped');
      if (card.classList.contains('is-flipped')) revealDeal(card);   // 翻開就揭曉折扣
    }
  });

  /* 滑鼠移入卡片＝翻牌 → 揭曉專屬折扣（每張卡只抽一次，之後鎖定） */
  el.courseGrid.addEventListener('mouseover', function (e) {
    if (isTapFlipDevice()) return;
    const card = e.target.closest('.course-card');
    if (!card) return;
    // 只在真正「進入卡片」時觸發，卡片內部移動不重複處理
    if (e.relatedTarget && card.contains(e.relatedTarget)) return;
    revealDeal(card);
  });

  /* 鍵盤操作（Tab 聚焦到卡片內的按鈕）同樣揭曉折扣，避免無滑鼠時價格未套用 */
  el.courseGrid.addEventListener('focusin', function (e) {
    const card = e.target.closest('.course-card');
    if (card) revealDeal(card);
  });

  /* 點擊卡片以外的地方，收起所有以點擊翻開的卡片 */
  document.addEventListener('click', function (e) {
    if (e.target.closest('.course-card')) return;
    el.courseGrid.querySelectorAll('.course-card.is-flipped')
      .forEach(function (c) { c.classList.remove('is-flipped'); });
  });

  /* 分類篩選 */
  el.categoryBar.addEventListener('click', function (e) {
    const chip = e.target.closest('.cat-chip');
    if (!chip) return;
    state.activeCategory = chip.getAttribute('data-cat');
    renderCategories();
    renderCourses();
  });

  /* 搜尋（防抖 220ms） */
  el.searchInput.addEventListener('input', debounce(function (e) {
    state.keyword = e.target.value || '';
    renderCourses();
  }, 220));

  /* 選課車：事件委派（＋ / − / 移除） */
  el.cartBody.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const row = e.target.closest('.cart-item');
    if (!row) return;
    const id = row.getAttribute('data-id');
    const action = btn.getAttribute('data-action');

    if (action === 'inc')    handleQtyChange(id, 1);
    if (action === 'dec')    handleQtyChange(id, -1);
    if (action === 'remove') handleRemove(id);
  });

  /* 送出訂單 */
  el.submitOrderBtn.addEventListener('click', handleSubmitOrder);
  el.customerName.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') handleSubmitOrder();
  });

  /* 手機抽屜 */
  el.cartFab.addEventListener('click', openCartDrawer);
  el.cartClose.addEventListener('click', closeCartDrawer);

  /* 成功提示框關閉 */
  el.successModal.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeSuccessModal();
  });

  /* ESC 關閉所有彈窗 */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeSuccessModal();
    closeCartDrawer();
    if (!el.confirmModal.hidden) el.confirmCancel.click();
  });
}


/* ============================================================================
   ⑧ 啟動
============================================================================ */
function cacheDom() {
  [
    'adminToggle','adminToggleText','adminPanel','modeBadge','courseForm','addCourseBtn',
    'fName','fCategory','fPrice','fImage','fDesc','fSeats','categoryList',
    'returnOrderId','returnBtn','orderList',
    'courseGrid','emptyState','countChip','categoryBar','searchInput',
    'offlineBar','offlineText',
    'cartCol','cartBody','cartEmpty','cartSummary','cartBadge','cartClose','cartFab','fabBadge',
    'sumCount','sumQty','sumTotal','customerName','submitOrderBtn',
    'busyOverlay','busyText','toastStack','appVersion',
    'successModal','successTitle','successDesc','orderSlip','orderIdText',
    'confirmModal','confirmTitle','confirmDesc','confirmOk','confirmCancel'
  ].forEach(function (id) { el[id] = $(id); });
}

function init() {
  // 測試頁（tests.html）沒有完整版面，僅載入純函式即可，不啟動 UI
  if (!$('courseGrid')) {
    console.info('未偵測到主畫面元素，已略過 UI 啟動（單元測試模式）。');
    return;
  }
  cacheDom();
  state.discounts = loadDiscounts();   // 還原先前翻牌鎖定的折數
  bindEvents();
  loadCourses();

  // 版本號顯示於頁尾與主控台，方便確認瀏覽器載入的是不是最新檔案
  if (el.appVersion) el.appVersion.textContent = APP_VERSION;
  console.log('%c 賈斯汀 AI 課程網站已啟動 ' + APP_VERSION + ' ',
              'background:#17496f;color:#fff;padding:4px 10px;border-radius:4px;');
  if (!API_URL) {
    console.warn('尚未設定 API_URL：目前為離線展示模式。請至 main.js 最上方的「API 設定區」填入 GAS 網址。');
  }
}

/* 對外命名空間：供 HTML 的 onerror 呼叫，以及 tests.js 進行單元測試 */
window.JustinAI = {
  version: APP_VERSION,
  onImgError: onImgError,
  state: state,
  loadCourses: loadCourses,
  /** 除錯用：清掉所有已鎖定的折數，下次翻牌重新抽籤 */
  resetDiscounts: function () {
    state.discounts = {};
    saveDiscounts(state.discounts);
    renderCourses();
    showToast('已清除所有翻牌折扣，重新翻牌即可重抽。', 'info');
  },
  // ── 純函式測試出口 ──
  __test__: {
    toNumber, parseSeats, seatLabel, normalizeCourse, formatCurrency, escapeHtml,
    sanitizeImageUrl, isBlankCourseRow,
    randomDiscount, normalizeDiscount, applyDiscount, discountText, lockDiscount,
    cartAdd, cartChangeQty, cartRemove, cartTotals,
    buildOrderPayload, buildAddPayload, buildDeletePayload, buildReturnPayload,
    validateOrder, validateCourseForm, parseApiResponse, placeholderSvg,
    apiGet, apiPost, mockApi,
    constants: { API_URL, ACTIONS, COURSE_CAPACITY, LOW_SEAT_THRESHOLD }
  }
};

/* DOM 就緒後啟動 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
