import React from 'react';
import renderer from 'react-test-renderer';
import LayoutView from '../../src/views/LayoutView';

describe('LayoutView -', () => {

  function renderPageContent () {
    return (
      <div>page content</div>
    );
  }

  it('Should render LayoutView', () => {
    const view = renderer.create(
      <LayoutView
        renderPageContent={ renderPageContent }
      ></LayoutView>
    );

    expect(view).toMatchSnapshot();
  });

});