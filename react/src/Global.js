import { useEffect, useState } from 'react';

// This defines a global state mechanism WITHOUT the need for createContext and useContext,
// and which therefore does NOT require wrapping (e.g. the entire App) in a context Provider.
// Came up with half of this idea originally for the ReadOnlyMode component; then that idea,
// of using (registered) callbacks (aka listeners) to update global state, was generalized
// after looking at this article which validated and expanded on this idea (from Diashi Kato):
// See: https://blog.openreplay.com/steps-to-develop-global-state-for-react-with-hooks-without-context
// Also see: https://stackoverflow.com/questions/63209420/react-global-state-no-context-or-redux
//
// Usage example:
//
// - YourGlobal.js:
//   import Global from './Global'; 
//   const YourGlobal = Global.Define(your-initial-value-or-function);
//   export default YourGlobal;
//
// - YourGlobalUsage.js:
//   import Global from './Global'; 
//   import YourGlobal from './YourGlobal'; 
//   ...
//   const yourGlobal = Global.Use(YourGlobal);
//   ...
//   return <div>
//     Your global value is: {yourGlobal.value}
//     Click button update your global value:
//     <b onClick={() => yourGlobal.update(your-updated-value-or-function)}>Button</b>
//   </div>
//
// Alternatively you can employ a more React-ish usage:
//
// - YourGlobal.js:
//   import { defineGlobal } from './Global'; 
//   const YourGlobal = defineGlobal(your-initial-value-or-function);
//   export default YourGlobal;
//
// - YourGlobalUsage.js:
//   import { useGlobal } from './Global'; 
//   import YourGlobal from './YourGlobal'; 
//   ...
//   const [ yourGlobal, setYourGlobal ] = useGlobal(YourGlobal);
//   ...
//   return <div>
//     Your global value is: {yourGlobal}
//     Click the button to update your global value:
//     <button onClick={() => setYourGlobal(your-updated-value-or-function)}>Update YourGlobal</button>
//   </div>

const _DefineGlobal = (initial = null) => {
    if (typeof initial === "function") initial = initial(null);
    return { __value: initial, __listeners: new Set() };
}

const _UseGlobal = (global) => {
    const [ , listener ] = useState();
    useEffect(() => {
        global.__listeners.add(listener);
        return () => global.__listeners.delete(listener);
    }, [ global.__value, global.__listeners ]);
    return {
        value: global.__value,
        update: (value) => {
            global.__value = value;
            global.__listeners.forEach(listener => listener(e => ({...value})));
         }
    }
};

const exports = {
    Define: _DefineGlobal,
    Use: _UseGlobal
}; export default exports;

// For a more React-ish usage.
//
export const defineGlobal = _DefineGlobal;
export const useGlobal = (global) => { const g = _UseGlobal(global); return [ g.value, g.update ] };
