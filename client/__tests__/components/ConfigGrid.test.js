import React from 'react';
import renderer from 'react-test-renderer';
import ConfigGrid from '../../src/components/ConfigGrid';

describe('ConfigGrid -', () => {

  it('Should render empty ConfigGrid', () => {
    const component = renderer.create(<ConfigGrid />);

    expect(component).toMatchSnapshot();
  });

  it('Should render non-empty ConfigGrid', () => {
    const data = [
      { id: 1, label: 'item 1' },
      { id: 2, label: 'item 2' },
      { id: 3, label: 'item 3' },
    ]
    const component = renderer.create(<ConfigGrid data={ data } />);

    expect(component).toMatchSnapshot();
  });
});