import axios from 'axios';
import get from 'lodash.get';
import ApplicationFramework from 'webclient-shell-unoadapter';

class CurrentEnvironment {
  constructor () {
    this.inCloud = false;
    this.properties = {};
  }


  init (url = '/environment.json', navCallback, langCallback) {
    return axios.get(url)
      .then((response) => {
        Object.assign(this.properties, response.data);

        if (response.data.mode === 'cloud') {
          this.inCloud = true;
          return ApplicationFramework.init(window, this.getItem('expectedOrigin'), navCallback, null, langCallback);
        } else {
          this.inCloud = false;
          langCallback(get(response, 'data.language', 'en-US'));
        }
        return null;
      });
  }

  getItem (prop) {
    return this.properties[prop];
  }

  getJwt () {
    return this.inCloud ? ApplicationFramework.getJwtToken() : this.getItem('jwt');
  }

  getUserId () {
    return this.inCloud ? ApplicationFramework.getUserId() : this.getItem('userId');
  }

  getAppInsightsKey () {
    return this.inCloud ? ApplicationFramework.getAppInsightsKey() : this.getItem('appInsightsKey');
  }

  getTenantId () {
    return this.inCloud ? ApplicationFramework.getTenantId() : this.getItem('tenantId');
  }

  getLaunchDarklyKey () {
    return this.inCloud ? ApplicationFramework.getLaunchDarklyKey() : this.getItem('launchDarklyKey');
  }

  getOrigin () {
    return this.inCloud ? ApplicationFramework.getOrigin() : window.location.href;
  }

  needsAuthentication () {
    if (this.inCloud) {
      ApplicationFramework.authenticate();
    }
  }

  sendNavigationToShell (path) {
    if (this.inCloud) {
      ApplicationFramework.sendNavigateToShell(path);
    }
  }

  completeNavigateCommand (path) {
    if (this.inCloud) {
      ApplicationFramework.completeNavigateCommand('', { route: path });
    }
  }
}

export default new CurrentEnvironment();
