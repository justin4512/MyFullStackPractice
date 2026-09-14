import { describe, it, assert } from '../harness.mjs';
import {
  normalizeProjects, stepIndex, createStore, validateOutcome,
  altHasInformation, linkLabelIsDescriptive, SUMMARY_MAX_LENGTH,
} from '../../assets/js/store.mjs';

/** 最小合規作品 —— 只含必填欄位（對應測試資料集 DS-E） */
const base = (over = {}) => ({
  id: 'a', order: 10, title: 'A', summary: '摘要',
  role: { label: '前端', scope: '全部' },
  problem: { problem: 'p', goal: 'g' },
  visual: { src: 'a.svg', alt: '一張說明介面版面配置的示意圖', width: 16, height: 10 },
  ...over,
});

describe('store — 排序與必填欄位（DR-1 / FR-3.3）', () => {
  it('UT-STORE-01 依 order 遞增排序，與輸入順序無關', () => {
    // DS-D 的設計要點：輸入順序刻意不等於 order，否則排序缺陷會被掩蓋
    const input = [base({ id: 'c', order: 30 }), base({ id: 'a', order: 10 }), base({ id: 'b', order: 20 })];
    const { projects } = normalizeProjects(input);
    assert.deepEqual(projects.map((p) => p.id), ['a', 'b', 'c']);
  });

  it('UT-STORE-02 order 相同時維持輸入順序（穩定排序）', () => {
    const input = [base({ id: 'x', order: 10 }), base({ id: 'y', order: 10 })];
    const { projects } = normalizeProjects(input);
    assert.deepEqual(projects.map((p) => p.id), ['x', 'y']);
  });

  it('UT-STORE-03 缺 id 或 order 為致命錯誤，該筆被丟棄', () => {
    const noId = base(); delete noId.id;
    const noOrder = base({ id: 'b' }); delete noOrder.order;
    const { projects, errors } = normalizeProjects([noId, noOrder, base({ id: 'ok' })]);
    assert.deepEqual(projects.map((p) => p.id), ['ok']);
    assert.ok(errors.length >= 2);
  });

  it('UT-STORE-04 重複 id 被丟棄，前台不崩潰', () => {
    const { projects, errors } = normalizeProjects([base({ id: 'dup' }), base({ id: 'dup', order: 20 })]);
    assert.equal(projects.length, 1);
    assert.ok(errors.some((e) => e.message.includes('重複')));
  });

  it('UT-STORE-05 summary 超過 80 字為致命錯誤', () => {
    const { projects, errors } = normalizeProjects([base({ summary: '字'.repeat(SUMMARY_MAX_LENGTH + 1) })]);
    assert.equal(projects.length, 0);
    assert.ok(errors.some((e) => e.message.includes('超過')));
  });

  it('UT-STORE-06 summary 恰好 80 字通過（邊界為包含）', () => {
    const { projects } = normalizeProjects([base({ summary: '字'.repeat(SUMMARY_MAX_LENGTH) })]);
    assert.equal(projects.length, 1);
  });

  it('UT-STORE-07 visual 缺 width/height 為致命錯誤（FR-2.8 CLS）', () => {
    const p = base(); delete p.visual.width;
    const { projects, errors } = normalizeProjects([p]);
    assert.equal(projects.length, 0);
    assert.ok(errors.some((e) => e.message.includes('CLS')));
  });

  it('UT-STORE-08 缺 role.scope 為 WARN，作品仍保留', () => {
    const p = base(); delete p.role.scope;
    const { projects, warnings, errors } = normalizeProjects([p]);
    assert.equal(projects.length, 1, '不應丟棄');
    assert.equal(errors.length, 0);
    assert.ok(warnings.some((w) => w.message.includes('scope')));
  });

  it('UT-STORE-09 替代文字缺資訊量被擋下（FR-3.7）', () => {
    assert.notOk(altHasInformation('圖片'));
    assert.notOk(altHasInformation('screenshot'));
    assert.notOk(altHasInformation(''));
    assert.ok(altHasInformation('監控台主畫面，上方為告警清單'));
  });

  it('UT-STORE-10 連結文字未說明用途被擋下（FR-3.1）', () => {
    assert.notOk(linkLabelIsDescriptive('看更多'));
    assert.notOk(linkLabelIsDescriptive('Click here'));
    assert.ok(linkLabelIsDescriptive('閱讀完整設計歷程'));
  });

  it('UT-STORE-11 空資料集不崩潰（BP-13）', () => {
    const { projects, errors } = normalizeProjects([]);
    assert.equal(projects.length, 0);
    assert.equal(errors.length, 0);
  });

  it('UT-STORE-12 非陣列輸入回報錯誤而非拋例外', () => {
    assert.doesNotThrow(() => normalizeProjects(null));
    const { errors } = normalizeProjects(null);
    assert.ok(errors.length > 0);
  });
});

describe('store — 證據強度條件約束（FR-3.5）', () => {
  it('UT-STORE-13 measured 缺 source 為 ERROR', () => {
    const out = validateOutcome({ type: 'measured', text: '快了很多', value: 30, unit: '%' }, 'x');
    assert.ok(out.some((e) => e.message.includes('source')));
  });

  it('UT-STORE-14 measured 四個欄位齊備則通過', () => {
    const out = validateOutcome({
      type: 'measured', text: 't', value: 90, unit: '秒', source: 's', measuredAt: '2026-06',
    }, 'x');
    assert.equal(out.length, 0);
  });

  it('UT-STORE-15 非 measured 類型帶未標來源的數值為 ERROR', () => {
    const out = validateOutcome({ type: 'observed', text: '感覺變快', value: 30 }, 'x');
    assert.ok(out.some((e) => e.message.includes('未標示來源')));
  });

  it('UT-STORE-16 unmeasured 的 value 必須為 null', () => {
    assert.equal(validateOutcome({ type: 'unmeasured', text: 't', value: null }, 'x').length, 0);
    assert.ok(validateOutcome({ type: 'unmeasured', text: 't', value: 5 }, 'x').length > 0);
  });

  it('UT-STORE-17 未知證據型別為 ERROR', () => {
    assert.ok(validateOutcome({ type: 'shipped', text: 't' }, 'x').length > 0,
      'shipped 不是合法 enum——schema 用的是 delivered（SCH-03）');
    assert.equal(validateOutcome({ type: 'delivered', text: 't' }, 'x').length, 0);
  });
});

describe('store — 邊界模式（FR-1.5）', () => {
  it('UT-STORE-18 cycle：最後一件 next 回繞至第一件', () => {
    assert.equal(stepIndex(5, 6, 1, 'cycle'), 0);
  });

  it('UT-STORE-19 cycle：第一件 prev 回繞至最後一件（負數取模）', () => {
    assert.equal(stepIndex(0, 6, -1, 'cycle'), 5);
  });

  it('UT-STORE-20 clamp：最後一件 next 抵達邊界，回傳 null', () => {
    assert.equal(stepIndex(5, 6, 1, 'clamp'), null);
  });

  it('UT-STORE-21 clamp：第一件 prev 抵達邊界，回傳 null', () => {
    assert.equal(stepIndex(0, 6, -1, 'clamp'), null);
  });

  it('UT-STORE-22 clamp 模式在非邊界處正常前進', () => {
    assert.equal(stepIndex(2, 6, 1, 'clamp'), 3);
  });

  it('UT-STORE-23 count 為 0 或索引越界時回傳 null，不拋例外', () => {
    assert.equal(stepIndex(0, 0, 1, 'cycle'), null);
    assert.equal(stepIndex(9, 6, 1, 'cycle'), null);
    assert.equal(stepIndex(-1, 6, 1, 'cycle'), null);
  });
});

describe('store — 篩選與位置（FR-1.4 / FR-1.7）', () => {
  const six = () => normalizeProjects(
    [1, 2, 3, 4, 5, 6].map((n) => base({
      id: `p${n}`, order: n * 10, title: `作品${n}`,
      categories: n <= 2 ? ['互動體驗'] : ['Web App'],
    })),
  ).projects;

  it('UT-STORE-24 position 為 1-based 且與可見集合一致', () => {
    const s = createStore(six());
    assert.deepEqual(s.position(), { index: 1, total: 6 });
    s.select('p4');
    assert.deepEqual(s.position(), { index: 4, total: 6 });
  });

  it('UT-STORE-25 篩選後當前作品不在子集合則對齊至第一件', () => {
    const s = createStore(six());
    s.select('p6');                       // Web App
    const r = s.setFilter('互動體驗');     // p6 不在其中
    assert.equal(r.alignedTo, 'p1');
    assert.equal(s.currentId, 'p1');
    assert.deepEqual(s.position(), { index: 1, total: 2 });
  });

  it('UT-STORE-26 篩選後當前作品仍在子集合則位置不變', () => {
    const s = createStore(six());
    s.select('p2');
    s.setFilter('互動體驗');
    assert.equal(s.currentId, 'p2');
    assert.deepEqual(s.position(), { index: 2, total: 2 });
  });

  it('UT-STORE-27 篩選結果為空時回報 empty，不拋例外', () => {
    const s = createStore(six());
    const r = s.setFilter('不存在的分類');
    assert.equal(r.empty, true);
    assert.deepEqual(s.position(), { index: 0, total: 0 });
  });

  it('UT-STORE-28 清除篩選後回到全集合', () => {
    const s = createStore(six());
    s.setFilter('互動體驗');
    s.clearFilter();
    assert.equal(s.visibleIds().length, 6);
  });

  it('UT-STORE-29 篩選後 step 只在子集合內移動', () => {
    const s = createStore(six());
    s.setFilter('互動體驗');   // p1, p2
    s.select('p2');
    assert.equal(s.step(1).id, 'p1', 'cycle 應在 2 件的子集合內回繞');
  });

  it('UT-STORE-30 needsFilterBar 僅在超過門檻時為真（FR-1.7）', () => {
    assert.notOk(createStore(six()).needsFilterBar(), '6 件不需篩選列');
    const twelve = normalizeProjects([...Array(12)].map((_, i) => base({ id: `q${i}`, order: (i + 1) * 10 }))).projects;
    assert.ok(createStore(twelve).needsFilterBar(), '12 件需要篩選列');
  });

  it('UT-STORE-31 step 只計算不改變狀態（單一入口的前提）', () => {
    const s = createStore(six());
    const before = s.currentId;
    s.step(1);
    assert.equal(s.currentId, before, 'step 不得自行更新 currentId');
  });

  it('UT-STORE-32 單件時 atBoundary 首尾皆為真', () => {
    const one = normalizeProjects([base({ id: 'only' })]).projects;
    const s = createStore(one, { orderMode: 'clamp' });
    assert.deepEqual(s.atBoundary, { first: true, last: true });
    assert.deepEqual(s.position(), { index: 1, total: 1 });
  });
});
