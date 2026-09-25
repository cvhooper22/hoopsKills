# StatusBadge (E2 sticker)

## Install
1. Copy `StatusBadge.jsx` + `StatusBadge.css` into `src/components/StatusBadge/`.
2. Add the icon font once in `public/index.html` `<head>` (skip if already loaded):
   ```html
   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Sharp:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200">
   ```
3. Uses your token vars (`--royal-600`, `--navy-700`, `--neg-700`, `--gray-500`, `--font-display`…) with hex fallbacks, so it works with or without the token sheets.

## Use
The card root must be `position: relative` (the alumni card already is if it hosts the flip button).

```jsx
import StatusBadge from '../StatusBadge/StatusBadge';

<div className="alumni-card">
  {player.status && <StatusBadge status={player.status} />}
  ...
</div>
```

`status` keys: `newTeam`, `injured`, `inactive`, `retired`, `unsigned`.

Overrides: `label`, `icon`, `tone` (`royal` | `navy` | `red` | `gray`), `inline` (static flow instead of card corner).

```jsx
<StatusBadge status="retired" icon="sports_basketball" />
<StatusBadge label="Two-way" icon="sync_alt" tone="navy" />
```

## Data
Add an optional field to each record in `src/assets/alum.js`:
```js
{ name: 'Brandon Davies', ..., status: 'newTeam' }
```

## Notes
- Placement: 50px from top, 3px past the right edge — clears the name line on a 250×370 card. Adjust `top` in `.status-badge` if your name plate differs.
- `pointer-events: none` so it never blocks card hover/flip.
- Card back: render it only on the front face so it flips away with the card.
- `color-mix()` needs Chrome 111+ / Safari 16.2+ / Firefox 113+.
