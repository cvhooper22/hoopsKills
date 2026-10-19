import { useMemo } from 'react';
import { topCombos } from '../../../utils/lineupCombos';
import '../styles/TopCombos.css';

// The best player combinations by net, for each group size. `lineups` are the game's five-man lineups
// ({names, totalTime, totalNet}); a group's net is the net of every lineup that contained all of its players.
const SIZE_LABEL = { 5: '5-man', 4: '4-man', 3: '3-man', 2: '2-man' };
const lastName = (checkname) => checkname.split(',')[0];

function NetChip({ net }) {
  const cls = ['lr--net', net < 0 ? 'lr--net--neg' : net > 0 ? 'lr--net--pos' : ''].filter(Boolean).join(' ');
  return <span className={cls}>{net > 0 ? `+${net}` : net}</span>;
}

// The five-man lineups are the table below, so only the smaller groups are listed here.
export default function TopCombos({ lineups, sizes = [4, 3, 2], limit = 5 }) {
  const top = useMemo(() => topCombos(lineups, { sizes, limit }), [lineups, sizes, limit]);
  return (
    <section className="top-combos">
      <h3 className="top-combos__title">Top lineups by net</h3>
      <p className="top-combos__note">
        Net is points scored minus points allowed while those players were on the floor together, added up across every lineup that included them.
      </p>
      <div className="top-combos__grid">
        {sizes.map((k) => (
          <div className="top-combos__card" key={k}>
            <h4 className="top-combos__size">{SIZE_LABEL[k] ?? `${k}-man`}</h4>
            <ol className="top-combos__list">
              {top[k].map((c) => (
                <li className="top-combos__row" key={c.names.join('|')}>
                  <span className="top-combos__names">{c.names.map(lastName).join(' / ')}</span>
                  <span className="top-combos__mins">{c.minutes.toFixed(2)}</span>
                  <NetChip net={c.net} />
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p className="top-combos__legend">Minutes on the right of each name list; ties in net are ordered by minutes together.</p>
    </section>
  );
}
