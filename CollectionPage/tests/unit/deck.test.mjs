import { describe, it, assert } from '../harness.mjs';
import { normalizeEmbed, shouldMount, EMBED_KINDS, DEFAULT_SANDBOX } from '../../assets/js/embed.mjs';
import {
  normalizeSlide, normalizeDeck, renderSlide, renderDeck, renderDots, progressPercent,
} from '../../assets/js/slides.mjs';
import { stepSlide } from '../../assets/js/deck.mjs';
import { resolveDeepLink } from '../../assets/js/router.mjs';

const slide = (over = {}) => ({ id: 's1', type: 'statement', title: '標題', ...over });

describe('embed — 嵌入設定正規化（安全與降級）', () => {
  it('UT-EMBED-01 未知類型降級為 site，不丟棄設定', () => {
    const e = normalizeEmbed({ kind: '不存在', src: 'a.html' });
    assert.equal(e.kind, 'site');
    assert.equal(e.ratio, EMBED_KINDS.site);
  });

  it('UT-EMBED-02 空的 src 標記為未就緒，由呼叫端改顯示佔位說明', () => {
    assert.equal(normalizeEmbed({ src: '' }).ok, false);
    assert.equal(normalizeEmbed({ src: '   ' }).ok, false);
    assert.equal(normalizeEmbed({ src: 'x.html' }).ok, true);
  });

  it('UT-EMBED-03 預設沙箱不含 allow-top-navigation', () => {
    assert.excludes(DEFAULT_SANDBOX, 'allow-top-navigation',
      '嵌入內容不得把母頁面導走');
    assert.equal(normalizeEmbed({ src: 'x' }).sandbox, DEFAULT_SANDBOX);
  });

  it('UT-EMBED-04 一律有可存取名稱（iframe 的 title 為必要）', () => {
    assert.ok(normalizeEmbed({ src: 'x' }).title.length > 0);
    assert.equal(normalizeEmbed({ src: 'x', title: '  ' }).title, '嵌入的作品內容');
  });

  it('UT-EMBED-05 一律提供新分頁的替代路徑（BP-11 失效降級）', () => {
    const e = normalizeEmbed({ src: 'https://e.com/a' });
    assert.equal(e.fallbackHref, 'https://e.com/a');
    assert.ok(e.fallbackLabel.length > 0);
  });
});

describe('embed — 掛載半徑（效能）', () => {
  it('UT-EMBED-06 只掛載當前頁與前後各一頁', () => {
    assert.ok(shouldMount(3, 3));
    assert.ok(shouldMount(2, 3));
    assert.ok(shouldMount(4, 3));
    assert.notOk(shouldMount(1, 3), '距離 2 頁以上不得掛載——七個 iframe 會壓垮首屏');
    assert.notOk(shouldMount(5, 3));
  });

  it('UT-EMBED-07 半徑可調，非整數輸入回傳 false 而非拋錯', () => {
    assert.ok(shouldMount(1, 3, 2));
    assert.notOk(shouldMount(null, 3));
    assert.notOk(shouldMount(1, undefined));
  });
});

describe('slides — 投影片正規化與渲染', () => {
  it('UT-SLIDE-01 未知型別降級為 statement，內容不丟失', () => {
    const s = normalizeSlide({ id: 'x', type: '不存在', title: 'T' }, 0);
    assert.equal(s.type, 'statement');
    assert.equal(s.title, 'T');
  });

  it('UT-SLIDE-02 缺 id 時以索引補上，不丟棄該頁', () => {
    assert.equal(normalizeSlide({ type: 'cover' }, 2).id, 'slide-3');
  });

  it('UT-SLIDE-03 重複 id 被略過並記錄警告', () => {
    const { slides, warnings } = normalizeDeck({ slides: [slide(), slide()] });
    assert.equal(slides.length, 1);
    assert.equal(warnings.length, 1);
    assert.includes(warnings[0], 's1');
  });

  it('UT-SLIDE-04 索引連續，不因略過而跳號', () => {
    const { slides } = normalizeDeck({ slides: [slide({ id: 'a' }), slide({ id: 'a' }), slide({ id: 'b' })] });
    assert.deepEqual(slides.map((s) => s.index), [0, 1]);
  });

  it('UT-SLIDE-05 所有文字都經過跳脫', () => {
    const html = renderSlide(normalizeSlide(slide({ title: '<img onerror=x>', lead: '"&\'' }), 0), { total: 1 });
    assert.excludes(html, '<img onerror');
    assert.includes(html, '&lt;img');
  });

  it('UT-SLIDE-06 換行轉為 <br>，但其餘標記仍被跳脫', () => {
    const html = renderSlide(normalizeSlide(slide({ title: 'A\n<b>B</b>' }), 0), { total: 1 });
    assert.includes(html, 'A<br>&lt;b&gt;');
  });

  it('UT-SLIDE-07 每頁具備投影片語意與位置的可存取名稱', () => {
    const html = renderSlide(normalizeSlide(slide({ title: '第三頁' }), 2), { total: 7 });
    assert.includes(html, 'aria-roledescription="投影片"');
    assert.includes(html, '第 3 頁，共 7 頁');
  });

  it('UT-SLIDE-08 封面用 h1，其餘用 h2（標題階層不得亂）', () => {
    assert.includes(renderSlide(normalizeSlide(slide({ type: 'cover' }), 0), {}), '<h1 class="slide__title"');
    assert.includes(renderSlide(normalizeSlide(slide({ type: 'statement' }), 1), {}), '<h2 class="slide__title"');
  });

  it('UT-SLIDE-09 嵌入的 iframe 預設被隔離，不形成鍵盤陷阱', () => {
    const html = renderSlide(normalizeSlide(slide({ type: 'embed', embed: { src: 'a.html', title: 'A' } }), 0), {});
    assert.includes(html, 'tabindex="-1"');
    assert.includes(html, 'aria-hidden="true"');
    assert.includes(html, 'data-embed-enter', '必須提供顯式的進入方式');
    assert.includes(html, 'data-embed-leave', '必須提供顯式的離開方式');
  });

  it('UT-SLIDE-10 iframe 初始不帶 src——由掛載管理器依當前頁注入', () => {
    const html = renderSlide(normalizeSlide(slide({ type: 'embed', embed: { src: 'a.html' } }), 0), {});
    // 只看 <iframe …> 標籤本身；不能用整份 HTML 找 src="a.html"，
    // 因為 data-embed-src="a.html" 也包含那段子字串（此處原本誤判過一次）。
    const tag = html.match(/<iframe[^>]*>/)[0];
    assert.notOk(/\ssrc\s*=/.test(tag), `iframe 不得在渲染時就帶 src：${tag}`);
    assert.includes(html, 'data-embed-src="a.html"', '來源改存在 data 屬性，由掛載時注入');
  });

  it('UT-SLIDE-11 嵌入一律帶沙箱與 title', () => {
    const html = renderSlide(normalizeSlide(slide({ type: 'embed', embed: { src: 'a.html' } }), 0), {});
    assert.includes(html, 'sandbox="');
    assert.includes(html, 'title="');
  });

  it('UT-SLIDE-12 未設定 src 時顯示可理解的佔位說明，而非空白框', () => {
    const html = renderSlide(normalizeSlide(slide({ type: 'embed', embed: { src: '', placeholder: '請填入網址' } }), 0), {});
    assert.includes(html, '尚未設定嵌入內容');
    assert.includes(html, '請填入網址');
    assert.excludes(html, '<iframe');
  });

  it('UT-SLIDE-13 空簡報顯示狀態訊息而非空白', () => {
    const html = renderDeck([]);
    assert.includes(html, 'role="status"');
    assert.includes(html, '沒有可顯示的投影片');
  });

  it('UT-SLIDE-14 頁碼點以 aria-current 標示，且每個都有可存取名稱', () => {
    const { slides } = normalizeDeck({ slides: [slide({ id: 'a', title: 'A' }), slide({ id: 'b', title: 'B' })] });
    const html = renderDots(slides, 1);
    assert.equal((html.match(/aria-current="true"/g) || []).length, 1);
    assert.includes(html, '第 2 頁：B');
  });

  it('UT-SLIDE-15 外部連結帶 noopener noreferrer', () => {
    const html = renderSlide(normalizeSlide(slide({
      type: 'closing', actions: [{ label: '寄信', href: 'https://e.com' }],
    }), 0), {});
    assert.includes(html, 'rel="noopener noreferrer"');
  });
});

describe('deck — 邊界與進度（純函式）', () => {
  it('UT-DECK-01 簡報不回繞：末頁的下一頁為 null', () => {
    assert.equal(stepSlide(6, 7, 1), null, '簡報有明確的結束，不該繞回封面');
    assert.equal(stepSlide(0, 7, -1), null);
    assert.equal(stepSlide(3, 7, 1), 4);
  });

  it('UT-DECK-02 越界或空簡報回傳 null，不拋例外', () => {
    assert.equal(stepSlide(0, 0, 1), null);
    assert.equal(stepSlide(9, 7, 1), null);
    assert.equal(stepSlide(-1, 7, 1), null);
  });

  it('UT-DECK-03 進度百分比在首末頁為 0 與 100', () => {
    assert.equal(progressPercent(0, 7), 0);
    assert.equal(progressPercent(6, 7), 100);
    assert.equal(progressPercent(3, 7), 50);
    assert.equal(progressPercent(0, 1), 100, '單頁簡報視為已完成');
  });

  it('UT-DECK-04 深連結以 slide 為參數名解析', () => {
    const ids = ['cover', 'tidal'];
    assert.equal(resolveDeepLink('?slide=tidal', ids, 'slide').id, 'tidal');
    assert.equal(resolveDeepLink('?project=tidal', ids, 'slide').id, 'cover',
      '參數名不符時應降級為第一頁，而非誤判');
    assert.equal(resolveDeepLink('?slide=nope', ids, 'slide').fallback, true);
  });
});
