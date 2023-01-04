import { useState } from 'react';

const __keyedStateValue = (value, args = undefined) => {
    if (typeof(value) == "function") value = value(args);
    return (value?.constructor === Object) ? value : {};
}

const __keyedStateInitialValue = (value) => {
    if (typeof(value) == "function") value = value();
    return (value?.constructor === Object) ? value : {};
}

const __keyedStateUsageInitialValue = (value) => {
    return (typeof(value) == "function") ? value() : value;
}

const __keyedStateUsageUpdateValue = (value, state) => {
    return (typeof(value) == "function") ? value(state) : value;
}

function __updateState(setState, newState, currentState = undefined, updateObject = true) {
    function __copyArrayWithAnyProperties(value) {
        const newValue = [...value];
        const keys = Object.keys(value);
        const nelements = value.length;
        const nproperties = keys.length - nelements;
        if (nproperties > 0) {
            for (let i = 0 ; i < nproperties ; i++) {
                const key = keys[nelements - i];
                newValue[key] = value[key];
            }
        }
        return newValue;
    }
    if (Object.is(newState, currentState)) {
        //
        // If the new state is DIFFERENT, by reference (i.e. Object.is),
        // than the current state, then we can do a simple setState since
        // React WILL in this case update the state as we would normally expect.
        //
        // Otherwise (THIS case) since the object references are the SAME, React
        // will NOT properly update the state; this is often (usually) not what
        // we would expect and want. So this __updateState function will force
        // an update by impliclitly creating a new (appropriate) object.
        //
        if (newState?.constructor === Object) {
            newState = {...newState};
        }
        else if (Array.isArray(newState)) {
            //
            // Special case of array to include any (odd) properties which might exist for the array.
            // as by default using the spread operator (...) on an array will not include these.
            //
            newState = __copyArrayWithAnyProperties(newState);
        }
        else if (typeof(newState) === "function") {
            newState = newState(currentState);
        }
    }
    else if ((newState?.constructor === Object) && (currentState?.constructor === Object) && updateObject) {
        //
        // Special case of object update. If desired, i.e. if the updateObject argument is true, which is
        // the default, then AMEND the existing/current object, updating/overriding from the new object.
        //
        newState = { ...currentState, ...newState };
    }
    setState(newState);
    return newState;
}

const useKeyedStateNew = (keyedStateOrInitial, undefinedOrInitial) => {
    // const keyedState = keyedStateOrInitial?.__keyedState === true ? keyedStateOrInitial : null;
    const keyedState = (keyedStateOrInitial?.__keyedState === true)
                        ? ((keyedStateOrInitial.__keyedStateUsage === true)
                            ? keyedStateOrInitial
                            : keyedStateOrInitial.keyed("default"))
                        : null;
    const initial = keyedState ? __keyedStateUsageInitialValue(undefinedOrInitial)
                               : __keyedStateInitialValue(keyedStateOrInitial);
    const [ state, setState ] = useState(initial);
    if (keyedState) {
        //if (keyedState.__keyedStateUsage !== true) {
                //keyedState = keyedState.keyed("key");
        //}
        //
        // Using an existing (parent) keyed state.
        //
        return [
            state,
            (value) => {
                if (keyedState.__keyedStateUsage !== true) {
                    //
                    // Should not really happen but if it is an object what the heck.
                    //
                    value = __updateState(setState, value, state, true);
                    if (value?.constructor === Object) {
                        keyedState.__updateState(value);
                    }
                    return;
                }
                value = __updateState(setState, value, state, true);
                keyedState.__updateState(value);
            }
        ];
    }
    else {
        //
        // Defining a keyed state.
        //
        return { __keyedState: true,
            key: null,
            keyed: function(key) {
                if ((this.__keyedState !== true) || (key?.constructor !== String) || (key.length === 0)) return undefined;
                const outer = this;
                return { __keyedState: true, __keyedStateUsage: true,
                    key: key,
                    keyed: function(key) {
                        if (this.__keyedState !== true) return undefined;
                        return outer.keyed(this.key ? `${this.key}.${key}` : key, true);
                    },
                    __updateState: function(value) {
                        outer.__updateKey(key, value);
                    }
                }
            },
            __updateKey: function(key, value) {
                if ((this.__keyedState !== true) || (key?.constructor !== String) || (key.length === 0)) return undefined;
                value = __keyedStateUsageUpdateValue(value)
             // setState(state => ({ ...state, [key]: { ...state[key], ...__keyedStateValue(value, state[key]) } }));
                setState(state => ({ ...state, [key]: value }));
            },
            __getState: function() {
                return state;
            },
            __updateState: function(value) {
                setState(__keyedStateInitialValue(value));
            }
        };
    }
}

export default useKeyedStateNew;