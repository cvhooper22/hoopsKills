import React from 'react';
import { BrowserRouter, Route } from 'react-router-dom';

import MainView from './views/MainView';
import CodeView from './views/CodeView';

export default function App () {
  return (
      <BrowserRouter>
          <Route exact path="/home" component={ MainView } />
          <Route exact path="/qrcode/:id" component={ CodeView } />
          <Route exact path="/" component={ MainView } />
      </BrowserRouter>
  );
}
