import { useEffect, useState } from 'react';
import urls from '../../../constants/assetUrls';
import { teamName } from '../../Kills/SeasonGamesTable';

const LOCATION_LABEL = { home: '', away: ' (A)', neutral: ' (N)' };

// Opponent logo with the game's net, tinted for away / neutral games. `teams` is the optional
// meta/teams.json lookup; without it the logo and name fall back to the team id.
export default function GameChip({ game, teams, className = '', children }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [game.oppTeamId]);
  const name = teamName(teams, game.oppTeamId);
  const label = `${name}${LOCATION_LABEL[game.location] || ''}`;
  const key = (teams && teams[game.oppTeamId] && teams[game.oppTeamId].logoKey) || game.oppTeamId;
  const classes = ['game flex-aic mr-m', className];
  if (game.location === 'away' || game.location === 'neutral') classes.push(`game--${game.location}`);
  return (
    <div className={classes.filter(Boolean).join(' ')}>
      <div className="game__img-container mr-xs">
        {failed
          ? <span className="game__logo-fallback">{name.slice(0, 3)}</span>
          : <img src={urls.teamLogo(key)} className="game__logo" title={`${label}${game.mins ? ` - ${game.mins.toFixed(2)}` : ''}`} alt={`Logo for ${name}`} onError={() => setFailed(true)} />}
      </div>
      {children}
    </div>
  );
}
