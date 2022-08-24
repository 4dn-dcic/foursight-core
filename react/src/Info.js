import { useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GlobalContext from "./GlobalContext.js";

const Info = (props) => {
    console.log("Info Page")
    const [info, setInfo] = useContext(GlobalContext);
        if (!info.loading) info.currentPage = "info";
 useEffect(() => {
         console.log('USE-EFFECT!! Info')
         info.homePageStyle = "normal"
         info.infoPageStyle = "bold"
         info.usersPageStyle = "normal"
         info.currentPage  = "info"
         if (!info.loading) {
            setInfo(JSON.parse(JSON.stringify(info)))
         }
    }, []);
  return (
    <>
      <h1>Info:</h1>
      <hr />
      <p style={{ marginTop: "150vh" }}>
        <Link to="/contact">Go to contact page</Link>
      </p>
    </>
  );
};

export default Info;
