import { useEffect, useState } from 'react';

// This defines a global state mechanism WITHOUT the need for createContext and useContext,
// and which therefore does NOT require wrapping (e.g. the entire App) in a context Provider.
// Came up with half of this idea originally for the ReadOnlyMode component; then that idea,
// of using (registered) callbacks (aka listeners) to update global state, was generalized
// after looking at this article which validated and expanded on this idea (from Diashi Kato):
//
// - https://blog.openreplay.com/steps-to-develop-global-state-for-react-with-hooks-without-context/
//
// Usage example:
//
// - YourGlobal.js:
//   import GlobalState from './GlobalState'; 
//   const YourGlobal = GlobalState.Define(your-initial-value);
//   export default YourGlobal;
//
// - YourGlobalUsage.js:
//   import GlobalState from './GlobalState'; 
//   import YourGlobal from './YourGlobal'; 
//   ...
//   const yourGlobal = GlobalState.Use(YourGlobal);
//   ...
//   return <div onClick={() => yourGlobal.update(your-updated-value)}>{yourGlobal.value}</div>
//
const DefineGlobalState = (initial = null) => {
    return { __value: initial, __listeners: new Set() };
}

const UseGlobalState = (global) => {
    const [ state, setState ] = useState(global.__value);
    useEffect(() => {
        const listener = (value) => setState(value);
        global.__listeners.add(listener);
        listener(global.__value);
        return () => global.__listeners.delete(listener);
    }, [global.__value, global.__listeners]);
    //
    // After a hard time getting this to even work at all, I now don't fully understand how this
    // even works at all. Thought we needed to return a reference the useState variable (state)
    // defined above, but just using the underlying global variable, i.e.  global.__value, works;
    // this global state is updated just by virtue of setState being called (above), on what is
    // now effectively just a dummy value; it (the above setState) could even just be called with
    // and empty object and it works (though with no argument or null does not work); this worries
    // me; is this somehow working by accident; is this causing too much re-rendering.
    //
    return {
        value: state, // global.__value works also for some not-understood reason (see above)
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
