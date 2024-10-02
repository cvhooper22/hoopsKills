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
      id="FacebookLogo"
      x="0px"
      y="0px"
      viewBox="0 0 56.7 56.7"
      height={`${height}px`}
      width={`${width}px`}
      className={className}
    >
      <path fill={fillColor} d="M40.4,21.7h-7.6v-5c0-1.9,1.2-2.3,2.1-2.3c0.9,0,5.4,0,5.4,0V6.1l-7.4,0c-8.2,0-10.1,6.2-10.1,10.1v5.5H18v8.5 h4.8c0,10.9,0,24.1,0,24.1h10c0,0,0-13.3,0-24.1h6.8L40.4,21.7z"></path>
    </svg>
  );
};