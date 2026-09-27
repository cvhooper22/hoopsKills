import PlayerAvatar from "./PlayerAvatar";

const MIN_FGA = 2;
const RUNNERS_UP = 2;

const efg = (p) => (p.fgm + 0.5 * p.tpm) / p.fga;
const stocks = (p) => p.stl + p.blk;
const stockParts = (p) => [p.stl && `${p.stl} STL`, p.blk && `${p.blk} BLK`].filter(Boolean).join(" · ");

const CATEGORIES = [
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
    title: "Shooting", note: `eFG% · min. ${MIN_FGA} FGA`,
    eligible: (p) => p.fga >= MIN_FGA,
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

export default function TopPerformers({ players, headshots }) {
  return (
    <section className="clutch-section">
      <h2 className="clutch-section__title">Top performers</h2>
      <p className="clutch-section__sub">Clutch only</p>
      <div className="clutch-leaders">
        {CATEGORIES.map((cat) => {
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
                      {rest.slice(0, RUNNERS_UP).map((p) => (
                        <li key={p.id} className="clutch-leaders__row">
                          <span>{p.name}</span>
                          <b>{cat.display(p)}</b>
                        </li>
                      ))}
                    </ol>
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
