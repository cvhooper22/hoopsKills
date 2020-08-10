import { combineReducers } from 'redux';
import configReducer from './configReducer';
import environmentReducer from './environmentReducer';
import featureFlagsReducer from './featureFlagsReducer';

const reducers = combineReducers({
  config: configReducer,
  environment: environmentReducer,
  featureFlags: featureFlagsReducer,
});

export default reducers;
