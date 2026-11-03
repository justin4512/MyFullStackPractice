import { AnimatePresence, motion } from 'motion/react';
import type { Work } from '../data/works';
import { WorkPlate } from './WorkPlate';
import './WorkGrid.css';

/** 依日期分段：這批練習的看點是六週內的變化，日期就是牆面的骨架 */
function groupByDate(works: Work[]): [string, Work[]][] {
  const groups = new Map<string, Work[]>();
  for (const work of works) {
    groups.set(work.added, [...(groups.get(work.added) ?? []), work]);
  }
  return [...groups];
}

export function WorkGrid({ works }: { works: Work[] }) {
  return (
    <div className="wall">
      {groupByDate(works).map(([date, items]) => (
        <section className="wall__group" key={date} aria-labelledby={`date-${date}`}>
          <h3 className="wall__date" id={`date-${date}`}>
            <time dateTime={date}>{date.slice(5)}</time>
            <span className="record">{items.length} 件</span>
          </h3>
          <ul className="wall__plates" role="list">
            {/* initial={false}：一載入就是最終狀態，內容不等動畫。離場與重排才有動態 */}
            <AnimatePresence mode="popLayout" initial={false}>
              {items.map((work) => (
                <motion.li
                  key={work.id}
                  layout
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.2, layout: { type: 'spring', stiffness: 420, damping: 38 } }}
                >
                  <WorkPlate work={work} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      ))}
    </div>
  );
}
