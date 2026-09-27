import React from 'react';
import { Outlet } from 'react-router-dom';

export default function ClutchRouter () {
    return (
        <div className="lineups flex">
            <div className="lineups-content f1 flex-c pr-l">
                <Outlet />
            </div>
        </div>
    );
};
