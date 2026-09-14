/**
 * 資料層 — 正規化／驗證／排序／篩選／邊界／索引運算。
 * 純資料，不持有 DOM、不寫歷史、不渲染（README 第 4 部 §6.3）。
 */

export const SUMMARY_MAX_LENGTH = 80;
export const DEEPDIVE_LENGTH = Object.freeze({ min: 300, max: 500 });
export const DEFAULT_FILTER_THRESHOLD = 10;

/** 缺資訊量的 alt 常見樣板（FR-3.7 的第一道濾網，非充分條件） */
const LOW_INFO_ALT = [
  'image', 'img', 'photo', 'picture', 'screenshot', 'graphic',
  '圖', '圖片', '照片', '截圖', '示意圖', '主視覺', 'banner', 'logo',
];

/** 未說明用途的連結文字（FR-3.1） */
const VAGUE_LINK_LABELS = [
  '看更多', '更多', '點這裡', '這裡', '連結', 'link', 'click here', 'here', 'more', 'read more',
];

const EVIDENCE_TYPES = ['measured', 'observed', 'qualitative', 'delivered', 'unmeasured'];

const issue = (level, path, message) => ({ level, path, message });

/**
 * alt 是否具資訊量。規則啟發式，可能誤判或漏判——
 * README 第 5 部 §9.3 已將此列為已知盲區，人工複審仍為必要。
 */
export function altHasInformation(alt) {
  if (typeof alt !== 'string') return false;
  const trimmed = alt.trim();
  if (trimmed.length < 8) return false;
  const lower = trimmed.toLowerCase();
  return !LOW_INFO_ALT.some((t) => lower === t || lower === `${t}。` || lower === `${t}.`);
}

/** 連結文字是否說明用途 */
export function linkLabelIsDescriptive(label) {
  if (typeof label !== 'string') return false;
  const lower = label.trim().toLowerCase();
  if (!lower) return false;
  return !VAGUE_LINK_LABELS.includes(lower);
}

/**
 * 驗證單筆 outcomes 的證據強度條件約束（FR-3.5）。
 * @returns {{level:string,path:string,message:string}[]}
 */
export function validateOutcome(outcome, path) {
  const out = [];
  if (!outcome || typeof outcome !== 'object') {
    return [issue('ERROR', path, 'outcome 必須是物件')];
  }
  if (!EVIDENCE_TYPES.includes(outcome.type)) {
    out.push(issue('ERROR', path, `未知的證據型別 "${outcome.type}"`));
    return out;
  }
  if (typeof outcome.text !== 'string' || !outcome.text.trim()) {
    out.push(issue('ERROR', path, 'outcome.text 為必填'));
  }
  if (outcome.type === 'measured') {
    for (const field of ['value', 'unit', 'source', 'measuredAt']) {
      if (outcome[field] === undefined || outcome[field] === null || outcome[field] === '') {
        out.push(issue('ERROR', path, `type=measured 需提供 ${field}`));
      }
    }
  } else if (outcome.value !== undefined && outcome.value !== null) {
    // 非 measured 類型不得攜帶未標來源的量化數字
    out.push(issue('ERROR', path, '非 measured 類型不得出現未標示來源的量化數字（FR-3.5）'));
  }
  if (outcome.type === 'unmeasured' && outcome.value !== undefined && outcome.value !== null) {
    out.push(issue('ERROR', path, 'type=unmeasured 的 value 必須為 null'));
  }
  return out;
}

/**
 * 正規化並驗證作品資料。
 * ERROR → 丟棄該筆；WARN → 保留但記錄；INFO → 統計（README 第 4 部 §2.4）。
 *
 * @param {unknown} input 陣列，或 { projects: [] }
 * @param {{knownCategories?: string[]}} [options]
 * @returns {{projects: object[], errors: object[], warnings: object[], infos: object[]}}
 */
export function normalizeProjects(input, options = {}) {
  const errors = [];
  const warnings = [];
  const infos = [];

  const raw = Array.isArray(input) ? input
    : (input && Array.isArray(input.projects)) ? input.projects
    : null;

  if (raw === null) {
    errors.push(issue('ERROR', 'root', '資料必須是陣列或含 projects 陣列的物件'));
    return { projects: [], errors, warnings, infos };
  }

  const known = Array.isArray(options.knownCategories) ? options.knownCategories : null;
  const seenIds = new Set();
  const accepted = [];

  raw.forEach((p, i) => {
    const path = `project[${i}]`;
    const fatal = [];

    if (!p || typeof p !== 'object') {
      errors.push(issue('ERROR', path, '作品必須是物件'));
      return;
    }
    // ── 致命：缺 id / order 無法定位 ──────────────────────────
    if (typeof p.id !== 'string' || !p.id.trim()) fatal.push('缺少 id');
    if (!Number.isInteger(p.order) || p.order < 1) fatal.push('order 必須是 >= 1 的整數');
    if (typeof p.id === 'string' && seenIds.has(p.id)) fatal.push(`id "${p.id}" 重複`);

    // ── 致命：資料契約 ────────────────────────────────────────
    if (typeof p.title !== 'string' || !p.title.trim()) fatal.push('缺少 title');
    if (typeof p.summary !== 'string' || !p.summary.trim()) {
      fatal.push('缺少 summary');
    } else if ([...p.summary].length > SUMMARY_MAX_LENGTH) {
      fatal.push(`summary 超過 ${SUMMARY_MAX_LENGTH} 字（實際 ${[...p.summary].length}）`);
    }
    if (!p.role || typeof p.role !== 'object' || !p.role.label) fatal.push('缺少 role.label');
    if (!p.problem || typeof p.problem !== 'object' || !p.problem.problem || !p.problem.goal) {
      fatal.push('缺少 problem.problem 或 problem.goal');
    }
    if (!p.visual || typeof p.visual !== 'object') {
      fatal.push('缺少 visual');
    } else {
      if (!p.visual.src) fatal.push('缺少 visual.src');
      if (!Number.isInteger(p.visual.width) || !Number.isInteger(p.visual.height)) {
        fatal.push('visual.width／height 為必填——沒有尺寸就無法保證 CLS（FR-2.8）');
      }
      if (!altHasInformation(p.visual.alt)) fatal.push('visual.alt 缺乏資訊量（FR-3.7）');
    }

    (p.outcomes || []).forEach((o, oi) => {
      for (const e of validateOutcome(o, `${path}.outcomes[${oi}]`)) {
        if (e.level === 'ERROR') fatal.push(e.message);
      }
    });

    (p.links || []).forEach((l, li) => {
      if (!l || !linkLabelIsDescriptive(l.label)) {
        fatal.push(`links[${li}] 的 label 未說明用途（FR-3.1）`);
      }
      if (!l || typeof l.href !== 'string' || !l.href.trim()) {
        fatal.push(`links[${li}] 缺少 href`);
      }
    });

    (p.visuals || []).forEach((v, vi) => {
      if (!altHasInformation(v && v.alt)) fatal.push(`visuals[${vi}].alt 缺乏資訊量（FR-3.7）`);
    });

    if (p.confidentiality && p.confidentiality.redacted === true && !p.confidentiality.reason) {
      fatal.push('confidentiality.redacted 為 true 時 reason 必填（FR-3.9）');
    }

    if (fatal.length) {
      for (const m of fatal) errors.push(issue('ERROR', path, m));
      return; // 丟棄該筆
    }

    // ── 降級：保留該筆，省略對應區塊 ──────────────────────────
    if (!p.role.scope) {
      warnings.push(issue('WARN', `${path}.role`, '缺少 scope——無法區分「我」與「團隊」的貢獻'));
    }
    if (known && Array.isArray(p.categories)) {
      for (const c of p.categories) {
        if (!known.includes(c)) warnings.push(issue('WARN', `${path}.categories`, `分類 "${c}" 未登記於站台列舉`));
      }
    }
    if (p.deepDive && typeof p.deepDive.body === 'string') {
      const len = [...p.deepDive.body].length;
      if (len < DEEPDIVE_LENGTH.min) {
        warnings.push(issue('WARN', `${path}.deepDive`, `深度文案 ${len} 字，低於 ${DEEPDIVE_LENGTH.min} 字目標（FR-3.6）`));
      } else if (len > DEEPDIVE_LENGTH.max) {
        warnings.push(issue('WARN', `${path}.deepDive`, `深度文案 ${len} 字，超過 ${DEEPDIVE_LENGTH.max} 字上限（FR-3.6）`));
      }
    }

    seenIds.add(p.id);
    accepted.push(p);
  });

  // 依 order 遞增排序；order 相同時以輸入順序穩定排序
  const sorted = accepted
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.order - b.p.order) || (a.i - b.i))
    .map(({ p }) => p);

  // ── 統計 ──────────────────────────────────────────────────
  const withDeepDive = sorted.filter((p) => p.deepDive && p.deepDive.body).length;
  const byType = {};
  for (const p of sorted) for (const o of p.outcomes || []) byType[o.type] = (byType[o.type] || 0) + 1;
  const redacted = sorted.filter((p) => p.confidentiality && p.confidentiality.redacted).length;

  infos.push(issue('INFO', 'summary', `原始紀錄 ${raw.length} 筆 → 通過建置 ${sorted.length} 筆`));
  infos.push(issue('INFO', 'deepDive', `具深度文案 ${withDeepDive} 筆`));
  for (const t of EVIDENCE_TYPES) {
    if (byType[t]) infos.push(issue('INFO', 'outcomes', `${t} ${byType[t]} 筆`));
  }
  if (redacted) infos.push(issue('INFO', 'confidentiality', `受保密約束 ${redacted} 筆（FR-3.9 須附說明文字）`));

  return { projects: sorted, errors, warnings, infos };
}

/**
 * 計算相對切換的目標索引。**只計算，不改變狀態**（README 第 4 部 §3.1 的真實缺陷修正）。
 *
 * @param {number} currentIndex 0-based
 * @param {number} count 可見作品數
 * @param {number} delta +1 或 -1
 * @param {'cycle'|'clamp'} orderMode
 * @returns {number|null} 目標索引；clamp 模式抵達邊界時回傳 null
 */
export function stepIndex(currentIndex, count, delta, orderMode = 'cycle') {
  if (!Number.isInteger(count) || count <= 0) return null;
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= count) return null;
  if (!Number.isInteger(delta)) return null;

  const raw = currentIndex + delta;
  if (orderMode === 'clamp') {
    return (raw < 0 || raw >= count) ? null : raw;
  }
  return ((raw % count) + count) % count; // 含負數取模
}

/**
 * 建立資料層。
 * @param {object[]} projects 已正規化並排序的作品
 * @param {{orderMode?:'cycle'|'clamp', filterThreshold?:number}} [siteConfig]
 */
export function createStore(projects, siteConfig = {}) {
  const all = Array.isArray(projects) ? projects.slice() : [];
  const orderMode = siteConfig.orderMode === 'clamp' ? 'clamp' : 'cycle';
  const filterThreshold = Number.isInteger(siteConfig.filterThreshold)
    ? siteConfig.filterThreshold : DEFAULT_FILTER_THRESHOLD;

  let filter = null;         // null = 全部
  let currentId = all.length ? all[0].id : null;

  const visible = () => (filter === null
    ? all
    : all.filter((p) => Array.isArray(p.categories) && p.categories.includes(filter)));

  const api = {
    get orderMode() { return orderMode; },
    get filter() { return filter; },
    get currentId() { return currentId; },

    allIds: () => all.map((p) => p.id),
    all: () => all.slice(),
    visible,
    visibleIds: () => visible().map((p) => p.id),
    findById: (id) => all.find((p) => p.id === id) || null,
    indexOfVisible: (id) => visible().findIndex((p) => p.id === id),

    /** 全站分類清單（依首次出現順序） */
    categories() {
      const seen = [];
      for (const p of all) for (const c of p.categories || []) if (!seen.includes(c)) seen.push(c);
      return seen;
    },

    /** 是否需渲染篩選列：作品數 > 門檻才升為必要（FR-1.7） */
    needsFilterBar: () => all.length > filterThreshold,

    /** @returns {{index:number,total:number}} index 為 1-based；無可見作品時為 0 */
    position() {
      const list = visible();
      const i = list.findIndex((p) => p.id === currentId);
      return { index: i < 0 ? 0 : i + 1, total: list.length };
    },

    /** 邊界狀態；僅 clamp 模式有意義 */
    get atBoundary() {
      const list = visible();
      const i = list.findIndex((p) => p.id === currentId);
      if (i < 0 || list.length === 0) return { first: false, last: false };
      return { first: i === 0, last: i === list.length - 1 };
    },

    /** 選取。不在此寫歷史、不在此渲染。 */
    select(id) {
      if (!all.some((p) => p.id === id)) return false;
      currentId = id;
      return true;
    },

    /**
     * 設定篩選並對齊當前位置。
     * 篩選後為空 → 保留 currentId 不變，由 render() 推導 EMPTY（FR-1.7）。
     * @returns {{alignedTo: string|null, empty: boolean}}
     */
    setFilter(category) {
      filter = (category === null || category === undefined || category === '') ? null : category;
      const list = visible();
      if (list.length === 0) return { alignedTo: null, empty: true };
      if (!list.some((p) => p.id === currentId)) {
        currentId = list[0].id;
        return { alignedTo: currentId, empty: false };
      }
      return { alignedTo: currentId, empty: false };
    },

    clearFilter() { return api.setFilter(null); },

    /**
     * 只計算相對切換的目標，不改狀態。
     * @param {number} delta
     * @returns {{id: string|null, index: number|null, atBoundary: {first:boolean,last:boolean}}}
     */
    step(delta) {
      const list = visible();
      const from = list.findIndex((p) => p.id === currentId);
      const boundary = api.atBoundary;
      if (from < 0 || list.length === 0) return { id: null, index: null, atBoundary: boundary };
      const to = stepIndex(from, list.length, delta, orderMode);
      if (to === null) return { id: null, index: null, atBoundary: boundary };
      return { id: list[to].id, index: to, atBoundary: boundary };
    },
  };

  return api;
}
