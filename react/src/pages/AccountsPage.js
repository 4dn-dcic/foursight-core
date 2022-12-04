import { useContext, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import HeaderData from '../HeaderData';
import AccountsComponent from './AccountsComponent';
import Type from '../utils/Type';

const AccountsPage = (props) => {

    const [ header ] = useContext(HeaderData);
    const [ args, setArgs ] = useSearchParams();
    const argS3 = args.get("s3");
    const [ s3, setS3 ] = useState(argS3?.toLowerCase() == "true" || argS3 == "1" ? true : false);

    return <div className="container">
        <AccountsComponent header={header} s3={s3} />
    </div>
};

export default AccountsPage;
