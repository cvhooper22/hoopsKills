import { FETCH_FEATURE_FLAGS_COMPLETED, FETCH_FEATURE_FLAGS_UPDATED } from '../constants/action-types';

const BOILERPLATE_FEATUREFLAG = 'boilerplate.featureFlag';

const featureFlagsReducer = (state = {}, action) => {
  switch (action.type) {
    case FETCH_FEATURE_FLAGS_COMPLETED:
    case FETCH_FEATURE_FLAGS_UPDATED: {
      const ff = {};

      const { payload } = action;
      Object.keys(payload).forEach((key) => {
        if (key.indexOf(BOILERPLATE_FEATUREFLAG) === 0) {
          ff[key.substring(BOILERPLATE_FEATUREFLAG.length + 1)] = payload[key];
        }
      });
      return { ...state, featureFlags: ff };
    }
    default: {
      return { ...state };
    }
  }
};

export default featureFlagsReducer;
