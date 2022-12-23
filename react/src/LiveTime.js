// -------------------------------------------------------------------------------------------------
// Current date/time/duration components.
// -------------------------------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import Time from './utils/Time';
import Tooltip from './components/Tooltip';

const _CURRENT_TIME_INTERVAL_MS = 1100;

const FormatDateTime = ({verbose = false, timezone = true}) => {
    const [ now, setNow ] = useState(new Date());
    useEffect(() => {
        const intervalId = setInterval(() => setNow(new Date()), _CURRENT_TIME_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, []);
    return <>{Time.FormatDateTime(now, verbose, timezone)}</>
}

const FormatDuration = ({start = null, end = null, verbose = false, fallback = "", prefix = "", suffix = "", tooltip = false}) => {
    if (prefix === "datetime") {
        prefix = Time.FormatDateTime(start || end) + " |";
    }
    const [ now, setNow ] = useState(new Date());
    useEffect(() => {
        const intervalId = setInterval(() => { setNow(new Date()); }, _CURRENT_TIME_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, []);
    return <>
        <span id={tooltip ? `tooltip-timestamp-${start || end}` : ""} data-text={Time.FormatDateTime(start || end)}>
            {Time.FormatDuration(start || now, end || now, verbose, fallback, prefix, suffix)}
            <Tooltip id={`tooltip-timestamp-${start || end}`} text={Time.FormatDateTime(start || end)} />
        </span>
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
