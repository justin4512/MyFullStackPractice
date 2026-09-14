/**
 * 視圖層 — 純函式：輸入資料 → 輸出 HTML 字串（永遠是最終狀態）。
 * 不 import store.mjs 或 folio.mjs、不讀取全域、不附加動畫類別、不持有狀態。
 */

/** HTML 跳脫。所有來自資料的文字都必須經過此函式。 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const esc = escapeHtml;

/** 證據強度的顯示標籤（FR-3.5）。鍵名與 schema enum 一致——注意是 delivered 不是 shipped。 */
export const EVIDENCE_LABELS = Object.freeze({
  measured: '實測結果',
  observed: '觀察行為',
  qualitative: '質性回饋',
  delivered: '交付事實',
  unmeasured: '未量測',
});

/**
 * 主視覺。width/height 必填 → 版位在圖片載入前後完全相同（CLS 第一道防線）。
 * 缺圖時輸出可理解的替代文字，而非破圖或空白（NFR-2.5）。
 */
export function renderVisual(project, opts = {}) {
  const eager = opts.eager === true;
  // 資料裡的圖片路徑相對於站台根目錄；頁面若不在根目錄（例如 works/folio/），
  // 需以 baseUrl 解析，否則相對路徑會相對於該頁而失效。
  const base = opts.baseUrl || '';
  const resolve = (p) => (base && p && !/^(https?:|data:|\/)/.test(p) ? base + p : p);
  if (!project) return '';
  const v = project.visual;
  if (!v || !v.src) {
    return `<p class="folio-visual__fallback">此作品未提供主視覺圖片，說明文字如下方所述。</p>`;
  }
  const srcset = v.srcset ? ` srcset="${esc(resolve(v.srcset))}"` : "";
  const style = v.placeholder ? ` style="background-image:url(${esc(resolve(v.placeholder))})"` : "";
  return `<img class="folio-visual__img"${style}
    src="${esc(resolve(v.src))}"${srcset}
    alt="${esc(v.alt)}"
    width="${esc(v.width)}" height="${esc(v.height)}"
    decoding="async"
    loading="${eager ? 'eager' : 'lazy'}"${eager ? ' fetchpriority="high"' : ''}>`;
}

/** 位置指示（FR-1.4） */
export function renderPosition(position) {
  const { index = 0, total = 0 } = position || {};
  if (!total) return `<span class="folio-position__value">—</span>`;
  return `<span class="folio-position__value"><strong>${esc(index)}</strong> / ${esc(total)}</span>`;
}

function renderRole(role) {
  if (!role || !role.label) return '';
  const scope = role.scope
    ? `<p class="field__text"><span class="field__key">我負責</span>${esc(role.scope)}</p>` : '';
  const team = role.team
    ? `<p class="field__text field__text--muted"><span class="field__key">團隊</span>${esc(role.team)}</p>` : '';
  return `<section class="field">
    <h3 class="field__label">我的角色與貢獻</h3>
    <p class="field__lead">${esc(role.label)}</p>
    ${scope}${team}
  </section>`;
}

function renderProblem(problem) {
  if (!problem || !problem.problem || !problem.goal) return '';
  return `<section class="field">
    <h3 class="field__label">問題與目標</h3>
    <p class="field__text"><span class="field__key">問題</span>${esc(problem.problem)}</p>
    <p class="field__text"><span class="field__key">目標</span>${esc(problem.goal)}</p>
  </section>`;
}

function renderDecisions(decisions) {
  if (!Array.isArray(decisions) || decisions.length === 0) return '';
  const items = decisions.filter((d) => d && d.decision).map((d) => `<li class="decision">
      <p class="decision__what">${esc(d.decision)}</p>
      ${d.rationale ? `<p class="decision__why">${esc(d.rationale)}</p>` : ''}
    </li>`).join('');
  if (!items) return '';
  return `<section class="field">
    <h3 class="field__label">關鍵決策</h3>
    <ul class="decision-list">${items}</ul>
  </section>`;
}

function renderTech(tech) {
  if (!Array.isArray(tech) || tech.length === 0) return '';
  const chips = tech.map((t) => `<li class="chip chip--tech">${esc(t)}</li>`).join('');
  return `<section class="field">
    <h3 class="field__label">技術棧</h3>
    <ul class="chip-list">${chips}</ul>
  </section>`;
}

function renderOutcome(o) {
  const label = EVIDENCE_LABELS[o.type] || o.type;
  const hasValue = o.value !== undefined && o.value !== null;
  const metric = hasValue
    ? `<p class="evidence__metric"><span class="evidence__number">${esc(o.value)}</span>${o.unit ? `<span class="evidence__unit">${esc(o.unit)}</span>` : ''}</p>`
    : '';
  const src = o.source
    ? `<p class="evidence__source">來源：${esc(o.source)}${o.measuredAt ? `（${esc(o.measuredAt)}）` : ''}</p>`
    : '';
  return `<li class="evidence" data-evidence="${esc(o.type)}">
    <span class="evidence__badge">${esc(label)}</span>
    ${metric}
    <p class="evidence__text">${esc(o.text)}</p>
    ${src}
  </li>`;
}

function renderOutcomes(outcomes) {
  if (!Array.isArray(outcomes) || outcomes.length === 0) return '';
  const items = outcomes.filter((o) => o && o.type && o.text).map(renderOutcome).join('');
  if (!items) return '';
  return `<section class="field">
    <h3 class="field__label">成果</h3>
    <ul class="evidence-list">${items}</ul>
  </section>`;
}

function renderLinks(links) {
  if (!Array.isArray(links) || links.length === 0) return '';
  const items = links.filter((l) => l && l.label && l.href).map((l) => {
    const external = l.external !== false;
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    const hint = external ? '<span class="visually-hidden">（在新分頁開啟）</span>' : '';
    return `<li><a class="link-pill" data-kind="${esc(l.kind || 'article')}" href="${esc(l.href)}"${attrs}>${esc(l.label)}${hint}</a></li>`;
  }).join('');
  if (!items) return '';
  return `<section class="field">
    <h3 class="field__label">相關連結</h3>
    <ul class="link-list">${items}</ul>
  </section>`;
}

function renderConfidentiality(c) {
  if (!c || c.redacted !== true) return '';
  return `<aside class="notice notice--confidential" role="note">
    <span class="notice__badge">保密說明</span>
    <p class="notice__text">${esc(c.reason)}</p>
  </aside>`;
}

/**
 * 說明欄位。選填欄位缺漏時**整個區塊省略，而非輸出空標籤**（FR-3.3）。
 * @returns {{html: string, omitted: string[]}}
 */
export function renderHighlights(project) {
  if (!project) {
    return { html: '', omitted: [] };
  }
  const parts = [
    ['role', renderRole(project.role)],
    ['problem', renderProblem(project.problem)],
    ['decisions', renderDecisions(project.decisions)],
    ['tech', renderTech(project.tech)],
    ['outcomes', renderOutcomes(project.outcomes)],
    ['links', renderLinks(project.links)],
  ];
  const omitted = parts.filter(([, html]) => !html).map(([key]) => key);
  const meta = [
    project.year ? `<span class="folio-meta__item">${esc(project.year)}</span>` : '',
    ...(project.categories || []).map((c) => `<span class="folio-meta__item">${esc(c)}</span>`),
  ].filter(Boolean).join('');

  const html = `<header class="folio-head">
      <h2 class="folio-title" id="folio-title">${esc(project.title)}</h2>
      ${meta ? `<p class="folio-meta">${meta}</p>` : ''}
      <p class="folio-summary">${esc(project.summary)}</p>
    </header>
    ${renderConfidentiality(project.confidentiality)}
    <div class="folio-fields">${parts.map(([, h]) => h).join('')}</div>`;

  return { html, omitted };
}

/** 索引清單。當前項以 aria-current + 左側色條雙重表達（WCAG 1.4.1） */
export function renderIndexList(projects, currentId) {
  if (!Array.isArray(projects) || projects.length === 0) return '';
  return projects.map((p, i) => {
    const isCurrent = p.id === currentId;
    const meta = [p.year, ...(p.categories || [])].filter(Boolean).map(esc).join(' · ');
    return `<li class="index-list__item">
      <button type="button" class="index-list__btn" data-project-id="${esc(p.id)}"
        ${isCurrent ? 'aria-current="true"' : ''}>
        <span class="index-list__num">${String(i + 1).padStart(2, '0')}</span>
        <span class="index-list__title">${esc(p.title)}</span>
        ${meta ? `<span class="index-list__meta">${meta}</span>` : ''}
      </button>
    </li>`;
  }).join('');
}

/** 篩選列（FR-1.7）。已選取以 aria-pressed + 勾選符號雙重表達 */
export function renderFilterBar(categories, activeFilter) {
  if (!Array.isArray(categories) || categories.length === 0) return '';
  const chip = (value, label) => {
    const on = (value === null && !activeFilter) || value === activeFilter;
    return `<button type="button" class="chip chip--filter" data-filter="${value === null ? '' : esc(value)}"
      aria-pressed="${on ? 'true' : 'false'}">${on ? '<span aria-hidden="true">✓</span> ' : ''}${esc(label)}</button>`;
  };
  return [chip(null, '全部'), ...categories.map((c) => chip(c, c))].join('');
}

/** 空狀態。篩選造成的空狀態附「清除篩選」復原路徑（FR-1.7） */
export function renderEmpty({ reason = 'no-data', filter = null } = {}) {
  if (reason === 'filtered') {
    return `<div class="empty" role="status">
      <p class="empty__text">「${esc(filter)}」分類目前沒有作品。</p>
      <button type="button" class="btn btn--secondary" data-action="clear-filter">清除篩選，顯示全部作品</button>
    </div>`;
  }
  return `<div class="empty" role="status">
    <p class="empty__text">目前沒有可顯示的作品。</p>
  </div>`;
}

/** 深連結降級說明（FR-1.6） */
export function renderNotice(message) {
  if (!message) return '';
  return `<p class="notice notice--fallback" role="status">${esc(message)}</p>`;
}
