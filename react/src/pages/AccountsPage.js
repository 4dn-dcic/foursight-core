import { useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Uuid from 'react-uuid';
import HeaderData from '../HeaderData';
import Page from '../Page';
import Auth from '../utils/Auth';
import Client from '../utils/Client';
import Char from '../utils/Char';
import Env from '../utils/Env';
import { useFetch, useFetchFunction } from '../utils/Fetch';
import Server from '../utils/Server';
import Type from '../utils/Type';
import AccountsComponent from './AccountsComponent';

const AccountsPage = (props) => {

    return <div className="container">
        <AccountsComponent />
    </div>
};

export default AccountsPage;
