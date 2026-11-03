import { MotionConfig } from 'motion/react';
import { useState } from 'react';
import { FilterBar } from './components/FilterBar';
import { Hero } from './components/Hero';
import { SiteFooter } from './components/SiteFooter';
import { SiteHeader } from './components/SiteHeader';
import { WorkGrid } from './components/WorkGrid';
import { isCategoryFilter, works, type CategoryFilter } from './data/works';
import './App.css';

function readCategoryFromUrl(): CategoryFilter {
  const value = new URLSearchParams(window.location.search).get('category');
  return isCategoryFilter(value) ? value : 'all';
}

export default function App() {
  const [category, setCategory] = useState<CategoryFilter>(readCategoryFromUrl);

  // 分類寫進網址（?category=），分享連結時保留篩選狀態；不新增歷史紀錄
  const handleCategoryChange = (next: CategoryFilter) => {
    setCategory(next);
    const url = new URL(window.location.href);
    if (next === 'all') url.searchParams.delete('category');
    else url.searchParams.set('category', next);
    window.history.replaceState(null, '', url);
  };

  const visibleWorks = category === 'all' ? works : works.filter((work) => work.category === category);

  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#wall">跳到作品牆</a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <section className="works" id="wall" aria-labelledby="wall-title">
          <div className="page">
            <div className="works__head">
              <h2 className="works__title" id="wall-title">全部練習</h2>
              <p className="works__hint">滑鼠停在印樣上，截圖會往下捲把整頁看完；點標題直接打開那一頁。</p>
            </div>
            <FilterBar value={category} onChange={handleCategoryChange} resultCount={visibleWorks.length} />
            <WorkGrid works={visibleWorks} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </MotionConfig>
  );
}
