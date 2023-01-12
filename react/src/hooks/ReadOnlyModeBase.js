import Cookie from '../utils/Cookie';
import defineGlobal from './GlobalDefinition';
import useGlobal from './Global';
import Image from './utils/Image';
import Tooltip from './components/Tooltip';

const __readOnlyModeGlobal = defineGlobal(() => Cookie.IsReadOnlyMode());
const _ReadOnlyModeDisplay = () => {
    const [ readOnlyMode, setReadOnlyMode ] = useGlobal(_ReadOnlyModeGlobal);
    return <>
        <img id={`tooltip-readonly`} alt="lock" src={readOnlyMode ? Image.Lock() : Image.Unlock()} style={{height:"35",cursor:"pointer"}}
            onClick={() => {
                Cookie.SetReadOnlyMode(!readOnlyMode);
                setReadOnlyMode(!readOnlyMode);
            }} />
        <Tooltip id={`tooltip-readonly`} position="bottom" text={`You are in ${readOnlyMode ? 'readonly' : 'read/write'} mode. Click to enter ${readOnlyMode ? 'read/write' : 'readonly'} mode.`} />
    </>
}

export const ReadOnlyModeDisplay = _ReadOnlyModeDisplay;
export const useReadOnlyMode = () => useGlobal(_ReadOnlyModeGlobal);
