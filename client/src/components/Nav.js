import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function Nav () {
  const { t } = useTranslation();

  return (
    <div className="nav-container">
      <div className="nav-item"><NavLink exact to="/boilerplate/main">{ t('components.nav.mainview') }</NavLink></div>
      <div className="nav-item"><NavLink exact to="/boilerplate/secondary">{ t('components.nav.secondaryview') }</NavLink></div>
      <div className="nav-item"><NavLink exact to="/boilerplate/featureflags">{ t('components.nav.featureflagsview') }</NavLink></div>
    </div>
  );
}

export default Nav;
