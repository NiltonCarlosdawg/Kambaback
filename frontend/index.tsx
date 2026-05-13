import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Carregar Google Identity Services (para login com Google)
const loadGoogleGIS = () => {
  if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) return;
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = () => {
    window.dispatchEvent(new Event('google-gis-ready'));
  };
  script.onerror = () => {
    window.dispatchEvent(new Event('google-gis-error'));
  };
  document.head.appendChild(script);
};
loadGoogleGIS();

const loadAppleJS = () => {
  if (document.querySelector('script[src*="appleid.cdn-apple.com"]')) return;
  const script = document.createElement('script');
  script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.js';
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
};
loadAppleJS();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
