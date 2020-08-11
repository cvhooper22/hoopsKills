import ReactAI from 'react-appinsights';
import get from 'lodash.get';
import currentEnvironment from './environment/currentEnvironment';

function setUserContext (ai, accountId) {
  if (!get(ai, 'context.user.accountId')) {
    const userId = currentEnvironment.getUserId();
    ai.setAuthenticatedUserContext(userId, accountId);
  }
}

export function trackEvent (name, properties = {}, measurements = {}) {
  const ai = ReactAI.ai();
  const tenantId = currentEnvironment.getTenantId();

  properties.tenantId = tenantId;
  setUserContext(ai, tenantId);
  ai.trackEvent(name, properties, measurements);
}

export function trackPageView (properties = {}, name = window.location.pathname, url = currentEnvironment.getOrigin(), measurements = {}) {
  const ai = ReactAI.ai();
  const tenantId = currentEnvironment.getTenantId();

  properties.tenantId = tenantId;
  setUserContext(ai, tenantId);
  ai.trackPageView(name, url, properties, measurements);
}
