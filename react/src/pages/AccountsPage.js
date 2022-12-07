import { useContext, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import HeaderData from '../HeaderData';
import AccountsComponent from './AccountsComponent';

const AccountsPage = (props) => {

    const [ header ] = useContext(HeaderData);

    return <div className="container">
        <AccountsComponent header={header} />
    </div>
};

export default AccountsPage;
