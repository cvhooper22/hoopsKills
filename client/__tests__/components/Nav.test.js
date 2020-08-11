import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import renderer from 'react-test-renderer';
import { I18nextProvider } from 'react-i18next';

import Nav from '../../src/components/Nav';
import i18n from '../i18n';

describe('Nav -', () => {
  it('Should render Nav - Main view active', () => {
    const component = renderer.create(
      <I18nextProvider i18n={ i18n }>
        <MemoryRouter>
          <Nav
          ></Nav>
        </MemoryRouter>
      </I18nextProvider>
    );

    expect(component).toMatchSnapshot();
  });

  it('Should render Nav - Secondary view active', () => {
    const component = renderer.create(
      <I18nextProvider i18n={ i18n }>
        <MemoryRouter initialEntries={[ '/secondary' ]}>
          <Nav
          ></Nav>
        </MemoryRouter>
      </I18nextProvider>
    );

    expect(component).toMatchSnapshot();
  });

});