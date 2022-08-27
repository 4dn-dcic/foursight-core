import { useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GlobalContext from "./GlobalContext.js";
import { VerifyLogin, LoginRequired } from "./LoginUtils.js";

const Home = (props) => {

    console.log("Home Page")
    const [ info, setInfo ] = useContext(GlobalContext);

    useEffect(() => {
         console.log('USE-EFFECT!! Info')
         if (!info.loading) {
            setInfo(JSON.parse(JSON.stringify(info)))
         }
    }, []);

    if (info?.loading) return <>Loading ...</>; return <LoginRequired>
        <h1>Home:</h1>
        <hr />
        <p style={{ marginTop: "150vh" }}>
            <Link to="/contact">Go to contact page</Link>
        </p>
    </LoginRequired>
};

export default Home;
