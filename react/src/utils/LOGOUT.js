// -------------------------------------------------------------------------------------------------
// Logout function.
// -------------------------------------------------------------------------------------------------

import Cookie from './Cookie';
import ENV from './ENV';
import Page from '../Page';
import SERVER from './SERVER';

// Redirects to the server /logout page in order to delete the authtoken cookie.
// The server should redirect back to the value of Client.LastPath (from the lasturl cookie)
//
function LOGOUT() {
    Cookie.DeleteFauxLogin();
    Cookie.DeleteAuth();
    Cookie.SetRedirect(Page.LastUrl());
    window.location.replace(SERVER.Url("/logout", ENV.Current()));
}

export default LOGOUT;
