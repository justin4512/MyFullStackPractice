/**
 * ============================================================================
 * 賈斯汀 AI 課程商業應用網站 ─ Google Apps Script Web API
 * ----------------------------------------------------------------------------
 * 試算表 ID : 1LZk6Teu-M4wowgpDQzox8nanY_LlzMtiEX1ENo996Bk
 * 工作表     : menu（課程主檔）、orders（訂單）
 *
 * 對應前端 main.js 的 API 設定區：
 *   GET  ?action=read            → 讀取 menu 全部課程
 *   POST { action:'order',  ... } → 建立訂單、扣除名額並回寫 menu.status
 *   POST { action:'add',    ... } → 新增課程（自動產生 id、預設 50 名額）
 *   POST { action:'delete', id }  → 依 id 刪除課程列
 *
 * 回應格式一律為：
 *   成功 { status:'success', data:..., message:'...' }
 *   失敗 { status:'error',  message:'...' }
 *
 * 部署：部署 → 新增部署 → 網頁應用程式
 *       執行身分：我　｜　具有存取權的使用者：所有人
 * ============================================================================
 */

/* ============================================================================
   ① 設定區（只要改這一段）
============================================================================ */

/** 試算表 ID */
const SPREADSHEET_ID = "1LZk6Teu-M4wowgpDQzox8nanY_LlzMtiEX1ENo996Bk";

/** 工作表名稱 */
const SHEET_MENU   = "menu";     // 課程主檔：id, name, category, description, price, imageUrl, status
const SHEET_ORDERS = "orders";   // 訂單：orderId, customerName, items, totalPrice, timestamp

/** 每堂課的開課人數上限（需與前端 main.js 的 COURSE_CAPACITY 一致） */
const COURSE_CAPACITY = 50;

/**
 * menu.status 欄位的寫回格式
 *   'number'：直接寫數字（例：50、48）← 目前試算表採用此格式
 *   'text'  ：寫成「剩餘 N 個名額」／「名額已滿」
 * ※ 兩種格式前端都能解析，改這裡即可切換。
 */
const SEAT_STATUS_FORMAT = "number";

/** orders.status 欄位使用的訂單狀態文字（用於退貨防重複） */
const ORDER_STATUS_ACTIVE   = "已成立";
const ORDER_STATUS_RETURNED = "已退貨";

/** 新增課程時自動產生的 id 前綴，例如 AI-111 */
const COURSE_ID_PREFIX = "AI-";

/** 訂單編號前綴，例如 ORD-20260909-001 */
const ORDER_ID_PREFIX = "ORD-";

/** 是否以「試算表上的價格」為準重新計算總金額（防止前端竄改價格） */
const TRUST_SERVER_PRICE = true;

/* ========================= 設定區結束（以下不需修改） ====================== */


/* ============================================================================
   ② doGet ─ 讀取資料
============================================================================ */
/**
 * HTTP GET 請求處理函式
 * 支援：?action=read（預設讀 menu，可用 &sheet=orders 指定其他工作表）
 */
function doGet(e) {
  try {
    const action = (e && e.parameter) ? e.parameter.action : null;
    const targetSheetName = (e && e.parameter && e.parameter.sheet) ? e.parameter.sheet : SHEET_MENU;

    if (action !== "read") {
      return responseError("不支援的 action：" + action);
    }

    const sheet = getSheet_(targetSheetName);
    if (!sheet) {
      return responseError("找不到指定的工作表：" + targetSheetName);
    }

    const table = readTable_(sheet);
    if (table.rows.length === 0) {
      return responseSuccess([], "工作表目前無資料");
    }

    // 轉為 JSON 物件陣列；menu 另外補上數值化的 price 與剩餘名額 seats
    // ※ 先濾掉整列皆空的殘留列（手動編輯試算表後常見），避免前端出現空白卡片
    const jsonData = table.rows.filter(function (row) {
      return row.some(function (cell) {
        return String(cell === null || cell === undefined ? "" : cell).trim() !== "";
      });
    }).map(function (row) {
      const item = {};
      table.headers.forEach(function (header, index) {
        if (header) item[String(header).trim()] = row[index];
      });

      if (targetSheetName === SHEET_MENU) {
        item.price = toNumber_(item.price);
        item.seats = parseSeats_(item.status);   // 前端亦會自行解析，此欄為方便除錯
      }
      return item;
    });

    return responseSuccess(jsonData);

  } catch (err) {
    return responseError("伺服器處理 doGet 發生錯誤：" + err.message);
  }
}


/* ============================================================================
   ③ doPost ─ 依 action 分派（order / add / delete）
============================================================================ */
/**
 * HTTP POST 請求處理函式
 * ※ 前端以 text/plain 送出 JSON 以避開 CORS 預檢，故一律用 JSON.parse 解析。
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseError("缺少請求主體 (Request Body)");
    }

    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return responseError("JSON 格式解析失敗，請確認傳入的資料是否為有效的 JSON 格式");
    }

    const action = String(body.action || "").trim().toLowerCase();

    switch (action) {
      case "order":
        return handleOrder_(body);
      case "add":
        return handleAddCourse_(body);
      case "delete":
        return handleDeleteCourse_(body);
      case "return":
      case "refund":
        return handleReturnOrder_(body);
      case "":
        // 相容舊版：未帶 action 時，沿用「依標題列通用寫入」的行為
        return handleLegacyAppend_(body);
      default:
        return responseError("不支援的 action：" + body.action);
    }

  } catch (err) {
    return responseError("伺服器處理 doPost 發生錯誤：" + err.message);
  }
}


/* ============================================================================
   ④ 業務邏輯：建立訂單（action = 'order'）
============================================================================ */
/**
 * 流程：驗證 → 鎖定 → 檢查名額 → 寫入 orders → 回寫 menu.status 扣除名額
 * @param {Object} body { action, customerName, items:[{id,name,price,qty,subtotal}], totalPrice }
 */
function handleOrder_(body) {
  const customerName = String(body.customerName || "").trim();
  // 同一門課若被拆成多筆傳入，先合併數量，避免重複扣除名額
  const items = mergeItemsById_(Array.isArray(body.items) ? body.items : []);

  /* --- 基本驗證 --- */
  if (customerName === "")  return responseError("請填寫顧客姓名");
  if (customerName.length > 30) return responseError("顧客姓名長度請勿超過 30 個字");
  if (items.length === 0)   return responseError("訂單中沒有任何課程");

  /* --- 加鎖：避免多人同時下單造成名額超賣 --- */
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockErr) {
    return responseError("系統忙碌中，請稍後再送出一次");
  }

  try {
    const menuSheet = getSheet_(SHEET_MENU);
    if (!menuSheet) return responseError("找不到工作表：" + SHEET_MENU);

    const menu = readTable_(menuSheet);
    const colIndex = buildHeaderIndex_(menu.headers);

    if (colIndex["id"] === undefined || colIndex["status"] === undefined) {
      return responseError("menu 工作表缺少必要欄位（id 或 status）");
    }

    /* --- 逐筆檢查名額與價格 --- */
    const checked = [];     // { rowNumber, id, name, price, qty, subtotal, remainingAfter }
    let totalPrice = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const id = String(item.id || "").trim();
      const qty = Math.floor(toNumber_(item.qty));

      if (id === "")  return responseError("訂單項目缺少課程 id");
      if (qty <= 0)   return responseError("課程數量必須大於 0");

      const rowPos = findRowIndexById_(menu.rows, colIndex["id"], id);
      if (rowPos === -1) return responseError("找不到課程：" + id + "（可能已被刪除）");

      const row = menu.rows[rowPos];
      const name = colIndex["name"] !== undefined ? String(row[colIndex["name"]]) : id;
      const remaining = parseSeats_(row[colIndex["status"]]);

      if (remaining <= 0) {
        return responseError("「" + name + "」名額已滿，請調整訂單");
      }
      if (qty > remaining) {
        return responseError("「" + name + "」僅剩 " + remaining + " 個名額，請調整數量");
      }

      // 定價以試算表為準（避免前端竄改），再套用前端傳來的「翻牌特價」折數
      const sheetPrice = colIndex["price"] !== undefined ? toNumber_(row[colIndex["price"]]) : 0;
      const basePrice = TRUST_SERVER_PRICE ? sheetPrice : toNumber_(item.price);
      const discount = normalizeDiscount_(item.discount);
      const price = Math.round(basePrice * discount / 100);
      const subtotal = price * qty;
      totalPrice += subtotal;

      checked.push({
        rowNumber: rowPos + 2,                 // +1 標題列、+1 轉為 1-based
        id: id,
        name: name,
        basePrice: basePrice,
        discount: discount,
        price: price,
        qty: qty,
        subtotal: subtotal,
        remainingAfter: remaining - qty
      });
    }

    /* --- 寫入 orders --- */
    const ordersSheet = getSheet_(SHEET_ORDERS);
    if (!ordersSheet) return responseError("找不到工作表：" + SHEET_ORDERS);

    const orderId = generateOrderId_(ordersSheet);
    const timestamp = new Date();

    const orderRecord = {
      orderId: orderId,
      customerName: customerName,
      items: checked.map(function (c) {
        return {
          id: c.id, name: c.name,
          basePrice: c.basePrice, discount: c.discount,   // 定價與翻牌折數（供對帳與退貨）
          price: c.price, qty: c.qty, subtotal: c.subtotal
        };
      }),
      totalPrice: totalPrice,
      timestamp: timestamp,
      status: ORDER_STATUS_ACTIVE      // orders 若有 status 欄位才會寫入（供退貨判斷）
    };

    appendByHeaders_(ordersSheet, orderRecord);

    /* --- 回寫 menu.status，扣除名額 --- */
    const statusColumn = colIndex["status"] + 1;   // 轉為 1-based 欄號
    const updatedSeats = checked.map(function (c) {
      const statusText = seatStatusText_(c.remainingAfter);
      menuSheet.getRange(c.rowNumber, statusColumn).setValue(statusText);
      return { id: c.id, remaining: c.remainingAfter, status: statusText };
    });

    SpreadsheetApp.flush();

    return responseSuccess({
      orderId: orderId,
      customerName: customerName,
      items: orderRecord.items,
      totalPrice: totalPrice,
      updatedSeats: updatedSeats
    }, "訂單建立成功");

  } finally {
    lock.releaseLock();
  }
}


/* ============================================================================
   ⑤ 業務邏輯：新增課程（action = 'add'）
============================================================================ */
/**
 * @param {Object} body { action, name, category, description, price, imageUrl, status? }
 */
function handleAddCourse_(body) {
  const name = String(body.name || "").trim();
  const category = String(body.category || "").trim();
  const description = String(body.description || "").trim();
  const imageUrl = String(body.imageUrl || "").trim();
  const price = toNumber_(body.price);

  /* --- 基本驗證 --- */
  if (name === "")        return responseError("請填寫課程名稱");
  if (category === "")    return responseError("請填寫課程分類");
  if (description === "") return responseError("請填寫課程描述");
  if (price < 0)          return responseError("課程價格需為 0 以上的數字");

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockErr) {
    return responseError("系統忙碌中，請稍後再試一次");
  }

  try {
    const sheet = getSheet_(SHEET_MENU);
    if (!sheet) return responseError("找不到工作表：" + SHEET_MENU);

    const table = readTable_(sheet);
    const colIndex = buildHeaderIndex_(table.headers);
    if (colIndex["id"] === undefined) {
      return responseError("menu 工作表缺少 id 欄位");
    }

    // 課程名稱重複檢查（避免手滑重複送出）
    if (colIndex["name"] !== undefined) {
      const duplicated = table.rows.some(function (row) {
        return String(row[colIndex["name"]]).trim() === name;
      });
      if (duplicated) return responseError("已存在同名課程：" + name);
    }

    const newCourse = {
      id: generateCourseId_(table.rows, colIndex["id"]),
      name: name,
      category: category,
      description: description,
      price: price,
      imageUrl: imageUrl,
      // 名額一律正規化為統一格式（前端可傳數字或文字，未傳則視為滿額 50）
      status: seatStatusText_(parseSeats_(body.status))
    };

    appendByHeaders_(sheet, newCourse);
    SpreadsheetApp.flush();

    return responseSuccess(newCourse, "課程新增成功");

  } finally {
    lock.releaseLock();
  }
}


/* ============================================================================
   ⑥ 業務邏輯：刪除課程（action = 'delete'）
============================================================================ */
/**
 * @param {Object} body { action, id }
 */
function handleDeleteCourse_(body) {
  const id = String(body.id || "").trim();
  if (id === "") return responseError("缺少要刪除的課程 id");

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockErr) {
    return responseError("系統忙碌中，請稍後再試一次");
  }

  try {
    const sheet = getSheet_(SHEET_MENU);
    if (!sheet) return responseError("找不到工作表：" + SHEET_MENU);

    const table = readTable_(sheet);
    const colIndex = buildHeaderIndex_(table.headers);
    if (colIndex["id"] === undefined) {
      return responseError("menu 工作表缺少 id 欄位");
    }

    const rowPos = findRowIndexById_(table.rows, colIndex["id"], id);
    if (rowPos === -1) return responseError("找不到課程：" + id);

    const deletedName = colIndex["name"] !== undefined
      ? String(table.rows[rowPos][colIndex["name"]])
      : id;

    sheet.deleteRow(rowPos + 2);   // +1 標題列、+1 轉為 1-based
    SpreadsheetApp.flush();

    return responseSuccess({ id: id, name: deletedName }, "課程刪除成功");

  } finally {
    lock.releaseLock();
  }
}


/* ============================================================================
   ⑥-2 業務邏輯：退貨並回補名額（action = 'return'）
============================================================================ */
/**
 * 依訂單編號把該筆訂單的課程名額加回 menu，並把訂單標記為「已退貨」。
 * 防重複：orders 若無 status 欄位會自動補上，已退貨的訂單不可再退。
 * @param {Object} body { action:'return', orderId:'ORD-20260909-001' }
 */
function handleReturnOrder_(body) {
  const orderId = String(body.orderId || "").trim();
  if (orderId === "") return responseError("缺少要退貨的訂單編號");

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockErr) {
    return responseError("系統忙碌中，請稍後再試一次");
  }

  try {
    /* --- 找出訂單 --- */
    const ordersSheet = getSheet_(SHEET_ORDERS);
    if (!ordersSheet) return responseError("找不到工作表：" + SHEET_ORDERS);

    const orders = readTable_(ordersSheet);
    const orderCol = buildHeaderIndex_(orders.headers);
    if (orderCol["orderid"] === undefined) {
      return responseError("orders 工作表缺少 orderId 欄位");
    }

    const orderPos = findRowIndexById_(orders.rows, orderCol["orderid"], orderId);
    if (orderPos === -1) return responseError("找不到訂單：" + orderId);

    const orderRow = orders.rows[orderPos];

    /* --- 狀態欄：沒有就自動補一欄，避免重複退貨 --- */
    let statusColIndex = orderCol["status"];
    if (statusColIndex === undefined) {
      statusColIndex = orders.headers.length;                       // 接在最後一欄之後
      ordersSheet.getRange(1, statusColIndex + 1).setValue("status");
    }

    const currentStatus = String(orderRow[statusColIndex] || "").trim();
    if (currentStatus === ORDER_STATUS_RETURNED) {
      return responseError("訂單 " + orderId + " 先前已辦理過退貨，不可重複退貨");
    }

    /* --- 解析訂單明細 --- */
    if (orderCol["items"] === undefined) {
      return responseError("orders 工作表缺少 items 欄位，無法回補名額");
    }

    let items;
    try {
      items = JSON.parse(String(orderRow[orderCol["items"]] || ""));
    } catch (parseErr) {
      items = null;
    }
    if (!Array.isArray(items) || items.length === 0) {
      return responseError("訂單 " + orderId + " 的明細格式無法解析，請人工確認 items 欄位");
    }
    items = mergeItemsById_(items);

    /* --- 逐筆回補 menu 名額 --- */
    const menuSheet = getSheet_(SHEET_MENU);
    if (!menuSheet) return responseError("找不到工作表：" + SHEET_MENU);

    const menu = readTable_(menuSheet);
    const menuCol = buildHeaderIndex_(menu.headers);
    if (menuCol["id"] === undefined || menuCol["status"] === undefined) {
      return responseError("menu 工作表缺少必要欄位（id 或 status）");
    }

    const statusColumn = menuCol["status"] + 1;
    const restoredSeats = [];
    const skipped = [];

    items.forEach(function (item) {
      const id = String(item.id || "").trim();
      const qty = Math.floor(toNumber_(item.qty));
      if (id === "" || qty <= 0) return;

      const rowPos = findRowIndexById_(menu.rows, menuCol["id"], id);
      if (rowPos === -1) {
        skipped.push(id);   // 課程可能已被刪除，記錄下來但不中斷退貨
        return;
      }

      const remaining = parseSeats_(menu.rows[rowPos][menuCol["status"]]);
      const next = Math.min(COURSE_CAPACITY, remaining + qty);
      const statusValue = seatStatusText_(next);

      menuSheet.getRange(rowPos + 2, statusColumn).setValue(statusValue);
      restoredSeats.push({ id: id, remaining: next, status: String(statusValue), restored: qty });
    });

    /* --- 標記訂單為已退貨 --- */
    ordersSheet.getRange(orderPos + 2, statusColIndex + 1).setValue(ORDER_STATUS_RETURNED);
    SpreadsheetApp.flush();

    const message = skipped.length > 0
      ? "退貨完成，但下列課程已不存在於 menu，未回補：" + skipped.join("、")
      : "退貨完成，名額已回補";

    return responseSuccess({
      orderId: orderId,
      restoredSeats: restoredSeats,
      skipped: skipped
    }, message);

  } finally {
    lock.releaseLock();
  }
}


/* ============================================================================
   ⑦ 相容舊版：未指定 action 時的通用寫入
============================================================================ */
/**
 * 保留原本「依標題列順序寫入一列」的行為，讓既有呼叫端不致失效。
 */
function handleLegacyAppend_(body) {
  const targetSheetName = body.targetSheet || SHEET_ORDERS;
  const sheet = getSheet_(targetSheetName);
  if (!sheet) return responseError("找不到寫入的工作表：" + targetSheetName);

  const lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) {
    return responseError("工作表 " + targetSheetName + " 為空，請先建立標題列");
  }

  const inserted = appendByHeaders_(sheet, body, { autoIncrementFirstIdColumn: true });
  return responseSuccess(inserted, "資料新增成功");
}


/* ============================================================================
   ⑧ 共用工具函式
============================================================================ */

/** 取得工作表（找不到回傳 null） */
function getSheet_(sheetName) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
}

/**
 * 讀取整張工作表
 * @returns {{headers:Array, rows:Array<Array>}} headers 為標題列，rows 為資料列
 */
function readTable_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length === 0) return { headers: [], rows: [] };
  return { headers: values[0], rows: values.slice(1) };
}

/**
 * 建立「小寫欄位名 → 欄位索引」對照表，讓 ImageUrl / imageurl 都能對應
 */
function buildHeaderIndex_(headers) {
  const index = {};
  headers.forEach(function (header, i) {
    const key = String(header).trim().toLowerCase();
    if (key) index[key] = i;
  });
  return index;
}

/**
 * 合併訂單中相同課程 id 的項目（數量相加），確保名額只扣一次
 * ※ 合併時必須「保留原項目的所有欄位」再覆寫 qty，
 *   否則像 discount／basePrice 這類後續才會用到的欄位會被丟掉
 *   （曾因此導致翻牌折扣失效，訂單一律以定價寫入試算表）。
 */
function mergeItemsById_(items) {
  const map = {};
  const order = [];

  items.forEach(function (item) {
    const id = String(item && item.id ? item.id : "").trim();
    if (id === "") { order.push(item); return; }   // 無 id 的異常項目原樣保留，交由後續驗證擋下

    if (map[id]) {
      map[id].qty = toNumber_(map[id].qty) + toNumber_(item.qty);
    } else {
      // 先複製整個原始項目，再正規化數量 → 不遺漏任何欄位
      const merged = {};
      Object.keys(item).forEach(function (key) { merged[key] = item[key]; });
      merged.id = id;
      merged.qty = toNumber_(item.qty);

      map[id] = merged;
      order.push(merged);
    }
  });
  return order;
}

/** 依 id 找出資料列位置（回傳 rows 陣列中的索引，找不到為 -1） */
function findRowIndexById_(rows, idColumnIndex, id) {
  const target = String(id).trim();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][idColumnIndex]).trim() === target) return i;
  }
  return -1;
}

/**
 * 依標題列順序把物件寫成新的一列
 * @param {Sheet} sheet
 * @param {Object} obj 要寫入的資料物件（key 對應標題列名稱，不分大小寫）
 * @param {Object} [options] { autoIncrementFirstIdColumn:boolean } 第一欄為 id 時自動遞增
 * @returns {Object} 實際寫入的內容
 */
function appendByHeaders_(sheet, obj, options) {
  const opts = options || {};
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  // 建立「小寫 key → 值」對照，容忍前端欄位大小寫差異
  const lowerObj = {};
  Object.keys(obj).forEach(function (key) {
    lowerObj[String(key).trim().toLowerCase()] = obj[key];
  });

  const rowData = [];
  const inserted = {};

  headers.forEach(function (header, index) {
    const fieldName = String(header).trim();
    const key = fieldName.toLowerCase();
    let value = "";

    if (opts.autoIncrementFirstIdColumn && index === 0 && key.indexOf("id") > -1 && lowerObj[key] === undefined) {
      value = nextNumericId_(sheet);
    } else if (key === "timestamp" || key === "created_at" || key === "建立時間") {
      value = lowerObj[key] || new Date();
    } else if (lowerObj[key] !== undefined && lowerObj[key] !== null) {
      // items 等物件 / 陣列欄位序列化為 JSON 字串保存
      value = (typeof lowerObj[key] === "object" && !(lowerObj[key] instanceof Date))
        ? JSON.stringify(lowerObj[key])
        : lowerObj[key];
    }

    rowData.push(value);
    inserted[fieldName] = value;
  });

  sheet.appendRow(rowData);
  return inserted;
}

/** 舊版數字流水號（相容用） */
function nextNumericId_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1;
  const parsed = parseInt(sheet.getRange(lastRow, 1).getValue(), 10);
  return isNaN(parsed) ? lastRow : parsed + 1;
}

/**
 * 產生課程 id：沿用既有 AI-101 格式，取現有最大流水號 + 1
 */
function generateCourseId_(rows, idColumnIndex) {
  let max = 100;   // 從 AI-101 開始
  rows.forEach(function (row) {
    const id = String(row[idColumnIndex]).trim();
    const matched = id.match(/(\d+)\s*$/);
    if (matched) {
      const num = parseInt(matched[1], 10);
      if (!isNaN(num) && num > max) max = num;
    }
  });
  return COURSE_ID_PREFIX + (max + 1);
}

/**
 * 產生訂單編號：ORD-YYYYMMDD-001（同一天內流水遞增）
 */
function generateOrderId_(ordersSheet) {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
  const prefix = ORDER_ID_PREFIX + today + "-";

  const lastRow = ordersSheet.getLastRow();
  let seq = 0;

  // 找出 orderId 所在的欄（不假設一定在第一欄）
  const lastColumn = ordersSheet.getLastColumn();
  const headers = ordersSheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const idColumn = (buildHeaderIndex_(headers)["orderid"] !== undefined)
    ? buildHeaderIndex_(headers)["orderid"] + 1
    : 1;

  if (lastRow > 1) {
    const ids = ordersSheet.getRange(2, idColumn, lastRow - 1, 1).getValues();
    ids.forEach(function (r) {
      const id = String(r[0]).trim();
      if (id.indexOf(prefix) === 0) {
        const num = parseInt(id.substring(prefix.length), 10);
        if (!isNaN(num) && num > seq) seq = num;
      }
    });
  }
  return prefix + ("00" + (seq + 1)).slice(-3);
}

/**
 * 解析 status 欄位中的剩餘名額（規則需與前端 main.js 的 parseSeats 一致）
 * 「剩餘 15 個名額」→ 15　｜　空白 → 50（全新課程）　｜　含「額滿」→ 0
 */
function parseSeats_(status) {
  if (typeof status === "number" && isFinite(status)) {
    return Math.max(0, Math.min(COURSE_CAPACITY, Math.floor(status)));
  }
  if (status === null || status === undefined) return COURSE_CAPACITY;

  const text = String(status).trim();
  if (text === "") return COURSE_CAPACITY;

  const matched = text.match(/-?\d+/);
  if (matched) {
    return Math.max(0, Math.min(COURSE_CAPACITY, parseInt(matched[0], 10)));
  }
  if (/(額滿|已滿|滿了|售罄|截止|關閉|停售)/.test(text)) return 0;
  return COURSE_CAPACITY;
}

/**
 * 依剩餘名額產生要寫回 menu.status 的值
 * 依 SEAT_STATUS_FORMAT 決定回傳「數字」或「剩餘 N 個名額」文字。
 */
function seatStatusText_(remaining) {
  const left = Math.max(0, Math.min(COURSE_CAPACITY, Math.floor(remaining)));
  if (SEAT_STATUS_FORMAT === "number") return left;      // 直接寫數字，例如 48
  if (left <= 0) return "名額已滿";
  return "剩餘 " + left + " 個名額";
}

/**
 * 折數正規化（需與前端 main.js 的 normalizeDiscount 一致）
 * 允許 75 ~ 99 折；其餘（含未提供）一律視為原價 100。
 */
function normalizeDiscount_(value) {
  const n = Math.round(toNumber_(value));
  if (!n || n >= 100) return 100;
  return Math.max(75, Math.min(99, n));
}

/** 安全轉數字（去除 NT$、逗號等雜訊） */
function toNumber_(value) {
  if (typeof value === "number") return isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const n = parseFloat(String(value).replace(/[^\d.-]/g, ""));
  return isNaN(n) ? 0 : n;
}


/* ============================================================================
   ⑨ 回應封裝
============================================================================ */

/**
 * 成功回應
 * @param {Object|Array} data 回傳資料
 * @param {string} [message] 可選訊息
 */
function responseSuccess(data, message) {
  const output = { status: "success", data: data };
  if (message) output.message = message;
  return ContentService
    .createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 失敗回應
 * @param {string} message 錯誤訊息
 */
function responseError(message) {
  const output = { status: "error", message: message };
  return ContentService
    .createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ============================================================================
   ⑩ 維護用工具（可在編輯器中手動執行，不會被 Web App 呼叫）
============================================================================ */

/**
 * 一鍵建立／修補兩張工作表的標題列。
 * 第一次使用或欄位被改亂時，可在 Apps Script 編輯器中手動執行此函式。
 */
function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const menuHeaders   = ["id", "name", "category", "description", "price", "imageUrl", "status"];
  // orders 的 status 欄位用於標記「已成立 / 已退貨」，退貨防重複所需
  const orderHeaders  = ["orderId", "customerName", "items", "totalPrice", "timestamp", "status"];

  [{ name: SHEET_MENU, headers: menuHeaders }, { name: SHEET_ORDERS, headers: orderHeaders }]
    .forEach(function (cfg) {
      let sheet = ss.getSheetByName(cfg.name);
      if (!sheet) sheet = ss.insertSheet(cfg.name);

      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers]);
      }
      sheet.getRange(1, 1, 1, sheet.getLastColumn() || cfg.headers.length)
           .setFontWeight("bold")
           .setBackground("#eaf4fb");
      sheet.setFrozenRows(1);
    });

  Logger.log("工作表標題列已建立／確認完成");
}

/**
 * 把所有課程名額重設為開課上限（測試或新一期開課時使用）。
 */
function resetAllSeats() {
  const sheet = getSheet_(SHEET_MENU);
  if (!sheet) throw new Error("找不到工作表：" + SHEET_MENU);

  const table = readTable_(sheet);
  const colIndex = buildHeaderIndex_(table.headers);
  if (colIndex["status"] === undefined) throw new Error("menu 缺少 status 欄位");

  const statusColumn = colIndex["status"] + 1;
  for (let i = 0; i < table.rows.length; i++) {
    sheet.getRange(i + 2, statusColumn).setValue(seatStatusText_(COURSE_CAPACITY));
  }
  Logger.log("已將 " + table.rows.length + " 門課程名額重設為 " + COURSE_CAPACITY);
}

/**
 * 本機測試：直接在編輯器執行，模擬前端的四種請求並輸出結果。
 * ※ 會實際寫入試算表，請在測試用試算表上執行。
 */
function runLocalTest() {
  Logger.log("── read ──");
  Logger.log(doGet({ parameter: { action: "read" } }).getContent());

  Logger.log("── add ──");
  const added = JSON.parse(doPost({ postData: { contents: JSON.stringify({
    action: "add", name: "測試課程（可刪除）", category: "測試分類",
    description: "由 runLocalTest 產生的測試資料", price: 1000, imageUrl: ""
  }) } }).getContent());
  Logger.log(JSON.stringify(added));

  const newId = added.data && added.data.id;

  Logger.log("── order ──");
  Logger.log(doPost({ postData: { contents: JSON.stringify({
    action: "order", customerName: "測試顧客",
    items: [{ id: newId, name: "測試課程（可刪除）", price: 1000, qty: 2, subtotal: 2000 }],
    totalPrice: 2000
  }) } }).getContent());

  Logger.log("── return（退貨回補名額）──");
  const ordered = JSON.parse(doPost({ postData: { contents: JSON.stringify({
    action: "order", customerName: "測試顧客（退貨用）",
    items: [{ id: newId, qty: 1 }], totalPrice: 1000
  }) } }).getContent());
  if (ordered.status === "success") {
    Logger.log(doPost({ postData: { contents: JSON.stringify({
      action: "return", orderId: ordered.data.orderId
    }) } }).getContent());
  }

  Logger.log("── delete ──");
  Logger.log(doPost({ postData: { contents: JSON.stringify({ action: "delete", id: newId }) } }).getContent());
}
