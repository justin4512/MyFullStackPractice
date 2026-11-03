import { useState, type CSSProperties } from 'react';
import { swatches, thumbs, thumbUrl, versionThumbId, workUrl, works } from '../data/works';
import './Hero.css';

/** 開場拿「同一份需求、五種工具」這件作品做比較；找不到就退回第一件 */
const heroWork = works.find((work) => (work.versions?.length ?? 0) >= 3) ?? works[0];
const heroVersions = heroWork.versions?.length
  ? heroWork.versions
  : [{ label: '完成版', path: heroWork.path }];

export function Hero() {
  const [active, setActive] = useState(0);
  const current = heroVersions[active];

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="page hero__inner">
        <div className="hero__copy">
          <h1 className="hero__title" id="hero-title">
            <span className="phrase">同一份需求，</span>
            <span className="phrase">五種工具做出來的</span>
            <span className="phrase">五個樣子。</span>
          </h1>
          <p className="hero__lead">
            這面牆上有 {works.length} 件前端練習：切版、CSS 版面、JavaScript 互動、資料應用與教學工具。每一件都是實際做出來的網頁，點開就能操作。
          </p>
        </div>

        <figure className="hero__compare">
          <div className="hero__stage">
            {heroVersions.map((version, index) => {
              const id = versionThumbId(heroWork.id, index);
              const size = thumbs[id];
              return (
                <img
                  key={version.path}
                  className="hero__shot"
                  src={thumbUrl(id)}
                  alt={index === active ? `${heroWork.title}：${version.label}版本的頁面截圖` : ''}
                  width={size?.width}
                  height={size?.height}
                  data-active={index === active}
                  aria-hidden={index === active ? undefined : true}
                  decoding="async"
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              );
            })}
          </div>

          <div
            className="hero__strips"
            role="group"
            aria-label={`${heroWork.title}：選擇要看的版本`}
            style={{ '--strip-count': heroVersions.length } as CSSProperties}
          >
            {heroVersions.map((version, index) => (
              <button
                key={version.path}
                type="button"
                className="strip"
                aria-pressed={index === active}
                style={{
                  '--i': index,
                  '--strip-shot': `url(${thumbUrl(versionThumbId(heroWork.id, index))})`,
                  '--chip': swatches[heroWork.id] ?? 'var(--ink-soft)',
                } as CSSProperties}
                onClick={() => setActive(index)}
              >
                <span className="strip__shot" aria-hidden="true" />
                <span className="strip__label">{version.label}</span>
              </button>
            ))}
          </div>

          <figcaption className="hero__caption">
            <span className="hero__caption-title">{heroWork.title}</span>
            <span className="record">{heroWork.added}</span>
            <a className="hero__open" href={workUrl(current.path)} target="_blank" rel="noopener noreferrer">
              打開 {current.label} 版本
              <span className="visually-hidden">（在新分頁開啟）</span>
            </a>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
