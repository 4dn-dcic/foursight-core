import "react-tooltip/dist/react-tooltip.css";
import { Tooltip as ReactTooltip } from "react-tooltip";

const Tooltip = ({ id, type = "dark", position = "bottom", text = "Your tooltip here.", shape = "default", color = null, background = null, bold = false, italic = false, icon = false, float = false, style = null, children}) => {
    // type => dark (black) | success (green-ish) | warning (orange-ish) | error (red-ish) | info (blue-ish) | light (white-ish)
    // or override both color and background specifically
    // if children specified then they override any given text as the tooltip content. 
    // if (!Str.HasValue(id) || !Str.HasValue(text)) return null;
    return <ReactTooltip anchorId={id}
                         place={position}
                         content={text}
                         variant={type}
                         float={float}
                         style={{ ...style, borderRadius:shape == "squared" ? "0 0 0 0" : "14px 0 14px 0", opacity:"1.0", zIndex:1000, fontWeight:bold ? "bold" : "normal" }}></ReactTooltip>
}

export default Tooltip;