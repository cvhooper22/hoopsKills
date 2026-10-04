import FlipPad from '../../components/FlipPad/FlipPad';
import Tooltip from '../../components/Tooltip/Tooltip';
import PureDirtyInfo from './PureDirtyInfo';
import { PotentialKillDefinition } from './killsDefinitions';
import { avgKillGain } from '../../utils/killInsights';
import Collectable from '../../components/Collectable/Collectable';
import './KillsHeader.css';

// Header for a single game's kills page: matchup, headline stats as the same
// FlipPad KPI tiles the Clutch view uses, and a pure/dirty/stops breakdown by
// half (or OT).

const BYU = 'BYU';

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// "BYU vs Utah · Feb 3, 2026", the caption a collected item carries.
export function gameLabel(game) {
  return `${game.home} vs ${game.away} · ${formatDate(game.date)}`;
}

function periodLabel(period) {
  if (period === 1) return '1st half';
  if (period === 2) return '2nd half';
  return `OT${period - 2}`;
}

// One kill/PK/stop breakdown row per period that actually has plays in it.
function byPeriod({ kills, potentialKills, stops }) {
  const periods = [...new Set([...kills.map((k) => k.start.period), ...potentialKills.map((p) => p.period), ...stops.map((s) => s.period)])].sort((a, b) => a - b);
  return periods.map((period) => {
    const periodKills = kills.filter((k) => k.start.period === period);
    const periodPKs = potentialKills.filter((p) => p.period === period);
    const periodStops = stops.filter((s) => s.period === period);
    const pure = periodKills.filter((k) => !k.dirty).length;
    const dirty = periodKills.length - pure;
    const chances = periodKills.length + periodPKs.length;
    return {
      period,
      label: periodLabel(period),
      kills: periodKills.length,
      pure,
      dirty,
      potentialKills: periodPKs.length,
      completion: chances ? periodKills.length / chances : null,
      chances,
      stops: periodStops.length,
      stopsDirty: periodStops.filter((s) => s.dirty).length,
    };
  });
}

function pct(n) {
  return n === null ? '–' : Math.round(n * 100);
}

// The snapshot is the FlipPad's own props, so /collection renders it with no other context.
function KpiTile({ label, value, gameId, gameLabel }) {
  const pad = { label, value, condensed: true };
  const descriptor = { type: 'kpi-flip', gameId, params: { label }, title: label, subtitle: gameLabel, snapshot: pad };
  return (
    <div className="kills-kpi">
      <Collectable descriptor={descriptor}>
        <FlipPad {...pad} />
      </Collectable>
    </div>
  );
}

export default function KillsHeader({ game, result, gameId }) {
  const label = gameLabel(game);
  const { kills, potentialKills, completion, stops } = result;
  const rows = byPeriod(result);
  const sum = (key) => rows.reduce((n, r) => n + r[key], 0);
  const totalChances = sum('chances');
  const efficiency = avgKillGain(kills);

  return (
    <div className="kills-header">
      <p className="kills-header__meta">
        {formatDate(game.date)} · {game.venue} · {game.neutral ? 'Neutral site' : `${BYU} ${game.defense === 'home' ? 'home' : 'away'}`}
      </p>
      <h1 className="kills-header__title">
        <span className={game.home === BYU ? 'kills-header__byu' : 'kills-header__opp'}>{game.home}</span>
        <span className="kills-header__vs">vs</span>
        <span className={game.away === BYU ? 'kills-header__byu' : 'kills-header__opp'}>{game.away}</span>
      </h1>

      <div className="kills-kpis">
        <KpiTile gameId={gameId} gameLabel={label} label="Kills" value={String(kills.length)} />
        <KpiTile gameId={gameId} gameLabel={label} label="Potential kills" value={String(potentialKills.length)} />
        <KpiTile gameId={gameId} gameLabel={label} label="Completion" value={`${pct(completion)}%`} />
        <KpiTile gameId={gameId} gameLabel={label} label="Stops" value={String(stops.length)} />
        <KpiTile gameId={gameId} gameLabel={label} label="Efficiency" value={efficiency === null ? '–' : efficiency.toFixed(1)} />
      </div>

      <table className="kills-half-table">
        <thead>
          <tr>
            <th></th>
            <th>Kills</th>
            <th className="kills-half-table__pure-dirty">Pure / dirty <PureDirtyInfo /></th>
            <th className="kills-half-table__pks">
              PKs
              <Tooltip content={<PotentialKillDefinition />}>
                <span className="material-symbols-sharp pure-dirty-info__icon" role="img" aria-label="What is a potential kill">info</span>
              </Tooltip>
            </th>
            <th>Completion</th>
            <th>Stops</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.period}>
              <th scope="row">{row.label}</th>
              <td className="kills-half-table__kills">{row.kills}</td>
              <td>{row.pure} / {row.dirty}</td>
              <td>{row.potentialKills}</td>
              <td>{row.completion === null ? '–' : `${pct(row.completion)}%`}</td>
              <td>{row.stops} <small>({row.stopsDirty} dirty)</small></td>
            </tr>
          ))}
          <tr className="kills-half-table__total">
            <th scope="row">Total</th>
            <td className="kills-half-table__kills">{sum('kills')}</td>
            <td>{sum('pure')} / {sum('dirty')}</td>
            <td>{sum('potentialKills')}</td>
            <td>{totalChances ? `${pct(sum('kills') / totalChances)}%` : '–'}</td>
            <td>{sum('stops')} <small>({sum('stopsDirty')} dirty)</small></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
