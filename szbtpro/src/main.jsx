import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './widgets/conv';

const root = ReactDOM.createRoot(document.getElementById('root'));

// root.render(
//   <App />
// );

window.ZOHO.embeddedApp.on("PageLoad", (pagedata) => {
  console.log('Page loaded, pagedata:', pagedata);  // 打印 pagedata 来查看数据

  // 渲染组件
  root.render(
    <App data={pagedata} />
  );
});

window.ZOHO.embeddedApp.init();