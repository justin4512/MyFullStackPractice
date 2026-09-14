/**
 * 極簡測試框架 — 同時可在 Node.js 與瀏覽器執行。
 *
 * 為什麼不直接用 node:test：本專案的開發環境目前沒有安裝 Node.js
 * （README 附錄 §A.3 第 7 點已揭露此限制）。這個 harness 讓 111 個案例中
 * 的純邏輯部分**現在就能真的被執行**，而不是只被宣稱通過。
 * Node.js 到位後，同一批測試檔可直接改用 node:test 執行，不需重寫斷言。
 */

const suites = [];
let currentSuite = null;

export function describe(name, fn) {
  const prev = currentSuite;
  currentSuite = { name, cases: [] };
  suites.push(currentSuite);
  fn();
  currentSuite = prev;
}

export function it(name, fn) {
  if (!currentSuite) throw new Error(`it("${name}") 必須寫在 describe 內`);
  currentSuite.cases.push({ name, fn });
}

class AssertionError extends Error {}

const fmt = (v) => {
  if (typeof v === 'string') return JSON.stringify(v);
  if (v === null || v === undefined || typeof v !== 'object') return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
};

export const assert = {
  ok(value, msg) {
    if (!value) throw new AssertionError(msg || `預期為真值，實際為 ${fmt(value)}`);
  },
  notOk(value, msg) {
    if (value) throw new AssertionError(msg || `預期為假值，實際為 ${fmt(value)}`);
  },
  equal(actual, expected, msg) {
    if (!Object.is(actual, expected)) {
      throw new AssertionError(msg || `預期 ${fmt(expected)}，實際 ${fmt(actual)}`);
    }
  },
  notEqual(actual, unexpected, msg) {
    if (Object.is(actual, unexpected)) {
      throw new AssertionError(msg || `不應等於 ${fmt(unexpected)}`);
    }
  },
  deepEqual(actual, expected, msg) {
    const a = JSON.stringify(actual); const b = JSON.stringify(expected);
    if (a !== b) throw new AssertionError(msg || `預期 ${b}，實際 ${a}`);
  },
  includes(haystack, needle, msg) {
    const has = typeof haystack === 'string' ? haystack.includes(needle) : (haystack || []).includes(needle);
    if (!has) throw new AssertionError(msg || `${fmt(haystack)} 不含 ${fmt(needle)}`);
  },
  excludes(haystack, needle, msg) {
    const has = typeof haystack === 'string' ? haystack.includes(needle) : (haystack || []).includes(needle);
    if (has) throw new AssertionError(msg || `${fmt(haystack)} 不應含 ${fmt(needle)}`);
  },
  between(actual, min, max, msg) {
    if (!(actual >= min && actual <= max)) {
      throw new AssertionError(msg || `${fmt(actual)} 不在 [${min}, ${max}] 區間內`);
    }
  },
  throws(fn, msg) {
    let threw = false;
    try { fn(); } catch { threw = true; }
    if (!threw) throw new AssertionError(msg || '預期拋出例外，實際沒有');
  },
  doesNotThrow(fn, msg) {
    try { fn(); } catch (e) { throw new AssertionError(`${msg || '不應拋出例外'}：${e.message}`); }
  },
};

/** 可控時鐘——中斷與保險清理測試的必要條件（TDD §8.4 禁止在 P0 使用真實計時器）*/
export function createFakeClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map();
  return {
    setTimeout(fn, delay = 0) {
      const id = ++seq;
      timers.set(id, { at: now + delay, fn });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    /** 推進假時鐘，依到期順序執行 */
    tick(ms) {
      const target = now + ms;
      while (true) {
        const due = [...timers.entries()]
          .filter(([, t]) => t.at <= target)
          .sort((a, b) => a[1].at - b[1].at);
        if (due.length === 0) break;
        const [id, t] = due[0];
        timers.delete(id);
        now = t.at;
        t.fn();
      }
      now = target;
    },
    get pendingCount() { return timers.size; },
    get now() { return now; },
  };
}

/** 極簡 DOM 替身——不模擬事件傳播，僅供轉場執行器的類別操作斷言 */
export function createFakeElement() {
  const classes = new Set();
  const listeners = new Map();
  return {
    dataset: {},
    style: { _props: {}, setProperty(k, v) { this._props[k] = v; }, getPropertyValue(k) { return this._props[k]; } },
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      contains: (c) => classes.has(c),
      get size() { return classes.size; },
    },
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    dispatch(type) { const fn = listeners.get(type); if (fn) fn({ type }); },
    get _classes() { return [...classes]; },
    get _listenerTypes() { return [...listeners.keys()]; },
  };
}

/** 執行全部套件。回傳結構化結果，供 Node CLI 與瀏覽器 runner 共用。 */
export async function run() {
  const report = { total: 0, passed: 0, failed: 0, suites: [] };
  for (const suite of suites) {
    const s = { name: suite.name, passed: 0, failed: 0, failures: [] };
    for (const c of suite.cases) {
      report.total += 1;
      try {
        await c.fn();
        s.passed += 1; report.passed += 1;
      } catch (err) {
        s.failed += 1; report.failed += 1;
        s.failures.push({ name: c.name, message: err && err.message ? err.message : String(err) });
      }
    }
    report.suites.push(s);
  }
  return report;
}

export function formatReport(report) {
  const lines = [];
  for (const s of report.suites) {
    const mark = s.failed === 0 ? '✓' : '✗';
    lines.push(`${mark} ${s.name} — ${s.passed}/${s.passed + s.failed}`);
    for (const f of s.failures) lines.push(`    ✗ ${f.name}\n      ${f.message}`);
  }
  lines.push('');
  lines.push(`合計 ${report.passed}/${report.total} 通過，失敗 ${report.failed}`);
  return lines.join('\n');
}
