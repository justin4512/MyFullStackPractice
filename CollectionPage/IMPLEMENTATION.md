# 實作狀態

依 [`README.md`](README.md) 全案整合文件實作。本檔記錄**已完成什麼、驗證到什麼程度、還缺什麼**。

| 項目 | 內容 |
|---|---|
| 日期 | 2026-09-14 |
| 對應文件 | `README.md` v2.0 第 4 部（SDD）／第 3 部（UI-UX）／第 5 部（TDD）／第 8 部（動態導覽） |
| 主介面 | 全幅簡報 deck（見 §0）；舊的作品切換器移至 `works/folio/` 並成為嵌入展品 |
| 執行期依賴 | **0**（原生 ES 模組，無框架） |
| 開發期依賴 | 0（測試 harness 自製，見下方「為什麼不用 node:test」） |
| 轉場編排 | 三層 ＋ 三裝飾層，整段 358ms（FR-2.2 預算 400ms） |

---

## 0. 介面改版：全幅簡報（2026-09-14 第二版）

原本的「單頁作品切換器」已改為 **Apple 式的全幅簡報**：每頁滿版、亮暗交替、吸附捲動，且每一頁都可嵌入實際可操作的網頁或簡報。

**舊介面沒有被刪除**——它移到 `works/folio/index.html`，並成為簡報第 3 頁的嵌入展品。換句話說，前一版的成果變成這一版的內容。

### 0.1 三個決定架構的判斷

**① 用原生 `scroll-snap`，不劫持捲動。**
PPT 的翻頁感來自瀏覽器的吸附，不是攔截滾輪事件。這守住 README 第 8 部 `FR-4.4`——劫持式的全螢幕 deck 在無障礙上是災難（捲動速度、慣性、觸控手勢全部失真）。當前頁由 `IntersectionObserver` 觀測得出，而不是 JS 算完再強制對齊。

**② iframe 會製造鍵盤陷阱，必須顯式處理。**
焦點一旦進入嵌入頁，Tab 就被內層文件接管，直接違反 `NFR-1.2`。因此 iframe 預設 `tabindex="-1"` ＋ `aria-hidden="true"`，使用者必須按「進入這個作品操作」才解除隔離，Esc 或「離開」鍵把焦點送回按鈕。**Esc 在未進入嵌入時不產生任何動作**（不劫持按鍵）。

**③ 不能一次掛載所有 iframe。**
七頁七個 iframe 會壓垮首屏。`embed.mjs` 以「距當前頁 ≤ 1」為掛載半徑，離開範圍時把 `src` 移除以真正終止內層文件。實測：在第 1 頁時嵌入未掛載，第 2 頁掛載，第 7 頁卸載。

### 0.2 新增模組

| 檔案 | 職責 |
|---|---|
| `assets/js/deck.mjs` | 簡報控制器。**唯一入口 `goTo()`**；捲動、鍵盤、頁碼點、深連結、上一頁全部收斂於此 |
| `assets/js/embed.mjs` | 嵌入生命週期：掛載半徑、沙箱正規化、進入／離開的焦點管理、失效降級 |
| `assets/js/slides.mjs` | 純函式渲染：五種投影片型別（cover／statement／embed／showcase／closing） |
| `assets/js/deck-main.mjs` | 啟動層：鍵盤契約、站內減少動態開關、嵌入事件接線 |
| `assets/css/deck.css` | 全幅版面、顯示級字階、亮暗交替、固定介面 |
| `data/deck.json` | 簡報內容。**要加一頁就加一筆物件，不需要改任何程式碼** |

沿用未改：`tokens.mjs`、`store.mjs`、`router.mjs`（新增可設定的查詢參數名）、`view.mjs`、`transition.mjs`、`keyboard.mjs`、`folio.mjs`——這些是舊介面的引擎，現在跑在嵌入的展品裡。

### 0.3 怎麼換成你自己的內容

編輯 `data/deck.json`。每一頁的 `type` 決定版面：

```jsonc
{
  "id": "my-work",           // 深連結會變成 ?slide=my-work
  "type": "embed",           // cover / statement / embed / showcase / closing
  "theme": "light",          // light 或 dark，交替使用效果最好
  "kicker": "作品 04",
  "title": "標題\n可以換行",
  "lead": "一段說明。",
  "embed": {
    "kind": "slides",        // site / slides / video / pdf，決定預設長寬比
    "src": "貼上嵌入網址",
    "title": "給螢幕閱讀器的說明（必要）",
    "sandbox": "allow-scripts allow-same-origin allow-popups"
  },
  "facts": [{ "label": "指標", "value": "90 秒", "note": "原為 20 分鐘" }]
}
```

**嵌入 PPT 的網址怎麼拿**：Google 簡報用「檔案 → 分享 → 發布到網路 → 嵌入」；PowerPoint 上傳 OneDrive 後用「嵌入」取得的 `src`。兩者都是 iframe 網址，直接填進 `embed.src`。

**嵌入自己的網頁**：填相對路徑（如 `works/xxx/index.html`）或完整網址皆可。

> ⚠️ **沙箱要自己判斷**。預設 `allow-scripts allow-popups allow-forms`，刻意**不含** `allow-top-navigation`（避免嵌入內容把母頁面導走）。嵌入自己的頁面若需要 `localStorage`、`history` 等功能，才加 `allow-same-origin`——但同時給 `allow-scripts` 與 `allow-same-origin` 等於解除同源沙箱，**只對你自己信任的內容這樣做**。

### 0.4 改版過程中修正的四個缺陷

**⑦ `box-sizing: border-box` 的 reset 只在 `components.css`，而簡報頁不載入該檔。**
整個 deck 都在用 `content-box`：內容 1030px ＋ 上下內距 120px = 1150px，每一頁都比視窗高。後果是嵌入頁底部的「進入／離開」工具列被裁掉，而 `scroll-snap` 是 mandatory，使用者捲不到那裡——**功能等於消失**。

**⑧ 固定介面拿不到頁面主題。**
`.chrome`／`.pager`／`.dots` 都在 `.deck` 之外，`--slide-fg` 是定義在 `.slide` 上的，繼承不到。亮色頁的頁首列因此是白字白底。修正：主題改掛到 `<html data-current-theme>`。

**⑨ `.embed` 是 `display: grid`，子元素的 `flex: 1` 完全無效。**
嵌入框卡在 `min-height: 220px`（僅佔視窗 21%），下方留著 200px 空白。修正後嵌入框佔 60% 視窗高。

**⑩ 「在新分頁開啟」連結只有 17px 高，低於 `NFR-1.8` 的 24px 觸控目標下限。**
純文字連結預設只有行高。這是行動版實測量到的，桌機用滑鼠不會發現。


---

## 1. 怎麼跑

本機沒有 Node.js，改用 XAMPP 內建的 PHP 開發伺服器提供靜態檔案。

```bash
C:/xampp/php/php.exe -S 127.0.0.1:8321 -t .
```

- 網站：<http://localhost:8321/>
- 測試：<http://localhost:8321/tests/>

**不要用 `file://` 開啟。** 深連結依賴 History API，`file://` 下 `pushState` 行為與正式環境不同，且 `fetch` 會被 CORS 擋下（README 第 5 部 §6.4 配套規則 1）。

Node.js 到位後：`npm run validate`（資料契約）、`npm test`（同一批測試檔的 CLI 版）。

---

## 2. 已完成

### 2.1 模組（依 SDD §1.2 分層，依賴方向單向向下）

| 檔案 | 層 | 職責 |
|---|---|---|
| `assets/js/tokens.mjs` | 權杖 | 時長／緩動／距離／禁止屬性清單；`assertCompositedOnly` |
| `assets/js/store.mjs` | 資料 | 正規化與 ERROR/WARN/INFO 分級、排序、篩選、`stepIndex` 邊界運算 |
| `assets/js/transition.mjs` | 轉場 | 方向判定、動畫計畫（純資料）、中斷安全執行器（五條硬規則） |
| `assets/js/router.mjs` | 路由 | 深連結解析、history 契約、`suspended` 迴圈抑制 |
| `assets/js/view.mjs` | 視圖 | 純函式渲染，輸入資料 → HTML 字串 |
| `assets/js/keyboard.mjs` | 輸入 | 鍵盤契約與事件代理 |
| `assets/js/folio.mjs` | 控制器 | 狀態機宿主、**唯一入口 `show()`**、aria-live 廣播 |
| `assets/js/main.mjs` | 啟動 | 掛載點查詢、資料取得、接線、主題三態 |

### 2.2 其他交付

- `index.html` — 首屏內容為靜態標記，JS 只「接管」不「生成」（FR-2.6）
- `assets/css/design-system.css` — 語意權杖、亮暗雙主題、減少動態雙軌
- `assets/css/components.css` — BEM 元件樣式
- `data/projects.schema.json`、`data/projects.json`（6 筆）、`data/site.json`
- `tools/validate-projects.mjs` — 建置期驗證，結束碼 1 阻擋發布
- `tests/` — 139 個單元／整合案例 ＋ 瀏覽器 runner ＋ Node CLI 進入點

---

## 3. 驗證結果（實際執行，非宣稱）

### 3.1 自動化測試：139 / 139 通過

於 <http://localhost:8321/tests/> 實跑。

| 套件 | 通過 |
|---|---|
| store — 排序與必填欄位（DR-1 / FR-3.3） | 12 / 12 |
| store — 證據強度條件約束（FR-3.5） | 5 / 5 |
| store — 邊界模式（FR-1.5） | 6 / 6 |
| store — 篩選與位置（FR-1.4 / FR-1.7） | 9 / 9 |
| tokens — 權杖與可合成屬性（NFR-2.4） | 10 / 10 |
| transition — 方向判定（FR-2.1） | 4 / 4 |
| transition — 動畫計畫為純資料（FR-2.2 / 2.6 / NFR-2.4） | 9 / 9 |
| transition — 中斷與保險清理（FR-2.7） | 10 / 10 |
| router — 深連結解析（FR-1.6） | 6 / 6 |
| router — 歷史契約（FR-1.6 / NFR-2.3） | 4 / 4 |
| view — 跳脫與欄位完整性（FR-3.1 / 3.3 / 3.7） | 15 / 15 |
| folio — 單一入口收斂（FR-1.1） | 4 / 4 |
| folio — 狀態機由 render() 推導（FR-1.5 / 1.7） | 6 / 6 |
| folio — 深連結與歷史（FR-1.6） | 3 / 3 |
| folio — 無障礙與降級（FR-3.8 / 2.3 / NFR-1.9） | 4 / 4 |
| **JS ↔ CSS 時長一致性（§4.2）** | **6 / 6** |
| **embed — 嵌入設定正規化（安全與降級）** | **5 / 5** |
| **embed — 掛載半徑（效能）** | **2 / 2** |
| **slides — 投影片正規化與渲染** | **15 / 15** |
| **deck — 邊界與進度** | **4 / 4** |

### 3.2 資料契約驗證

對 `data/projects.json` 實跑 `validate()`：**ERROR 0、WARN 0**，6 筆全數通過。
邊界情境：0 件不崩潰 ✓　1 件可建置 ✓　缺 id 被丟棄 ✓

### 3.3 瀏覽器實測（Chromium）

| 檢查 | 結果 |
|---|---|
| JS 接管、6 件依 `order` 排序（輸入順序刻意不同） | ✓ |
| 切換：內容／位置指示／`aria-current`／`aria-live` 同步 | ✓ |
| `pushState` 寫入、上一頁回溯、**不重載頁面** | ✓ |
| 焦點保留：點索引項後焦點留在原按鈕 | ✓ |
| 鍵盤 `←` `→` 切換且焦點不移動 | ✓ |
| cycle 邊界回繞（第 6 件 → 第 1 件） | ✓ |
| 密集操作（12 次切換／鍵盤／上一頁）零 JS 錯誤、轉場類別無殘留 | ✓ |
| 權杖一致：CSS `.25s`／`.12s`／`.5s`／`32px` ＝ JS `250`／`120`／`500`／`32` | ✓ |
| 桌機雙欄比例 1.50（目標 1.5fr : 1fr）、無水平捲動 | ✓ |
| 行動版 375px：單欄、無水平捲動、DOM 順序 主視覺→說明→控制 | ✓ |
| 14 個控制項全部 ≥ 24 × 24 CSS 像素（NFR-1.8） | ✓ |
| 站內減少動態開關：位移 → `0px`、時長 → `.12s`（完全不位移） | ✓ |

---

## 4. 轉場編排（舊介面，現為嵌入展品）

初版只有一個元素在動：主視覺 250ms 位移淡入，說明欄位硬切。FR-2.2 的 150–400ms 是**整段編排的預算**，我卻把它花在單一層上。

### 4.1 現在的編排（整段 358ms）

| 層 | 對象 | 位移倍率 | 延遲 | 時長 |
|---|---|---|---|---|
| visual | 主視覺容器 | 1.0 | 0 | 250ms |
| visual/zoom | 主視覺影像（縮放 1.04→1，視差） | — | 0 | 350ms |
| head | 標題與摘要 | 1.5 ＋ 上移 8px | 40ms | 230ms |
| field | 各欄位（錯開 22ms，上限 4 次） | 1.5 ＋ 上移 10px | 70ms | 200ms |
| evidence | 成果色條（scaleY 展開） | — | 120ms | 200ms |
| chip | 技術棧（錯開 18ms，上限 4 次） | — | 110ms | 170ms |
| position | 位置指示（重建即播放） | — | 0 | 150ms |

另加微互動：索引清單當前色條由中央展開、hover 右推 3px、按下時 scale(.97)、連結 pill 上浮。

### 4.2 三個被限制住的地方

- **離場動畫被 SDD §4.4 規則 4 禁止**（「任何時刻不得出現兩個作品同時可見」），因此只能做進場，做不了 cross-fade。
- **位移距離固定 24/32px**，是設計系統的既有權杖，未擅自加大；深度感改用縮放視差與分層錯開取得。
- **整段不得超過 400ms**，由 `envelopeMs()` ＋ `UT-CSS-06` 把關。想要更慢更戲劇化的節奏，需要先改 FR-2.2，那是需求層決策。

---

## 5. 實作過程中修正的六個真實缺陷

記錄在這裡，因為它們比「全部通過」更有參考價值。

**① 深度文案全部低於 300 字下限（FR-3.6）**
6 筆示範資料的 `deepDive.body` 實際為 200–222 字，全數未達下限。這與 SDD §2.4 記載的既有缺陷（292 字、277 字）是同一類問題——**字數目標若沒有機械檢查，寫的人一定會低估**。已全部補寫至 300–344 字並重新驗證。

**② `clock.setTimeout` 拋 Illegal invocation，導致 aria-live 永遠不更新**
`clock = { setTimeout, clearTimeout }` 把全域函式當成物件方法呼叫，瀏覽器要求 `this` 必須是 `window`。例外在 `show()` 第 8 步（播放動畫）中斷，**第 9 步的 aria-live 廣播因此永遠不執行**。

這個缺陷的隱蔽性值得記下：畫面切換完全正常（第 6 步的 `render()` 在拋錯之前），只有螢幕閱讀器使用者受影響。而且初次載入與瀏覽器上一頁**看起來正常**——因為那兩條路徑的 `direction` 為 `none`，`planTransition` 回傳 `null`，根本不會走到計時器。
修正：把預設 clock 綁定到 `globalThis`。

**③ `render()` 重繪整份索引清單會摧毀焦點**
SDD §6.4 把「重繪整份清單」列為作品數變多時的**效能**優化建議。實測發現它其實是**正確性**問題：重建 DOM 會讓當前聚焦的按鈕消失，焦點掉回 `<body>`，直接違反 NFR-1.4「切換後焦點不移動」。
修正：可見集合未變時只原地更新 `aria-current`，僅在篩選改變集合時才重建。

**④ CSS 用 `calc(var(--transition-duration) * 1.6)` 寫縮放時長，資料層算不到**
`envelopeMs()` 算出 358ms，`getAnimations()` 實測 400ms——已經頂到 FR-2.2 上限。任何人調大 `--duration-base` 都會無聲超標。修正：時長倍率改為 `tokens.mjs` 的資料，CSS 只讀屬性。

**⑤ 微互動的延遲只寫在 CSS，同一類漂移的第二次**
`evidence-bar` 與技術棧 chips 的延遲寫死在 CSS，資料層不知道，實測 370ms vs 計算 358ms。修正：新增 `CHOREOGRAPHY.decorations`，把「CSS 驅動但影響總長」的動畫也宣告成資料。

**⑥ 位置指示的動畫從來沒播放過，且未被減少動態覆蓋**
`position-tick` 掛在 `.folio-panel.is-entering ~ *` 與 `.is-transitioning` 底下，但位置指示在 `.toolbar` 內、不是 folio 的後代——兩個選擇器都匹配不到，是死的 CSS。同時它也沒被任何一條減少動態軌道覆蓋。修正：改為元素重建即播放（`render()` 本來就每次重建它），並補進兩條降級軌道。

> **④⑤⑥ 是同一個模式的三次重演**：只要動畫的某個數值或某條規則只存在於 CSS，資料層的保證就出現破口，而單元測試看不到 CSS 所以全綠。因此新增了 `tests/unit/tokens-css.test.mjs`（6 案）——直接 fetch CSS 檔並與 `tokens.mjs` 逐項比對，包含「每個進場動畫都必須被兩條減少動態軌道覆蓋」這條結構性檢查。⑥ 就是它抓到的。

> 建議回饋上游文件：① 補進 SDD §2.4 的驗證器範例；③ 修正 SDD §6.4 的敘述（那不是優化建議，是無障礙要求）；④⑤⑥ 支持 README 第 5 部 §5.2 增列一項「JS↔CSS 一致性」的測試工具需求。

---

## 6. 尚未完成

| 項目 | 狀態 | 理由 |
|---|---|---|
| **E2E / RWD 自動化（26 案）** | 未做 | 需要 Playwright，而 Playwright 需要 Node.js。本機沒有 Node，安裝屬於環境決策，未擅自進行 |
| **BDD step definitions（83 案）** | 未做 | 需要 `@cucumber/cucumber`（同上）。且 README §0.9 `B1` 指出 `.feature` 需先補情境 ID |
| **`c8` 覆蓋率量測** | 未做 | 同上。README 第 5 部 §7 的 90%／85%／95% 仍是目標，不是量測結果 |
| **Lighthouse 效能實測** | 未做 | 同上。LCP／CLS／INP 預算未經實測驗證 |
| **`axe-core` 無障礙掃描** | 未做 | 同上。目前的無障礙驗證是手動 DOM 斷言，涵蓋不到 axe 能抓的部分 |
| **作品內頁 `/work/{id}`** | 未做 | SDD §5.1 列為正式站結構的一部分；首頁切換機制不依賴它 |
| **第 8 部 動態導覽擴充** | 未做 | 草案狀態，且 README §0.9 情境 B 的 `B1`–`B3` 三項前置條件尚未完成 |
| **上游文件回寫** | 未做 | §4 的三項缺陷發現、以及 README §0.9 情境 A 的 2 項 ERROR 修正，都屬於文件層變更 |

### 6.1 誠實說明測試涵蓋範圍

**139 個測試不等於 README 第 5 部的 111 個案例。** 兩者的關係是：

- 我寫的 139 案涵蓋**單元層與可用替身驗證的整合層**，對應原案例集的 `UT-*` 與部分 `IT-*`；
- 案例 ID 沿用原編號慣例但**未與 `data/test-cases.json` 做機器比對**——那份權威案例集不在版本控制中（README 第 5 部 §9.1 的版控狀態註記）；
- 因此**不應宣稱與原案例集的通過數有對應關係**。正確說法是：本次實作附帶 139 個可執行測試，全數通過；其中 32 個（JS↔CSS 一致性、嵌入、投影片、簡報邊界）是原案例集完全沒有的新面向。

### 6.2 為什麼不用 `node:test`

README 第 5 部 §5.2 選定 `node:test`，理由是零安裝。但本機沒有 Node.js，那個理由在這裡反而不成立。

`tests/harness.mjs` 是自製的極簡替代品（`describe`／`it`／`assert`／假時鐘／DOM 替身），讓測試**現在就能真的執行**。斷言 API 刻意做得與 `node:assert/strict` 相近，Node 到位後改用 `node:test` 只需替換 harness 的 import，測試檔本身不必重寫。
