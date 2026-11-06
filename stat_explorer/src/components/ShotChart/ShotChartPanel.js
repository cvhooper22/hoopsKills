import { useMemo } from 'react';
import ShotChart from './ShotChart';
import { normalizeShots, summarizeShots, ZONES } from '../../utils/shotLocation';

const pct = (p) => (p === null ? '–' : `${Math.round(100 * p)}%`);

// Summary table and chart for one team's shots.
// `ft` ({ made, att }) adds a free-throw row (free throws have no location, so they are not on the chart); `made` / `miss` recolor the marks; `chart={false}` leaves out the court (the table alone, for a chart drawn elsewhere).
export function ShotChartCard({ name, shots, made, miss, ft, teams, chart = true }) {
  const sum = summarizeShots(shots);
  return (
    <section className="shot-chart-panel__team">
      <h3 className="shot-chart-panel__name">{name}</h3>
      <table className="shot-chart-panel__table">
        <thead><tr><th /><th>Made–Att</th><th>FG%</th><th>Of shots</th></tr></thead>
        <tbody>
          <tr className="shot-chart-panel__total"><th scope="row">All field goals</th><td>{sum.fg.made}–{sum.fg.att}</td><td>{pct(sum.fg.pct)}</td><td /></tr>
          <tr><th scope="row">2-pointers</th><td>{sum.twos.made}–{sum.twos.att}</td><td>{pct(sum.twos.pct)}</td><td>{pct(sum.fg.att ? sum.twos.att / sum.fg.att : null)}</td></tr>
          <tr><th scope="row">3-pointers</th><td>{sum.threes.made}–{sum.threes.att}</td><td>{pct(sum.threes.pct)}</td><td>{pct(sum.fg.att ? sum.threes.att / sum.fg.att : null)}</td></tr>
          {ft ? <tr className="shot-chart-panel__ft"><th scope="row">Free throws</th><td>{ft.made}–{ft.att}</td><td>{pct(ft.att ? ft.made / ft.att : null)}</td><td /></tr> : null}
          <tr className="shot-chart-panel__zone-head"><th colSpan={4}>By zone</th></tr>
          {ZONES.map(({ id, label }) => (
            <tr key={id}><th scope="row">{label}</th><td>{sum.zones[id].made}–{sum.zones[id].att}</td><td>{pct(sum.zones[id].pct)}</td><td>{pct(sum.zones[id].share)}</td></tr>
          ))}
        </tbody>
      </table>
      {chart ? <ShotChart shots={shots} made={made} miss={miss} teams={teams} label={`${name} shot chart`} /> : null}
    </section>
  );
}

// Field-goal locations for a game's plays (normalized rows from the plays export, any feed), one chart per team. They
// flow side by side and wrap when there isn't room for both at a readable size. meta (optional) names the teams and
// orders them away then home; without it the team ids are shown.
export default function ShotChartPanel({ plays, meta }) {
  const shots = useMemo(() => normalizeShots(plays), [plays]);
  const teamIds = useMemo(() => {
    const seen = [...new Set(shots.map((s) => s.teamId).filter(Boolean))];
    const order = meta ? [meta.awayId, meta.homeId] : [];
    return seen.sort((a, b) => (order.indexOf(a) + 1 || 9) - (order.indexOf(b) + 1 || 9));
  }, [shots, meta]);
  const nameOf = (id) => (meta && meta.teams && meta.teams[id] && meta.teams[id].name) || id;

  if (!shots.length) return <p className="mt-l">There is no shot chart data for this game.</p>;
  return (
    <div className="shot-chart-panel">
      <div className="shot-chart-panel__teams">
        {teamIds.map((id) => <ShotChartCard key={id} name={nameOf(id)} shots={shots.filter((s) => s.teamId === id)} />)}
      </div>
      <div className="shot-chart-panel__legend"><span><span className="made">●</span> made</span><span><span className="miss">✕</span> missed</span></div>
    </div>
  );
}
