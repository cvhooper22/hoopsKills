import React from 'react';
import { Outlet } from 'react-router-dom';
import GameSwitcher from "../../components/GameSwitcher/GameSwitcher";

export default function LineupRouter () {
    return (
        <div className="lineups flex">
            <GameSwitcher basePath="lineups" />
            <div className="lineups-content f1 flex-c pr-l">
                <Outlet />
            </div>
        </div>
    );
};
