import ENV from './ENV';
import COOKIE from './COOKIE';
import SERVER from './SERVER';

// Redirects to the server /logout page in order to delete the authtoken cookie.
// The server should redirect back to the value of CLIENT.LastPath (from the lasturl cookie)
//
function LOGOUT() {
    COOKIE.DeleteFauxLogin();
    window.location.replace(SERVER.Url("/logout", ENV.Current()));
}

export default LOGOUT;