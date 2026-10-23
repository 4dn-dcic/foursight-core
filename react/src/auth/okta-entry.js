import { runBridge } from './okta';

runBridge().catch(() => {
    // Never render provider exceptions or query parameters (they can contain credentials).
    window.history.replaceState(null, '', window.location.pathname);
    document.getElementById('status').textContent =
        'Sign-in or sign-out could not be completed. Return to Foursight and try again.';
    document.getElementById('retry').hidden = false;
});
