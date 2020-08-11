import React from 'react';
import renderer from 'react-test-renderer';
import { I18nextProvider } from 'react-i18next';

import { ConnectedFeatureFlagsView } from '../../src/views/FeatureFlagsView';
import i18n from '../i18n';

describe('FeatureFlagsView -', () => {
  it('Should render with false', () => {
    const view = renderer.create(
      <I18nextProvider i18n={ i18n }>
        <ConnectedFeatureFlagsView
          featureFlags={{ test: false }}
        ></ConnectedFeatureFlagsView>
      </I18nextProvider>
    );

    expect(view).toMatchSnapshot();
  });

  it('Should render with true', () => {
    const view = renderer.create(
      <I18nextProvider i18n={ i18n }>
        <ConnectedFeatureFlagsView
          featureFlags={{ test: true }}
        ></ConnectedFeatureFlagsView>
      </I18nextProvider>
    );

    expect(view).toMatchSnapshot();
  });

  it('Should render with undefined', () => {
    const view = renderer.create(
      <I18nextProvider i18n={ i18n }>
        <ConnectedFeatureFlagsView
          featureFlags={{ }}
        ></ConnectedFeatureFlagsView>
      </I18nextProvider>
    );

    expect(view).toMatchSnapshot();
  });

});