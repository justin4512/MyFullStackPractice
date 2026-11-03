import type { CSSProperties } from 'react';
import { swatches, thumbs, thumbUrl, workUrl, type Work } from '../data/works';
import './WorkPlate.css';

/** 印樣框固定 16:10 */
const FRAME_RATIO = 10 / 16;

/** 整頁截圖比框高多少，hover 或聚焦時就往上捲多少（以圖片自身高度的百分比計） */
function previewShift(id: string): string {
  const size = thumbs[id];
  if (!size) return '0%';
  const ratio = size.height / size.width;
  if (ratio <= FRAME_RATIO) return '0%';
  return `${(-(1 - FRAME_RATIO / ratio) * 100).toFixed(2)}%`;
}

export function WorkPlate({ work }: { work: Work }) {
  const size = thumbs[work.id];
  const titleId = `plate-${work.id}`;
  const url = workUrl(work.path);
  const versions = work.versions ?? [];
  const others = versions.filter((version) => version.path !== work.path);

  return (
    <article
      className="plate"
      aria-labelledby={titleId}
      style={{
        '--chip': swatches[work.id] ?? 'var(--ink-soft)',
        '--preview-shift': previewShift(work.id),
      } as CSSProperties}
    >
      {/* 圖片與標題同一個網址：圖片連結不進 Tab 順序，鍵盤使用者只停一次 */}
      <a className="plate__frame" href={url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
        <img
          className="plate__shot"
          src={thumbUrl(work.id)}
          alt=""
          width={size?.width}
          height={size?.height}
          loading="lazy"
          decoding="async"
        />
      </a>

      <h4 className="plate__title" id={titleId}>
        <a href={url} target="_blank" rel="noopener noreferrer">
          {work.title}
          <span className="visually-hidden">（在新分頁開啟）</span>
        </a>
      </h4>

      <p className="plate__summary">{work.summary}</p>
      <p className="record">{work.tags.join('、')}</p>

      {others.length > 0 && (
        <div className="plate__versions">
          <span className="record plate__versions-count">{versions.length} 個版本</span>
          <ul className="plate__versions-list" role="list">
            {others.map((version) => (
              <li key={version.path}>
                <a href={workUrl(version.path)} target="_blank" rel="noopener noreferrer">
                  {version.label}
                  <span className="visually-hidden">（在新分頁開啟）</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
