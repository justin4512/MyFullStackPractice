import { describe, it, assert, createFakeClock, createFakeElement } from '../harness.mjs';
import {
  resolveDirection, resolveDirectionForSource, planTransition,
  safetyDelayFor, createTransitionRunner, assertFocusRetained,
} from '../../assets/js/transition.mjs';
import {
  DURATION, DURATION_RANGE, CLEANUP_GRACE_MS, assertCompositedOnly,
  withinDurationBudget, distanceFor, FORBIDDEN_PROPERTIES,
  CHOREOGRAPHY, envelopeMs,
} from '../../assets/js/tokens.mjs';

describe('tokens — 權杖與可合成屬性（NFR-2.4）', () => {
  it('UT-TOK-01 預設轉場時長落在 FR-2.2 的 150–400ms 區間', () => {
    assert.between(DURATION.base, DURATION_RANGE.min, DURATION_RANGE.max);
    assert.ok(withinDurationBudget(DURATION.base));
  });

  it('UT-TOK-02 硬上限為 500ms，且保險清理有 100ms 餘裕', () => {
    assert.equal(DURATION.cap, 500);
    assert.equal(safetyDelayFor(DURATION.base), DURATION.base + CLEANUP_GRACE_MS);
    assert.equal(safetyDelayFor(9999), DURATION.cap + CLEANUP_GRACE_MS, '超長時長須被 cap 夾住');
  });

  it('UT-TOK-03 減少動態淡入 120ms 刻意低於 150ms 下限（ANIM-05 的明文豁免）', () => {
    assert.equal(DURATION.reducedFade, 120);
    assert.notOk(withinDurationBudget(DURATION.reducedFade),
      '此值不適用 FR-2.2 下限——減少動態路徑為獨立時長類別');
  });

  it('UT-TOK-04 位移距離依斷點切換（24px / 32px）', () => {
    assert.equal(distanceFor(375), 24);
    assert.equal(distanceFor(768), 32);
    assert.equal(distanceFor(1440), 32);
  });

  it('UT-TOK-05 assertCompositedOnly 會抓出禁止屬性', () => {
    assert.deepEqual(assertCompositedOnly({ keyframes: [{ opacity: 0 }, { transform: 'none' }] }), []);
    assert.deepEqual(assertCompositedOnly({ keyframes: [{ width: '10px', opacity: 0 }] }), ['width']);
    assert.includes(FORBIDDEN_PROPERTIES, 'width');
  });

  it('UT-TOK-06 整段分層編排不得超出 FR-2.2 的 400ms 預算', () => {
    const envelope = envelopeMs();
    assert.between(envelope, DURATION_RANGE.min, DURATION_RANGE.max,
      `編排總長 ${envelope}ms 必須落在 150–400ms 內——新增層或加大延遲時這條會先紅`);
    assert.ok(envelope <= DURATION.cap);
  });

  it('UT-TOK-07 錯開次數設有上限，避免欄位一多就超出預算', () => {
    const field = CHOREOGRAPHY.layers.find((l) => l.name === 'field');
    assert.ok(field.stagger > 0, '欄位層必須有錯開，否則整排一起動就沒有層次');
    assert.ok(field.staggerCap > 0, '必須有上限——欄位數是資料決定的，不能讓它無限累加');
  });

  it('UT-TOK-08 分層編排的每一層都被合成屬性檢查涵蓋', () => {
    // 刻意塞一個違規層，證明檢查不會只看頂層 keyframes
    const sneaky = { keyframes: [{ opacity: 0 }], layers: [{ keyframes: [{ marginTop: '4px' }] }] };
    assert.includes(assertCompositedOnly(sneaky), 'marginTop');
  });

  it('UT-TOK-09 巢狀的附屬動畫（縮放視差）也在檢查範圍內', () => {
    const nested = { keyframes: [{ opacity: 0 }], layers: [{ keyframes: [{ opacity: 0 }], zoom: { keyframes: [{ height: '10px' }] } }] };
    assert.includes(assertCompositedOnly(nested), 'height',
      '巢狀層若不走訪，就是一個可以繞過 NFR-2.4 的破口');
    assert.deepEqual(assertCompositedOnly(planTransition({ direction: 'next', viewportWidth: 1280 })), []);
  });

  it('UT-TOK-10 envelopeMs 必須把縮放這類附屬時長算進去', () => {
    const withZoom = { layers: [{ delay: 0, duration: 250, zoomDuration: 350 }] };
    assert.equal(envelopeMs(withZoom), 350,
      '只算 duration 會低估總長——實測時 CSS 端的 1.6 倍 calc 就是這樣漏掉的');
  });
});

describe('transition — 方向判定（FR-2.1）', () => {
  it('UT-TRANS-01 由相對位置判定，不由按鈕判定', () => {
    assert.equal(resolveDirection(1, 4), 'next');
    assert.equal(resolveDirection(4, 1), 'prev', '索引清單從第 5 項跳到第 2 項應往左');
  });

  it('UT-TRANS-02 同一位置為無方向', () => {
    assert.equal(resolveDirection(2, 2), 'none');
  });

  it('UT-TRANS-03 無空間語意的來源一律無方向', () => {
    for (const source of ['history', 'init', 'deeplink', 'filter']) {
      assert.equal(resolveDirectionForSource({ source, fromIndex: 0, toIndex: 5 }), 'none', source);
    }
    assert.equal(resolveDirectionForSource({ source: 'control', fromIndex: 0, toIndex: 5 }), 'next');
  });

  it('UT-TRANS-04 索引非整數時回傳無方向，不拋例外', () => {
    assert.equal(resolveDirection(undefined, 3), 'none');
    assert.equal(resolveDirection(-1.5, 3), 'none');
  });
});

describe('transition — 動畫計畫為純資料（FR-2.2 / FR-2.6 / NFR-2.4）', () => {
  it('UT-TRANS-05 計畫可序列化，且不觸碰 DOM 或計時器', () => {
    const plan = planTransition({ direction: 'next', viewportWidth: 1280 });
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(plan)));
    assert.equal(plan.mode, 'slide');
  });

  it('UT-TRANS-06 計畫只使用 transform 與 opacity', () => {
    for (const direction of ['next', 'prev']) {
      for (const reducedMotion of [false, true]) {
        const plan = planTransition({ direction, reducedMotion, viewportWidth: 1280 });
        assert.deepEqual(assertCompositedOnly(plan), [], `${direction}/${reducedMotion}`);
      }
    }
  });

  it('UT-TRANS-07 時長恆落在預算內（含硬上限斷言）', () => {
    const plan = planTransition({ direction: 'next' });
    assert.between(plan.duration, DURATION_RANGE.min, DURATION_RANGE.max);
    assert.ok(plan.duration <= DURATION.cap);
  });

  it('UT-TRANS-08 next 由右側進場、prev 由左側進場', () => {
    const next = planTransition({ direction: 'next', viewportWidth: 1280 });
    const prev = planTransition({ direction: 'prev', viewportWidth: 1280 });
    assert.includes(next.keyframes[0].transform, '32px');
    assert.includes(prev.keyframes[0].transform, '-32px');
    assert.equal(next.keyframes[1].transform, 'translate3d(0, 0, 0)');
  });

  it('UT-TRANS-09 減少動態時完全不位移——不是位移距離縮小版', () => {
    const plan = planTransition({ direction: 'next', reducedMotion: true, viewportWidth: 1280 });
    assert.equal(plan.mode, 'fade');
    assert.equal(plan.distancePx, 0);
    assert.equal(plan.duration, DURATION.reducedFade);
    for (const f of plan.keyframes) assert.equal(f.transform, undefined, '關鍵影格不得含 transform');
    assert.deepEqual(plan.layers, [], '分層編排整份作廢，不是「縮短的編排」');
  });

  it('UT-TRANS-09b 一般模式產生三層，各層位移倍率與延遲遞增', () => {
    const plan = planTransition({ direction: 'next', viewportWidth: 1280 });
    assert.equal(plan.layers.length, 3);
    assert.deepEqual(plan.layers.map((l) => l.name), ['visual', 'head', 'field']);
    assert.ok(plan.layers[1].distancePx > plan.layers[0].distancePx, '說明欄位位移須大於主視覺，才有前後感');
    assert.ok(plan.layers[2].delay > plan.layers[1].delay, '欄位層必須晚於標題層');
    assert.ok(plan.layers[0].zoom, '主視覺需有縮放層形成視差');
  });

  it('UT-TRANS-09c prev 方向時所有層一致向左，不得有層走反方向', () => {
    const plan = planTransition({ direction: 'prev', viewportWidth: 1280 });
    for (const l of plan.layers) assert.ok(l.dx < 0, `${l.name} 應為負向位移`);
  });

  it('UT-TRANS-10 direction 為 none 時回傳 null（畫面即最終狀態）', () => {
    assert.equal(planTransition({ direction: 'none' }), null);
    assert.equal(planTransition({}), null);
  });

  it('UT-TRANS-11 終點狀態與是否減少動態無關（E2E-15 的單元層對應）', () => {
    const normal = planTransition({ direction: 'next', viewportWidth: 1280 });
    const reduced = planTransition({ direction: 'next', reducedMotion: true, viewportWidth: 1280 });
    assert.equal(normal.keyframes.at(-1).opacity, 1);
    assert.equal(reduced.keyframes.at(-1).opacity, 1);
  });
});

describe('transition — 中斷與保險清理（FR-2.7）', () => {
  const setup = () => {
    const el = createFakeElement();
    const clock = createFakeClock();
    const runner = createTransitionRunner({ getTarget: () => el, clock });
    return { el, clock, runner };
  };

  it('UT-TRANS-12 play 後元素帶上進場類別，settle 後移除', () => {
    const { el, clock, runner } = setup();
    runner.play('next');
    assert.ok(el.classList.contains('is-entering'));
    assert.ok(runner.pending);
    el.dispatch('animationend');
    assert.notOk(el.classList.contains('is-entering'));
    assert.notOk(runner.pending);
    assert.equal(clock.pendingCount, 0, '保險計時器須被清掉');
  });

  it('UT-TRANS-13 animationend 未觸發時，保險清理仍執行', () => {
    const { el, clock, runner } = setup();
    runner.play('next');
    // 保險清理以**整段編排**為基準，不是只看主視覺那一層——
    // 否則說明欄位還在動的時候類別就被拔掉，最後一層會瞬間跳到終點。
    clock.tick(envelopeMs() + CLEANUP_GRACE_MS);   // 刻意不派送 animationend
    assert.notOk(el.classList.contains('is-entering'), '狀態不得永久卡在轉場中');
    assert.notOk(runner.pending);
    assert.equal(runner.stats.safetySettled, 1);
  });

  it('UT-TRANS-13b 保險清理不得早於編排結束', () => {
    const { el, clock, runner } = setup();
    runner.play('next');
    clock.tick(DURATION.base + CLEANUP_GRACE_MS);  // 只等主視覺那一層
    assert.ok(el.classList.contains('is-entering'), '欄位層尚未結束，類別不得被拔掉');
    assert.ok(runner.pending);
  });

  it('UT-TRANS-13c 說明欄位與主視覺同時被套用與清除', () => {
    const el = createFakeElement();
    const panel = createFakeElement();
    const clock = createFakeClock();
    const runner = createTransitionRunner({ getTarget: () => el, getPanel: () => panel, clock });
    runner.play('next');
    assert.ok(panel.classList.contains('is-entering'), '說明欄位也必須參與編排');
    assert.ok(el.classList.contains('is-entering'));
    runner.cancelInFlight();
    assert.notOk(panel.classList.contains('is-entering'), '取消時兩者都要回到基準狀態');
    assert.notOk(el.classList.contains('is-entering'));
  });

  it('UT-TRANS-14 連續快切：同時存活的動畫永遠不超過一個', () => {
    const { clock, runner } = setup();
    for (let i = 0; i < 5; i += 1) { runner.play('next'); clock.tick(20); }
    assert.ok(runner.pending, '最後一次仍在進行');
    assert.equal(clock.pendingCount, 1, '不得累積多個未收尾的計時器');
    assert.equal(runner.stats.cancelCalls, 5, '規則 1：每次 play 前都必須呼叫 cancelInFlight');
    assert.equal(runner.stats.cancelled, 4, '第 2～5 次各取消掉一個進行中的動畫（首次無可取消）');
    assert.equal(runner.stats.played, 5);
  });

  it('UT-TRANS-15 舊動畫的計時器不得為新動畫收尾', () => {
    const { el, clock, runner } = setup();
    runner.play('next');
    clock.tick(100);
    runner.play('prev');            // 新動畫開始，舊 token 失效
    clock.tick(DURATION.base + CLEANUP_GRACE_MS - 100 - 1);
    assert.ok(el.classList.contains('is-entering'), '舊計時器不應提前結束新動畫');
    assert.ok(runner.pending);
  });

  it('UT-TRANS-16 cancelInFlight 為同步且冪等', () => {
    const { el, runner } = setup();
    runner.play('next');
    assert.ok(runner.cancelInFlight());
    assert.notOk(el.classList.contains('is-entering'), '取消後畫面停在最終狀態');
    assert.notOk(runner.cancelInFlight(), '重複呼叫不應有副作用');
  });

  it('UT-TRANS-17 direction 為 none 時不播放、不建立計時器', () => {
    const { el, clock, runner } = setup();
    assert.equal(runner.play('none'), null);
    assert.equal(el._classes.length, 0);
    assert.equal(clock.pendingCount, 0);
  });

  it('UT-TRANS-18 監聽器在收尾後被移除，不累積', () => {
    const { el, runner } = setup();
    runner.play('next');
    el.dispatch('animationend');
    assert.equal(el._listenerTypes.length, 0);
  });

  it('UT-TRANS-19 焦點保留斷言（NFR-1.4）', () => {
    const a = {}; const b = {};
    assert.ok(assertFocusRetained(a, a));
    assert.notOk(assertFocusRetained(a, b));
  });
});
