import React from 'react';
import BlockFace from '../Logos/BlockFace';
import "./Loaders.css";

export const HEIGHT_TO_WIDTH_RATIO = 0.91;
export default function BlockFaceLoader ({width, height, lineColor, fillColor}) {
  return (
    <div className='y-ball-loader' style={{width: width ?? 91, height: height ?? 100}}>
      <BlockFace className="base-ball" width={width ?? 91} height={height ?? 100} lineColor={lineColor ?? "#003fa2"} fillColor={fillColor ?? "white"}/>
      <BlockFace className="top-ball" width={width ?? 91} height={height ?? 100} lineColor={lineColor ?? "white"} fillColor={fillColor ?? "#003fa2"}/>
    </div>
  );
};
