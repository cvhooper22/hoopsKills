import React from 'react';
import "./Nav.css";

export default function Nav ({ options = [], onOptionClick, currentOption = '' }) {
  function handleClick (option) {
    return () => {
      if (onOptionClick) {
        onOptionClick(option);
      }
    }
  }

  return (
    <nav className='nav flex'>
      <ul className='flex-aic'>
        {
          options.map((opt) => {
            const classes = ['px-l'];
            if (opt.disabled) {
              classes.push('nav__item--disabled');
            }
            if (currentOption === opt.title) {
              classes.push('nav__item--active')
            }
            return (
              <li className={classes.join(' ')} role="button" onClick={handleClick(opt.title)} key={opt.title}>
                {opt.title}
                {opt.disabled && <sub>Coming Soon</sub>}
              </li>
            );
          })
        }
      </ul>
    </nav>
  )
};
