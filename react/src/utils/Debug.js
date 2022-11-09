import Cookie from './Cookie';

const testModeDebugOutput = Cookie.Get("test_mode_debug_output") === "1";

const exports = {
    Info:  (message, data) => { testModeDebugOutput && console.log(message); if (data) console.log(data); },
    Warn:  (message, data) => { testModeDebugOutput && console.log(message); if (data) console.log(data); },
    Error: (message, data) => { testModeDebugOutput && console.log(message); if (data) console.log(data); }
}; export default exports;
