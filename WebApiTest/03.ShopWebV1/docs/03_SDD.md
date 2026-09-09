# SDD 文件 ─ 賈斯汀 AI 課程商業應用網站

> 軟體設計文件（Software Design Document）
> 版本：v1.0　撰寫日期：2026-09-09
> 對應原始碼：`index.html` / `style.css` / `main.js`（三檔分離）

---

## 1. 系統概觀

```
┌────────────────────────────────────────────────────────────┐
│                     瀏覽器（純靜態前端）                      │
│                                                            │
│  index.html ─ 語意化骨架 / 內聯 SVG 背景動畫層                │
│  style.css  ─ :root 設計代幣 + 桌遊卡 3D + 動畫關鍵影格        │
│  main.js    ─ API 設定區 / 純函式區 / 狀態區 / 渲染區 / 事件區  │
└──────────────────────────┬─────────────────────────────────┘
                           │ fetch（GET 讀取 / POST text-plain 寫入）
                           ▼
        ┌──────────────────────────────────────────┐
        │      Google Apps Script Web App (doGet/doPost)      │
        └──────────────────────┬───────────────────┘
                               ▼
        ┌──────────────────────────────────────────┐
        │  Google 試算表：menu 工作表 / orders 工作表  │
        └──────────────────────────────────────────┘
```

**設計原則**
1. 單向資料流：`state` → `render()` → DOM，禁止在事件處理器中直接改 DOM 文字。
2. 純函式與副作用分離，確保可測試（見 `02_TDD.md`）。
3. 所有色彩與陰影、圓角、動畫時間集中為 CSS 變數（`:root`），方便換膚。
4. 所有 API 設定集中於 `main.js` 最上方 `API 設定區`，方便維護。

---

## 2. 資料模型

### 2.1 menu 工作表（課程主檔）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `id` | String | 課程編號，例：`AI-101`（刪除／訂購以此為鍵） |
| `name` | String | 課程名稱 |
| `category` | String | 分類標記，用於卡片緞帶與篩選晶片 |
| `description` | String | 課程描述（顯示於卡片背面） |
| `price` | Number | 售價（新台幣） |
| `imageUrl` | String | 課程主視覺網址 |
| `status` | String | 名額狀態，例：`剩餘 15 個名額`；由後端於下單後更新 |

### 2.2 orders 工作表（訂單）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `orderId` | String | 訂單編號（後端產生） |
| `customerName` | String | 顧客姓名 |
| `items` | String(JSON) | 課程明細序列化字串 |
| `totalPrice` | Number | 訂單總金額 |
| `timestamp` | Date | 下單時間 |

### 2.3 前端課程模型（normalizeCourse 後）

```js
{
  id: 'AI-101',
  name: '生成式 AI 職場生產力倍增實戰',
  category: '職場應用',
  description: '……',
  price: 3200,          // Number，已去除 NT$ 與千分位
  imageUrl: 'https://…',
  status: '剩餘 15 個名額',
  remaining: 15         // 由 parseSeats() 推導，0 ≤ remaining ≤ 50
}
```

### 2.4 名額規則（重要設計決策）

- 開課人數上限 `COURSE_CAPACITY = 50`。
- `status` 欄位保存**剩餘名額**。目前試算表採「純數字」（例：`50`、`48`），
  後端 `Code.gs` 的 `SEAT_STATUS_FORMAT = 'number'` 亦以數字寫回；
  前端 `parseSeats()` 兩種格式都能解析（數字、`剩餘 15 個名額`、`熱銷中 (剩 5 名)`）：
  取字串中第一個整數；若無數字但含「額滿／已滿／截止」→ 視為 0；若為空 → 視為 50（全新課程）。
- 名額生命週期：**下單扣除 → 退貨回補**（`action:'return'`，見 §3.5），回補後不得超過 50。
- 低於門檻 `LOW_SEAT_THRESHOLD = 25` 時，改以紅色粗體顯示「僅剩 NN 名，欲購從速」。
- 下單成功後前端會**樂觀更新**（optimistic update）扣除名額並重繪；
  下一次 `read` 會以後端試算表回傳值為準（後端為單一真實來源）。
- 後端 `Code.gs` 於下單時加 `LockService` 鎖定、重新檢查名額後寫回 `menu.status`，
  格式為 `剩餘 N 個名額` / `名額已滿`，並在訂單回應中以 `updatedSeats` 回傳異動後的名額
  （見 §3.2；前端對其他寫法亦可解析）。

---

## 3. API 介面契約

`main.js` 最上方統一設定：

```js
const API_URL = '';                 // ← 貼上 GAS Web App /exec 網址
const COURSE_CAPACITY = 50;         // 每堂課開課人數
const LOW_SEAT_THRESHOLD = 25;      // 低於此值顯示紅色警語
const ACTIONS = { READ:'read', ORDER:'order', ADD:'add', DELETE:'delete' };
```

後端實作見專案根目錄的 `Code.gs`（Google Apps Script）。

### 3.1 讀取課程

```
GET  {API_URL}?action=read          （可加 &sheet=orders 讀取其他工作表）
→ {
    "status": "success",
    "data": [
      { "id":"AI-101", "name":"…", "category":"職場應用", "description":"…",
        "price":3200, "imageUrl":"https://…", "status":"剩餘 15 個名額",
        "seats":15 },
      ...
    ]
  }
```

> `seats` 為後端附贈的除錯欄位（已由 `status` 解析為數字）。
> 前端仍以自己的 `parseSeats()` 解析 `status`，**不依賴** `seats`，避免與後端耦合。

### 3.2 送出訂單

```
POST {API_URL}   Content-Type: text/plain;charset=UTF-8（避免 CORS 預檢）
{
  "action": "order",
  "customerName": "王小明",
  "items": [ { "id":"AI-101", "name":"…", "price":2528, "basePrice":3200,
               "discount":79, "qty":2, "subtotal":5056 } ],
  "totalPrice": 5056
}
→ {
    "status": "success",
    "message": "訂單建立成功",
    "data": {
      "orderId": "ORD-20260909-001",
      "customerName": "王小明",
      "items": [ { "id":"AI-101", "name":"…", "price":3200, "qty":2, "subtotal":6400 } ],
      "totalPrice": 6400,
      "updatedSeats": [
        { "id":"AI-101", "remaining":13, "status":"剩餘 13 個名額" }
      ]
    }
  }
```

**`updatedSeats` 欄位說明**

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `id` | String | 本次訂單有異動名額的課程 id |
| `remaining` | Number | 扣除後的剩餘名額（0 ~ 50，後端已夾擠） |
| `status` | String | 後端實際寫回 `menu.status` 的文字（`剩餘 N 個名額` 或 `名額已滿`） |

- 僅包含**本次訂單異動到的課程**，未下單的課程不會出現。
- 名額與 `totalPrice` 皆以**試算表為單一真實來源**重新計算：
  後端加 `LockService` 鎖定後重讀 `menu`，名額不足會直接回 `error`（不會部分成功），
  價格則以試算表的 `price` 覆算（`TRUST_SERVER_PRICE = true`），前端傳來的 `price` 僅供對帳參考。
- 同一課程被拆成多筆 `items` 傳入時，後端會先合併數量，名額只扣一次。

**前端使用方式（現況與建議）**

目前 `handleSubmitOrder()` 採**樂觀更新**：送出成功後先在本地扣除名額，再靜默 `loadCourses({silent:true})`
以後端資料校正。`updatedSeats` 讓這一步可以更精準——建議改為直接套用回應值，
省下一次 `read` 往返，也避免兩次請求之間的名額落差：

```js
// 以後端回傳的名額為準（若後端未提供則退回本地樂觀扣除）
const updated = res.data && res.data.updatedSeats;
if (Array.isArray(updated)) {
  updated.forEach(function (s) {
    const course = state.courses.find(function (c) { return c.id === s.id; });
    if (course) { course.remaining = s.remaining; course.status = s.status; }
  });
}
```

### 3.3 新增課程

```
POST {API_URL}
{ "action":"add", "name":"…", "category":"…", "description":"…",
  "price":3200, "imageUrl":"https://…", "seats":20, "status":20 }
→ {
    "status": "success",
    "message": "課程新增成功",
    "data": { "id":"AI-111", "name":"…", "category":"…", "description":"…",
              "price":3200, "imageUrl":"https://…", "status":"剩餘 50 個名額" }
  }
```

- `id` 由後端產生：沿用既有 `AI-nnn` 格式，取現有最大流水號 +1。
- `seats`＝管理員在表單選擇的**開課名額**（6 ~ 50，預設 50），會寫入 `status` 作為初始剩餘名額；
  未提供時後端以開課上限 `COURSE_CAPACITY` 產生。
- 同名課程會被擋下（回 `error`），避免重複送出。

### 3.4 刪除課程

```
POST {API_URL}
{ "action":"delete", "id":"AI-101" }
→ { "status":"success", "message":"課程刪除成功", "data": { "id":"AI-101", "name":"…" } }
```

### 3.5 退貨（名額回補）

```
POST {API_URL}
{ "action":"return", "orderId":"ORD-20260909-001" }
→ {
    "status": "success",
    "message": "退貨完成，名額已回補",
    "data": {
      "orderId": "ORD-20260909-001",
      "restoredSeats": [ { "id":"AI-101", "remaining":50, "status":"50", "restored":2 } ],
      "skipped": []
    }
  }
```

| 欄位 | 說明 |
| --- | --- |
| `restoredSeats[].restored` | 這門課回補的名額數（＝該訂單的購買數量） |
| `restoredSeats[].remaining` | 回補後的剩餘名額，上限夾擠於 `COURSE_CAPACITY` |
| `skipped` | 訂單中已從 menu 刪除、無法回補的課程 id |

- 後端讀取 `orders.items` 的 JSON 明細來回補，因此**不需要前端傳課程清單**。
- 防重複退貨：`orders.status` 標記為 `已退貨`；若該欄位不存在，後端會自動補上此欄。
- 前端以 `restoredSeats` 直接更新畫面（與 §3.2 的 `updatedSeats` 走同一支 `applySeatUpdates()`）。

### 3.6 錯誤回應（共用格式）

```
→ { "status":"error", "message":"「AI Agent 智能代理人實作工作坊」僅剩 2 個名額，請調整數量" }
```

常見 `message`：名額不足、找不到課程（已被刪除）、缺少顧客姓名、已存在同名課程、
系統忙碌中（`LockService` 逾時，可請使用者重試）。

> **CORS 注意**：一律不加自訂 header（不設 `Content-Type: application/json`），
> 由 GAS 端以 `JSON.parse(e.postData.contents)` 解析，避免瀏覽器發出 OPTIONS 預檢而失敗。

---

## 4. 前端模組設計（`main.js` 分區）

| 區塊 | 職責 | 代表函式 |
| --- | --- | --- |
| ① API 設定區 | 端點、常數、action 名稱（唯一維護點） | — |
| ② 內建示範資料 | 離線 / 未設定 API 時的降級資料 | `DEMO_COURSES` |
| ③ 純函式區 | 無副作用、可單元測試 | `parseSeats` `seatLabel` `normalizeCourse` `formatCurrency` `cartAdd` `cartChangeQty` `cartRemove` `cartTotals` `buildOrderPayload` `buildAddPayload` `buildDeletePayload` `validateOrder` `validateCourseForm` `escapeHtml` `parseApiResponse` `placeholderSvg` |
| ④ 狀態區 | 單一 `state` 物件 | `state = { courses, cart, adminMode, activeCategory, loading, offline }` |
| ⑤ 資料存取區 | `fetch` 封裝與錯誤攔截 | `apiGet` `apiPost` `loadCourses` |
| ⑥ 渲染區 | 由 state 產生 DOM | `renderCourses` `renderCart` `renderCategories` `renderSkeleton` |
| ⑦ 互動區 | 事件委派、動畫、提示框 | `bindEvents` `toggleAdmin` `showToast` `showSuccessModal` `showConfirm` `setBusy` |
| ⑧ 測試出口 | 掛載純函式供 `tests.js` 使用 | `window.JustinAI.__test__` |

### 4.1 狀態機（載入狀態）

```
idle ──loadCourses()──▶ loading ──成功──▶ ready
                          │
                          └──失敗/未設定 API──▶ offline（示範資料 + 黃色警示列）

ready ──送單/新增/刪除──▶ busy（全螢幕墨滴遮罩 + 按鈕 spinner）──▶ ready
```

### 4.2 事件委派

課程卡與購物車列採 **事件委派**（在容器上單一 listener + `data-action` 屬性），
避免每次重繪重新綁定，並確保動態新增的卡片自動具備行為。

`data-action` 一覽：`add-to-cart`｜`inc`｜`dec`｜`remove`｜`delete-course`｜`flip`。

---

## 5. 視覺設計規格

### 5.1 主題：彩墨藍・迪淺色（Ink-Wash Blue / Light Academia）

| 代幣 | 值 | 用途 |
| --- | --- | --- |
| `--ink-900` | `#0d2b45` | 主標題、深墨 |
| `--ink-700` | `#17496f` | 次標題、卡片邊框 |
| `--ink-500` | `#2f7fb8` | 主要互動色、連結 |
| `--ink-300` | `#8cc3e3` | 淺墨、分隔線 |
| `--ink-050` | `#eaf4fb` | 卡片底、選取態 |
| `--paper` | `#f4f8fc` | 頁面宣紙底色 |
| `--paper-card` | `#ffffff` | 卡片紙面 |
| `--jade` | `#2f9e8f` | 名額正常、成功狀態 |
| `--rouge` | `#d1495b` | 名額吃緊、刪除、錯誤 |
| `--gold` | `#c98a2e` | 價格、徽章重點 |
| `--plum` | `#7d5ba6` | 分類標記輔色 |

（完整代幣含圓角 `--radius-*`、陰影 `--shadow-*`、動畫時間 `--dur-*` 皆定義於 `style.css` 的 `:root`。）

### 5.2 背景動態層（`.ink-stage`，`pointer-events:none`）

| 元素 | 手法 | 時長 |
| --- | --- | --- |
| 手寫筆記線條 | SVG `stroke-dasharray/offset` 循環描繪 | 14s |
| 漂浮數學公式 | 絕對定位文字 + `translate/rotate` 微幅漂移 | 22–34s |
| 終端機指令 | 等寬字打字機（`steps()`）+ 游標閃爍 | 8s 循環 |
| 紙飛機 | SVG 沿貝茲路徑位移 + 輕微擺動 | 26s |
| 墨暈光斑 | 徑向漸層 `blur` 呼吸 | 18s |

所有動態於 `@media (prefers-reduced-motion: reduce)` 下停用。

### 5.3 桌遊風格課程卡

- 尺寸比例接近實體卡牌（約 5:7），外框雙線 + 四角裝飾紋。
- 3D 翻牌：外層 `perspective: 1400px`，內層 `transform-style: preserve-3d`，
  `hover` 時 `rotateY(180deg)`；背面 `backface-visibility: hidden` + 預先 `rotateY(180deg)`。
- 觸控裝置（`@media (hover:none)`）改為點擊切換 `.is-flipped`。
- 刪除按鈕置於「翻轉容器外層」，確保正／反面皆可點擊。
- **命中測試補償**：背面按鈕位於 `preserve-3d` 子樹內，部分瀏覽器不會把點擊送進去
  （表現為「翻牌後按不到加入課程」）。因此在翻轉容器外層再放一個透明按鈕
  `.card-hit`（`data-action="add-to-cart"`、`opacity:0`），以百分比定位覆蓋背面下半部；
  平時 `pointer-events:none`，僅在 `:hover` 或 `.is-flipped` 時啟用。
  正面顯示時完全不影響操作，且不會發生「點卡片任一處就加入」的誤觸。

### 5.3.0 翻牌魔法特效（金色施法）

特效層 `.card-magic` 與 `.card-hit`、刪除鈕同樣位於 3D 翻轉容器之外，
因此火花可以飛出卡片邊界，且不受 `overflow:hidden` 與 3D 命中測試影響。

| 元素 | 效果 | 觸發時機 |
| --- | --- | --- |
| `.card-magic::before` | 金色光流斜掃過卡面（`mix-blend-mode: screen`），使卡片瞬間泛淡金色 | 每次翻牌 |
| `.magic-glow` | 沿卡片外緣暈開的金色靈光（三層 box-shadow） | 每次翻牌 |
| `.magic-ring` | 虛線符文魔法陣，邊旋轉邊擴散消失 | **僅第一次翻牌**（抽出折扣時） |
| `.spk` × 8 | 八角星火花朝八個方向噴射（各有 `--tx/--ty/--sd`） | **僅第一次翻牌** |

第一次翻牌時 JS 加上 `.is-casting`（1.5 秒後移除），區隔「每次翻牌的金色光流」
與「首次抽獎的魔法陣爆發」，避免重複翻牌時特效疲勞。

### 5.3.1 翻牌特價（隨機折扣）

| 項目 | 設計 |
| --- | --- |
| 折數範圍 | `DISCOUNT_MIN = 75` ~ `DISCOUNT_MAX = 99`（整數，75 折最優惠） |
| 抽籤時機 | 卡片**第一次**翻到背面（hover 或點擊翻牌）時 |
| 揭露位置 | **僅背面**：折數徽章、「本次課程可打 NN 折」、`定價 → 折後價`、按鈕金額。<br>正面永遠維持「定價 + 翻牌有驚喜」，以保留開牌的驚喜感 |
| 鎖定機制 | `lockDiscount(map, id)` 純函式；已存在則直接沿用，回傳 `isNew` 供特效判斷 |
| 保存 | `localStorage['justin-ai-course-discounts']`，讀寫皆包 try/catch（隱私模式退回僅本次瀏覽有效） |
| 計價 | `applyDiscount(price, discount) = Math.round(定價 × 折數 / 100)` |
| 傳遞 | 購物車項目保存 `basePrice`／`discount`／`price`（折後）；訂單 payload 一併送出 `discount` |
| 後端合併 | `mergeItemsById_()` 合併重複課程時**必須保留原項目的所有欄位**再覆寫 `qty`；<br>若重建成 `{id,name,price,qty}` 會丟掉 `discount`／`basePrice`，導致訂單一律以定價寫入（已修正） |
| 折扣對帳 | 送單成功後，前端比對「送出的折數」與後端回傳 `data.items[].discount`，不一致即跳紅色警示，提醒重新部署 `Code.gs` |
| 折扣一致性（三道防線） | ① **加入購物車時若尚未抽籤，當場抽並鎖定**——不依賴 `mouseover`，因為 CSS `:hover` 翻牌與 JS 事件不一定同步（頁面捲動使卡片移到靜止游標下時，`:hover` 會生效但 `mouseover` 要等滑鼠移動才送出）。<br>② `cartAdd` 對已存在的項目**同步更新 `basePrice`／`discount`／`price`**，不再只加數量，避免沿用第一次加入時的錯價。<br>③ `syncCartPricing()` 於送單前以目前折數重算整車，確保「送出金額 ＝ 畫面金額」。 |
| 後端 | `Code.gs` 以「試算表定價 × `normalizeDiscount_(item.discount)`」覆算，仍不信任前端傳來的金額 |

### 5.3.2 字體系統（英式學院風）

| 代幣 | 字體 | 用途 |
| --- | --- | --- |
| `--font-display` | Playfair Display → Noto Serif TC | 所有標題、品牌名、課程名稱、價格數字、總金額 |
| `--font-script` | Caveat | 手寫註記：副標、翻牌提示、空車文案、頁尾標語 |
| `--font-sans` | Noto Sans TC | 內文、表單、按鈕 |
| `--font-mono` | JetBrains Mono | 卡牌編號、背景終端機指令 |

Playfair Display 不含中文字符，中文會自動落到 Noto Serif TC（明體），
因此中英混排時英文為古典襯線、中文為學院感明體；頁尾另加
`JUSTIN AI ACADEMY · EST. 2026` 寬字距義大利體銘牌。
- 卡片左上角顯示課程 id 作為「卡牌編號」，右下角顯示價格「能量值」晶片。

### 5.4 載入動畫（三種層級）

1. **骨架卡（Skeleton）**：初次載入課程時，8 張帶 shimmer 掃光的卡片佔位。
2. **墨滴全螢幕遮罩（Ink Drop）**：送單／新增／刪除時，毛筆墨滴落下擴散 + 紙飛機環繞。
3. **按鈕內嵌 spinner**：按鈕在請求期間 `disabled` 並顯示旋轉墨環，防止重複提交。

### 5.5 提示框

- 成功：SVG 勾勾 `stroke-dashoffset` 描繪動畫 + 卡片彈跳進場 + 訂單編號。
- 錯誤／警告：頂部滑入 Toast，3.5 秒自動消失，可手動關閉。
- 刪除確認：置中對話框（半透明毛玻璃背景），需明確點擊「確認刪除」。

---

## 6. 響應式規格

版面骨架（v1.1 起）：**工具列獨立為整頁寬的 `.board-head`**（標題／搜尋／分類篩選／離線提示），
其下的 `.layout` 才分成「課程網格 + 選課車」兩欄，因此兩者從同一條水平線開始、上緣齊高。
`.layout` 使用 `align-items: stretch` 讓選課車欄與課程網格等高，
`.cart-card` 則在欄內 `position: sticky` 並固定為可視高度，捲動時維持在畫面中。

| 斷點 | 版面 |
| --- | --- |
| ≥ 1200px | 左側課程網格 3 欄 + 右側 380px 常駐選課車（sticky，與卡片齊高） |
| 992–1199px | 課程網格 2 欄 + 右側選課車 340px |
| 768–991px | 課程網格 2 欄，選課車移至下方 |
| < 768px | 單欄；選課車以底部浮動按鈕（含數量徽章）呼出抽屜 |

---

## 7. 錯誤處理與防呆

| 風險 | 對策 |
| --- | --- |
| `API_URL` 未設定 | 顯示黃色提示列並切換為內建示範資料（離線模式） |
| 網路失敗 / CORS | `try/catch` 包覆所有 fetch，回傳 `{ ok:false, message }`，UI 顯示錯誤 Toast |
| 回應非 JSON（GAS 錯誤頁） | `response.text()` 後再 `JSON.parse`，失敗即回報「後端回應格式錯誤」 |
| 圖片 404 / 防盜連 | `onerror` 替換為內聯 SVG（data URI），並移除 `onerror` 避免無窮迴圈 |
| XSS（試算表內容） | 所有寫入 DOM 的字串經 `escapeHtml()` |
| 重複點擊送出 | `state.busy` 旗標 + 按鈕 `disabled` |
| 名額超賣 | 前端限制數量不得超過 `remaining`；最終仍以後端驗證為準 |

---

## 8. 檔案結構

```
03.ShopWebV1/
├─ index.html            # 頁面骨架（三檔分離：僅結構）
├─ style.css             # 所有樣式與色彩代幣（:root）
├─ main.js               # 所有邏輯（最上方為 API 設定區）
├─ Code.gs               # 後端 Google Apps Script（read / order / add / delete）
├─ tests.html            # 測試執行頁（開啟即跑）
├─ tests.js              # 單元 / 整合測試案例
├─ shop.csv              # 課程原始資料（匯入 Google 試算表用）
└─ docs/
   ├─ 01_BDD.md
   ├─ 02_TDD.md
   ├─ 03_SDD.md
   └─ 04_框架評估.md
```

---

## 9. 未來擴充建議

1. 訂單查詢頁（以 `orderId` 查詢狀態）。
2. 管理員登入驗證（目前管理員模式僅為前端切換，無權限控管）。
3. 名額改以獨立數值欄位 `seats` 儲存，`status` 僅作顯示用，可避免字串解析。
4. 加入課程收藏 / 比較功能，以 `localStorage` 保存。
