import RingLoader from "react-spinners/RingLoader";
import BarLoader from "react-spinners/BarLoader";

export const RingSpinner = ({loading, color, size}) => {
    const override: CSSProperties = {
        display: "block",
        margin: "0 auto"
    };
    return <RingLoader color={color} loading={loading} cssOverride={override} size={size} />
}

export const BarSpinner = ({loading, color, size}) => {
    const override: CSSProperties = {
        display: "block",
        margin: "0 auto"
    };
    return <BarLoader color={color} loading={loading} cssOverride={override} width={size} />
}
