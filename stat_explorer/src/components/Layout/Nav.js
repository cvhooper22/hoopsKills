import React from 'react';
import { useLocation } from 'react-router-dom';
import "./Nav.css";

export default function Nav ({ options = [], onOptionClick}) {
  const location = useLocation();
  const pathname = location.pathname;
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
            let isCurrent = pathname.includes(opt.routeRoot ?? opt.route);
            if (opt.route === '/') {
              isCurrent = pathname === opt.route;
            }
            const classes = ['px-l'];
            if (opt.disabled) {
              classes.push('nav__item--disabled');
            }
            if (isCurrent) {
              classes.push('nav__item--active')
            }
            return (
              <li className={classes.join(' ')} role="button" onClick={handleClick(opt)} key={opt.title}>
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
