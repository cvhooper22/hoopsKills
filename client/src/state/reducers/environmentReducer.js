import { APPLICATION_INITIALIZED } from '../constants/action-types';

const environmentReducer = (state = {}, action) => {
  switch (action.type) {
    case APPLICATION_INITIALIZED: {
      return { ...state, appReady: action.payload };
    }
    default: {
      return { ...state };
    }
  }
};

export default environmentReducer;
