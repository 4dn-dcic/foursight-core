import React from 'react';
import ReactDOM from 'react-dom/client';
import './css/index.css';
import App from './App';
import COOKIE from './utils/COOKIE';

const root = ReactDOM.createRoot(document.getElementById('root'));

if (COOKIE.Get("test_mode_dummy_page") == "1") {
    root.render(
        <div>
            Foursight: Hello, world!
        </div>
    );
}
else {
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
