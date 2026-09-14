/**
 * 簡報視圖層 — 純函式：投影片資料 → HTML 字串。
 * 與 view.mjs 同樣的紀律：不讀全域、不持有狀態、不附加動畫類別。
 */

import { escapeHtml } from './view.mjs';
import { normalizeEmbed } from './embed.mjs';

const esc = escapeHtml;

/** 換行符轉為 <br>，其餘一律跳脫 */
const multiline = (s) => esc(s).replace(/\n/g, '<br>');

const SLIDE_TYPES = ['cover', 'statement', 'embed', 'showcase', 'closing'];

/** 正規化投影片；未知型別降級為 statement，不丟棄內容 */
export function normalizeSlide(slide, index) {
  const s = slide || {};
  const id = typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `slide-${index + 1}`;
  return {
    ...s,
    id,
    index,
    type: SLIDE_TYPES.includes(s.type) ? s.type : 'statement',
    theme: s.theme === 'dark' ? 'dark' : 'light',
  };
}

export function normalizeDeck(data) {
  const raw = Array.isArray(data) ? data : (data && Array.isArray(data.slides) ? data.slides : []);
  const seen = new Set();
  const slides = [];
  const warnings = [];
  raw.forEach((s, i) => {
    const n = normalizeSlide(s, slides.length);
    if (seen.has(n.id)) { warnings.push(`投影片 id "${n.id}" 重複，已略過第 ${i + 1} 張`); return; }
    seen.add(n.id);
    slides.push(n);
  });
  return { slides, warnings, meta: (data && data.meta) || {} };
}

function renderFacts(facts) {
  if (!Array.isArray(facts) || facts.length === 0) return '';
  const items = facts.filter((f) => f && f.label && f.value).map((f) => `<li class="fact">
      <span class="fact__label">${esc(f.label)}</span>
      <span class="fact__value">${esc(f.value)}</span>
      ${f.note ? `<span class="fact__note">${esc(f.note)}</span>` : ''}
    </li>`).join('');
  return items ? `<ul class="fact-row">${items}</ul>` : '';
}

function renderActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) return '';
  const items = actions.filter((a) => a && a.label && a.href).map((a) => {
    const external = /^https?:/.test(a.href);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a class="deck-btn${a.primary ? ' deck-btn--primary' : ''}" href="${esc(a.href)}"${attrs}>${esc(a.label)}</a>`;
  }).join('');
  return items ? `<div class="deck-actions">${items}</div>` : '';
}

function renderHead(slide, { titleTag = 'h2' } = {}) {
  return `
    ${slide.eyebrow ? `<p class="slide__eyebrow">${esc(slide.eyebrow)}</p>` : ''}
    ${slide.kicker ? `<p class="slide__kicker">${esc(slide.kicker)}</p>` : ''}
    ${slide.title ? `<${titleTag} class="slide__title" id="${esc(slide.id)}-title">${multiline(slide.title)}</${titleTag}>` : ''}
    ${slide.lead ? `<p class="slide__lead">${multiline(slide.lead)}</p>` : ''}`;
}

/**
 * 嵌入區塊。
 *
 * iframe 一律先不帶 src（由 embed 管理器依當前頁掛載），並以 tabindex="-1"
 * ＋ aria-hidden 隔離，避免形成鍵盤陷阱（NFR-1.2）。使用者按下「進入」才解除。
 */
function renderEmbed(slide) {
  const e = normalizeEmbed(slide.embed);
  const frameId = `${slide.id}-frame`;

  if (!e.ok) {
    return `<div class="embed embed--placeholder" style="--embed-ratio:${esc(e.ratio)}">
      <div class="embed__note" role="note">
        <p class="embed__note-title">尚未設定嵌入內容</p>
        <p class="embed__note-text">${esc(e.placeholder || '請在 data/deck.json 的這一頁填入 embed.src。')}</p>
      </div>
    </div>`;
  }

  return `<div class="embed" style="--embed-ratio:${esc(e.ratio)}">
    <div class="embed__frame" data-embed-frame
         data-embed-index="${esc(slide.index)}"
         data-embed-src="${esc(e.src)}"
         data-embed-state="idle"
         data-embed-entered="false">
      <iframe id="${esc(frameId)}" title="${esc(e.title)}"
              tabindex="-1" aria-hidden="true"
              loading="lazy" referrerpolicy="no-referrer"
              sandbox="${esc(e.sandbox)}"
              allow="fullscreen"></iframe>
      <p class="embed__fallback">
        這個嵌入無法顯示。
        <a href="${esc(e.fallbackHref)}" target="_blank" rel="noopener noreferrer">${esc(e.fallbackLabel)}</a>
      </p>
    </div>
    <div class="embed__bar">
      <button type="button" class="deck-btn deck-btn--small" data-embed-enter aria-controls="${esc(frameId)}">
        進入這個作品操作
      </button>
      <button type="button" class="deck-btn deck-btn--small deck-btn--ghost" data-embed-leave hidden>
        離開（Esc）
      </button>
      <a class="deck-link" href="${esc(e.fallbackHref)}" target="_blank" rel="noopener noreferrer">
        ${esc(e.fallbackLabel)}<span class="visually-hidden">（在新分頁開啟）</span>
      </a>
    </div>
  </div>`;
}

function renderVisual(slide, baseUrl = '') {
  const v = slide.visual;
  if (!v || !v.src) return '';
  const src = baseUrl && !/^(https?:|data:|\/)/.test(v.src) ? baseUrl + v.src : v.src;
  return `<figure class="slide__figure">
    <img class="slide__img" src="${esc(src)}" alt="${esc(v.alt)}"
         width="${esc(v.width)}" height="${esc(v.height)}"
         loading="lazy" decoding="async">
  </figure>`;
}

/** 單張投影片。type 決定版面，theme 決定亮暗。 */
export function renderSlide(slide, opts = {}) {
  const s = slide;
  const isCover = s.type === 'cover';
  const titleTag = isCover ? 'h1' : 'h2';
  const body = {
    cover: () => `<div class="slide__inner slide__inner--center">
        ${renderHead(s, { titleTag })}
        ${s.hint ? `<p class="slide__hint" aria-hidden="true">${esc(s.hint)}</p>` : ''}
      </div>`,
    statement: () => `<div class="slide__inner slide__inner--center">
        ${renderHead(s, { titleTag })}
      </div>`,
    embed: () => `<div class="slide__inner slide__inner--wide">
        <div class="slide__head">${renderHead(s, { titleTag })}${renderFacts(s.facts)}</div>
        ${renderEmbed(s)}
      </div>`,
    showcase: () => `<div class="slide__inner slide__inner--split">
        <div class="slide__head">${renderHead(s, { titleTag })}${renderFacts(s.facts)}</div>
        ${renderVisual(s, opts.baseUrl)}
      </div>`,
    closing: () => `<div class="slide__inner slide__inner--center">
        ${renderHead(s, { titleTag })}
        ${renderActions(s.actions)}
      </div>`,
  }[s.type];

  return `<section class="slide" id="${esc(s.id)}"
      data-slide data-slide-id="${esc(s.id)}" data-slide-index="${esc(s.index)}"
      data-theme="${esc(s.theme)}" data-slide-type="${esc(s.type)}"
      aria-roledescription="投影片"
      aria-label="第 ${esc(s.index + 1)} 頁，共 ${esc(opts.total || 0)} 頁：${esc((s.title || '').replace(/\n/g, ' '))}">
    ${body ? body() : ''}
  </section>`;
}

export function renderDeck(slides, opts = {}) {
  if (!Array.isArray(slides) || slides.length === 0) {
    return `<section class="slide" data-theme="light"><div class="slide__inner slide__inner--center">
      <p class="slide__lead" role="status">目前沒有可顯示的投影片。</p>
    </div></section>`;
  }
  return slides.map((s) => renderSlide(s, { ...opts, total: slides.length })).join('');
}

/** 右側頁碼導覽。當前頁以 aria-current ＋ 加長的點雙重表達（不依賴顏色） */
export function renderDots(slides, currentIndex) {
  if (!Array.isArray(slides) || slides.length === 0) return '';
  return slides.map((s, i) => {
    const label = (s.title || s.id).replace(/\n/g, ' ');
    return `<li><button type="button" class="dot" data-goto="${esc(s.id)}"
      ${i === currentIndex ? 'aria-current="true"' : ''}>
      <span class="visually-hidden">第 ${i + 1} 頁：${esc(label)}</span>
    </button></li>`;
  }).join('');
}

/** 進度列寬度百分比 */
export function progressPercent(currentIndex, total) {
  if (!Number.isInteger(total) || total <= 1) return 100;
  const i = Math.min(Math.max(currentIndex, 0), total - 1);
  return Math.round((i / (total - 1)) * 100);
}
