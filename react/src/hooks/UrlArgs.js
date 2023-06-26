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
        const args = new URLSearchParams(window.location.search);
        return Str.HasValue(arg) ? args.get(arg) : args.toString();
    }
    function setArg(arg, value) {
        if (!Str.HasValue(arg)) return;
        if (Str.HasValue(value)) {
            setUrlArgs({...urlArgs, [arg]: value});
        }
        else {
            unsetArg(arg);
        }
    }
    function unsetArg(arg, value = null) {
        if (!Str.HasValue(arg)) return;
        if (!Str.HasValue(value) || getArg(arg) == value) {
            delete urlArgs[arg];
            setUrlArgs({...urlArgs});
        }
    }
    function getListArg(arg) {
        return urlArgs?.get(arg)?.split(",") || [];
    }
    function setListArg(arg, value = null) {
        if (!Str.HasValue(arg)) return;
        if (Str.HasValue(value)) {
            const argValue = getArg(arg)
            const argValues = argValue?.split(",") || [];
            if (!argValues.includes(value)) {
                argValues.push(value);
                setArg(arg, argValues.join(","));
            }
        }
        else {
            unsetArg(arg);
        }
    }
    function unsetListArg(arg, value = null) {
        if (!Str.HasValue(arg)) return;
        if (Str.HasValue(value)) {
            const argValue = getArg(arg);
            const argValues = argValue?.split(",") || [];
            const argValueIndex = argValues.indexOf(value);
            if (argValueIndex !== -1) {
                argValues.splice(argValueIndex, 1);
                setArg(arg, argValues.join(","));
            }
        }
        else {
            unsetArg(arg);
        }
    }
    return {
        get: (arg = null) => getArg(arg),
        set: (arg, value) => setArg(arg, value),
        unset: (arg, value = null) => unsetArg(arg, value),
        getList: (arg = null) => getListArg(arg),
        setList: (arg, value = null) => setListArg(arg, value),
        unsetList: (arg, value = null) => unsetListArg(arg, value)
    }
}

export default useUrlArgs;
