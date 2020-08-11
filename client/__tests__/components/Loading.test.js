import React from 'react';
import renderer from 'react-test-renderer';
import Loading from '../../src/components/Loading';

describe('Loading -', () => {

  it('Should render Loading', () => {
    const component = renderer.create(<Loading />);

    expect(component).toMatchSnapshot();
  });

});