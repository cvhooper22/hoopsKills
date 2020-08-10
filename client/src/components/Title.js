import React from 'react';
import PropTypes from 'prop-types';

function Title (props) {
  const { title } = props;

  return (
    <h1>
      <i className="fa fa-compass" />
      { ` ${title}` }
    </h1>
  );
}

Title.propTypes = {
  title: PropTypes.string,
};

export default Title;
