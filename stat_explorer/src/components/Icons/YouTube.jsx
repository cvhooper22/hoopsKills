import React from 'react';

export default function YouTube ({
    height = 24,
    width = 24,
    className,
    fillColor = "#000000",
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      id="YouTubeLogo"
      x="0px"
      y="0px"
      viewBox="0 0 32 32" 
      height={`${height}px`}
      width={`${width}px`}
      className={className}
    >
      <path fill={fillColor} d="M31.7,9.2c0,0-0.3-2.4-1.3-3.4c-1.2-1.4-2.6-1.4-3.2-1.4C22.7,4,16,4,16,4h0c0,0-6.7,0-11.2,0.3 c-0.6,0.1-2,0.1-3.2,1.4c-1,1-1.3,3.4-1.3,3.4S0,11.9,0,14.7v2.6c0,2.8,0.3,5.5,0.3,5.5s0.3,2.4,1.3,3.4c1.2,1.4,2.8,1.3,3.5,1.5 C7.7,27.9,16,28,16,28s6.7,0,11.2-0.4c0.6-0.1,2-0.1,3.2-1.4c1-1,1.3-3.4,1.3-3.4s0.3-2.8,0.3-5.5v-2.6C32,11.9,31.7,9.2,31.7,9.2z M12,22V10l10,6L12,22z"></path>
    </svg>
  );
};