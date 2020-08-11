import React from 'react';
import PropTypes from 'prop-types';

function ConfigGrid (props) {
  const { data } = props;

  function renderRows () {
    return data.map((row) => {
      return <tr key={ row.id }><td>{ row.label }</td></tr>;
    });
  }

  return (
    <table>
      <tbody>
        { renderRows() }
      </tbody>
    </table>
  );
}

ConfigGrid.propTypes = {
  data: PropTypes.array,
};

ConfigGrid.defaultProps = {
  data: [],
};

export default ConfigGrid;
