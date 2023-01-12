import Cookie from '../utils/Cookie';
import useGlobal from './Global';

const useReadOnlyMode = () => {
    const __readOnlyModeGlobal = useGlobal(() => Cookie.IsReadOnlyMode());
    return useGlobal(__readOnlyModeGlobal);
}

export default useReadOnlyMode;
