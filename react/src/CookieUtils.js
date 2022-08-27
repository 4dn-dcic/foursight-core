import Cookies from 'universal-cookie';
import { decodeToken } from "react-jwt";
import * as Utils from './Utils.js';

let _cookies = new Cookies()

export const GetCookie = (name) => {
    const value = _cookies.get(name);
    return (value == "") ? undefined : value;
}

export const SetCookie = (name, value) => {
    if (Utils.isNonEmptyString(name)) {
        if (Utils.isNonEmptyString(value)) {
            _cookies.set(name, value, { path: "/"});
        } else {
            DeleteCookie(name);
        }
    }
}

export const DeleteCookie = (name) => {
    _cookies.remove(name, { path: "/" });
    // Issues with leading dot on domain name in cookie ...
    document.cookie = "jwtToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + document.location.hostname + ";";
}

const _jwtTokenCookieName = "jwtToken";

export const GetJwtTokenCookie = (name) => {
    return GetCookie(_jwtTokenCookieName);
}

export const DecodeJwtToken = (jwtToken) => {
    return decodeToken(jwtToken);
}

export const GetDecodedJwtTokenCookie = (name) => {
    const jwtToken = GetJwtTokenCookie()
    if (Utils.isNonEmptyString(jwtToken)) {
        try {
            return DecodeJwtToken(jwtToken);
        } catch {
            console.log("Error parsing JWT token.");
        }
    } else {
        console.log("No JWT token found.");
        return undefined;
    }
}

export const DeleteJwtTokenCookie = (name) => {
    DeleteCookie(_jwtTokenCookieName)
}

export const CreateSampleJwtTokenCookie = () => {
    const sampleJwtToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImRhdmlkX21pY2hhZWxzQGhtcy5oYXJ2YXJkLmVkdSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJpc3MiOiJodHRwczovL2htcy1kYm1pLmF1dGgwLmNvbS8iLCJzdWIiOiJnb29nbGUtb2F1dGgyfDExNzMwMDIwNjAxMzAwNzM5ODkyNCIsImF1ZCI6IkRQeEV3c1pSbktEcGswVmZWQXhyU3RSS3VrTjE0SUxCIiwiaWF0IjoxNjYxNTI0NzQxLCJleHAiOjE2NjE1NjA3NDF9.ebubhh7VZbkah36bwuBHkgUKEAg6S8JLksVo_ui6ID8";
    SetCookie(_jwtTokenCookieName, sampleJwtToken);
}
