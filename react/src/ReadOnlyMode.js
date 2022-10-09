import Cookie from './utils/Cookie';
import GlobalState from './GlobalState';
import Image from './utils/Image';

const ReadOnlyModeGlobal = GlobalState.Define(() => Cookie.IsReadOnlyMode());
const ReadOnlyModeDisplay = function() {
    const readOnlyMode = GlobalState.Use(ReadOnlyModeGlobal);
    return <>
        { readOnlyMode.value ? <>
            <span className={"tool-tip"} data-text={"You are in readonly mode. Click to enter read/write mode."}>
                <img alt="lock" src={Image.Lock()}
                    style={{height:"30",cursor:"pointer"}}
                    onClick={() => {
                        readOnlyMode.update(false);
                        Cookie.SetReadOnlyMode(false);
                    }}/>
        
            </span>
        </>:<>
            <span className={"tool-tip"} data-text={"You are in read/write mode. Click to enter readonly mode."}>
                <img alt="unlock" src={Image.Unlock()}
                    style={{height:"30",cursor:"pointer"}}
                    onClick={() => {
                        readOnlyMode.update(true);
                        Cookie.SetReadOnlyMode(true);
                    }}/>
            </span>
        </>}
    </>
}

const exports = {
    Display: ReadOnlyModeDisplay,
    Use:     () => GlobalState.Use(ReadOnlyModeGlobal)
}; export default exports;
