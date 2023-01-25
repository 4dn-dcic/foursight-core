// -------------------------------------------------------------------------------------------------
// Logout function.
// -------------------------------------------------------------------------------------------------

import Cookie from './Cookie';
import Page from '../Page';
import Server from './Server';

// Redirects to the server /logout page in order to delete the authtoken cookie.
// The server should redirect back to the value of Client.LastPath (from the lasturl cookie)
//
function Logout() {
    Cookie.DeleteAuth();
    Cookie.SetRedirect(Page.LastUrl());
    window.location.replace(Server.Url("/logout"));
}

export default Logout;
