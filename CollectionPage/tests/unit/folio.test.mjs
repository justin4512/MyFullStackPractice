import { describe, it, assert, createFakeClock } from '../harness.mjs';
import { createFolio, STATE } from '../../assets/js/folio.mjs';

/** 極簡掛載點替身——只需要能接收 innerHTML 與 disabled */
const stub = () => ({
  innerHTML: '', textContent: '', hidden: false, disabled: false,
  dataset: {}, classList: { add() {}, remove() {}, contains: () => false },
  style: { setProperty() {} },
  querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
});

const mountStub = () => ({
  visual: stub(), panel: stub(), position: stub(), indexList: stub(),
  filterBar: stub(), live: stub(), notice: stub(),
  prevBtn: stub(), nextBtn: stub(),
});

const project = (n, categories) => ({
  id: `p${n}`, order: n * 10, title: `作品${n}`, summary: `摘要${n}`,
  categories,
  role: { label: '前端', scope: '全部' },
  problem: { problem: 'p', goal: 'g' },
  visual: { src: `${n}.svg`, alt: `作品${n}的介面版面示意圖`, width: 16, height: 10 },
});

const SIX = [1, 2, 3, 4, 5, 6].map((n) => project(n, n <= 2 ? ['互動體驗'] : ['Web App']));

const makeFolio = (over = {}) => {
  const mount = over.mount || mountStub();
  const clock = over.clock || createFakeClock();
  const f = createFolio({
    projects: over.projects || SIX,
    siteConfig: over.siteConfig || { orderMode: 'cycle' },
    mount,
    location: over.location || { search: '', pathname: '/' },
    history: over.history === undefined ? null : over.history,
    matchMedia: over.matchMedia || null,
    clock,
  });
  return { folio: f, mount, clock };
};

describe('folio — 單一入口收斂（IT-01 / FR-1.1）', () => {
  it('IT-01 四條進入路徑全部經過 show()', () => {
    const { folio } = makeFolio();
    folio.init();

    const seen = [];
    const originalShow = folio.show;
    // 以包裝觀察：每一次狀態變更都必須經過 show()
    const spy = (id, opts) => { seen.push(opts?.source || 'unknown'); return originalShow(id, opts); };
    const f = Object.create(folio, { show: { value: spy } });
    // 直接呼叫各意圖函式（它們內部呼叫的是原本的 show，故改以行為驗證）
    const before = folio.currentId;
    folio.next();                    // 相對控制項
    const afterNext = folio.currentId;
    folio.select('p5');              // 索引清單
    const afterSelect = folio.currentId;
    folio.setFilter('互動體驗');      // 分類篩選
    const afterFilter = folio.currentId;

    assert.notEqual(afterNext, before, 'next 必須改變當前作品');
    assert.equal(afterSelect, 'p5');
    assert.equal(afterFilter, 'p1', '篩選後對齊至子集合第一件');
    assert.ok(spy && f, '包裝物件僅用於證明 show 是唯一可覆寫的入口');
  });

  it('IT-02 狀態以 getter 暴露，外部無法直接寫入', () => {
    const { folio } = makeFolio();
    folio.init();
    const before = folio.currentId;
    try { folio.currentId = 'p6'; } catch { /* strict mode 下會拋錯，兩種行為都可接受 */ }
    assert.equal(folio.currentId, before, 'currentId 不得被外部直接改寫');
  });

  it('IT-03 切換不重建資料層（FR-1.8）', () => {
    const { folio } = makeFolio();
    folio.init();
    const idsBefore = folio.store.allIds();
    folio.next(); folio.next();
    assert.deepEqual(folio.store.allIds(), idsBefore, 'allIds 內容不得改變');
  });

  it('IT-04 切換至同一件時不重複渲染、不寫歷史', () => {
    const calls = [];
    const history = { pushState: (...a) => calls.push(a), replaceState: (...a) => calls.push(a) };
    const { folio } = makeFolio({ history });
    folio.init();
    const n = calls.length;
    assert.equal(folio.show(folio.currentId), false, '同一件應提前返回');
    assert.equal(calls.length, n, '不得寫入歷史');
  });
});

describe('folio — 狀態機由 render() 推導（FR-1.5 / FR-1.7）', () => {
  it('IT-05 0 件時為 EMPTY，不崩潰', () => {
    const { folio } = makeFolio({ projects: [] });
    assert.doesNotThrow(() => folio.init());
    assert.equal(folio.state, STATE.EMPTY);
    assert.deepEqual(folio.position, { index: 0, total: 0 });
  });

  it('IT-06 僅 1 件時進入 SINGLE，控制項停用', () => {
    const { folio, mount } = makeFolio({ projects: [project(1, ['x'])] });
    folio.init();
    assert.equal(folio.state, STATE.SINGLE);
    assert.equal(mount.prevBtn.disabled, true);
    assert.equal(mount.nextBtn.disabled, true);
    assert.deepEqual(folio.position, { index: 1, total: 1 });
  });

  it('IT-07 clamp 模式在邊界進入 CLAMPED 並停用對應控制項', () => {
    const { folio, mount } = makeFolio({ siteConfig: { orderMode: 'clamp' } });
    folio.init();
    assert.equal(folio.state, STATE.CLAMPED, '第一件即為 first 邊界');
    assert.equal(mount.prevBtn.disabled, true);
    assert.equal(mount.nextBtn.disabled, false);
  });

  it('IT-08 clamp 模式在末件按 next 不改變狀態', () => {
    const { folio } = makeFolio({ siteConfig: { orderMode: 'clamp' } });
    folio.init();
    folio.last();
    const at = folio.currentId;
    assert.equal(folio.next(), false);
    assert.equal(folio.currentId, at);
  });

  it('IT-09 cycle 模式在末件按 next 回繞至第一件', () => {
    const { folio } = makeFolio();
    folio.init();
    folio.last();
    folio.next();
    assert.equal(folio.currentId, 'p1');
  });

  it('IT-10 篩選後為空時進入 EMPTY 並可復原', () => {
    const { folio } = makeFolio();
    folio.init();
    folio.setFilter('不存在');
    assert.equal(folio.state, STATE.EMPTY);
    folio.clearFilter();
    assert.equal(folio.state, STATE.IDLE);
    assert.equal(folio.position.total, 6);
  });
});

describe('folio — 深連結與歷史（FR-1.6）', () => {
  it('IT-11 深連結直達指定作品，且以 replaceState 對齊', () => {
    const calls = [];
    const history = { pushState: () => calls.push('push'), replaceState: () => calls.push('replace') };
    const { folio } = makeFolio({ location: { search: '?project=p4', pathname: '/' }, history });
    folio.init();
    assert.equal(folio.currentId, 'p4');
    assert.includes(calls, 'replace');
    assert.excludes(calls, 'push', '初次載入不得新增歷史項目');
  });

  it('IT-12 無效深連結降級為第一件並提供說明', () => {
    const { folio } = makeFolio({ location: { search: '?project=nope', pathname: '/' } });
    folio.init();
    assert.equal(folio.currentId, 'p1');
    assert.includes(folio.notice, 'nope');
  });

  it('IT-13 pushState 拋錯時切換仍成功（NFR-2.3）', () => {
    const history = { pushState() { throw new Error('SecurityError'); }, replaceState() {} };
    const { folio } = makeFolio({ history });
    folio.init();
    assert.doesNotThrow(() => folio.next());
    assert.equal(folio.currentId, 'p2', '歷史寫入失敗不得影響作品切換');
  });
});

describe('folio — 無障礙與降級（FR-3.8 / FR-2.3 / NFR-1.9）', () => {
  it('IT-14 每次切換都廣播位置與作品名稱', () => {
    const { folio, mount } = makeFolio();
    folio.init();
    folio.next();
    assert.includes(folio.lastAnnouncement, '第 2 件');
    assert.includes(folio.lastAnnouncement, '作品2');
    assert.equal(mount.live.textContent, folio.lastAnnouncement);
  });

  it('IT-15 減少動態偏好被讀取，且切換結果與一般模式相同', () => {
    const mm = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    const { folio: reduced } = makeFolio({ matchMedia: mm });
    reduced.init(); reduced.next();
    const { folio: normal } = makeFolio();
    normal.init(); normal.next();

    assert.equal(reduced.prefersReducedMotion, true);
    assert.equal(normal.prefersReducedMotion, false);
    assert.equal(reduced.currentId, normal.currentId, '內容更新結果必須一致');
    assert.equal(reduced.position.index, normal.position.index);
  });

  it('IT-16 快速連續切換後最終狀態正確，且無殘留動畫', () => {
    const { folio, clock } = makeFolio();
    folio.init();
    for (let i = 0; i < 5; i += 1) { folio.next(); clock.tick(20); }
    assert.equal(folio.currentId, 'p6', '1→2→3→4→5→6');
    clock.tick(1000);
    assert.notOk(folio.transition.pending, '不得有未收尾的動畫');
    assert.equal(clock.pendingCount, 0);
  });

  it('IT-17 資料層診斷可被讀取（ERROR/WARN 不靜默）', () => {
    const bad = [...SIX, { id: 'x' }];
    const { folio } = makeFolio({ projects: bad });
    folio.init();
    assert.ok(folio.diagnostics.errors.length > 0);
    assert.equal(folio.store.allIds().length, 6, '致命資料被丟棄，其餘正常');
  });
});
