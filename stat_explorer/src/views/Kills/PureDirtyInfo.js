import Tooltip from '../../components/Tooltip/Tooltip';
import { PURE_DIRTY_DEFINITION } from './killsDefinitions';
import './PureDirtyInfo.css';

// Tooltip triggered by an info icon, explaining what makes a kill pure vs.
// dirty. Shared by KillsHeader (next to "Pure / dirty") and the Kills table's
// legend, so the definition lives in one place.
export default function PureDirtyInfo() {
  return (
    <Tooltip
      content={PURE_DIRTY_DEFINITION}
    >
      {/* Material Symbols Sharp's `info` glyph (see public/index.html's icon_names subset). */}
      <span className="material-symbols-sharp pure-dirty-info__icon" role="img" aria-label="What makes a kill pure or dirty">info</span>
    </Tooltip>
  );
}
