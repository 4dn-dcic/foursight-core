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
//   import GlobalState from './GlobalState'; 
//   const YourGlobal = GlobalState.Define(your-initial-value-or-function);
//   export default YourGlobal;
//
// - YourGlobalUsage.js:
//   import GlobalState from './GlobalState'; 
//   import YourGlobal from './YourGlobal'; 
//   ...
//   const yourGlobal = GlobalState.Use(YourGlobal);
//   ...
//   return <div>
//       Your global value is: {yourGlobal.value}
//       Click button update your global value:
//       <b onClick={() => yourGlobal.update(your-updated-value-or-function)}>Button</b>
//   </div>

const DefineGlobalState = (initial = null) => {
    if (typeof initial === "function") initial = initial(null);
    return { __value: initial, __listeners: new Set() };
}

const UseGlobalState = (global) => {
    const [ , listener ] = useState();
    useEffect(() => {
        global.__listeners.add(listener);
        return () => global.__listeners.delete(listener);
    }, [ global.__value, global.__listeners ]);
    return {
        value: global.__value,
        update: (value) => {
            global.__value = value;
            global.__listeners.forEach(listener => listener(value));
         }
    }
};

const exports = {
    Define: DefineGlobalState,
    Use: UseGlobalState
}; export default exports;
