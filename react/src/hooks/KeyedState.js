import { useEffect, useState } from 'react';

// Hook to manage a (parent) "keyed" state object used to pass down
// to child components in which this can be used to transparently
// store the local state of the child component within the parent.
// The primary (initial) purpose to be to maintain state of a component
// between instantiations of it, i.e. e.g. between show and hide, e.g.
// like what is done on the AWS Infrastructure page where any number of
// components can dynamically be selected (shown) or unselected (hidden).
//
const useKeyedState = (keyedStateOrInitial, undefinedOrInitial) => {

    const keyedState = (keyedStateOrInitial?.__keyedState === true)
                        ? ((keyedStateOrInitial.__keyedStateUsage === true)
                            ? keyedStateOrInitial
                            : keyedStateOrInitial.keyed("default"))
                        : null;

    const initial = keyedState
                    ? (keyedState.__state()
                       ? keyedState.__state()
                       : __keyedStateUsageValue(undefinedOrInitial))
                    : __keyedStateValue(keyedStateOrInitial);

    const [ state, setState ] = useState(initial);

    useEffect(() => {
        if (initial && keyedState && !keyedState.__state()) {
            keyedState.__updateState(__updateState(initial, state, true));
        }
    }, []);

    if (keyedState) {
        //
        // Using an existing (parent) keyed state.
        //
        return [
            state,
            (value) => {
                value = __updateState(value, state, true);
                setState(value);
                keyedState.__updateState(value);
            }
        ];
    }
    else {
        //
        // Defining a (parent) keyed state.
        //
        return { __keyedState: true,
            key: null,
            keyed: function(key) {
                if (this.__keyedState !== true) return undefined;
                if ((key?.constructor !== String) || (key.length === 0)) key = "default";
                const outer = this;
                return { __keyedState: true, __keyedStateUsage: true,
                    key: key,
                    keyed: function(key) {
                        if ((this.__keyedState !== true) || (this.__keyedStateUsage !== true)) return undefined;
                        if ((key?.constructor !== String) || (key.length === 0)) key = "default";
                        return outer.keyed(this.key ? `${this.key}.${key}` : key, true);
                    },
                    __updateState: function(value) {
                        if (value?.constructor === Object) {
                            setState(state => ({ ...state, [key]: { ...state[key], ...value } }));
                        }
                        else {
                            setState(state => ({ ...state, [key]: value }));
                        }
                    },
                    __state: function() {
                        return state[key];
                    }
                }
            }
        };
    }
}

const __keyedStateValue = (value) => {
    if (typeof(value) == "function") value = value();
    return (value?.constructor === Object) ? value : {};
}

const __keyedStateUsageValue = (value, state) => {
    if (typeof(value) == "function") value = value();
    return (value !== undefined) ? value : {};
}

function __updateState(newState, currentState = undefined, updateObject = true) {
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
            newState = { ...newState };
        }
        else if (Array.isArray(newState)) {
            //
            // Special case of array update. Include any properties which might exist for the array.
            // as, by default, using the spread operator (...) on an array will not include these.
            //
            function __copyArrayWithAnyProperties(value) {
                const newValue = [ ...value ];
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
            newState = __copyArrayWithAnyProperties(newState);
        }
        else if (typeof(newState) === "function") {
            newState = newState(currentState);
        }
    }
    else if ((newState?.constructor === Object) && (currentState?.constructor === Object) && updateObject) {
        //
        // Special case of object update. If desired, i.e. if the updateObject argument is true, which
        // is the default, then AMEND the existing/current object, updating/overriding from the new object.
        //
        newState = { ...currentState, ...newState };
    }
    return newState;
}

export default useKeyedState;
