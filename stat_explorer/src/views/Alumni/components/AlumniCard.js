import React, { useState } from 'react';
import FlipOver from '../../../components/Icons/FlipOver';
import OpenInNew from '../../../components/Icons/OpenInNew';
import urls from '../../../constants/assetUrls';
import FakeTable from './FakeTable';
import SocialLink from './SocialLink';

export default function AlmuniCard({alum}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [firstname, lastname] = alum.name.split(' ');
  const imageStyle = alum.coverPhoto?.style ?? {};
  const teamLogoStyle = alum.teamLogo?.style ?? {};
  
  function setFlipped () {
    setIsFlipped(!isFlipped);
  }

  const flagUrl = `${urls.flagBasePath}/${alum.countryCode}.png`;
  const footerUrl = alum.recentTweetsUrl || alum.playerUrl;
  const footerText = alum.recentTweetsUrl ? `Recent team activity for ${firstname} on twitter` : `Player profile for ${firstname}`;
  const socialAccounts = Object.keys(alum.teamSocial ?? {});
  return (
    <div className="alumni-card-root m-s">
      <div className={`alumni-card-flipper${ isFlipped ? ' alumni-card-flipper--flipped' : ''}`}>
        <div className={`alumni-card-flip-btn`}>
          <button type="button" onClick={setFlipped} className='flip-button'>
            <FlipOver fillColor='white'/>
          </button>
        </div>
        <div className='alumni-card'>
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
          <div>

          </div>
        </div>
        <div className='alumni-card alumni-card--back flex-c'>
          <div className='card-back-header flex-aic jcc'>
            <div className='card-back-header__first'>{firstname}</div>
            <div className='card-back-header__last ml-s'>{lastname}</div>
          </div>
          <div className='card-back-team flex-aic jcc p-s'>
            <div className='card-back-team__logo mr-m'>
              <img className='card-back__logo-image' src={alum.teamLogo?.url}></img>
            </div>
            <div className='card-back-team__details flex-c ais'>
              <div className='card-back-detail flex-aic'>
                <div className='card-back-team__label'>Country: </div>
                <img src={flagUrl} className='card-back-flag' alt={alum.country} title={alum.country} />
              </div>
              <div className='card-back-detail flex'>
                <div className='card-back-team__label'>Team Name: </div>
                <div className='card-back-team__value'><a href={alum.teamWebsite} alt={alum.team} target='_blank'>{alum.team}</a></div>
              </div>
              <div className='card-back-detail flex'>
                <div className='card-back-team__label'>League: </div>
                <div className='card-back-team__value'>{alum.league}</div>
              </div>
              <div className='card-back-detail'>
                <div className='card-back-team__label'>Division: </div>
                <div className='card-back-team__value'>{alum.division}</div>
              </div>
            </div>
          </div>
          <div className='card-back-stats'>
            <div className='stat-link-blur flex-aic jcc'>
              <div className='card-back-stat-link-blur'></div>
            </div>
            <a href={alum.playerUrl} className='card-back-stat-link flex-aic jcc' target='_blank'>
              <div>
                Click to go to stats
              </div>
            </a>
            <FakeTable />
          </div>
          <div className='card-back-links'>
            <div className='card-back-links-header'>TEAM SOCIAL</div>
            <div className='card-back-links-container flex-aic jcc'>
              { socialAccounts.map(socialType => <SocialLink type={socialType} link={alum.teamSocial[socialType]} key={`${alum.team}_${socialType}`}/>)}
            </div>
          </div>
          <div className={`card-back-notes f1 flex-aic`}>
            { alum.notes && (
              alum.notes.map(n => <div className='card-back-note' key={`${alum.name}_note`}>{n}</div>)
            )}
            { !alum.notes && <img className='card-back-byuhoops' src="./byuHoops.png" />}
          </div>
          <div className='card-back-footer flex-aic jcc'>
              <a href={footerUrl} target='_blank' className='mr-xs'>
                {footerText}
              </a>
              <OpenInNew fillColor='white' height={8} width={8} />
          </div>
        </div>
      </div>
    </div>
  );
}