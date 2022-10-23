import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useFetch } from '../utils/Fetch';
import Server from '../utils/Server';

const UserEditPage = () => {
    
    const { uuid } = useParams();
    const user = useFetch(Server.Url("/users/{uuid}"));

    return <>
        <div>
            UserEditPage: TODO
        </div>
    </>
}

export default UserEditPage;
