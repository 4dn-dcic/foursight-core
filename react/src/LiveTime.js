// -------------------------------------------------------------------------------------------------
// Current date/time/duration components.
// -------------------------------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import Time from "./utils/Time";

const _CURRENT_TIME_INTERVAL = 1100;

const FormatDateTime = ({verbose = false}) => {
    const [ now, setNow ] = useState(new Date());
    useEffect(() => {setInterval(() => setNow(new Date()), _CURRENT_TIME_INTERVAL); }, []);
    return <>{Time.FormatDateTime(now, verbose)}</>
}

const FormatDuration = ({start = null, end = null, verbose = false, fallback = "", suffix = "", tooltip = false}) => {
    const [ now, setNow ] = useState(new Date());
    useEffect(() => {setInterval(() => setNow(new Date()), _CURRENT_TIME_INTERVAL); }, []);
    return <>
        { tooltip ? <>
            <span className="tool-tip" data-text={Time.FormatDateTime(start || end)}>
                {Time.FormatDuration(start || now, end || now, verbose, fallback, null, suffix)}
            </span>
        </>:<>
            {Time.FormatDuration(start || now, end || now, verbose, fallback, null, suffix)}
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
