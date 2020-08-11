import * as LDClient from 'ldclient-js';

import { APPLICATION_INITIALIZED, FETCH_FEATURE_FLAGS_COMPLETED, FETCH_FEATURE_FLAGS_ERROR } from '../constants/action-types';
import currentEnvironment from '../../utils/environment/currentEnvironment';
import { fetchConfig } from './testAction';

const featureFlags = (ldclient) => {
  const allFlags = ldclient.allFlags();
  const flags = {};
  Object.keys(allFlags).forEach((key) => {
    if (key.indexOf('boilerplate') === 0) {
      flags[key] = allFlags[key];
    }
  });
  return flags;
};

export const fetchFeatureFlags = () => {
  return (dispatch) => {
    const userId = currentEnvironment.getUserId();
    const user = {
      key: userId,
    };

    try {
      const ldclient = LDClient.initialize(currentEnvironment.getLaunchDarklyKey(), user);
      ldclient.on('ready', () => {
        dispatch({ type: FETCH_FEATURE_FLAGS_COMPLETED, payload: featureFlags(ldclient) });
        dispatch(fetchConfig());
        dispatch({ type: APPLICATION_INITIALIZED, payload: true });
      });
    } catch (err) {
      dispatch({ type: FETCH_FEATURE_FLAGS_ERROR, payload: err });
    }
  };
};
