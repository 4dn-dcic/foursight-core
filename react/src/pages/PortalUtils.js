import Tooltip from '../components/Tooltip';

export const BlueGreenMirrorStateImage = (props) => {
    return <>
        <span style={{position: "relative", top: "-2px", right: "5pt"}} id={`tooltip-blue-green-mirror-${props.id}`}>
            <img src="https://png.pngtree.com/png-vector/20220814/ourmid/pngtree-rounded-vector-icon-with-flipped-cyan-and-grey-flat-colors-vector-png-image_19505434.png" height="17"/>
        </span>
        <Tooltip id={`tooltip-blue-green-mirror-${props.id}`} position="left" shape="squared" bold={true} size="small" text={"Blue and green are currently identity swapped."} />
    </>
}
