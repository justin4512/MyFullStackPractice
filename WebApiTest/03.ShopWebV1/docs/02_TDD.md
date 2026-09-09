# TDD 文件 ─ 賈斯汀 AI 課程商業應用網站

> 測試驅動開發（Test Driven Development）
> 先寫測試 → 紅燈 → 實作 → 綠燈 → 重構。
> 測試執行方式：以瀏覽器開啟 `tests.html`（零安裝、無需 npm，符合本專案純靜態部署情境）。
> 版本：v1.0

---

## 1. 測試策略

| 層級 | 範圍 | 工具 | 佔比 |
| --- | --- | --- | --- |
| 單元測試 | 純函式（名額計算、金額計算、購物車 reducer、payload 組裝、驗證、跳脫） | 自製輕量 runner（`tests.js`） | 70% |
| 整合測試 | `fetch` 以 stub 取代，驗證 request/response 流程與錯誤處理 | 同上（monkey patch `window.fetch`） | 20% |
| 手動 E2E | 翻牌動畫、滑動展開、Loading 動畫、RWD、鍵盤操作 | 人工檢查表（見 BDD 驗收檢查表） | 10% |

**可測試性設計**：所有純邏輯集中於 `main.js` 的「純函式區」，並掛載於
`window.JustinAI`（`__test__` 命名空間）供測試檔取用；DOM 操作與副作用不混入純函式。

---

## 2. 單元測試案例清單

### 2.1 `parseSeats(status, capacity)` ─ 解析剩餘名額

| # | 輸入 | 期望輸出 | 說明 |
| --- | --- | --- | --- |
| T-01 | `("剩餘 15 個名額", 50)` | `15` | 取出字串中第一個整數 |
| T-02 | `("熱銷中 (剩 5 名)", 50)` | `5` | 含括號與中文仍可解析 |
| T-03 | `(12, 50)` | `12` | 數字型別直接採用 |
| T-04 | `("", 50)` | `50` | 空值視為全新課程，回傳上限 |
| T-05 | `(null, 50)` / `(undefined, 50)` | `50` | 防呆 |
| T-06 | `("已額滿", 50)` | `0` | 無數字但含「額滿／已滿」關鍵字 → 0 |
| T-07 | `("剩餘 -3 個", 50)` | `0` | 負數夾擠為 0 |
| T-08 | `("剩餘 999 個", 50)` | `50` | 超過上限夾擠為上限 |

### 2.2 `seatLabel(remaining, capacity)` ─ 名額文字與樣式等級

| # | 輸入 | 期望輸出 |
| --- | --- | --- |
| T-10 | `(42, 50)` | `{ level: 'normal', text: '還剩 42 個名額' }` |
| T-11 | `(25, 50)` | `{ level: 'normal', text: '還剩 25 個名額' }` |
| T-12 | `(24, 50)` | `{ level: 'low', text: '僅剩 24 名，欲購從速' }` |
| T-13 | `(1, 50)` | `{ level: 'low', text: '僅剩 1 名，欲購從速' }` |
| T-14 | `(0, 50)` | `{ level: 'soldout', text: '名額已滿' }` |

> 門檻常數 `LOW_SEAT_THRESHOLD = 25`（低於 25 顯示紅色警語）。

### 2.3 `normalizeCourse(raw)` ─ 試算表列 → 前端模型

| # | 情境 | 期望 |
| --- | --- | --- |
| T-20 | 完整資料列 | 欄位一對一映射，`price` 轉為 Number，附加 `remaining` |
| T-21 | `price` 為 `"NT$ 3,200"` | `price === 3200`（去除符號與千分位） |
| T-22 | 欄位大小寫不一致（`ImageUrl` / `IMAGEURL`） | 仍可正確取值 |
| T-23 | 缺少 `id` | 自動產生 `TMP-<index>` 暫時 id，不得為 `undefined` |
| T-24 | 缺少 `imageUrl` | 回傳空字串，由 UI 走 SVG 佔位圖流程 |

### 2.4 `formatCurrency(n)` ─ 金額格式化

| # | 輸入 | 期望輸出 |
| --- | --- | --- |
| T-30 | `3200` | `NT$ 3,200` |
| T-31 | `0` | `NT$ 0` |
| T-32 | `"4500"` | `NT$ 4,500` |
| T-33 | `NaN` / `null` | `NT$ 0` |

### 2.5 購物車 Reducer（不可變更新）

| # | 動作 | 期望 |
| --- | --- | --- |
| T-40 | `cartAdd([], courseA)` | 長度 1、`qty === 1` |
| T-41 | `cartAdd(cartWithA, courseA)` | 長度仍為 1、`qty === 2` |
| T-42 | `cartAdd` 回傳新陣列 | 原陣列不被修改（immutable） |
| T-43 | `cartChangeQty(cart, id, +1)` | 該項 `qty + 1` |
| T-44 | `cartChangeQty(cart, id, -1)`（qty 由 1 → 0） | 該項被移除 |
| T-45 | `cartChangeQty(cart, id, +1)` 且 `qty === remaining` | 數量不變並回傳 `capped: true` |
| T-46 | `cartRemove(cart, id)` | 僅移除指定項目 |
| T-47 | `cartTotals(cart)` | `{ count, total }` 正確；空車為 `{ count: 0, total: 0 }` |

### 2.6 Payload 組裝

| # | 函式 | 期望 |
| --- | --- | --- |
| T-50 | `buildOrderPayload('王小明', cart)` | `{ action:'order', customerName:'王小明', items:[{id,name,price,qty,subtotal}], totalPrice }` |
| T-51 | `buildOrderPayload` 姓名前後空白 | 自動 `trim()` |
| T-52 | `buildAddPayload(form)` | `{ action:'add', name, category, description, price:Number, imageUrl }` |
| T-53 | `buildDeletePayload('AI-101')` | `{ action:'delete', id:'AI-101' }` |

### 2.7 驗證函式

| # | 情境 | 期望 |
| --- | --- | --- |
| T-60 | `validateOrder('', cart)` | `{ ok:false, field:'customerName' }` |
| T-61 | `validateOrder('王小明', [])` | `{ ok:false, field:'cart' }` |
| T-62 | `validateOrder('王小明', cart)` | `{ ok:true }` |
| T-63 | `validateCourseForm({ name:'', ... })` | `ok:false`，訊息指出「課程名稱」 |
| T-64 | `validateCourseForm({ price:'-5', ... })` | `ok:false`，訊息指出價格需為 0 以上數字 |
| T-65 | `validateCourseForm(完整合法)` | `ok:true` |

### 2.8 安全性

| # | 輸入 | 期望 |
| --- | --- | --- |
| T-70 | `escapeHtml('<img src=x onerror=alert(1)>')` | 角括號被轉義，不含可執行標籤 |
| T-71 | `escapeHtml('AT&T "AI" 課程')` | `&amp;`、`&quot;` 正確轉義 |

### 2.9 API 回應解析

| # | 輸入 | 期望 |
| --- | --- | --- |
| T-80 | `{ status:'success', data:[...] }` | `{ ok:true, data:[...] }` |
| T-81 | `{ status:'error', message:'不支援的 action' }` | `{ ok:false, message:'不支援的 action' }` |
| T-82 | `null` / 非物件 | `{ ok:false }` 且不得拋出例外 |

---

## 3. 整合測試案例（stub fetch）

| # | 情境 | 期望 |
| --- | --- | --- |
| I-01 | `API_URL` 為空 | `loadCourses()` 不發請求，直接進入離線示範資料模式 |
| I-02 | `fetch` reject（模擬斷網） | 捕捉例外，回傳 `{ ok:false }`，不得有 unhandled rejection |
| I-03 | POST 請求格式 | `method === 'POST'`、body 為 JSON 字串、**不得**帶自訂 header（避免 CORS preflight） |
| I-04 | 送單成功 | 購物車被清空、成功提示框被開啟 |
| I-05 | 送單失敗 | 購物車內容保留、錯誤提示框被開啟 |

---

## 4. 開發節奏（漸進式 / Red-Green-Refactor）

| 迭代 | 內容 | 對應測試 |
| --- | --- | --- |
| Iteration 1 | 純函式骨架（名額、金額、跳脫） | T-01 ~ T-33, T-70 ~ T-71 |
| Iteration 2 | 購物車 reducer 與 payload | T-40 ~ T-53 |
| Iteration 3 | 驗證與 API 解析 | T-60 ~ T-82 |
| Iteration 4 | 資料串接與 Loading 狀態機 | I-01 ~ I-05 |
| Iteration 5 | 視覺層：桌遊翻牌卡、背景動畫、提示框 | 手動 E2E 檢查表 |
| Iteration 6 | 管理員模式（新增／刪除） | BDD Feature 6 |

## 5. 執行方式

```bash
# 於專案資料夾直接以瀏覽器開啟即可（或使用任一靜態伺服器）
start tests.html
```

測試頁會顯示每個案例的 ✔ / ✘ 與失敗差異，並於頁面頂端顯示總計。
