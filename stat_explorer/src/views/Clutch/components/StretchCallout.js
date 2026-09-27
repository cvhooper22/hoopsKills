// A highlighted moment: how a stretch began or ended. `tone`: 'neutral' (grey), 'in' or 'out' (blue).
export default function StretchCallout({ tone = "neutral", label, headline, details = [] }) {
  return (
    <div className={`stretch-callout stretch-callout--${tone}`}>
      <div className="stretch-callout__label">{label}</div>
      <div className="stretch-callout__headline">{headline}</div>
      <div className="stretch-callout__details">
        {details.map((d) => <span key={d}>{d}</span>)}
      </div>
    </div>
  );
}
