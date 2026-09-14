import { describe, it, assert } from '../harness.mjs';
import { DURATION, CHOREOGRAPHY, envelopeMs, DURATION_RANGE } from '../../assets/js/tokens.mjs';

/**
 * JS ↔ CSS 時長一致性。
 *
 * 這組測試的存在理由很具體：實作分層編排時連續踩到兩次同一類漂移——
 *   ① CSS 寫了 `calc(var(--transition-duration) * 1.6)`，JS 的 envelopeMs() 算不到；
 *   ② 微互動的 evidence-bar 與 chip 延遲只寫在 CSS，資料層完全不知道。
 * 兩次都是「測試全綠但實際編排比宣稱的長」。單元測試看不到 CSS，所以看不到問題。
 *
 * 對應 README 第 4 部 §4.2：「時長定義在 tokens.mjs，必須與 design-system.css 一致」。
 * 這裡把那句話變成可執行的檢查。
 */

const CSS_FILES = ['/assets/css/design-system.css', '/assets/css/components.css'];

async function loadCss() {
  if (typeof fetch !== 'function') return null;
  try {
    const texts = await Promise.all(CSS_FILES.map(async (f) => {
      const res = await fetch(f);
      return res.ok ? res.text() : '';
    }));
    // 先移除註解：本檔以正則解析 CSS，而註解裡常引用選擇器與舊數值，
    // 不剝掉的話會被當成實際規則（實測時就誤判過一次）。
    return texts.join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  } catch { return null; }
}

/** 取出 `--name: value;` 的值 */
const tokenValue = (css, name) => {
  const m = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
};

/** 把 CSS 時間值正規化為毫秒 */
const toMs = (v) => {
  if (!v) return null;
  const m = String(v).trim().match(/^(-?[\d.]+)(ms|s)$/);
  if (!m) return null;
  return m[2] === 's' ? Math.round(parseFloat(m[1]) * 1000) : Math.round(parseFloat(m[1]));
};

describe('JS ↔ CSS 時長一致性（README 第 4 部 §4.2）', () => {
  it('UT-CSS-01 CSS 權杖與 tokens.mjs 的 DURATION 完全一致', async () => {
    const css = await loadCss();
    if (!css) { assert.ok(true, '無 fetch 環境，略過'); return; }
    const pairs = [
      ['--duration-base', DURATION.base],
      ['--duration-reduced', DURATION.reducedFade],
      ['--duration-cap', DURATION.cap],
      ['--duration-shimmer', DURATION.shimmer],
    ];
    for (const [name, expected] of pairs) {
      assert.equal(toMs(tokenValue(css, name)), expected, `${name} 與 JS 不一致`);
    }
  });

  it('UT-CSS-02 CSS 中不得出現以 calc 乘算轉場時長的寫法', async () => {
    const css = await loadCss();
    if (!css) { assert.ok(true, '無 fetch 環境，略過'); return; }
    // calc(var(--transition-duration) * N) 會產生資料層算不到的時長
    const bad = css.match(/calc\([^)]*--(?:transition|duration)-[a-z-]+[^)]*\*[^)]*\)/g) || [];
    assert.deepEqual(bad, [],
      '時長倍率必須寫成 tokens.mjs 的資料，否則 envelopeMs() 會低估總長');
  });

  it('UT-CSS-03 裝飾層的 CSS 數值與 CHOREOGRAPHY.decorations 宣告一致', async () => {
    const css = await loadCss();
    if (!css) { assert.ok(true, '無 fetch 環境，略過'); return; }

    const evidence = CHOREOGRAPHY.decorations.find((d) => d.name === 'evidence');
    // 錨定行首：否則會先命中 design-system.css 裡以 :root 開頭的減少動態覆蓋規則
    const evBlock = css.match(/\n\.folio-panel\.is-entering \.evidence::before \{[^}]+\}/);
    assert.ok(evBlock, '找不到 evidence 裝飾層規則');
    assert.equal(toMs((evBlock[0].match(/animation:\s*evidence-bar\s+([\d.]+m?s)/) || [])[1]), evidence.duration);
    assert.equal(toMs((evBlock[0].match(/animation-delay:\s*([\d.]+m?s)/) || [])[1]), evidence.delay);

    const chip = CHOREOGRAPHY.decorations.find((d) => d.name === 'chip');
    const chipBlock = css.match(/\n\.folio-panel\.is-entering \.chip--tech \{[^}]+\}/);
    assert.ok(chipBlock, '找不到 chip 裝飾層規則');
    assert.equal(toMs((chipBlock[0].match(/animation:\s*folio-enter\s+([\d.]+m?s)/) || [])[1]), chip.duration);
    const delayCalc = chipBlock[0].match(/calc\((\d+)ms\s*\+\s*(\d+)ms/);
    assert.ok(delayCalc, 'chip 延遲須為 calc(base + stagger * i) 形式');
    assert.equal(Number(delayCalc[1]), chip.delay);
    assert.equal(Number(delayCalc[2]), chip.stagger);
  });

  it('UT-CSS-04 錯開上限的 nth-child 規則與 staggerCap 一致', async () => {
    const css = await loadCss();
    if (!css) { assert.ok(true, '無 fetch 環境，略過'); return; }
    const field = CHOREOGRAPHY.layers.find((l) => l.name === 'field');
    // 上限規則寫成 :nth-child(n+K)，K 應為 staggerCap + 1
    const capRule = css.match(/\.folio-panel\.is-entering \.field:nth-child\(n\+(\d+)\)/);
    assert.ok(capRule, '欄位層必須有錯開上限規則');
    assert.equal(Number(capRule[1]), field.staggerCap + 1,
      `staggerCap 為 ${field.staggerCap}，CSS 的上限選擇器應為 nth-child(n+${field.staggerCap + 1})`);
  });

  it('UT-CSS-05 每個進場動畫的選擇器都被減少動態規則覆蓋', async () => {
    const css = await loadCss();
    if (!css) { assert.ok(true, '無 fetch 環境，略過'); return; }

    // components.css 中所有帶 is-entering 且有 animation 宣告的選擇器
    const entering = new Set();
    const blockRe = /(\.[a-z-]+(?:\.[a-z-]+)*\.is-entering[^{,]*(?:,\s*[^{]+)?)\s*\{([^}]*)\}/g;
    let m;
    while ((m = blockRe.exec(css)) !== null) {
      if (!/animation\s*:/.test(m[2])) continue;
      for (const sel of m[1].split(',')) {
        const s = sel.trim();
        // 減少動態區塊本身不算（它們有 :root 前綴）
        if (s.startsWith(':root')) continue;
        entering.add(s);
      }
    }
    // 不帶 is-entering 但仍會播放的動畫也要納入。
    // 位置指示就是這一類：render() 每次重建該元素，插入即播放，不需要任何類別。
    if (/\n\.folio-position__value \{[^}]*animation\s*:/.test(css)) entering.add('.folio-position__value');
    assert.ok(entering.size >= 5, `應至少找到 5 個動畫選擇器，實際 ${entering.size}`);

    // 每一個都必須在兩條減少動態軌道中各出現一次
    const missing = [];
    for (const sel of entering) {
      const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const inMedia = new RegExp(`:root:not\\(\\[data-motion="full"\\]\\)\\s+${esc}`).test(css);
      const inSwitch = new RegExp(`:root\\[data-motion="reduced"\\]\\s+${esc}`).test(css);
      if (!inMedia || !inSwitch) missing.push(`${sel}（系統偏好軌 ${inMedia ? '✓' : '✗'}／站內開關軌 ${inSwitch ? '✓' : '✗'}）`);
    }
    assert.deepEqual(missing, [],
      '新增進場動畫時必須同步加入兩條減少動態軌道——只靠 * 規則壓時長，關鍵影格仍帶 transform');
  });

  it('UT-CSS-06 含裝飾層在內的整段編排仍在 400ms 預算內', () => {
    const envelope = envelopeMs();
    assert.between(envelope, DURATION_RANGE.min, DURATION_RANGE.max);
    // 逐項列出，讓超標時能一眼看出是哪一層
    const all = [...CHOREOGRAPHY.layers, ...CHOREOGRAPHY.decorations];
    for (const l of all) {
      const end = l.delay + (l.stagger || 0) * (l.staggerCap || 0) + Math.max(l.duration, l.zoomDuration || 0);
      assert.ok(end <= DURATION_RANGE.max, `${l.name} 結束於 ${end}ms，超出 400ms 預算`);
    }
  });
});
