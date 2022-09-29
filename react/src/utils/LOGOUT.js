// -------------------------------------------------------------------------------------------------
// Logout function.
// -------------------------------------------------------------------------------------------------

import COOKIE from './COOKIE';
import ENV from './ENV';
import Page from '../Page';
import SERVER from './SERVER';

// Redirects to the server /logout page in order to delete the authtoken cookie.
// The server should redirect back to the value of CLIENT.LastPath (from the lasturl cookie)
//
function LOGOUT() {
    COOKIE.DeleteFauxLogin();
    COOKIE.DeleteAuth();
    COOKIE.SetRedirect(Page.LastUrl());
    window.location.replace(SERVER.Url("/logout", ENV.Current()));
}

export default LOGOUT;
