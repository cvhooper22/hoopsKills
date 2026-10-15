import './RecordTile.css';

// A win-loss record shown big ("19-0"), for the record rows under the flip KPI tiles.
//   slim: record | rule | text, sideways and about 90px tall; used in the app.
//   full: label plate, record, rule, text, stacked and centred; not used in the app yet.
// `label` is the plate in full and a small eyebrow in slim. `children` is the sentence, `note` the
// small mono line under it. Pass `onClick` to make the whole tile a button.
export default function RecordTile({ variant = 'slim', wins, losses, label, children, note, onClick, title }) {
  const Tag = onClick ? 'button' : 'div';
  const tagProps = onClick ? { type: 'button', onClick, title } : { title };
  return (
    <Tag className={`record-tile record-tile--${variant}`} {...tagProps}>
      {variant === 'full' && label && <span className="record-tile__plate">{label}</span>}
      <span className="record-tile__record">
        <span className="record-tile__wins">{wins}</span>
        <span className="record-tile__losses">-{losses}</span>
      </span>
      <span className="record-tile__rule" aria-hidden="true" />
      <span className="record-tile__body">
        {variant === 'slim' && label && <span className="record-tile__label">{label}</span>}
        {children && <span className="record-tile__text">{children}</span>}
        {note && <span className="record-tile__note">{note}</span>}
      </span>
    </Tag>
  );
}
