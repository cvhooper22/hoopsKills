import React, { useContext, useEffect, useState } from 'react';
import "./Alumni.css";
import urls from '../../constants/assetUrls';
import AlmuniCard from './components/AlumniCard';
import AlumniFilters from './components/AlumniFilters';
import { EMPTY_FILTERS, hasAnyFilter, matchesFilters } from '../../utils/alumniFilters';
import { TouchPointsContext } from '../../contexts/TouchpointsContext';
import QuestionMark from '../../components/Icons/QuestionMark';
import XClose from '../../components/Icons/XClose';

export default function AlumniRouter () {
    const [helpOpen, setHelpOpen] = useState(false);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [alum, setAlum] = useState(null);
    const [loadError, setLoadError] = useState(false);
    const hasTouchEnabled = useContext(TouchPointsContext);
    const displayAlum = (alum ?? []).filter(a => matchesFilters(a, filters));

    useEffect(() => {
        fetch(urls.alumJson())
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (!Array.isArray(data)) throw new Error('alum.json is not a list');
                setAlum(data);
            })
            .catch(() => setLoadError(true));
    }, []);

    function onHelpClick () {
        setHelpOpen(!helpOpen);
    }

    return (
        <div className={`alumni flex-c aic scroll${ hasTouchEnabled ? ' alumni--touch-enabled' : ''}`}>
            <div className={`alumni__help p-l${ helpOpen ? ' alumni__help--open' : ''}`} role="button" onClick={onHelpClick}>
                <div className='alumni__help-content'>
                    { `${ hasTouchEnabled ? 'Tap' : 'Hover over' } a card to show a flip button` }
                    <div className='alumni__help-close'>
                        <XClose height={16} width={16} />
                    </div>
                </div>
            </div>
            <div className={`alumni-info-positioner${ helpOpen ? ' alumni-info--open' : ''}` }>
                <div className='alumni-info flex-aic jcc' role="button" onClick={onHelpClick}>
                    <QuestionMark height={20} width={20} />
                </div>
            </div>
            <AlumniFilters alum={alum} selected={filters} onChange={setFilters} />
            {loadError && <div className='p-l'>Couldn't load alumni right now. Please try again later.</div>}
            {!alum && !loadError && <div className='p-l'>Loading alumni…</div>}
            {alum && displayAlum.length === 0 && hasAnyFilter(filters) && (
                <div className='p-l'>No alumni match these filters.</div>
            )}
            <div className='alumni-cards flex f-wrap'>
                {displayAlum.map((alumnus) => <AlmuniCard alum={alumnus} key={alumnus.name} />)}
            </div>
        </div>
    );
};
