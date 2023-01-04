import { useState } from 'react';

// Component/hook to provide a generic "keyed" state which can be useful for passing down
// to children components (recursively) from a parent component so that the state of
// the children component can be stored in the parent, // so that it it is maintained,
// for example, between instantiations, i.e. e.g. between hide/show of the (child) component.
//
export const useKeyedState = (initial) => {
    const [ state, setState ] = useState(initial || {});
    const response = {
        get: () => state,
        update: (value) => setState(state => ({...state, ...value})),
        __get: (key) => {
            key = key ? `__${key}__` : key = "__key__";
            return (key ? state[key] : state) || {};
        },
        __update: (key, value) => {
            key = key ? `__${key}__` : key = "__key__";
            setState(state => ({ ...state, [key]: { ...state[key], ...value } }));
        },
    };
    response.keyed = function(key) {
        const outer = this;
        return {
            key: key,
            get: () => outer.__get(key),
            update: (value) => outer.__update(key, value),
            keyed: function(key, exact = false) { return outer.keyed(exact || !this.key ? key : this.key + key, true); }
        }
    };
    return response;
}

// Convenience component/hook to wrap the above useKeyedState hook in a child component
// to use either a passed in keyed state or its own local state.
//
export const useOptionalKeyedState = (keyedState, initial) => {
    const [ state, setState ] = useState(keyedState?.get() || initial || {});
    return [
        state,
        (value) => {
                console.log('goo')
                console.log(value)
            keyedState?.update({ ...state, ...value });
            setState({ ...state, ...value });
        }
    ];
}
