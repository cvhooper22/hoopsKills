import { FETCH_CONFIG_COMPLETED, FETCH_CONFIG_ERROR } from '../constants/action-types';
import currentEnvironment from '../../utils/environment/currentEnvironment';
import HttpService from '../../utils/httpService';

export const fetchConfig = () => {
  return (dispatch) => {
    const url = `${currentEnvironment.getItem('baseServiceUrl')}/api/SmartAdvisor/metadata`;
    HttpService.request({ url })
      .then((response) => {
        dispatch({ type: FETCH_CONFIG_COMPLETED, payload: response.data });
      })
      .catch((err) => {
        dispatch({ type: FETCH_CONFIG_ERROR, payload: err });
      });
  };
};
