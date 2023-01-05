import { useState, useEffect } from 'react';
import useKeyedStateNew from './pages/checks/k';

// Component/hook to dynamically define/create components by type name and an optional
// identifying name. This is in service of the useSelectedComponents component/hook
// below to add/remove arbitrary components to a list of "selected" components,
// i.e components which may dynamically be shown or hidden in in specified order.
// Instantiated with an array of objects each containing a type name, an optional
// identifying name, and a required create function which is used to create the component.
// The given create function is called the type name, identifying name, an arbitrary
// opaque argument, and an unselect function (to unselect/hide/remove) the component.
//
export const useComponentDefinitions = (componentTypes) => {
    return {
        __get: (type, name, unselect, createArgs) => {
            const index = componentTypes.findIndex(componentType => componentType.type === type);
            if (index >= 0) {
                //const key = name ? `${type}::${name}` : type;
                const key = name ? `${type}.${name}` : type;
                return {
                    type: type,
                    name: name,
                    key: key,
                    ui: (args) => componentTypes[index].create(name, key, unselect, { ...createArgs, ...args })
                };
            }
            return null;
        }
    };
}

// Component/hook to dynamically maintain a list of "selected" components, i.e. components
// which are currently being shown (versus hidden). Instantiated with an instance of the
// above useComponentDefinitions hook which defines the list of possible components to
// create on the fly when selected (added).
//
export const useSelectedComponents = (componentDefinitions) => {
    const [ components, setComponents ] = useState([]);
    // TODO: Figure out precisely why we need to wrap in useState (but we do or else e.g. X-ing out from
    // a stack box gets confused - removes all (previously selected) stack boxes - something to do with
    // the useSelectedComponents state getting captured on each select). 
    return useState({
        count: () => components.length,
        empty: () => components.length == 0,
        map: (f, i) => components.map(f, i),
        selected: function(type, name = null) { return this.__lookup(type, name) >= 0; },
        select:   function(type, name = null) { this.__select(type, name); },
        unselect: function(type, name = null) { this.__unselect(type, name); },
        toggle:   function(type, name = null, args = {}) {
            const index = this.__lookup(type, name);
            if (index >= 0) {
                this.__unselect(type, name, index);
            }
            else {
                this.__select(type, name, index, args);
            }
        },
        __lookup: (type, name) => components.findIndex(item => item.type === type && item.name === name),
        __select: function (type, name, index, args) {
            if (index == null) index = this.__lookup(type, name);
            if (index < 0) {
                const component = componentDefinitions.__get(type, name, () => this.unselect(type, name), args);
                if (component) {
                    components.unshift(component);
                    setComponents([...components]);
                }
            }
        },
        __unselect: function(type, name = null, index = null) {
            if (index == null) index = this.__lookup(type, name);
            if (index >= 0) {
                components.splice(index, 1);
                setComponents([...components]);
            }
        }
   })[0];
}

// Ensure the keyed state value is an object or a function producing an object.
//
function __keyedStateValue(value, args = undefined) {
    if (typeof(value) == "function") value = value(args);
    if (value === undefined || value === null && value.constructor !== Object) return {};
    return value;
}

// Component/hook to provide a generic "keyed" state which can be useful for passing down
// to children components (recursively) from a parent component so that the state of
// the children component can be stored in the parent, // so that it it is maintained,
// for example, between instantiations, i.e. e.g. between hide/show of the (child) component.
//
export const useKeyedState = (initial) => {
    const [ state, setState ] = useState(__keyedStateValue(initial));
    return {
        __keyedState: true,
        __get: () => state,
        // __update: (value) => setState(state => ({...state, ...__keyedStateValue(value, state)})),
        __getKey: (key) => {
            key = key ? `__${key}__` : key = "__key__";
            return (key ? state[key] : state) || {};
        },
        __updateKey: (key, value) => {
            key = key ? `__${key}__` : key = "__key__";
            setState(state => ({ ...state, [key]: { ...state[key], ...__keyedStateValue(value, state[key]) } }));
        },
        keyed: function(key) {
            const outer = this;
            return {
                __keyedState: true,
                key: key,
                __get: () => outer.__getKey(key),
                __update: (value) => outer.__updateKey(key, value),
                keyed: function(key, exact = false) {
                    if (!exact && this.key) key = this.key + "::" + key;
                    return outer.keyed(key, true);
                }
            }
        }
    };
}

// Convenience component/hook to wrap the above useKeyedState hook in a child component
// to use either a passed in keyed state or its own local state.
//
export const useOptionalKeyedState = (keyedState, initial) => {
    if (keyedState?.__keyedState !== true) keyedState = null;
    // This may be better setting here than the below within useEffect?
    // const [ state, setState ] = useState((Object.keys(keyedState?.__get()).length === 0) ? __keyedStateValue(initial) : (keyedState.__get() || {}));
    const [ state, setState ] = useState(keyedState?.__get() || {});
    useEffect(() => {
        if (keyedState) {
            if (Object.keys(keyedState.__get()).length == 0) {
                initial = __keyedStateValue(initial);
                keyedState.__update({...initial, ...state});
                setState({...initial, ...state});
            }
        }
        else {
            initial = __keyedStateValue(initial);
            setState({...initial, ...state});
        }
    }, []);
    return [
        state,
        (value) => {
            value = __keyedStateValue(value, state);
            keyedState?.__update({ ...state, ...value });
            setState({ ...state, ...value });
        }
    ];
}
