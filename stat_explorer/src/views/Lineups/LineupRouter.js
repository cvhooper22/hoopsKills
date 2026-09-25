import React from 'react';
import { Outlet } from 'react-router-dom';
import GameSelector from "../../components/GameSelector/GameSelector";
import { LINEUPS_DEMO } from "../../constants/demo";

export default function LineupRouter () {
    return (
        <div className="lineups flex">
            {!LINEUPS_DEMO && <GameSelector />}
            <div className="lineups-content f1 flex-c pr-l">
                <Outlet />
            </div>
        </div>
    );
};
