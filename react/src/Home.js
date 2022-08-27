import { useContext } from 'react';
import GlobalContext from "./GlobalContext.js";
import { LoginRequired } from "./LoginUtils.js";

const Home = (props) => {

    console.log("Home Page")
    const [ info ] = useContext(GlobalContext);

    if (info?.loading) return <>Loading ...</>; return <LoginRequired>
        <h3>Home:</h3>
        <hr />
        TODO
    </LoginRequired>
};

export default Home;
