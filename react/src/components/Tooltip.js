import "react-tooltip/dist/react-tooltip.css";
import { Tooltip as ReactTooltip } from "react-tooltip";
import Image from '../utils/Image';

const Tooltip = ({ id, type = "dark", position = "bottom", text = "Your tooltip here.", content=null, color = null, background = null, bold = false, italic = false, icon = false, float = false, delay = 500, image = null, imageHeight = null, style = null, children}) => {
    // type => dark (black) | success (green-ish) | warning (orange-ish) | error (red-ish) | info (blue-ish) | light (white-ish)
    // or override both color and background specifically
    // if children specified then they override any given text as the tooltip content. 
    return <ReactTooltip anchorId={id}
                         place={position}
                         content={text}
                         variant={type}
                         float={float}
                         style={{ ...style, borderRadius:"10px 0 10px 0", opacity:"1.0", zIndex:1000, fontWeight:bold ? "bold" : "normal" }}>{children}</ReactTooltip>
}

export default Tooltip;
