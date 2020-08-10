import { FETCH_CONFIG_COMPLETED } from '../constants/action-types';

const configReducer = (state = {}, action) => {
  switch (action.type) {
    case FETCH_CONFIG_COMPLETED: {
      const SmartAdvisors = action.payload;
      return { ...state, config: SmartAdvisors };
    }
    default: {
      return { ...state };
    }
  }
};

export default configReducer;
