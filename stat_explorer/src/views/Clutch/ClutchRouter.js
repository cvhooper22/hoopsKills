import React from 'react';
import { Outlet } from 'react-router-dom';
import GameSelector from "../../components/GameSelector/GameSelector";

export default function ClutchRouter () {
    return (
        <div className="lineups flex">
            <GameSelector />
            <div className="lineups-content f1 flex-c pr-l">
                <Outlet />
            </div>
        </div>
    );
};
