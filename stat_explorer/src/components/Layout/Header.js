import React from 'react';
import Logo from '../../assets/HoopsLogo';

export default function ({options, onOptionClick}) {
  return (
    <header className="flex-aic px-m header">
      <Logo className="header__logo" size="40px" fill="#003fa2" />
      <span className='header__title ml-s'>BYU HOOPS STATS</span>
    </header>
  );
}