import RingLoader from "react-spinners/RingLoader";
import BarLoader from "react-spinners/BarLoader";
import DotLoader from "react-spinners/DotLoader";
import ScaleLoader from "react-spinners/ScaleLoader";
import ClipLoader from "react-spinners/ClipLoader";

export const RingSpinner = ({loading, color, size}) => {
    const override: CSSProperties = {
        display: "block",
        margin: "0 auto"
    };
    return <RingLoader color={color} loading={loading} cssOverride={override} size={size} />
}

export const BarSpinner = ({loading, color, size, style}) => {
    const override: CSSProperties = {
        display: "block",
        margin: "0 auto",
        ...style
    };
    return <BarLoader color={color} loading={loading} cssOverride={override} width={size} />
}

export const DotSpinner = ({loading, color, size}) => {
    const override: CSSProperties = {
        display: "block",
        margin: "0 auto"
    };
    return <DotLoader color={color} loading={loading} cssOverride={override} width={size} />
}

export const ScaleSpinner = ({loading, color, size}) => {
    const override: CSSProperties = {
        display: "block",
        margin: "0 auto"
    };
    return <ScaleLoader color={color} loading={loading} cssOverride={override} width={size} />
}

export const ClipSpinner = ({loading, color, size}) => {
    const override: CSSProperties = {
        display: "block",
        margin: "0 auto"
    };
    return <ClipLoader color={color} loading={loading} cssOverride={override} width={size} />
}
