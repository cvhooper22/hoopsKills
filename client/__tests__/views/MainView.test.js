import React from 'react';
import renderer from 'react-test-renderer';
import { I18nextProvider } from 'react-i18next';

import MainView from '../../src/views/MainView';
import i18n from '../i18n';

describe('MainView -', () => {
  it('Should render MainView', () => {
    const view = renderer.create(
      <I18nextProvider i18n={ i18n }>
        <MainView
          date="2018-03-11T08:42:34"
        ></MainView>
      </I18nextProvider>,
    );

    expect(view).toMatchSnapshot();
  });
});
