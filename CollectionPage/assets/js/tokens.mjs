/**
 * 權杖層 — 時長／緩動／位移距離的唯一來源。
 * 這些值必須與 assets/css/design-system.css 的 CSS 自訂屬性一致；
 * BDD 情境以 getComputedStyle 實測，兩者不一致會被測試抓到（README 第 4 部 §4.2）。
 */

export const DURATION = Object.freeze({
  base: 250,          // 作品切換位移，落在 FR-2.2 的 150–400ms 區間
  reducedFade: 120,   // 減少動態淡入（不適用 FR-2.2 下限，見 README §0.9 行動 B3）
  shimmer: 1200,      // 骨架掃光，非位移動畫
  cap: 500,           // 硬上限
});

export const EASING = Object.freeze({
  base: 'cubic-bezier(0.22, 1, 0.36, 1)',
  reduced: 'cubic-bezier(0.4, 0, 0.2, 1)',
});

/** FR-2.2 的合法區間；planTransition 產出的時長必須落在其中 */
export const DURATION_RANGE = Object.freeze({ min: 150, max: 400 });

/** 位移距離：<768px 為 24px，>=768px 為 32px（README 第 4 部 §4.2） */
export const DISTANCE = Object.freeze({ base: 24, lg: 32, breakpointPx: 768 });

/** 保險清理的額外餘裕；safetyMs = min(duration, cap) + CLEANUP_GRACE_MS */
export const CLEANUP_GRACE_MS = 100;

/**
 * 分層編排（choreography）。
 *
 * FR-2.2 的 150–400ms 是**整段編排的預算**，不是「只能動一個元素」。
 * 初版把整份預算花在主視覺一層，說明欄位完全不動，因此觀感單薄。
 * 此處把預算拆給三層，各層有不同的位移倍率與延遲，形成深度與先後。
 *
 * 硬約束：`envelopeMs()` 必須 ≤ DURATION_RANGE.max（400ms），由 UT-TOK-06 把關。
 * 減少動態時整份編排作廢，改為零位移淡入——不是「縮短的編排」。
 */
export const CHOREOGRAPHY = Object.freeze({
  layers: Object.freeze([
    // 主視覺：基準位移 ＋ 影像本身輕微縮放，兩層視差。
    // zoomDuration 必須是資料而不是 CSS 裡的 calc()——否則 envelopeMs() 算不到它，
    // 實際編排會比計算值長，且沒有任何檢查會發現（實測時抓到過一次）。
    Object.freeze({
      name: 'visual', distanceScale: 1, delay: 0, duration: 250,
      zoomFrom: 1.04, zoomDuration: 350,
    }),
    // 標題與摘要：位移較大、稍晚進場
    Object.freeze({ name: 'head', distanceScale: 1.5, delay: 40, duration: 230, liftPx: 8 }),
    // 各欄位：依序錯開，但錯開次數設上限以免超出預算
    Object.freeze({ name: 'field', distanceScale: 1.5, delay: 70, duration: 200, liftPx: 10, stagger: 22, staggerCap: 4 }),
  ]),
  /**
   * 裝飾層：由 CSS 後代選擇器驅動，執行器不直接操作它們。
   *
   * **它們仍然必須宣告在這裡**，因為 envelopeMs() 要算得到。
   * 實測時就是因為這兩項只寫在 CSS，導致計算值 358ms 與實際 370ms 不一致——
   * 「只在 CSS 裡加一點延遲」是這類漂移最常見的來源。
   * 下方數值必須與 components.css 的對應規則一致。
   */
  decorations: Object.freeze([
    Object.freeze({ name: 'evidence', delay: 120, duration: 200 }),
    Object.freeze({ name: 'chip', delay: 110, duration: 170, stagger: 18, staggerCap: 4 }),
    // 位置指示：render() 每次重建該元素，插入即播放，不需要類別驅動。
    // 時長直接用 --duration-fast（150ms），因此與權杖同步。
    Object.freeze({ name: 'position', delay: 0, duration: 150 }),
  ]),
});

/**
 * 整段編排從開始到最後一個元素結束所需的毫秒數。
 * **每一種會影響總長的時長都必須被算進來**——包含縮放這類附屬動畫。
 */
export function envelopeMs(choreography = CHOREOGRAPHY) {
  const all = [...(choreography.layers || []), ...(choreography.decorations || [])];
  return all.reduce((max, l) => {
    const lastDelay = l.delay + (l.stagger ? l.stagger * (l.staggerCap ?? 0) : 0);
    const longest = Math.max(l.duration, l.zoomDuration || 0);
    return Math.max(max, lastDelay + longest);
  }, 0);
}

/**
 * 明文禁止動畫的屬性（README 第 4 部 §7.2）。
 * 動畫這些屬性會觸發版面重排，違反 NFR-2.4。
 */
export const FORBIDDEN_PROPERTIES = Object.freeze([
  'width', 'height', 'top', 'left', 'right', 'bottom',
  'margin', 'padding', 'font-size', 'line-height',
  'border-width', 'gap', 'flex-basis',
]);

/** 唯一被允許動畫的屬性 */
export const COMPOSITED_PROPERTIES = Object.freeze(['transform', 'opacity']);

/**
 * 依視窗寬度取得位移距離。
 * @param {number} viewportWidth
 * @returns {number}
 */
export function distanceFor(viewportWidth) {
  if (!Number.isFinite(viewportWidth)) return DISTANCE.base;
  return viewportWidth >= DISTANCE.breakpointPx ? DISTANCE.lg : DISTANCE.base;
}

/**
 * 檢查動畫計畫是否只使用合成屬性。
 * 回傳違規的屬性名稱陣列——空陣列代表通過。
 * 這是一個可在測試中執行的約束，而非文件裡的口號（README 第 4 部 §7.2）。
 * @param {{keyframes?: Array<Record<string, unknown>>}|null} plan
 * @returns {string[]}
 */
export function assertCompositedOnly(plan) {
  if (!plan) return [];
  const violations = new Set();
  const walk = (frames) => {
    if (!Array.isArray(frames)) return;
    for (const frame of frames) {
      if (!frame || typeof frame !== 'object') continue;
      for (const prop of Object.keys(frame)) {
        if (prop === 'offset' || prop === 'easing') continue;
        if (!COMPOSITED_PROPERTIES.includes(prop)) violations.add(prop);
      }
    }
  };
  walk(plan.keyframes);
  // 分層編排的每一層都必須通過同一道檢查——否則新增一層就是一個繞過檢查的破口。
  // 巢狀的附屬動畫（如縮放視差）同樣要走訪，不能只看 layer.keyframes。
  for (const layer of plan.layers || []) {
    walk(layer.keyframes);
    if (layer.zoom) walk(layer.zoom.keyframes);
  }
  return [...violations];
}

/**
 * 時長是否落在 FR-2.2 區間內。位移類轉場適用；
 * 減少動態淡入與骨架掃光不適用（見 README §0.9 行動 B3 的豁免說明）。
 * @param {number} ms
 */
export function withinDurationBudget(ms) {
  return Number.isFinite(ms) && ms >= DURATION_RANGE.min && ms <= DURATION_RANGE.max;
}
