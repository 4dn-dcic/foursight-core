import Cookie from './utils/Cookie';
import Global from './Global';
import { defineGlobal, useGlobal } from './Global';
import Image from './utils/Image';

const _ReadOnlyModeGlobal = defineGlobal(() => Cookie.IsReadOnlyMode());
const _ReadOnlyModeDisplay = () => {
    const [ readOnlyMode, setReadOnlyMode ] = useGlobal(_ReadOnlyModeGlobal);
    return <span title={`You are in ${readOnlyMode ? 'readonly' : 'read/write'} mode. Click to enter ${readOnlyMode ? 'read/write' : 'readonly'} mode.`}>
        <img alt="lock" src={readOnlyMode ? Image.Lock() : Image.Unlock()} style={{height:"35",cursor:"pointer"}}
            onClick={() => {
                Cookie.SetReadOnlyMode(!readOnlyMode);
                setReadOnlyMode(!readOnlyMode);
            }} />
    </span>
}

const exports = {
    Display: _ReadOnlyModeDisplay,
    Use:     () => Global.Use(_ReadOnlyModeGlobal)
}; export default exports;

// For a more React-ish usage.
//
export const ReadOnlyModeDisplay = _ReadOnlyModeDisplay;
export const useReadOnlyMode = () => useGlobal(_ReadOnlyModeGlobal);
