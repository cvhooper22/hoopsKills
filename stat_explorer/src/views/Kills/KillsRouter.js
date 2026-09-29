import React from 'react';
import { Outlet } from 'react-router-dom';
import GameSwitcher from "../../components/GameSwitcher/GameSwitcher";

export default function KillsRouter () {
    return (
        <div className="lineups flex">
            <GameSwitcher basePath="kills" />
            <div className="lineups-content f1 flex-c pr-l">
                <Outlet />
            </div>
        </div>
    );
};
