import RingLoader from 'react-spinners/RingLoader';
import BarLoader from 'react-spinners/BarLoader';
import DotLoader from 'react-spinners/DotLoader';
import ScaleLoader from 'react-spinners/ScaleLoader';
import ClipLoader from 'react-spinners/ClipLoader';
import CircleLoader from 'react-spinners/CircleLoader';
import PuffLoader from 'react-spinners/PuffLoader';
import GridLoader from 'react-spinners/GridLoader';

export const RingSpinner = ({loading, color, size}) => {
    const override: CSSProperties = {
        display: "block",
        margin: "0 auto"
    };
    return <RingLoader color={color} loading={loading} cssOverride={override} size={size} />
}

export const BarSpinner = ({loading, color, size, inline, style}) => {
    const override: CSSProperties = {
        display: inline ? "inline" : "block",
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

export const PuffSpinner = ({loading, color, size, inline = false}) => {
    const override: CSSProperties = {
        display: inline ? "inline" : "block",
        margin: "0 auto"
    };
    return <PuffLoader color={color} loading={loading} cssOverride={override} size={size} />
}

export const CircleSpinner = ({loading, color, size}) => {
    const override: CSSProperties = {
        display: "block",
        margin: "0 auto"
    };
    return <CircleLoader color={color} loading={loading} cssOverride={override} size={size} />
}

export const ScaleSpinner = ({loading, color, width, height, speed = 1.6}) => {
    const override: CSSProperties = {
        display: "block",
        margin: "0 auto",
        width: width,
        height: height,
        color: color,
            
    };
    return <ScaleLoader color={color} loading={loading} cssOverride={override} width={width} height={height} speedMultiplier={speed} />
}

export const ClipSpinner = ({loading, color, size}) => {
    const override: CSSProperties = {
        display: "block",
        margin: "0 auto"
    };
    return <ClipLoader color={color} loading={loading} cssOverride={override} width={size} />
}

export const GridSpinner = ({loading, color, size}) => {
    const override: CSSProperties = {
        display: "block",
        margin: "0 auto"
    };
    return <GridLoader color={color} loading={loading} cssOverride={override} size={size} />
}

export const StandardSpinner = ({condition, color = "var(--box-fg)", size = 100, bold = true, label = "Loading", style = {}}) => {
    return <table><tbody><tr>
        {label && <td nowrap="1"><small style={{color:color,fontWeight:bold ? "bold" : "normal"}}><i>{label}</i></small>&nbsp;&nbsp;</td>}
        <td style={{paddingTop:"6px", ...style}} nowrap="1"> <BarSpinner loading={condition} size={size} color={color} /></td>
    </tr></tbody></table>
}

export const PuffSpinnerInline = ({loading, color, size, nudge}) => {
    const style = {
        display: "inline-block",
        marginBottom: `-${(nudge || "2px")}`
    };
    return <PuffLoader color={color} loading={loading} cssOverride={style} size={size} />
}
