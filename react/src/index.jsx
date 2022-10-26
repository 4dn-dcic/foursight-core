import React from 'react';
import ReactDOM from 'react-dom/client';
import './css/App.css';
import './css/index.css';
import App from './App';
import Cookie from './utils/Cookie';

const root = ReactDOM.createRoot(document.getElementById('root'));

// N.B. When using StrictMode, which is NOT enabled for production builds,
// components (seem to) get rendered TWICE, i.e. e.g. useEffect is called
// twice, resulting in double fetches from the API depending on the component.
// This is said to be done to enable more checking during development, but it
// also is confusing and obfuscates what's going on when you want to make sure
// you're not in fact calling APIs more often than should be for other (bad)
// reasons. So we turn it off by default, but can turn it on by manually
// setting the test_mode_strict_mode cookie.

if (Cookie.Get("test_mode_strict_mode") === "1") {
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}
else {
    root.render(
        <App />
    );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
