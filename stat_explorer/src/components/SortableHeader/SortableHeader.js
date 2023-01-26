import React from 'react';
import "./SortableHeader.css";
import { SORT_KEYS } from '../../constants/sorting';

export default function SortableHeader ({classes, sortDirection, sortKey, onHeaderClick, children}) {
    function handleClick () {
        if (onHeaderClick) {
            let newDirection = '';
            if (!sortDirection) {
                newDirection = SORT_KEYS.DESC;
            } else if (sortDirection === SORT_KEYS.DESC) {
                newDirection = SORT_KEYS.ASC;
            }        
            onHeaderClick(sortKey, newDirection);
        }
    }

    const additionalClasses = classes.split(' ');
    const headerClass = [...additionalClasses, 'sort-header'];
    if (sortDirection === SORT_KEYS.ASC) {
        headerClass.push('sort--asc');
    } else if (sortDirection === SORT_KEYS.DESC) {
        headerClass.push('sort--desc');
    }

    return (
        <div className={headerClass.join(' ')} role="button" onClick={handleClick}>
            { children }
        </div>
    );
}