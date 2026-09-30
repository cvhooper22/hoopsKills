import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import "./Nav.css";

// Matches the width of the .nav-wrap__edge scroll cues, so a revealed item isn't under one.
const EDGE_CLEARANCE = 40;

export default function Nav ({ options = [], onOptionClick}) {
  const location = useLocation();
  const pathname = location.pathname;
  const navRef = useRef(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });

  // Which edges have more items hidden past them, so we can show a scroll cue there.
  const updateOverflow = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setOverflow((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  // Scroll just far enough that the current page's item is fully visible and clear of
  // the edge scroll cues — no-op when it already is. At either end the scroll clamps,
  // so the last item (Alumni) ends up flush right, where it normally sits.
  const revealActive = useCallback((behavior) => {
    const el = navRef.current;
    const active = el?.querySelector('.nav__item--active');
    if (!el || !active) return;
    // The first/last item goes all the way to its end, so the cue for "more this way"
    // doesn't linger over leading/trailing space when there's nothing left there.
    const list = active.parentElement;
    if (active === list.firstElementChild) { el.scrollTo({ left: 0, behavior }); return; }
    if (active === list.lastElementChild) { el.scrollTo({ left: el.scrollWidth, behavior }); return; }
    const navRect = el.getBoundingClientRect();
    const itemRect = active.getBoundingClientRect();
    let delta = 0;
    if (itemRect.left < navRect.left + EDGE_CLEARANCE) delta = itemRect.left - navRect.left - EDGE_CLEARANCE;
    else if (itemRect.right > navRect.right - EDGE_CLEARANCE) delta = itemRect.right - navRect.right + EDGE_CLEARANCE;
    if (Math.abs(delta) > 1) el.scrollBy({ left: delta, behavior });
  }, []);

  // Recheck the cues and the active item's visibility whenever the nav's size changes
  // (window resize, web fonts loading and changing item widths).
  useEffect(() => {
    const el = navRef.current;
    if (!el) return undefined;
    updateOverflow();
    const observer = new ResizeObserver(() => {
      updateOverflow();
      revealActive('auto');
    });
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [updateOverflow, revealActive]);

  // Route changes animate the item into view.
  useEffect(() => { revealActive('smooth'); }, [pathname, revealActive]);

  function handleClick (option) {
    return () => {
      if (onOptionClick) {
        onOptionClick(option);
      }
    }
  }

  return (
    <div className="nav-wrap">
    <nav className='nav flex' ref={navRef} onScroll={updateOverflow}>
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
                {!opt.disabled && opt.subtitle && <sub>{opt.subtitle}</sub>}
              </li>
            );
          })
        }
      </ul>
    </nav>
    {overflow.start && <span className="nav-wrap__edge nav-wrap__edge--start" aria-hidden="true" />}
    {overflow.end && <span className="nav-wrap__edge nav-wrap__edge--end" aria-hidden="true" />}
    </div>
  )
};
