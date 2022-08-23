import { Link } from 'react-router-dom';

const Info = (props) => {
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
