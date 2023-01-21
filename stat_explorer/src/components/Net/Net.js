import React from 'react';

export default function Net ({netVal, classes}) {
    let additionalClasses = [];
    if (classes) {
        additionalClasses = classes.split(' ');
    }
    const stintNetClass = ['net', ...additionalClasses];
    if (netVal !== 0) {
        if (netVal < 0) {
            stintNetClass.push('net--neg');
        } else {
            stintNetClass.push('net--pos');
        }
    }
    return <span className={stintNetClass.join(' ')}>{netVal}</span>
};
