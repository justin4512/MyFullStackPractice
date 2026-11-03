import { CATEGORIES, categoryLabel, works, type CategoryFilter } from '../data/works';
import './FilterBar.css';

// 各分類件數只依賴靜態資料，模組載入時算一次即可
const CATEGORY_COUNTS = CATEGORIES.map((category) => ({
  ...category,
  count: category.id === 'all' ? works.length : works.filter((work) => work.category === category.id).length,
}));

type FilterBarProps = {
  value: CategoryFilter;
  onChange: (next: CategoryFilter) => void;
  resultCount: number;
};

export function FilterBar({ value, onChange, resultCount }: FilterBarProps) {
  return (
    <div className="filters">
      <div className="filters__row" role="group" aria-label="依類型篩選作品">
        {CATEGORY_COUNTS.map((category) => (
          <button
            key={category.id}
            type="button"
            className="filters__item"
            aria-pressed={category.id === value}
            onClick={() => onChange(category.id)}
          >
            {category.label}
            <span className="record filters__count">{category.count}</span>
          </button>
        ))}
      </div>
      <p className="record filters__status" role="status">
        {value === 'all' ? `牆上 ${resultCount} 件` : `${categoryLabel(value)} ${resultCount} 件`}
      </p>
    </div>
  );
}
