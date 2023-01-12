import Cookie from '../utils/Cookie';
import defineGlobal from './GlobalDefinition';
import useGlobal from './Global';

// This is the actual global readonly-mode data definition; INTERNAL to this module.
// This is initialized from the ("readonly") cookie where we store readonly-mode,
// i.e. via Cookie.IsReadOnlyMode.
//
const readOnlyModeGlobalData = defineGlobal(() => Cookie.IsReadOnlyMode());

// This hook provides read/write access to the global readonly-mode data.
// E.g. const [ readOnlyMode, setReadOnlyMode ] = useReadOnlyMode();
// The setter for this not only update the global readonly-mode data but
// also the associated ("readonly") cookie, i.e. via Cookie.SetReadOnlyMode.
//
export const useReadOnlyMode = () => {
    const [ readOnlyMode, setReadOnlyMode ] = useGlobal(readOnlyModeGlobalData);
    return [
        readOnlyMode,
        (value) => {
            setReadOnlyMode(value);
            Cookie.SetReadOnlyMode(value);
        }
    ];
}
