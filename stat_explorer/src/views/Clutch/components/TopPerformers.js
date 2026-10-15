import { useState } from "react";
import PlayerAvatar from "./PlayerAvatar";

const DEFAULT_MIN_FGA = 2;
const RUNNERS_UP = 2;

const efg = (p) => (p.fgm + 0.5 * p.tpm) / p.fga;
const stocks = (p) => p.stl + p.blk;
const stockParts = (p) => [p.stl && `${p.stl} STL`, p.blk && `${p.blk} BLK`].filter(Boolean).join(" · ");

const categories = (minFga) => [
  {
    title: "Points",
    eligible: (p) => p.pts > 0,
    value: (p) => p.pts,
    display: (p) => String(p.pts),
    detail: (p) => `${p.fgm}-${p.fga} FG · ${p.ftm}-${p.fta} FT`,
  },
  {
    title: "Stocks", note: "STL + BLK",
    eligible: (p) => stocks(p) > 0,
    value: stocks,
    display: (p) => String(stocks(p)),
    detail: stockParts,
  },
  {
    title: "Assists",
    eligible: (p) => p.ast > 0,
    value: (p) => p.ast,
    display: (p) => String(p.ast),
    detail: (p) => `${p.tov} TO`,
  },
  {
    title: "Off. rebounds",
    eligible: (p) => p.oreb > 0,
    value: (p) => p.oreb,
    display: (p) => String(p.oreb),
    detail: (p) => `${p.reb} REB`,
  },
  {
    title: "Shooting", note: `eFG% · min. ${minFga} FGA`,
    eligible: (p) => p.fga >= minFga,
    value: efg,
    display: (p) => `${(efg(p) * 100).toFixed(1)}%`,
    detail: (p) => `${p.fgm}-${p.fga} FG · ${p.tpm}-${p.tpa} 3P`,
  },
];

function rank(cat, players) {
  return players
    .filter(cat.eligible)
    .sort((a, b) => cat.value(b) - cat.value(a) || b.fga - a.fga || b.pts - a.pts);
}

// `minFga` is the shooting card's attempts minimum (a season needs more than a single game does).
// `expandable` adds a "Show all" toggle to each card, for lists longer than the runners-up.
export default function TopPerformers({ players, headshots, sub = "Clutch only", minFga = DEFAULT_MIN_FGA, expandable = false }) {
  const [open, setOpen] = useState({}); // card title -> showing the full list
  return (
    <section className="clutch-section">
      <h2 className="clutch-section__title">Top performers</h2>
      <p className="clutch-section__sub">{sub}</p>
      <div className="clutch-leaders">
        {categories(minFga).map((cat) => {
          const [leader, ...rest] = rank(cat, players);
          return (
            <div key={cat.title} className="clutch-leaders__card">
              <div className="clutch-leaders__head">
                <span>{cat.title}</span>
                {cat.note && <span className="clutch-leaders__note">{cat.note}</span>}
              </div>
              {leader ? (
                <>
                  <PlayerAvatar name={leader.name} src={headshots?.[leader.id]} />
                  <div className="clutch-leaders__value">{cat.display(leader)}</div>
                  <div className="clutch-leaders__name">{leader.name}</div>
                  <div className="clutch-leaders__detail">{cat.detail(leader)}</div>
                  {rest.length > 0 && (
                    <ol className="clutch-leaders__list" start={2}>
                      {rest.slice(0, open[cat.title] ? rest.length : RUNNERS_UP).map((p) => (
                        <li key={p.id} className="clutch-leaders__row">
                          <span>{p.name}</span>
                          <b>{cat.display(p)}</b>
                        </li>
                      ))}
                    </ol>
                  )}
                  {expandable && rest.length > RUNNERS_UP && (
                    <button
                      type="button" className="clutch-leaders__more" aria-expanded={Boolean(open[cat.title])}
                      onClick={() => setOpen((o) => ({ ...o, [cat.title]: !o[cat.title] }))}
                    >
                      {open[cat.title] ? "Show less" : `Show all ${rest.length + 1}`}
                    </button>
                  )}
                </>
              ) : (
                <div className="clutch-leaders__empty">Nobody in this stretch</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
