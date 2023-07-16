import Time from './Time';
import LiveTime from '../LiveTime';

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const VERBOSE = true;
const NO_VERBOSE = false;

const MILITARY = true;
const NO_MILITARY = false;

const TIMEZONE = true;
const NO_TIMEZONE = false;

const exports = {
    Now: () => new Date(),
    Format: (value) =>
        Time.FormatDateTime(value, NO_VERBOSE, TIMEZONE, MILITARY),
    Format24: (value) =>
        Time.FormatDateTime(value, NO_VERBOSE, TIMEZONE, MILITARY),
    Format12: (value) =>
        Time.FormatDateTime(value, NO_VERBOSE, TIMEZONE, NO_MILITARY),
    FormatVerbose: (value) =>
        Time.FormatDateTime(value, VERBOSE, TIMEZONE, NO_MILITARY),
    Live: LiveTime.FormatDateTime
}; export default exports;
