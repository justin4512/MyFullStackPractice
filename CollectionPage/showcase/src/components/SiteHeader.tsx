import { works } from '../data/works';
import './SiteHeader.css';

const dates = works.map((work) => work.added).sort();
const span = `${dates[0]} – ${dates.at(-1)}`;

export function SiteHeader() {
  return (
    <header className="masthead">
      <div className="page masthead__inner">
        <a className="masthead__name" href="#main">練習印樣</a>
        <p className="record masthead__meta">
          <span>{works.length} 件</span>
          <span>{span}</span>
        </p>
      </div>
    </header>
  );
}
