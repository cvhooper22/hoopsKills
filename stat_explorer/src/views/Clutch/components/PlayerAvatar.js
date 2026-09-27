import { useState } from "react";

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

// Circular headshot; falls back to initials when there is no image or it fails to load.
export default function PlayerAvatar({ name, src }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="clutch-avatar">
      {src && !failed
        ? <img src={src} alt="" onError={() => setFailed(true)} />
        : <span className="clutch-avatar__initials" aria-hidden="true">{initials(name)}</span>}
    </span>
  );
}
