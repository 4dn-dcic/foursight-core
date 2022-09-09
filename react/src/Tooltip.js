import ReactTooltip from "react-tooltip";
import { useState } from 'react';
import { UUID } from './Utils';

export const Tooltip = ({text, id = null, color = "white", background = "black", bold = false, italic = false, children}) => {
    const _id = !id ? UUID() : id;
    const [tooltip, showTooltip] = useState(true);
    //
    // WRT to the setTimeout thing see: https://github.com/wwayne/react-tooltip/issues/765#issuecomment-1119129132
    //
        /*
    if (tooltip) {
        return <div>
            <ReactTooltip id={_id} followPointer={true} effect="solid" backgroundColor={background} textColor={color}>
                <span style={{fontWeight:bold ? "bold" : "normal", fontStyle:italic ? "italic" : "normal"}}>{text}</span>
            </ReactTooltip>
        </div>
    }
    else {
        return <>{children}</>
    }
        */
    return <span>
        {tooltip && <ReactTooltip id={id} followPointer={true} effect="solid" backgroundColor={background} textColor={color}><span style={{fontWeight:bold ? "bold" : "normal", fontStyle:italic ? "italic" : "normal"}}>{text}</span></ReactTooltip>}
        <span data-tip data-for={id} mouseTrail={true} onMouseEnter={() => showTooltip(true)} onMouseLeave={() => { showTooltip(false); setTimeout(() => showTooltip(true), 1); }}>{children}</span>
    </span>
}
