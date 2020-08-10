import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { useTranslation } from 'react-i18next';

import Title from '../components/Title';
import LayoutView from './LayoutView';
import Loading from '../components/Loading';
import ConfigGrid from '../components/ConfigGrid';

const mapStateToProps = (state) => {
  return {
    appReady: state.environment.appReady,
    config: state.config.config,
  };
};

export function ConnectedSecondaryView (props) {
  const { appReady, config } = props;
  const { t } = useTranslation();

  function renderPageContent () {
    if (appReady && config) {
      return (
        <Fragment>
          <Title
            title={ t('views.secondaryview.title') }
          ></Title>
          <ConfigGrid
            data={ config }
          ></ConfigGrid>
        </Fragment>
      );
    } else {
      return <Loading />;
    }
  }

  return (
    <LayoutView
      renderPageContent={ renderPageContent }
    ></LayoutView>
  );
}

ConnectedSecondaryView.propTypes = {
  appReady: PropTypes.bool,
  config: PropTypes.array,
};

const SecondaryView = connect(mapStateToProps)(ConnectedSecondaryView);

export default SecondaryView;
