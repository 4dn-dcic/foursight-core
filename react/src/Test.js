import './App.css';
import React from 'react';
import { instanceOf } from 'prop-types';
import { Component, useContext, useEffect, useCookies} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GlobalContext from "./GlobalContext.js";
import { URL, URLE, getEnvFromUrlPath } from "./Utils.js";
import { RingSpinner, BarSpinner } from "./Spinners.js";
import { Cookies } from 'react-cookie';
import Auth0Lock from 'auth0-lock';
import { useJwt } from "react-jwt";

class Test extends Component {

  //static propTypes = {
    //cookies: instanceOf(Cookies).isRequired
  //};

    constructor(props) {
        //const [cookies, setCookie] = useCookies(['user']);
        super(props);
        console.log('Test');
        console.log(props)
            //        const { decodedToken, isExpired, reEvaluateToken } = useJwt(token);
    }
    componentWillMount() {
        //useEffect(() => { const [setCookie] = useCookies(["member"]) });
        console.log('componentWillMount');
        //const { cookies } = this.props;
        //this.state = { name: Cookies.get('name') };

        //let token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImRhdmlkX21pY2hhZWxzQGhtcy5oYXJ2YXJkLmVkdSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJpc3MiOiJodHRwczovL2htcy1kYm1pLmF1dGgwLmNvbS8iLCJzdWIiOiJnb29nbGUtb2F1dGgyfDExNzMwMDIwNjAxMzAwNzM5ODkyNCIsImF1ZCI6IkRQeEV3c1pSbktEcGswVmZWQXhyU3RSS3VrTjE0SUxCIiwiaWF0IjoxNjYxNTI0NzQxLCJleHAiOjE2NjE1NjA3NDF9.ebubhh7VZbkah36bwuBHkgUKEAg6S8JLksVo_ui6ID8'
    }

    render() {
        return (<>
                <span>hello</span>
        </>);
    }
}

export default Test;
