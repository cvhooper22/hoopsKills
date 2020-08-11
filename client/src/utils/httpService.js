import axios from 'axios';
import get from 'lodash.get';

import currentEnvironment from './environment/currentEnvironment';

class HttpService {
  prepareOptions (options) {
    const completeOptions = { ...options };
    if (!completeOptions.headers) {
      completeOptions.headers = {};
    }

    completeOptions.headers.Authorization = `Bearer ${currentEnvironment.getJwt()}`;
    return completeOptions;
  }

  request (options) {
    return this._makeRequest(options);
  }

  _makeRequest (options) {
    const requestOptions = this.prepareOptions(options);
    return axios.request(requestOptions).catch((error) => {
      const status = get(error, 'response.status', 0);
      if (currentEnvironment.inCloud && status === 401) {
        currentEnvironment.needsAuthentication();
      }
      return error;
    }).then((result) => {
      if (result instanceof Error) {
        throw result;
      } else {
        return result;
      }
    });
  }
}

export default new HttpService();
