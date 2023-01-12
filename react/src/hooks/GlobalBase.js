import { useEffect, useState } from 'react';

// This defines a global state mechanism (hook) WITHOUT the need for createContext/useContext,
// and which therefore does NOT require wrapping (e.g. the entire App) in a context Provider.
// Came up with half of this idea originally for the ReadOnlyMode component; then that idea,
// of using (registered) callbacks (aka listeners) to update global state, was generalized
// after looking at this article which validated and expanded on this idea (from Diashi Kato):
// See: https://blog.openreplay.com/steps-to-develop-global-state-for-react-with-hooks-without-context
// Also see: https://stackoverflow.com/questions/63209420/react-global-state-no-context-or-redux
//
// Usage example:
//
// - YourGlobalData.js:
//   import useGlobal from './hooks/Global'; 
//   const YourGlobalData = useGlobal(your-initial-value-or-function);
//   export default YourGlobalData;
//
// - YourGlobalUsage.js:
//   import useGlobal from './hooks/Global'; 
//   import YourGlobalData from './YourGlobalData'; 
//   const [ yourGlobal, setYourGlobal ] = useGlobal(YourGlobalData);
//   return <div>
//     Your global value is: {yourGlobal}
//     Click the button to update your global value:
//     <button onClick={() => setYourGlobal(your-updated-value-or-update-function)}>Update YourGlobal</button>
//   </div>

export const defineGlobal = (initial = null) => {
    if (typeof initial === "function") initial = initial(null);
    return {
        value: initial,
        __listeners: new Set(),
        __globalDefinition: true
    };
}

const __useGlobal = (global) => {
    const [ , listener ] = useState();
    useEffect(() => {
        global.__listeners.add(listener);
        return () => global.__listeners.delete(listener);
    }, [ global.value, global.__listeners ]);
    return {
        value: global.value,
        update: (value) => {
            global.value = value;
            //
            // Don't actually even need to specify a value here ...
            // global.__listeners.forEach(listener => listener(e => ({...value})));
            //
            global.__listeners.forEach(listener => listener(({})));
         }
    }
};

export const useGlobal = (globalDefinitionOrNot) => {
    if (globalDefinitionOrNot.__globalDefinition === true) {
        const global = __useGlobal(globalDefinitionOrNot);
        return [
            global.value,
            global.update
        ];
    }
    else {
        //
        // Nevermind this part.
        // Cannot call useGlobal at global scope; use defineGlobal.
        //
        return defineGlobal(globalDefinitionOrNot);
    }
};
