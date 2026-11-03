import rawWorks from './works.json';
import swatchData from './swatches.json';
import thumbSizes from './thumbs.json';

export const CATEGORIES = [
  { id: 'all', label: '全部' },
  { id: 'landing', label: '形象網站' },
  { id: 'layout', label: '切版與版面' },
  { id: 'bootstrap', label: 'Bootstrap' },
  { id: 'javascript', label: 'JavaScript 互動' },
  { id: 'webapi', label: '資料與應用' },
  { id: 'tool', label: '互動工具' },
] as const;

export type CategoryFilter = (typeof CATEGORIES)[number]['id'];
export type CategoryId = Exclude<CategoryFilter, 'all'>;

export type WorkVersion = { label: string; path: string };

export type Work = {
  id: string;
  title: string;
  summary: string;
  category: CategoryId;
  /** 相對於 repo 根目錄的作品路徑 */
  path: string;
  /** 首次加入 repo 的日期（YYYY-MM-DD） */
  added: string;
  tags: string[];
  featured?: boolean;
  versions?: WorkVersion[];
};

export type ThumbSize = { width: number; height: number };

/** 依加入日期由新到舊排列 */
export const works: Work[] = [...(rawWorks as Work[])].sort((a, b) => b.added.localeCompare(a.added));

export const thumbs: Partial<Record<string, ThumbSize>> = thumbSizes;

/** 每件作品從自己的截圖取樣的代表色（scripts/extract-swatches.mjs 產生） */
export const swatches: Partial<Record<string, string>> = swatchData;

/** 其他版本的截圖 id：主版本用作品 id，其餘為 id__1、id__2… */
export function versionThumbId(workId: string, index: number): string {
  return index === 0 ? workId : `${workId}__${index}`;
}

export function categoryLabel(id: CategoryFilter): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function isCategoryFilter(value: string | null): value is CategoryFilter {
  return CATEGORIES.some((c) => c.id === value);
}

/** 作品網址：開發時指向 repo 根目錄的靜態伺服器，上線時為網站根目錄 */
export function workUrl(path: string): string {
  const base = new URL(import.meta.env.VITE_WORKS_BASE, window.location.href);
  return new URL(path, base).href;
}

export function thumbUrl(id: string): string {
  return `${import.meta.env.BASE_URL}thumbs/${id}.jpg`;
}
