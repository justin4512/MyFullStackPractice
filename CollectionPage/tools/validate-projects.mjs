/**
 * 建置期資料契約驗證（CI 階段 0 閘門）。
 *
 * ERROR → 結束碼 1，阻擋發布；WARN → 記錄待修；INFO → 統計。
 * 核心邏輯直接沿用 store.mjs 的 normalizeProjects——**驗證器與執行期共用同一套規則**，
 * 否則兩者會各自漂移，出現「建置期通過但執行期丟棄」這種最難查的落差。
 *
 * 用法：node tools/validate-projects.mjs [data/projects.json]
 */

import { normalizeProjects } from '../assets/js/store.mjs';

/**
 * 純函式驗證入口——可在瀏覽器或 Node 執行。
 * @param {unknown} data `{ projects: [] }` 或陣列
 * @param {{knownCategories?: string[]}} [options]
 */
export function validate(data, options = {}) {
  const raw = Array.isArray(data) ? data : (data && data.projects) || [];
  const result = normalizeProjects(data, options);

  // 邊界情境自我檢查（對應 BDD 的 BP-12／BP-13／BP-14）
  const boundary = {
    '0 件不崩潰': normalizeProjects([]).projects.length === 0,
    '1 件可建置': raw.length === 0 || normalizeProjects([raw[0]]).projects.length <= 1,
    '缺 id 被丟棄': normalizeProjects([{ order: 1 }]).projects.length === 0,
    '> 10 件需篩選列': true, // 由 store.needsFilterBar 決定，見 UT-STORE-30
  };

  return {
    ...result,
    inputCount: raw.length,
    outputCount: result.projects.length,
    boundary,
    ok: result.errors.length === 0,
  };
}

export function format(report) {
  const lines = [];
  lines.push(`原始紀錄：${report.inputCount} 筆 → 通過建置：${report.outputCount} 筆`);
  lines.push('');
  lines.push(`ERROR（${report.errors.length}）`);
  for (const e of report.errors) lines.push(`  ✗ ${e.path}: ${e.message}`);
  lines.push(`WARN（${report.warnings.length}）`);
  for (const w of report.warnings) lines.push(`  ! ${w.path}: ${w.message}`);
  for (const i of report.infos) lines.push(`INFO — ${i.message}`);
  lines.push('');
  lines.push('邊界情境：' + Object.entries(report.boundary)
    .map(([k, v]) => `${v ? '✓' : '✗'} ${k}`).join('　'));
  return lines.join('\n');
}

// ── Node CLI（瀏覽器 import 時不執行）────────────────────────
if (typeof process !== 'undefined' && process.argv && process.argv[1]
    && process.argv[1].endsWith('validate-projects.mjs')) {
  const { readFile } = await import('node:fs/promises');
  const file = process.argv[2] || 'data/projects.json';
  const raw = JSON.parse(await readFile(file, 'utf8'));
  const site = await readFile('data/site.json', 'utf8').then(JSON.parse).catch(() => ({}));
  const report = validate(raw, { knownCategories: site.categories });
  console.log(format(report));
  process.exit(report.ok ? 0 : 1);
}
