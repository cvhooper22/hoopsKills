import react from 'react';

export default function PlayerSelector ({ players: [], selected: [], onSelect}) {
  function onPlayerSelect (playerName) {
    if (onSelect) {
      onSelect(playerName);
    }
  }
  return (
    <div className='flex'>
      players.map((p) => {
        return <PlayerSelect player={p} onSelect={onPlayerSelect(p.name)} />;
      });
    </div>
  )
}