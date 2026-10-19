import FlipPad from '../../components/FlipPad/FlipPad';
import { f2, formatDate, signed, periodLabel } from './boxFormat';

const SEASON_TYPE = { regular: null, conf_tourney: 'Conference tournament', postseason: 'Postseason' };

// Chances and possessions are counted from the play-by-play (the same numbers as the "What decided the game" table), not estimated
// from the box score, so the header and the table always agree.
const teamLine = (s) => ({ poss: s.poss, chances: s.plays, ppp: s.ppp, ppc: s.ppPlay });

// "LIVE 2nd half 07:24"
const liveEyebrow = (l) => ['LIVE', l.period ? periodLabel(l.period) : null, l.clock].filter(Boolean).join(' ');

export default function BoxHeader({ data }) {
  const { header: h, split } = data;
  const liveNow = !!data.live && data.live.status === 'live';
  const mine = teamLine(split.byu);
  const theirs = teamLine(split.opp);
  const eyebrow = [formatDate(h.date), h.venue, h.neutral ? 'Neutral site' : null, SEASON_TYPE[h.seasonType], liveNow ? liveEyebrow(data.live) : 'Final'].filter(Boolean);
  const chanceMargin = mine.chances - theirs.chances;
  return (
    <header className="box-header">
      <div className="box-header__eyebrow">{eyebrow.join(' · ')}</div>
      <h1 className="box-header__score">
        <span className="box-header__team box-header__team--focus">{h.teams.byu} {h.final.byu}</span>
        <span className="box-header__dash">–</span>
        <span className="box-header__team">{h.final.opp} {h.teams.opp}</span>
      </h1>
      <p className="box-header__headline">{h.headline}</p>
      <div className="box-kpis">
        <FlipPad condensed label={`${h.teams.byu} pts / chance`} value={f2(mine.ppc)} />
        <FlipPad condensed label={`${h.teams.byu} pts / poss`} value={f2(mine.ppp)} />
        <FlipPad condensed className="box-kpi--opp" label={`${h.teams.opp} pts / chance`} value={f2(theirs.ppc)} />
        <FlipPad condensed className="box-kpi--opp" label={`${h.teams.opp} pts / poss`} value={f2(theirs.ppp)} />
        <FlipPad condensed label="Chance margin" value={signed(chanceMargin, 0).replace('−', '-')} tone="auto" />
      </div>
      <p className="box-header__note">
        {h.teams.byu} {mine.chances} chances on {mine.poss} possessions; {h.teams.opp} {theirs.chances} on {theirs.poss}.
        A chance is every shot opportunity, so each offensive rebound starts a new one. Counted from the play-by-play.
      </p>
    </header>
  );
}
