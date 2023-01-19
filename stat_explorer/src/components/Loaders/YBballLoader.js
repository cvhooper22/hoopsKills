import React from 'react';
import YBall from '../Logos/YBall';
import "./Loaders.css";

export const HEIGHT_TO_WIDTH_RATIO = 0.8;
export default function YBallLoader ({width, height, lineColor, fillColor}) {
  return (
    <div className='y-ball-loader' style={{width: width ?? 80, height: height ?? 100}}>
      <YBall className="base-ball" width={width ?? 80} height={height ?? 100}/>
      <YBall className="top-ball" width={width ?? 80} height={height ?? 100} lineColor="white" fillColor="#003fa2"/>
    </div>
  );
};
