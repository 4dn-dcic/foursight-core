import { Link } from 'react-router-dom';

const Home = (props) => {
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
