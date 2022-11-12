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

const AccountInfo = ({ account }) => {
    const info = useFetch(Server.Url(`/accounts/${account.id}`, false), { nofetch: false });
    return <>
        <div className="box">
                {info.data?.name}
                {info.data?.foursight_url}
            <table><tbody>
                <tr>
                    <td>
                        Account:
                    </td>
                    <td>
                        {info.data?.name}
                    </td>
                </tr>
            </tbody></table>
        </div>
        <pre>
            {JSON.stringify(info.data, null, 2)}
        </pre>
    </>
}

const AccountsComponent = () => {

    const accounts = useFetch(Server.Url("/accounts", false));

    return <>
        { accounts?.map(account =>
            <AccountInfo account={account} />
        )}
    </>
}

export default AccountsComponent;
