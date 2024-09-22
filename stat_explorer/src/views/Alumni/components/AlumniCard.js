import React from 'react';

export default function AlmuniCard({alum}) {
  const [firstname, lastname] = alum.name.split(' ');
  const imageStyle = alum.coverPhoto?.style ?? {};
  const teamLogoStyle = alum.teamLogo?.style ?? {};
  return (
    <div className='alumni-card m-s'>
      <div className='alumni-card__inner p-xs'>
        <div className='alumni-card__logo'>
          <img className='alumni-card__logo-image' src={alum.teamLogo?.url} style={{ ...teamLogoStyle }}></img>
          <img className='alumni-card__logo-image alumni-card__logo-image--dropLeft' src={alum.teamLogo?.url} style={{ ...teamLogoStyle }}></img>
        </div>
        <div className='alumni-card__photo'>
          <img className="alumni-card__image" src={alum.coverPhoto?.url} style={{ ...imageStyle }}/>
        </div>
        <div className='alumni-card__name-circle-spacer'></div>
      </div>
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
        <div className='alumni-card__name-lower flex jcc'>
          {alum.position}
        </div>
      </div>
      <div className='alumni-card__label'>
        <img src="./byuHoops.png" />
      </div>
    </div>
  );
}