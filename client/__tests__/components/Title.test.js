import React from 'react';
import renderer from 'react-test-renderer';
import Title from '../../src/components/Title';

describe('Title -', () => {

  it('Should render Title', () => {
    const component = renderer.create(
        <Title
          title="This is a test"
        ></Title>
    );

    expect(component).toMatchSnapshot();
  });

});