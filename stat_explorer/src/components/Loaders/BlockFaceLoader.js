import React from 'react';
import BlockFace from '../Logos/BlockFace';
import "./Loaders.css";

export const HEIGHT_TO_WIDTH_RATIO = 0.91;
export default function BlockFacecLoader ({width, height, lineColor, fillColor}) {
  return (
    <div className='y-ball-loader' style={{width: width ?? 91, height: height ?? 100}}>
      <BlockFace classname="base-ball" width={width ?? 91} height={height ?? 100}/>
      <BlockFace classname="top-ball" width={width ?? 91} height={height ?? 100} lineColor={lineColor ?? "white"} fillColor={fillColor ?? "#003fa2"}/>
    </div>
  );
};
