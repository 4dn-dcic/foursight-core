import Cookie from './utils/Cookie';
import GlobalState from './GlobalState';
import Image from './utils/Image';

const ReadOnlyModeGlobal = GlobalState.Define(() => Cookie.IsReadOnlyMode());
const ReadOnlyModeDisplay = function() {
    const readOnlyMode = GlobalState.Use(ReadOnlyModeGlobal);
    return <span title={`You are in ${readOnlyMode.value ? 'readonly' : 'read/write'} mode. Click to enter ${readOnlyMode.value ? 'read/write' : 'readonly'} mode.`}>
        <img alt="lock" src={readOnlyMode.value ? Image.Lock() : Image.Unlock()} style={{height:"35",cursor:"pointer"}}
            onClick={() => {
                Cookie.SetReadOnlyMode(!readOnlyMode.value);
                readOnlyMode.update(!readOnlyMode.value);
            }}/>
    </span>
}

const exports = {
    Display: ReadOnlyModeDisplay,
    Use:     () => GlobalState.Use(ReadOnlyModeGlobal)
}; export default exports;
