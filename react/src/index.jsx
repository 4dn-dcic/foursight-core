import React from 'react';
import ReactDOM from 'react-dom/client';
import './css/index.css';
import App from './App';
import { CookiesProvider } from 'react-cookie';
import { GetCookie } from './utils/CookieUtils';

const root = ReactDOM.createRoot(document.getElementById('root'));

if (GetCookie("test_mode_dummy_page") == "1") {
    root.render(
        <div>
            Foursight: Hello, world!
        </div>
    );
}
else {
    root.render(
        <React.StrictMode>
            <CookiesProvider>
                <App />
            </CookiesProvider>
        </React.StrictMode>
    );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
