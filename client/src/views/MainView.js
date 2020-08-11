import React, { useState } from 'react';
import { withRouter } from 'react-router-dom';

function MainView (props) {
  const imgSrc = './ROClogoclear.png';
  const [ id, setId ] = useState('');
  const { history } = props;

  function onSubmit(evt) {
    if (id.length) {
      console.log('onsubmit', evt);
      console.log('id is', id);
      history.push(`/qrcode/${id}`);
    }
  }
  return (
    <div className="main__container flex column ai-c">
      <img className="main__splash-image" src={ imgSrc } />
      <div className="main__instructions mt-reg">
        Here there be stats
      </div>
      <input className="main__id-input mt-reg" type="text" placeholder="Student Id" value={ id } onChange={ e => setId(e.target.value) } />
      <button className="mt-reg" type="button" onClick={ onSubmit }>Get QR Code</button>
    </div>
  );
}

export default withRouter(MainView);
