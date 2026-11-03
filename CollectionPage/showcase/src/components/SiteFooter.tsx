import './SiteFooter.css';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page site-footer__inner">
        <p>這些頁面都放在 MyFullStackPractice 這個 repo 裡，點開的是實際運作的版本。</p>
        <p className="record">印樣由 headless Chromium 直接擷取自每一頁</p>
      </div>
    </footer>
  );
}
