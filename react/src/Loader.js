import RingLoader from "react-spinners/RingLoader";

const Loader = ({loading}) => {
    const override: CSSProperties = {
        display: "block",
        margin: "0 auto"
    };
    return <RingLoader color={'darkblue'} loading={loading} cssOverride={override} size={150} />
}

export default Loader;
