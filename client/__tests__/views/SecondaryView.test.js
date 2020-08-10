import React from 'react';
import renderer from 'react-test-renderer';
import { I18nextProvider } from 'react-i18next';

import { ConnectedSecondaryView } from '../../src/views/SecondaryView';
import i18n from '../i18n';

describe('SecondaryView -', () => {
  const config = [
    { id: 'item1', label: 'item one' },
    { id: 'item2', label: 'item two' },
    { id: 'item3', label: 'item three' },
  ];

  it('Should render SecondaryView', () => {
    const view = renderer.create(
      <I18nextProvider i18n={ i18n }>
        <ConnectedSecondaryView
          appReady
          config={ config }
        ></ConnectedSecondaryView>
      </I18nextProvider>
    );

    expect(view).toMatchSnapshot();
  });

});