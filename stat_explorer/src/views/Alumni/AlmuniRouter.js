import React from 'react';
import "./Alumni.css";
import alum from '../../assets/alum';
import AlmuniCard from './components/AlumniCard';

export default function AlumniRouter () {
    return (
        <div className="alumni flex-c scroll">
            <div className='alumni-cards flex f-wrap'>
              {alum.map((alumnus) => <AlmuniCard alum={alumnus} key={alumnus.name} />)}
            </div>
        </div>
    );
};
