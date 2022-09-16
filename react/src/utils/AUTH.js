// Authentication and authorization utilities.
// All of these are passed the global header state as an argument.

import COOKIE from './COOKIE';
import CLIENT from './CLIENT';
import SERVER from './SERVER';

function IsLoggedIn(header) {
    //
    // We can either check the global header auth field or check for the cookie. 
    // Probably better more React-ish to check this global state, especially
    // since the way we detect the existence of the authtoken cookie is a bit
    // hacky since it is an HttpOnly cookie (see COOKIE.HasAuthToken).
    //
    if (CLIENT.IsLocal() && IsFauxLoggedIn()) {
        return true;
    }
    return header?.auth?.authenticated;
}

function IsFauxLoggedIn(header) {
    return CLIENT.IsLocal() && COOKIE.HasFauxLogin();
}

function LoggedInUser(header) {
    if (CLIENT.IsLocal() && IsFauxLoggedIn()) {
        return "faux-login";
    }
    return header?.auth?.authenticated ? header.auth?.user : "unknown";
}

function LoggedInUserVerified(header) {
    return header?.auth?.authenticated ? header.auth?.user_verified : false;
}

function LoggedInUserJwt(header) {
    return header?.auth?.jwt;
}

function Logout(header) {
    COOKIE.DeleteFauxLogin();
    window.location.replace(SERVER.Url("/logout", CLIENT.Env()));
}

export default {
    IsFauxLoggedIn: IsFauxLoggedIn,
    IsLoggedIn: IsLoggedIn,
    LoggedInUser: LoggedInUser,
    LoggedInUserVerified: LoggedInUserVerified,
    LoggedInUserJwt: LoggedInUserJwt,
    Logout: Logout
}
