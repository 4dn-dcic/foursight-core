import Image from '../utils/Image';
import Tooltip from '../components/Tooltip';
import useReadOnlyMode from './ReadOnlyMode';

// This is (not a hook but) a UI component which renders
// UI to display and control the global readonly-mode data.
//
const ReadOnlyModeComponent = () => {
    const [ readOnlyMode, setReadOnlyMode ] = useReadOnlyMode();
    return <>
        <img id={`tooltip-readonly`} alt="lock" src={readOnlyMode ? Image.Lock() : Image.Unlock()} style={{height:"35",cursor:"pointer"}} onClick={() => setReadOnlyMode(!readOnlyMode)} />
        <Tooltip id={`tooltip-readonly`} position="bottom" text={`You are in ${readOnlyMode ? 'readonly' : 'read/write'} mode. Click to enter ${readOnlyMode ? 'read/write' : 'readonly'} mode.`} />
    </>
}

export default ReadOnlyModeComponent;
