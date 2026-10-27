import { runBridge, createDiagnostic, captureDiagnostic, formatDiagnostic } from './okta';

const diagnostic = createDiagnostic();
runBridge(diagnostic).catch(error => {
    // Config/SDK initialization can fail before runBridge's cleanup catch.
    // Otherwise retain the first classification, not its generic rethrow.
    captureDiagnostic(diagnostic, error);
    // Never render provider exceptions or query parameters (they can contain credentials).
    window.history.replaceState(null, '', window.location.pathname);
    document.getElementById('status').textContent =
        'Sign-in or sign-out could not be completed. Return to Foursight and try again.';
    document.getElementById('retry').hidden = false;
    const detail = document.createElement('p');
    detail.id = 'diagnostic';
    detail.textContent = 'Diagnostic: ' + formatDiagnostic(diagnostic);
    document.getElementById('status').insertAdjacentElement('afterend', detail);
});
