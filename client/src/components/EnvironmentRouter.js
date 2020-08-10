import { BrowserRouter } from 'react-router-dom';

import currentEnvironment from '../utils/environment/currentEnvironment';

export default class EnvironmentRouter extends BrowserRouter {
  constructor (props) {
    super(props);
    this.lastPath = null;
    this.history.listen((location) => {
      const path = `${location.pathname}${location.search}${location.hash}`;
      if (currentEnvironment.inCloud && path !== this.lastPath) {
        this.lastPath = path;
        currentEnvironment.sendNavigationToShell(path);
        currentEnvironment.completeNavigateCommand(path);
      }
    });
  }
}
