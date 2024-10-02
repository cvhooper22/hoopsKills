import React, { useContext, useState } from 'react';
import "./Alumni.css";
import alum from '../../assets/alum';
import AlmuniCard from './components/AlumniCard';
import { TouchPointsContext } from '../../contexts/TouchpointsContext';
import QuestionMark from '../../components/Icons/QuestionMark';
import XClose from '../../components/Icons/XClose';

export default function AlumniRouter () {
    const [helpOpen, setHelpOpen] = useState(false);
    const hasTouchEnabled = useContext(TouchPointsContext);

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
            <div className='alumni-cards flex f-wrap'>
                {alum.map((alumnus) => <AlmuniCard alum={alumnus} key={alumnus.name} />)}
            </div>
        </div>
    );
};
