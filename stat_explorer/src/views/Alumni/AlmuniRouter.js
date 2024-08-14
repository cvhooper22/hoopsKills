import React from 'react';
import "./Alumni.css";
import alum from '../../assets/alum';
import AlmuniCard from './components/AlumniCard';

export default function AlumniRouter () {
    console.log('alumni', alum);
    return (
        <div className="almuni flex">
            <h2>Alumni</h2>
            <div className='alumni-cards'>
              {alum.map((alumnus) => { console.log('the alum: ', alumnus); return <AlmuniCard alum={alumnus} key={alumnus.name} />;})}
            </div>
        </div>
    );
};
