import { Navigate } from 'react-router-dom';
import * as URL from "./URL";

const LoginDone = (props) => {
    return <Navigate to={URL.Url("/login", true)} replace />
};

export default LoginDone;
