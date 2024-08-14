import React from 'react';

export default function AlmuniCard({alum}) {
  const [firstname, lastname] = alum.name.split(' ');
  return (
    <div className='alumni-card'>
      <div className='alumni-card__inner'>
        <div className='alumni-card__logo'>
          <img className='alumni-card__logo-image' src={alum.teamLogo}></img>
        </div>
        <div className='alumni-card__photo'>
          <img className="alumni-card__image" src="https://s3.ppllstatics.com/diariovasco/www/multimedia/2023/12/09/89781268-kC0B--1200x840@Diario%20Vasco.jpg" />
        </div>
        <div className='alumni-card__firstname'>
          {firstname}
        </div>
        <div className='alumni-card__lastname'>
          {lastname}
        </div>
        <div className='alumni-card__label'>
          <span className='alumni-card__label__byu'>BYU</span>
          <span className='alumni-card__label__hoops'>HOOPS</span>
        </div>
      </div>
    </div>
  );
}