import ReactAI from 'react-appinsights';

import currentEnvironment from '../../utils/environment/currentEnvironment';
import { fetchFeatureFlags } from './featureFlagsActions';

export const initializeApplication = (navCallback, langCallback) => {
  return (dispatch) => {
    currentEnvironment.init('/data/config/environment.json', navCallback, langCallback).then(() => {
      const appInsightsKey = currentEnvironment.getAppInsightsKey();
      ReactAI.init({ instrumentationKey: appInsightsKey });
      dispatch(fetchFeatureFlags());
    });
  };
};
