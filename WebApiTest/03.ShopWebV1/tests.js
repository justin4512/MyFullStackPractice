/* ============================================================================
   賈斯汀 AI 課程網站 ─ 單元 / 整合測試
   ---------------------------------------------------------------------------
   對應 docs/02_TDD.md 的案例編號（T-xx 單元、I-xx 整合）
   執行方式：以瀏覽器開啟 tests.html
============================================================================ */
'use strict';

/* ----------------------------------------------------------------------------
   極輕量測試框架（零依賴）
---------------------------------------------------------------------------- */
const Runner = (function () {
  const suites = [];
  let current = null;

  function describe(title, fn) {
    current = { title: title, cases: [] };
    suites.push(current);
    fn();
    current = null;
  }

  function it(title, fn) {
    current.cases.push({ title: title, fn: fn });
  }

  /** 深度比較（僅支援 JSON 可序列化資料，足夠本專案使用） */
  function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function expect(actual) {
    return {
      toBe: function (expected) {
        if (actual !== expected) {
          throw new Error('期望 ' + JSON.stringify(expected) + '，實際得到 ' + JSON.stringify(actual));
        }
      },
      toEqual: function (expected) {
        if (!deepEqual(actual, expected)) {
          throw new Error('期望 ' + JSON.stringify(expected) + '，實際得到 ' + JSON.stringify(actual));
        }
      },
      toContain: function (sub) {
        if (String(actual).indexOf(sub) === -1) {
          throw new Error('期望字串包含「' + sub + '」，實際得到 ' + JSON.stringify(actual));
        }
      },
      notToContain: function (sub) {
        if (String(actual).indexOf(sub) !== -1) {
          throw new Error('期望字串「不」包含「' + sub + '」，實際得到 ' + JSON.stringify(actual));
        }
      },
      toBeTruthy: function () {
        if (!actual) throw new Error('期望為真值，實際得到 ' + JSON.stringify(actual));
      },
      toBeFalsy: function () {
        if (actual) throw new Error('期望為假值，實際得到 ' + JSON.stringify(actual));
      }
    };
  }

  async function run(mount) {
    let pass = 0, fail = 0;
    const frag = document.createDocumentFragment();

    for (const suite of suites) {
      const box = document.createElement('section');
      box.className = 'suite';
      box.innerHTML = '<h2>' + suite.title + '</h2>';

      for (const c of suite.cases) {
        const row = document.createElement('div');
        try {
          await c.fn();
          pass++;
          row.className = 'case ok';
          row.innerHTML = '<span class="mark">✔</span>' + c.title;
        } catch (err) {
          fail++;
          row.className = 'case ng';
          row.innerHTML = '<span class="mark">✘</span>' + c.title +
                          '<div class="err">' + (err && err.message ? err.message : err) + '</div>';
        }
        box.appendChild(row);
      }
      frag.appendChild(box);
    }

    mount.appendChild(frag);
    return { pass: pass, fail: fail, total: pass + fail };
  }

  return { describe: describe, it: it, expect: expect, run: run };
})();

const describe = Runner.describe;
const it = Runner.it;
const expect = Runner.expect;

/* 取得受測的純函式 */
const T = window.JustinAI.__test__;


/* ============================================================================
   2.1 parseSeats ─ 解析剩餘名額
============================================================================ */
describe('T-01~08　parseSeats：剩餘名額解析', function () {
  it('T-01 「剩餘 15 個名額」→ 15', function () {
    expect(T.parseSeats('剩餘 15 個名額', 50)).toBe(15);
  });
  it('T-02 「熱銷中 (剩 5 名)」→ 5', function () {
    expect(T.parseSeats('熱銷中 (剩 5 名)', 50)).toBe(5);
  });
  it('T-03 數字型別 12 → 12', function () {
    expect(T.parseSeats(12, 50)).toBe(12);
  });
  it('T-04 空字串 → 回傳開課上限 50', function () {
    expect(T.parseSeats('', 50)).toBe(50);
  });
  it('T-05 null / undefined → 50', function () {
    expect(T.parseSeats(null, 50)).toBe(50);
    expect(T.parseSeats(undefined, 50)).toBe(50);
  });
  it('T-06 「已額滿」→ 0', function () {
    expect(T.parseSeats('已額滿', 50)).toBe(0);
  });
  it('T-07 負數夾擠為 0', function () {
    expect(T.parseSeats('剩餘 -3 個', 50)).toBe(0);
  });
  it('T-08 超過上限夾擠為 50', function () {
    expect(T.parseSeats('剩餘 999 個', 50)).toBe(50);
  });
});

/* ============================================================================
   2.2 seatLabel ─ 名額文字與樣式等級
============================================================================ */
describe('T-10~14　seatLabel：名額文字與稀缺提示', function () {
  it('T-10 42 → normal「還剩 42 個名額」', function () {
    expect(T.seatLabel(42, 50)).toEqual({ level: 'normal', text: '還剩 42 個名額' });
  });
  it('T-11 25（門檻邊界）→ normal', function () {
    expect(T.seatLabel(25, 50).level).toBe('normal');
  });
  it('T-12 24 → low「僅剩 24 名，欲購從速」', function () {
    expect(T.seatLabel(24, 50)).toEqual({ level: 'low', text: '僅剩 24 名，欲購從速' });
  });
  it('T-13 1 → low', function () {
    expect(T.seatLabel(1, 50)).toEqual({ level: 'low', text: '僅剩 1 名，欲購從速' });
  });
  it('T-14 0 → soldout「名額已滿」', function () {
    expect(T.seatLabel(0, 50)).toEqual({ level: 'soldout', text: '名額已滿' });
  });
});

/* ============================================================================
   2.3 normalizeCourse ─ 試算表列轉前端模型
============================================================================ */
describe('T-20~24　normalizeCourse：資料正規化', function () {
  const row = {
    id: 'AI-101', name: '生成式 AI 職場生產力倍增實戰', category: '職場應用',
    description: '描述文字', price: 3200,
    imageUrl: 'https://example.com/a.jpg', status: '剩餘 15 個名額'
  };

  it('T-20 完整資料列：欄位映射正確且附加 remaining', function () {
    const c = T.normalizeCourse(row, 0);
    expect(c.id).toBe('AI-101');
    expect(c.category).toBe('職場應用');
    expect(c.price).toBe(3200);
    expect(c.remaining).toBe(15);
  });
  it('T-21 price 為「NT$ 3,200」→ 轉為數字 3200', function () {
    const c = T.normalizeCourse(Object.assign({}, row, { price: 'NT$ 3,200' }), 0);
    expect(c.price).toBe(3200);
  });
  it('T-22 欄位大小寫不一致（ImageUrl / NAME）仍可取值', function () {
    const c = T.normalizeCourse({ ID: 'AI-999', NAME: '大小寫測試', ImageUrl: 'https://x/y.png', PRICE: 100 }, 0);
    expect(c.id).toBe('AI-999');
    expect(c.name).toBe('大小寫測試');
    expect(c.imageUrl).toBe('https://x/y.png');
    expect(c.price).toBe(100);
  });
  it('T-23 缺少 id → 自動產生 TMP-n', function () {
    const c = T.normalizeCourse({ name: '無編號課程' }, 4);
    expect(c.id).toBe('TMP-5');
  });
  it('T-24 缺少 imageUrl → 空字串（交由 UI 走 SVG 佔位流程）', function () {
    const c = T.normalizeCourse({ id: 'X', name: 'Y' }, 0);
    expect(c.imageUrl).toBe('');
  });
});

/* ============================================================================
   2.4 formatCurrency ─ 金額格式化
============================================================================ */
describe('T-30~33　formatCurrency：金額格式化', function () {
  it('T-30 3200 → NT$ 3,200', function () { expect(T.formatCurrency(3200)).toBe('NT$ 3,200'); });
  it('T-31 0 → NT$ 0',          function () { expect(T.formatCurrency(0)).toBe('NT$ 0'); });
  it('T-32 "4500" → NT$ 4,500', function () { expect(T.formatCurrency('4500')).toBe('NT$ 4,500'); });
  it('T-33 NaN / null → NT$ 0', function () {
    expect(T.formatCurrency(NaN)).toBe('NT$ 0');
    expect(T.formatCurrency(null)).toBe('NT$ 0');
  });
});

/* ============================================================================
   2.5 購物車 Reducer
============================================================================ */
describe('T-40~47　購物車：不可變更新與金額計算', function () {
  const courseA = { id: 'AI-101', name: 'A 課程', price: 3200, imageUrl: '', remaining: 15 };
  const courseB = { id: 'AI-110', name: 'B 課程', price: 8200, imageUrl: '', remaining: 2 };

  it('T-40 加入新課程 → 長度 1、數量 1', function () {
    const cart = T.cartAdd([], courseA);
    expect(cart.length).toBe(1);
    expect(cart[0].qty).toBe(1);
  });
  it('T-41 重複加入同一課程 → 不新增列，數量變 2', function () {
    const cart = T.cartAdd(T.cartAdd([], courseA), courseA);
    expect(cart.length).toBe(1);
    expect(cart[0].qty).toBe(2);
  });
  it('T-42 cartAdd 為不可變操作（原陣列不被修改）', function () {
    const origin = T.cartAdd([], courseA);
    const next = T.cartAdd(origin, courseA);
    expect(origin[0].qty).toBe(1);
    expect(next[0].qty).toBe(2);
  });
  it('T-43 cartChangeQty(+1) → 數量 +1', function () {
    const cart = T.cartAdd([], courseA);
    const r = T.cartChangeQty(cart, 'AI-101', 1);
    expect(r.items[0].qty).toBe(2);
    expect(r.capped).toBeFalsy();
  });
  it('T-44 數量由 1 減到 0 → 該項被移除', function () {
    const cart = T.cartAdd([], courseA);
    const r = T.cartChangeQty(cart, 'AI-101', -1);
    expect(r.items.length).toBe(0);
    expect(r.removed).toBeTruthy();
  });
  it('T-45 數量已達剩餘名額 → 不再增加並回報 capped', function () {
    let cart = T.cartAdd([], courseB);          // remaining = 2
    cart = T.cartChangeQty(cart, 'AI-110', 1).items;  // qty = 2
    const r = T.cartChangeQty(cart, 'AI-110', 1);     // 想加到 3
    expect(r.capped).toBeTruthy();
    expect(r.items[0].qty).toBe(2);
  });
  it('T-46 cartRemove 僅移除指定項目', function () {
    const cart = T.cartAdd(T.cartAdd([], courseA), courseB);
    const r = T.cartRemove(cart, 'AI-101');
    expect(r.length).toBe(1);
    expect(r[0].id).toBe('AI-110');
  });
  it('T-47 cartTotals 計算門數 / 堂數 / 總金額', function () {
    let cart = T.cartAdd(T.cartAdd([], courseA), courseB); // A×1 + B×1
    cart = T.cartChangeQty(cart, 'AI-101', 1).items;       // A×2
    expect(T.cartTotals(cart)).toEqual({ count: 2, qty: 3, total: 3200 * 2 + 8200 });
    expect(T.cartTotals([])).toEqual({ count: 0, qty: 0, total: 0 });
  });
});

/* ============================================================================
   2.6 Payload 組裝
============================================================================ */
describe('T-50~53　Payload：送出資料格式', function () {
  const cart = [{ id: 'AI-101', name: 'A 課程', price: 3200, qty: 2, remaining: 15 }];

  it('T-50 buildOrderPayload 結構正確（含折數欄位）', function () {
    const p = T.buildOrderPayload('王小明', cart);
    expect(p.action).toBe('order');
    expect(p.customerName).toBe('王小明');
    expect(p.items).toEqual([{
      id: 'AI-101', name: 'A 課程',
      price: 3200, basePrice: 3200, discount: 100,
      qty: 2, subtotal: 6400
    }]);
    expect(p.totalPrice).toBe(6400);
  });
  it('T-50b 有折扣時：以折後價計價並帶出折數', function () {
    const discounted = [{ id: 'AI-101', name: 'A 課程', basePrice: 3200, discount: 85, price: 2720, qty: 2 }];
    const p = T.buildOrderPayload('王小明', discounted);
    expect(p.items[0].discount).toBe(85);
    expect(p.items[0].price).toBe(2720);
    expect(p.totalPrice).toBe(5440);
  });
  it('T-51 姓名前後空白自動 trim', function () {
    expect(T.buildOrderPayload('  王小明  ', cart).customerName).toBe('王小明');
  });
  it('T-52 buildAddPayload：price 轉為數字、action 為 add', function () {
    const p = T.buildAddPayload({ name: 'N', category: 'C', description: 'D', price: '4800', imageUrl: 'u' });
    expect(p.action).toBe('add');
    expect(p.price).toBe(4800);
    expect(p.status).toContain('50');
  });
  it('T-53 buildDeletePayload：action 為 delete 且帶 id', function () {
    expect(T.buildDeletePayload('AI-101')).toEqual({ action: 'delete', id: 'AI-101' });
  });
  it('T-54 buildReturnPayload：action 為 return 且帶 orderId（自動 trim）', function () {
    expect(T.buildReturnPayload('  ORD-20260909-001 ')).toEqual({ action: 'return', orderId: 'ORD-20260909-001' });
  });
});

/* ============================================================================
   2.6b 試算表資料清洗（圖片網址、空白列）
============================================================================ */
describe('T-90~96　資料清洗：圖片網址與空白列', function () {
  it('T-90 一般網址原樣保留（含 query string）', function () {
    const url = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80';
    expect(T.sanitizeImageUrl(url)).toBe(url);
  });
  it('T-91 Markdown 連結格式 [文字](網址) → 取出真實網址', function () {
    const url = 'https://images.unsplash.com/photo-1499750310107.jpg?w=800';
    expect(T.sanitizeImageUrl('[' + url + '](' + url + ')')).toBe(url);
  });
  it('T-92 純文字說明（例如「查看圖片」）→ 視為無圖', function () {
    expect(T.sanitizeImageUrl('查看圖片')).toBe('');
  });
  it('T-93 空值 / 空白 → 空字串', function () {
    expect(T.sanitizeImageUrl(null)).toBe('');
    expect(T.sanitizeImageUrl('   ')).toBe('');
  });
  it('T-94 內聯 data:image 允許通過', function () {
    expect(T.sanitizeImageUrl('data:image/svg+xml;charset=UTF-8,%3Csvg%3E')).toContain('data:image/svg+xml');
  });
  it('T-95 normalizeCourse 只採用 imageUrl 欄，不誤用「imageUrl (更換後穩定網址)」', function () {
    const c = T.normalizeCourse({
      id: 'AI-101', name: '測試',
      'imageUrl (更換後穩定網址)': '[https://old.example/a.jpg](https://old.example/a.jpg)',
      imageUrl: 'https://new.example/b.jpg'
    }, 0);
    expect(c.imageUrl).toBe('https://new.example/b.jpg');
  });
  it('T-96 isBlankCourseRow：id 與 name 皆空 → 視為空白列', function () {
    expect(T.isBlankCourseRow({ id: '', name: '', imageUrl: '查看圖片' })).toBeTruthy();
    expect(T.isBlankCourseRow({ id: 'AI-101', name: '' })).toBeFalsy();
    expect(T.isBlankCourseRow({ id: '', name: '課程名稱' })).toBeFalsy();
  });
});

/* ============================================================================
   2.6c 名額：試算表改以數字保存
============================================================================ */
describe('T-97~99　名額：status 欄位為純數字', function () {
  it('T-97 數字字串 "50" → 50', function () {
    expect(T.parseSeats('50', 50)).toBe(50);
  });
  it('T-98 結帳扣除後的 "48" → 48，且顯示為一般樣式', function () {
    expect(T.parseSeats('48', 50)).toBe(48);
    expect(T.seatLabel(48, 50).level).toBe('normal');
  });
  it('T-99 退貨回補不得超過開課上限（52 → 夾擠為 50）', function () {
    expect(T.parseSeats('52', 50)).toBe(50);
  });
});

/* ============================================================================
   2.6d 翻牌特價（折扣）
============================================================================ */
describe('T-100~110　翻牌特價：隨機折扣與鎖定', function () {
  it('T-100 randomDiscount 一律落在 75 ~ 99 之間的整數', function () {
    for (let i = 0; i < 300; i++) {
      const d = T.randomDiscount();
      expect(d >= 75 && d <= 99 && Number.isInteger(d)).toBeTruthy();
    }
  });
  it('T-101 300 次抽樣應涵蓋多種折數（確認確實是隨機）', function () {
    const set = {};
    for (let i = 0; i < 300; i++) set[T.randomDiscount()] = 1;
    expect(Object.keys(set).length > 8).toBeTruthy();
  });
  it('T-102 normalizeDiscount：超出範圍或非數字 → 100（原價）', function () {
    expect(T.normalizeDiscount(undefined)).toBe(100);
    expect(T.normalizeDiscount(0)).toBe(100);
    expect(T.normalizeDiscount(120)).toBe(100);
    expect(T.normalizeDiscount(60)).toBe(75);   // 低於下限夾擠為 75
    expect(T.normalizeDiscount(88)).toBe(88);
  });
  it('T-103 applyDiscount：3200 打 85 折 → 2720', function () {
    expect(T.applyDiscount(3200, 85)).toBe(2720);
  });
  it('T-104 applyDiscount：四捨五入到整數元（5800 打 87 折 → 5046）', function () {
    expect(T.applyDiscount(5800, 87)).toBe(5046);
  });
  it('T-105 applyDiscount：無折扣時回原價', function () {
    expect(T.applyDiscount(3200, 100)).toBe(3200);
    expect(T.applyDiscount(3200, undefined)).toBe(3200);
  });
  it('T-106 discountText：88 →「本次課程可打 88 折」', function () {
    expect(T.discountText(88)).toBe('本次課程可打 88 折');
  });
  it('T-107 lockDiscount：第一次翻牌抽出折數並標記 isNew', function () {
    const r = T.lockDiscount({}, 'AI-101');
    expect(r.isNew).toBeTruthy();
    expect(r.discount >= 75 && r.discount <= 99).toBeTruthy();
    expect(r.map['AI-101']).toBe(r.discount);
  });
  it('T-108 lockDiscount：重複翻牌沿用同一折數，且不再標記 isNew', function () {
    const first = T.lockDiscount({}, 'AI-101', 82);
    const second = T.lockDiscount(first.map, 'AI-101');
    const third = T.lockDiscount(second.map, 'AI-101');
    expect(second.discount).toBe(82);
    expect(third.discount).toBe(82);
    expect(second.isNew).toBeFalsy();
  });
  it('T-109 lockDiscount：不同課程各自獨立抽籤，且為不可變更新', function () {
    const a = T.lockDiscount({}, 'AI-101', 90);
    const b = T.lockDiscount(a.map, 'AI-102', 78);
    expect(b.map['AI-101']).toBe(90);
    expect(b.map['AI-102']).toBe(78);
    expect(a.map['AI-102'] === undefined).toBeTruthy();   // 原對照表未被修改
  });
  it('T-110 cartAdd：帶入折數時以折後價計價並保留定價', function () {
    const cart = T.cartAdd([], { id: 'AI-101', name: 'A', price: 4000, remaining: 10, discount: 80 });
    expect(cart[0].basePrice).toBe(4000);
    expect(cart[0].discount).toBe(80);
    expect(cart[0].price).toBe(3200);
    expect(T.cartTotals(cart).total).toBe(3200);
  });
  it('T-111 重複加入時會同步最新折數（修正「第一次加入時折扣尚未鎖定」的錯價）', function () {
    // 第一次在折扣尚未鎖定時加入 → 原價
    let cart = T.cartAdd([], { id: 'AI-111', name: 'B', price: 50000, remaining: 20 });
    expect(cart[0].discount).toBe(100);
    expect(cart[0].price).toBe(50000);

    // 折扣鎖定後再次加入 → 整列價格應被更新，而非沿用舊價
    cart = T.cartAdd(cart, { id: 'AI-111', name: 'B', price: 50000, remaining: 20, discount: 89 });
    expect(cart.length).toBe(1);
    expect(cart[0].qty).toBe(2);
    expect(cart[0].discount).toBe(89);
    expect(cart[0].price).toBe(44500);
    expect(T.cartTotals(cart).total).toBe(89000);
  });
  it('T-112 折後價會反映在送單 payload（不會送出未折扣金額）', function () {
    const cart = T.cartAdd([], { id: 'AI-111', name: 'B', price: 50000, remaining: 20, discount: 89 });
    const p = T.buildOrderPayload('王小明', cart);
    expect(p.items[0].discount).toBe(89);
    expect(p.items[0].price).toBe(44500);
    expect(p.totalPrice).toBe(44500);
  });
});

/* ============================================================================
   2.7 驗證函式
============================================================================ */
describe('T-60~65　驗證：送單與新增課程', function () {
  const cart = [{ id: 'AI-101', name: 'A', price: 100, qty: 1, remaining: 10 }];

  it('T-60 未填姓名 → 失敗且指向 customerName', function () {
    const r = T.validateOrder('', cart);
    expect(r.ok).toBeFalsy();
    expect(r.field).toBe('customerName');
  });
  it('T-61 購物車為空 → 失敗且指向 cart', function () {
    const r = T.validateOrder('王小明', []);
    expect(r.ok).toBeFalsy();
    expect(r.field).toBe('cart');
  });
  it('T-62 姓名與購物車皆有效 → 通過', function () {
    expect(T.validateOrder('王小明', cart).ok).toBeTruthy();
  });
  it('T-63 課程名稱空白 → 失敗且訊息提到「課程名稱」', function () {
    const r = T.validateCourseForm({ name: '', category: 'C', description: 'D', price: '100' });
    expect(r.ok).toBeFalsy();
    expect(r.message).toContain('課程名稱');
  });
  it('T-64 價格為負數 → 失敗且訊息提到價格', function () {
    const r = T.validateCourseForm({ name: 'N', category: 'C', description: 'D', price: '-5' });
    expect(r.ok).toBeFalsy();
    expect(r.field).toBe('price');
  });
  it('T-65 完整合法表單 → 通過', function () {
    expect(T.validateCourseForm({ name: 'N', category: 'C', description: 'D', price: '4800' }).ok).toBeTruthy();
  });
  it('T-66 開課名額超出 1~50 → 失敗且指向 seats', function () {
    const r = T.validateCourseForm({ name: 'N', category: 'C', description: 'D', price: '100', seats: '80' });
    expect(r.ok).toBeFalsy();
    expect(r.field).toBe('seats');
  });
  it('T-67 buildAddPayload：帶出管理員選擇的開課名額', function () {
    const p = T.buildAddPayload({ name: 'N', category: 'C', description: 'D', price: '100', seats: '20' });
    expect(p.seats).toBe(20);
    expect(p.status).toBe(20);
  });
  it('T-68 buildAddPayload：未選名額時預設為滿編 50', function () {
    const p = T.buildAddPayload({ name: 'N', category: 'C', description: 'D', price: '100' });
    expect(p.seats).toBe(50);
  });
});

/* ============================================================================
   2.8 安全性
============================================================================ */
describe('T-70~71　escapeHtml：XSS 防護', function () {
  it('T-70 角括號被轉義，不留下可執行標籤', function () {
    const out = T.escapeHtml('<img src=x onerror=alert(1)>');
    expect(out).notToContain('<img');
    expect(out).toContain('&lt;img');
  });
  it('T-71 & 與雙引號正確轉義', function () {
    expect(T.escapeHtml('AT&T "AI" 課程')).toBe('AT&amp;T &quot;AI&quot; 課程');
  });
});

/* ============================================================================
   2.9 API 回應解析
============================================================================ */
describe('T-80~82　parseApiResponse：回應解析', function () {
  it('T-80 success → ok:true 並帶出 data', function () {
    const r = T.parseApiResponse({ status: 'success', data: [1, 2] });
    expect(r.ok).toBeTruthy();
    expect(r.data).toEqual([1, 2]);
  });
  it('T-81 error → ok:false 並帶出後端訊息', function () {
    const r = T.parseApiResponse({ status: 'error', message: '不支援的 action' });
    expect(r.ok).toBeFalsy();
    expect(r.message).toBe('不支援的 action');
  });
  it('T-82 null / 非物件 → ok:false 且不拋例外', function () {
    expect(T.parseApiResponse(null).ok).toBeFalsy();
    expect(T.parseApiResponse('字串').ok).toBeFalsy();
  });
});

/* ============================================================================
   附加：圖片佔位 SVG
============================================================================ */
describe('附加　placeholderSvg：破圖防呆', function () {
  it('回傳可直接指派給 img.src 的 data URI', function () {
    const uri = T.placeholderSvg('AI 課程');
    expect(uri).toContain('data:image/svg+xml');
  });
  it('標題內容經過跳脫，不會注入標籤', function () {
    // 字串以拼接方式撰寫，避免在行內 <script> 情境中提前結束標籤
    const evil = '<' + 'script>alert(1)<' + '/script>';
    expect(decodeURIComponent(T.placeholderSvg(evil))).notToContain('<' + 'script>');
  });
});

/* ============================================================================
   整合測試：以 stub 取代 fetch
============================================================================ */
describe('I-01~03　資料串接（stub fetch）', function () {

  it('I-02 fetch 失敗（模擬斷網）→ 回傳 ok:false 且不拋例外', async function () {
    const origin = window.fetch;
    window.fetch = function () { return Promise.reject(new Error('Failed to fetch')); };
    try {
      const r = await T.apiPost({ action: 'order' });
      expect(r.ok).toBeFalsy();
      expect(r.message).toContain('連線失敗');
    } finally {
      window.fetch = origin;
    }
  });

  it('I-03 POST 以 text/plain 送出：method 正確、body 為 JSON 字串、不帶自訂 header', async function () {
    const origin = window.fetch;
    let captured = null;
    window.fetch = function (url, init) {
      captured = { url: url, init: init };
      return Promise.resolve({ text: function () { return Promise.resolve('{"status":"success","data":null}'); } });
    };
    try {
      const payload = { action: 'delete', id: 'AI-101' };
      const r = await T.apiPost(payload);
      expect(r.ok).toBeTruthy();
      expect(captured.init.method).toBe('POST');
      expect(JSON.parse(captured.init.body)).toEqual(payload);
      expect(captured.init.headers === undefined).toBeTruthy();   // 不得帶 header，避免 CORS 預檢
    } finally {
      window.fetch = origin;
    }
  });

  it('回應非 JSON（GAS 錯誤頁）→ 回報格式錯誤而非崩潰', async function () {
    const origin = window.fetch;
    window.fetch = function () {
      return Promise.resolve({ text: function () { return Promise.resolve('<!DOCTYPE html><html>error</html>'); } });
    };
    try {
      const r = await T.apiGet('read');
      expect(r.ok).toBeFalsy();
      expect(r.message).toContain('JSON');
    } finally {
      window.fetch = origin;
    }
  });

  it('離線模式 mockApi：order 會回傳模擬訂單編號', async function () {
    const r = await T.mockApi({ action: 'order' });
    expect(r.ok).toBeTruthy();
    expect(r.data.orderId).toContain('DEMO-');
  });
});


/* ============================================================================
   執行並輸出結果
============================================================================ */
window.addEventListener('DOMContentLoaded', async function () {
  const mount = document.getElementById('out');
  const summary = document.getElementById('summary');
  const started = performance.now();

  const result = await Runner.run(mount);
  const spent = Math.round(performance.now() - started);

  summary.className = result.fail === 0 ? 'summary pass' : 'summary fail';
  summary.innerHTML =
    '<b>' + (result.fail === 0 ? '全部通過 🎉' : '有測試未通過') + '</b>' +
    '<span>總計 ' + result.total + ' 項｜通過 ' + result.pass + '｜失敗 ' + result.fail + '｜耗時 ' + spent + ' ms</span>';
});
