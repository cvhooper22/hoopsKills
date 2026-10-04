import React, { useLayoutEffect, useRef, useState } from 'react';

// Shows a fixed-width child shrunk to fit its container (never enlarged). The scaling is on
// this wrapper, not on the child, so an image captured from the child is still full size.
export default function FitToWidth ({ width, children }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    const update = () => {
      const s = Math.min(1, outer.clientWidth / width);
      setScale(s);
      setHeight(inner.offsetHeight * s);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={outerRef} className="fit-to-width" style={{ height: height ?? undefined }}>
      <div ref={innerRef} className="fit-to-width__inner" style={{ width, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
