import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useFetch } from '../utils/Fetch';
import Json from '../utils/Json';
import Server from '../utils/Server';

const UserEditPage = () => {
    
    const { uuid } = useParams();
    const user = useFetch(Server.Url(`/users/${uuid}`), { onData: (data) => data[0] });

    return <>
        <div>
            UserEditPage: TODO
            {Json.Format(user.data)}
        {user.data?.uuid}

            <form>
                <input value={user.data?.uuid}>
                </input>
            </form>
        </div>
    </>
}

export default UserEditPage;
