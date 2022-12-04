import { useContext } from 'react';
import { useFetchFunction } from './utils/Fetch';
import HeaderData from './HeaderData';
import Server from './utils/Server';

export const useHeaderRefresh = (env) => {
    const [ _, setHeader ] = useContext(HeaderData);
    const fetchHeader = useFetchFunction();
    function refresh(env) {
        fetchHeader({
            url: Server.Url("/header", env),
            onData: (data) => setHeader(data)
        });
    }
    return (env) => refresh(env)
}
