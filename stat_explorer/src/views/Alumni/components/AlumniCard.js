import React from 'react';

export default function AlmuniCard({alum}) {
  const [firstname, lastname] = alum.name.split(' ');
  const imageStyle = alum.style ?? {};
  return (
    <div className='alumni-card m-s'>
      <div className='alumni-card__inner p-xs'>
        <div className='alumni-card__logo'>
          <img className='alumni-card__logo-image' src={alum.teamLogo}></img>
        </div>
        <div className='alumni-card__photo'>
          <img className="alumni-card__image" src="https://s3.ppllstatics.com/diariovasco/www/multimedia/2023/12/09/89781268-kC0B--1200x840@Diario%20Vasco.jpg" style={{ ...imageStyle }}/>
        </div>
      </div>
      <div className='alumni-card__name-circle-spacer'></div>
      <div className='alumni-card__name flex-c aic'>
        <div className='alumni-card__firstname-container flex-aic jcc'>
          <div className='alumni-card__firstname'>
            {firstname}
          </div>
        </div>
        <div className='alumni-card__lastname-container'>
          <div className='alumni-card__lastname-inner'>
            <div className='alumni-card__lastname'>
              {lastname}
            </div>
          </div>
        </div>
        <div className='alumni-card__name-lower  flex-aic jcc'>
          POSITION
        </div>
      </div>
      <div className='alumni-card__label'>
        <span className='alumni-card__label__byu'>BYU</span>
        <span className='alumni-card__label__hoops'>HOOPS</span>
      </div>
    </div>
  );
}