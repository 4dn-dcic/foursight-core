import { useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GlobalContext from "./GlobalContext.js";

const Home = (props) => {
    console.log("Home Page")
    const [ info, setInfo ] = useContext(GlobalContext);

        if (!info.loading) info.currentPage = "home";

 useEffect(() => {
         console.log('USE-EFFECT!! Home')
         info.homePageStyle = "bold"
         info.infoPageStyle = "normal"
         info.usersPageStyle = "normal"
         info.currentPage  = "home"
         if (!info.loading) {
            setInfo(JSON.parse(JSON.stringify(info)))
         }
    }, []);

  return (
    <>
      <h1>Home:</h1>
      <hr />
      <p style={{ marginTop: "150vh" }}>
        <Link to="/contact">Go to contact page</Link>
      </p>
    </>
  );
};

export default Home;
