import useHeader from '../hooks/Header';
import AccountsComponent from './AccountsComponent';

const AccountsPage = (props) => {

    const header = useHeader();

    return <div className="container">
        <AccountsComponent header={header} />
    </div>
};

export default AccountsPage;
