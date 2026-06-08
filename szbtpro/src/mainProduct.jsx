import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './widgets/convProduct';

const root = ReactDOM.createRoot(document.getElementById('root'));

window.ZOHO.embeddedApp.on("PageLoad", (pagedata) => {
  console.log('Page loaded, pagedata:', pagedata);

  root.render(
    <App data={pagedata} />
  );
});

window.ZOHO.embeddedApp.init();
