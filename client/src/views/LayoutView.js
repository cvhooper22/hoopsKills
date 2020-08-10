import React, { Fragment } from 'react';
import PropTypes from 'prop-types';

function LayoutView (props) {
  const { renderPageContent } = props;

  return (
    <Fragment>
      <div className="container">
        <div className="row">
          <div className="col-md-12">
            { renderPageContent() }
          </div>
        </div>
      </div>
    </Fragment>
  );
}

LayoutView.propTypes = {
  renderPageContent: PropTypes.func,
};

export default LayoutView;
