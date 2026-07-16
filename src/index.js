import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { unregister } from './registerServiceWorker';
unregister();

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(<App />);

registerServiceWorker();