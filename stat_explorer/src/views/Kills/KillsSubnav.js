import { Link } from 'react-router-dom';
import './KillsSubnav.css';

// Game / Season switch at the top of both kills views. `active` is 'game' or 'season'.
export default function KillsSubnav({ active }) {
  return (
    <nav className="kills-subnav" aria-label="Kills views">
      <Link to="/kills" className={`kills-subnav__tab${active === 'game' ? ' kills-subnav__tab--active' : ''}`}>Game</Link>
      <Link to="/kills/season" className={`kills-subnav__tab${active === 'season' ? ' kills-subnav__tab--active' : ''}`}>Season</Link>
    </nav>
  );
}
