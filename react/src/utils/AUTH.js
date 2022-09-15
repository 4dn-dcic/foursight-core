// Authentication and authorization utilities.
// All of these are passed the global header state as an argument.

import UTIL from './UTIL';
import COOKIE from './COOKIE';
import CLIENT from './CLIENT';
import SERVER from './SERVER';
import * as URL from './URL';

function IsLoggedIn(header) {
    //
    // We can either check the global header auth field or check for the cookie. 
    // Probably better more React-ish to check this global state, especially
    // since the way we detect the existence of the authtoken cookie is a bit
    // hacky since it is an HttpOnly cookie (see COOKIE.HasAuthToken).
    //
    return header.auth?.authenticated;
}

function IsFauxLoggedIn(header) {
    return CLIENT.IsLocal() && COOKIE.HasFauxLogin();
}

function LoggedInUser(header) {
    return header.auth?.authenticated ? header.auth?.user : "unknown";
}

function Logout(header) {
        console.log("LOGOUTOOOOO")
    COOKIE.DeleteFauxLogin();
    //window.location.replace("http://localhost:8000/api/reactapi/" + URL.Env() + "/logout");
    //window.location.replace("/api/reactapi/" + CLIENT.Env(header) + "/logout");
    console.log('xyzzy......................................')
    console.log(SERVER.Url("/logout", CLIENT.Env()));
    window.location.replace(SERVER.Url("/logout", CLIENT.Env()));
}

export default {
    IsFauxLoggedIn: IsFauxLoggedIn,
    IsLoggedIn: IsLoggedIn,
    LoggedInUser: LoggedInUser,
    Logout: Logout
}
