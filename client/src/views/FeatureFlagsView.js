import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { useTranslation } from 'react-i18next';

import Title from '../components/Title';
import LayoutView from './LayoutView';

const mapStateToProps = (state) => {
  return {
    featureFlags: state.featureFlags.featureFlags,
  };
};

export function ConnectedFeatureFlagsView (props) {
  const { t } = useTranslation();
  const { featureFlags } = props;

  function renderFeatureFlags () {
    const ffString = t('views.featureflagsview.featureflag');
    return Object.keys(featureFlags).map((key) => {
      return <p key={ `${key}` }>{ `${ffString}${key} = ${featureFlags[key]}` }</p>;
    });
  }

  function renderPageContent () {
    return (
      <Fragment>
        <Title
          title={ t('views.featureflagsview.title') }
        ></Title>
        <div className="section">
          <div className="row">
            <div className="col-md-12">
              { renderFeatureFlags() }
            </div>
          </div>
        </div>
      </Fragment>
    );
  }

  return (
    <LayoutView
      renderPageContent={ renderPageContent }
    ></LayoutView>
  );
}

ConnectedFeatureFlagsView.propTypes = {
  date: PropTypes.string,
  featureFlags: PropTypes.object,
};

const FeatureFlagsView = connect(mapStateToProps)(ConnectedFeatureFlagsView);

export default FeatureFlagsView;
