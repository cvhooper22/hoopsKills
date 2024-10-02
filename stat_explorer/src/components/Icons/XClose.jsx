import React from 'react';

export default function FlipOver ({
    height = 24,
    width = 24,
    className,
    fillColor = "#fff",
}) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            height={`${height}px`}
            width={`${width}px`}
            viewBox="0 -960 960 960"
            fill={fillColor}
            className={className}
        >
            <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
        </svg>
    );
};