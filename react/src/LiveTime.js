// -------------------------------------------------------------------------------------------------
// Current date/time/duration components.
// -------------------------------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import Time from "./utils/Time";

const _CURRENT_TIME_INTERVAL = 1100;

const FormatDateTime = ({verbose = false}) => {
    const [ now, setNow ] = useState(new Date());
    useEffect(() => {
        const intervalId = setInterval(() => setNow(new Date()), _CURRENT_TIME_INTERVAL);
        return () => clearInterval(intervalId);
    }, []);
    return <>{Time.FormatDateTime(now, verbose)}</>
}

const FormatDuration = ({start = null, end = null, verbose = false, fallback = "", prefix = "", suffix = "", tooltip = false}) => {
    if (prefix === "datetime") {
        prefix = Time.FormatDateTime(start || end) + " |";
    }
    const [ now, setNow ] = useState(new Date());
    useEffect(() => {
        const intervalId = setInterval(() => { setNow(new Date()); }, _CURRENT_TIME_INTERVAL);
        return () => clearInterval(intervalId);
    }, []);
    return <>
        { tooltip ? <>
            <span className="tool-tip" data-text={Time.FormatDateTime(start || end)}>
                {Time.FormatDuration(start || now, end || now, verbose, fallback, prefix, suffix)}
            </span>
        </>:<>
            {Time.FormatDuration(start || now, end || now, verbose, fallback, prefix, suffix)}
        </>}
    </>
}

// -------------------------------------------------------------------------------------------------
// Exported components.
// -------------------------------------------------------------------------------------------------

const Exports = {
    FormatDateTime: FormatDateTime,
    FormatDuration: FormatDuration
};
export default Exports;
