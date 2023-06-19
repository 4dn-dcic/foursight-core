import { useSearchParams } from 'react-router-dom';
import Str from '../utils/Str';

const useUrlArgs = () => {
    const [ urlArgs, setUrlArgs ] = useSearchParams();
    function getArg(arg) {
        //
        // N.B. This reference to urlArgs does not work quite correctly as I think
        // being captured with closure of nested function usage; not sure of right
        // way to deal with this; perhaps something like putting setUrlArgs in the
        // useEffect dependency list but that is not quite working correctly either;
        // accessing window.location.search directly works for now.
        // return urlArgs.get("secrets");
        //
        return new URLSearchParams(window.location.search).get(arg);
    }
    function setArg(arg, value) {
        if (Str.HasValue(value)) {
            setUrlArgs({...urlArgs, [arg]: value});
        }
        else if (value === undefined) {
            unsetArg(arg);
        }
    }
    function unsetArg(arg, value = null) {
        if (!Str.HasValue(value) || getArg(arg) == value) {
            delete urlArgs[arg];
            setUrlArgs({...urlArgs});
        }
    }
    return {
        get: (arg) => getArg(arg),
        set: (arg, value) => setArg(arg, value),
        unset: (arg, value = null) => unsetArg(arg, value)
    }
}

export default useUrlArgs;
