import { LoginRequired } from "./LoginUtils.js";

const Home = (props) => {

    console.log("Home Page")

    return <LoginRequired>
        <h3>Home:</h3>
        <hr />
        TODO
    </LoginRequired>
};

export default Home;
