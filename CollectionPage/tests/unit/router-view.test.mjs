import { describe, it, assert } from '../harness.mjs';
import { resolveDeepLink, urlForProject, createRouter } from '../../assets/js/router.mjs';
import {
  escapeHtml, renderVisual, renderHighlights, renderPosition,
  renderIndexList, renderFilterBar, renderEmpty, EVIDENCE_LABELS,
} from '../../assets/js/view.mjs';

const IDS = ['tidal', 'quiet', 'meridian'];

describe('router — 深連結解析（FR-1.6）', () => {
  it('UT-ROUTER-01 未指定時顯示第一件', () => {
    const r = resolveDeepLink('', IDS);
    assert.equal(r.id, 'tidal');
    assert.equal(r.fallback, false);
    assert.equal(r.message, null);
  });

  it('UT-ROUTER-02 合法 id 直達該作品', () => {
    const r = resolveDeepLink('?project=meridian', IDS);
    assert.equal(r.id, 'meridian');
    assert.equal(r.fallback, false);
  });

  it('UT-ROUTER-03 找不到的 id 降級為第一件，並提供明確說明', () => {
    const r = resolveDeepLink('?project=nope', IDS);
    assert.equal(r.id, 'tidal');
    assert.equal(r.fallback, true);
    assert.includes(r.message, 'nope');
    assert.includes(r.message, '第一件');
  });

  it('UT-ROUTER-04 空資料集時降級不拋例外', () => {
    assert.doesNotThrow(() => resolveDeepLink('?project=x', []));
    const r = resolveDeepLink('?project=x', []);
    assert.equal(r.id, null);
    assert.includes(r.message, '沒有可顯示的作品');
  });

  it('UT-ROUTER-05 其他查詢參數不影響解析', () => {
    assert.equal(resolveDeepLink('?utm=ad&project=quiet&ref=x', IDS).id, 'quiet');
  });

  it('UT-ROUTER-06 URL 組成會對 id 做編碼', () => {
    assert.equal(urlForProject('a b', '/'), '/?project=a%20b');
  });
});

describe('router — 歷史契約（FR-1.6 / NFR-2.3）', () => {
  const fakeHistory = (opts = {}) => {
    const calls = [];
    return {
      calls,
      pushState(state, t, url) { if (opts.throwOnPush) throw new Error('SecurityError'); calls.push(['push', state, url]); },
      replaceState(state, t, url) { calls.push(['replace', state, url]); },
    };
  };

  it('UT-ROUTER-07 切換寫入 pushState、初次載入寫入 replaceState', () => {
    const hist = fakeHistory();
    const r = createRouter({ history: hist, location: { search: '', pathname: '/' }, addEventListener: null });
    r.replace('tidal', 1);
    r.push('quiet', 2);
    assert.deepEqual(hist.calls.map((c) => c[0]), ['replace', 'push']);
    assert.includes(hist.calls[1][2], 'project=quiet');
  });

  it('UT-ROUTER-08 還原期間抑制回寫，避免 popstate→show→pushState 迴圈', () => {
    const hist = fakeHistory();
    const r = createRouter({ history: hist, location: { search: '', pathname: '/' }, addEventListener: null });
    r.duringRestore(() => { r.push('quiet', 2); });
    assert.equal(hist.calls.length, 0, '還原期間不得回寫');
    assert.equal(r.stats.suppressed, 1);
    r.push('quiet', 2);
    assert.equal(hist.calls.length, 1, '還原結束後恢復回寫');
  });

  it('UT-ROUTER-09 pushState 拋錯被吞掉，不連帶破壞切換', () => {
    const hist = fakeHistory({ throwOnPush: true });
    const r = createRouter({ history: hist, location: { search: '', pathname: '/' }, addEventListener: null });
    assert.doesNotThrow(() => r.push('quiet', 2));
    assert.equal(r.push('quiet', 2), false, '回報失敗，但不拋例外');
    assert.equal(r.stats.failed, 2);
  });

  it('UT-ROUTER-10 history 不可用時不拋例外', () => {
    const r = createRouter({ history: null, location: { search: '', pathname: '/' }, addEventListener: null });
    assert.doesNotThrow(() => r.push('x', 1));
  });
});

describe('view — 跳脫與欄位完整性（FR-3.1 / FR-3.3 / FR-3.7）', () => {
  const project = {
    id: 'a', order: 10, title: '作品 <A>', summary: '摘要 & 說明',
    year: 2026, categories: ['Web App'],
    role: { label: '前端', scope: '全部', team: '兩人' },
    problem: { problem: 'p', goal: 'g' },
    decisions: [{ decision: 'd1', rationale: 'r1' }],
    tech: ['TypeScript'],
    outcomes: [{ type: 'measured', text: 't', value: 90, unit: '秒', source: 's', measuredAt: '2026-06' }],
    links: [{ label: '閱讀設計歷程', href: 'https://e.com', kind: 'case-study', external: true }],
    visual: { src: 'a.svg', alt: '一張說明版面配置的示意圖', width: 16, height: 10 },
  };

  it('UT-VIEW-01 所有文字都經過跳脫', () => {
    assert.equal(escapeHtml('<script>"x"&\'y\''), '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;');
    const { html } = renderHighlights(project);
    assert.includes(html, '作品 &lt;A&gt;');
    assert.excludes(html, '<A>');
  });

  it('UT-VIEW-02 主視覺必定輸出 width/height（CLS 第一道防線）', () => {
    const html = renderVisual(project);
    assert.includes(html, 'width="16"');
    assert.includes(html, 'height="10"');
    assert.includes(html, 'alt="一張說明版面配置的示意圖"');
  });

  it('UT-VIEW-03 首屏主視覺為 eager 且 fetchpriority high', () => {
    assert.includes(renderVisual(project, { eager: true }), 'fetchpriority="high"');
    assert.includes(renderVisual(project, { eager: false }), 'loading="lazy"');
  });

  it('UT-VIEW-04 缺圖時輸出可理解的替代文字，而非破圖', () => {
    const html = renderVisual({ ...project, visual: null });
    assert.includes(html, '未提供主視覺圖片');
    assert.excludes(html, '<img');
  });

  it('UT-VIEW-05 選填欄位缺漏時整個區塊省略，不輸出空標籤', () => {
    const minimal = { ...project };
    delete minimal.decisions; delete minimal.tech; delete minimal.outcomes; delete minimal.links;
    const { html, omitted } = renderHighlights(minimal);
    assert.deepEqual(omitted, ['decisions', 'tech', 'outcomes', 'links']);
    assert.excludes(html, '關鍵決策');
    assert.excludes(html, '技術棧');
    assert.includes(html, '我的角色與貢獻', '必填區塊仍須輸出');
  });

  it('UT-VIEW-06 空陣列與缺欄位一樣被省略', () => {
    const { omitted } = renderHighlights({ ...project, tech: [], decisions: [] });
    assert.includes(omitted, 'tech');
    assert.includes(omitted, 'decisions');
  });

  it('UT-VIEW-07 證據型別使用 delivered 而非 shipped（SCH-03）', () => {
    assert.equal(EVIDENCE_LABELS.delivered, '交付事實');
    assert.equal(EVIDENCE_LABELS.shipped, undefined);
    const { html } = renderHighlights({ ...project, outcomes: [{ type: 'delivered', text: 'x' }] });
    assert.includes(html, 'data-evidence="delivered"');
    assert.includes(html, '交付事實');
  });

  it('UT-VIEW-08 measured 輸出數值與來源；非 measured 不輸出數值', () => {
    const m = renderHighlights(project).html;
    assert.includes(m, '90');
    assert.includes(m, '來源：s（2026-06）');
    const o = renderHighlights({ ...project, outcomes: [{ type: 'observed', text: 'x' }] }).html;
    assert.excludes(o, 'evidence__metric');
  });

  it('UT-VIEW-09 外部連結帶 noopener noreferrer 與新分頁提示', () => {
    const { html } = renderHighlights(project);
    assert.includes(html, 'rel="noopener noreferrer"');
    assert.includes(html, 'target="_blank"');
    assert.includes(html, '在新分頁開啟');
  });

  it('UT-VIEW-10 受保密約束時輸出說明（FR-3.9）', () => {
    const { html } = renderHighlights({ ...project, confidentiality: { redacted: true, reason: '客戶為受監管機構' } });
    assert.includes(html, '保密說明');
    assert.includes(html, '客戶為受監管機構');
    const none = renderHighlights({ ...project, confidentiality: { redacted: false } }).html;
    assert.excludes(none, '保密說明');
  });

  it('UT-VIEW-11 位置指示為 1-based；無作品時不顯示 0/0', () => {
    assert.includes(renderPosition({ index: 3, total: 6 }), '<strong>3</strong> / 6');
    assert.includes(renderPosition({ index: 0, total: 0 }), '—');
  });

  it('UT-VIEW-12 索引清單以 aria-current 標示當前項', () => {
    const html = renderIndexList([{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }], 'b');
    assert.equal((html.match(/aria-current="true"/g) || []).length, 1);
    assert.includes(html, 'data-project-id="b"');
  });

  it('UT-VIEW-13 篩選 chip 以 aria-pressed 與勾號雙重表達（不只靠顏色）', () => {
    const html = renderFilterBar(['Web App', '互動體驗'], '互動體驗');
    assert.includes(html, 'aria-pressed="true"');
    assert.includes(html, '✓');
    assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  });

  it('UT-VIEW-14 空狀態區分「無資料」與「篩選後為空」', () => {
    const noData = renderEmpty({ reason: 'no-data' });
    const filtered = renderEmpty({ reason: 'filtered', filter: '互動體驗' });
    assert.excludes(noData, 'clear-filter');
    assert.includes(filtered, 'clear-filter', '篩選造成的空狀態必須提供復原路徑');
    assert.includes(filtered, '互動體驗');
    assert.includes(noData, 'role="status"');
  });

  it('UT-VIEW-15 view 為純函式：同輸入同輸出，且不改動輸入', () => {
    const frozen = JSON.parse(JSON.stringify(project));
    const a = renderHighlights(project).html;
    const b = renderHighlights(project).html;
    assert.equal(a, b);
    assert.deepEqual(project, frozen);
  });
});
