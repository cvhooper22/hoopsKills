import React, { createContext } from 'react';

export const TouchPointsContext = createContext(null);

export function TouchPointsContextProvider ({ children }) {
  const hasTouch = navigator.maxTouchPoints > 0;

  return (
    <TouchPointsContext.Provider value={ hasTouch }>
      { children }
    </TouchPointsContext.Provider>
  );
};