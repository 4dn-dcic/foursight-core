// -------------------------------------------------------------------------------------------------
// Current date/time/duration components.
// -------------------------------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import TIME from "./utils/TIME";

const _CURRENT_TIME_INTERVAL = 1100;

const FormatDateTime = ({verbose = false}) => {
    const [ now, setNow ] = useState(new Date());
    useEffect(() => {setInterval(() => setNow(new Date()), _CURRENT_TIME_INTERVAL); }, []);
    return <>{TIME.FormatDateTime(now, verbose)}</>
}

const FormatDuration = ({start = null, end = null, verbose = false, fallback = "", suffix = "", tooltip = false}) => {
    const [ now, setNow ] = useState(new Date());
    useEffect(() => {setInterval(() => setNow(new Date()), _CURRENT_TIME_INTERVAL); }, []);
    return <>
        { tooltip ? <>
            <span className="tool-tip" data-text={TIME.FormatDateTime(start || end)}>
                {TIME.FormatDuration(start || now, end || now, verbose, fallback, null, suffix)}
            </span>
        </>:<>
            {TIME.FormatDuration(start || now, end || now, verbose, fallback, null, suffix)}
        </>}
    </>
}

// -------------------------------------------------------------------------------------------------
// Exported components.
// -------------------------------------------------------------------------------------------------

export default {
    FormatDateTime: FormatDateTime,
    FormatDuration: FormatDuration
}
