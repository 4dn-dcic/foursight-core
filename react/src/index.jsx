import React from 'react';
import ReactDOM from 'react-dom/client';
import './css/index.css';
import App from './App';
import Cookie from './utils/Cookie';

const root = ReactDOM.createRoot(document.getElementById('root'));

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
