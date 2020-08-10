import React, { Fragment, useState, useEffect } from 'react';
import Loading from '../components/Loading';
import axios from 'axios';
import { withRouter } from 'react-router-dom';

// TODO, change this with the prod build
const urlBase = 'https://byu-ticketing-server.herokuapp.com';

function CodeView (props) {
  const [ imageSource, setImageSource ] = useState('');
  const [ error, setError ] = useState({});
  const [ dropdownOpen, setDropdownOpen ] = useState(false);
  const { history, match } = props;
  const id = match.params.id;
  const imgSrc = '/lareen342576.png';
  //https://byu-ticketing-server.herokuapp.com/qrcode/${id}

  // hold off on this until I set the cors on the server
  // useEffect (() => {
  //   axios.request({ url: `${urlBase}/qrcode/${id}` })
  //     .then((res) => {
  //       // console.log('res', res.data)
  //       setImageSource(res.data);
  //     })
  //     .catch( (err) => {
  //       const errorData = {
  //         message: err.message,
  //       }
  //       if (err.response) {
  //         errorData.message = err.response.data;
  //         errorData.status = err.response.status;
  //       }
  //       setError(errorData);
  //     });
  // }, [])

  function onDrowdownClick () {
    setDropdownOpen(!dropdownOpen);
  }

  function onTryAgain () {
    history.push('/');
  }

  function renderDropdown () {
    if (dropdownOpen) {
      return (
        <Fragment>
          <p className="code-view__instructions__nested flex">
            <i className="material-icons">smartphone</i>
            To download on a mobile device, press and hold on the QR code and an option should show up to download the image.
          </p>
          <p className="code-view__instructions__nested flex">
            <i className="material-icons">desktop_windows</i>
            To download on a computer, right-click on the QR code and choose "Save Image As..."
          </p>
        </Fragment>
      );
    }
    return undefined;
  }

  function renderCode () {
    return (
      <Fragment>
        <img className="code-view__qr-code" src={ imageSource } />
        <div className="code-view__instructions mt-large">
          Download the above image to have a digital copy of your ROC pass.
          <button type="button" className="dropdown-trigger flex ai-c" onClick={ onDrowdownClick }>
            { !dropdownOpen ? 
                <i className="material-icons">keyboard_arrow_right</i>
              :
              <i className="material-icons">keyboard_arrow_down</i>
            }
            How do I download?
          </button>
          { renderDropdown() }
        </div>
      </Fragment>
    )
  }

  function renderError () {
    return (
      <div className="code-view__error flex column ai-c">
        <div className="code-vew__error__message">
          { renderErrorMessage () }
        </div>
        <button className="mt-reg" type="button" onClick={ onTryAgain }>Try Again</button>
      </div>
    );
  }

  function renderErrorMessage () {
    if (error.status === 404) {
      return (
        <Fragment>
          Could not find a QR code for the id that you entered.
          <ul>
            <li>Did you enter your Net ID and not your Student ID number?</li>
            <li>Did you remove all dashes from your Student ID number?</li>
            <li>Have you received an email letting you know your digital pass should be ready?</li>
          </ul>
        </Fragment>
      );
    } else if ( error.message) {
      return `There was an error generating your digital ROC Pass: ${error.message}`;
    }
    return 'An error occured generating your digital ROC Pass'
  }

  function renderLoading () {
    return (
      <div className="code-view__loading flex column ai-c">
        <Loading />
        <div className="code-view__loading__message mt-reg">Generating your digital pass...</div>
      </div>
    );
  }

  function renderContent () {
    if (imageSource.length) {
      return renderCode();
    } else if (Object.keys(error).length) {
      return renderError();
    }
    return renderLoading();
  }

  return (
    <div className="code-view flex column ai-c">
      { renderContent() }
    </div>
  );
}

export default withRouter(CodeView);
