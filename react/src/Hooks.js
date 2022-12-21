import { useState } from 'react';

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
        create: (type, name, arg, unselect) => {
            const index = componentTypes.findIndex(componentType => componentType.type === type);
            if (index >= 0) {
                const key = name ? `${type}::${name}` : type;
                return {
                    type: type,
                    name: name,
                    key: key,
                    ui: componentTypes[index].create(name, key, arg, unselect)
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
        toggle:   function(type, name = null, arg = null) {
            const index = this.__lookup(type, name);
            if (index >= 0) {
                this.__unselect(type, name, index);
            }
            else {
                this.__select(type, name, arg, index);
            }
        },
        __lookup: (type, name = null) => components.findIndex(item => item.type === type && item.name === name),
        __select: function (type, name = null, arg = null, index = null) {
            if (index == null) index = this.__lookup(type, name);
            if (index < 0) {
                const component = componentDefinitions.create(type, name, arg, () => this.unselect(type, name));
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

// Component/hook to provide a generic "keyed" state which can be useful for passing down
// to children components (recursively) from a parent component so that the state of
// the children component can be stored in the parent, // so that it it is maintained,
// for example, between instantiations, i.e. e.g. between hide/show of the (child) component.
//
export const useKeyedState = (initial) => {
    const [ state, setState ] = useState(initial || {});
    const response = {
        get: (key) => (key ? state[key] : state) || {},
        set: (key, value) => key && setState(state => ({ ...state, [key]: { ...state[key], ...value } })),
    };
    response.keyed = function(key) {
        const outer = this;
        return {
            key: key,
            get: () => this.get(key),
            set: (value) => this.set(key, value),
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
            keyedState?.set({ ...state, ...value });
            setState({ ...state, ...value });
        }
    ];
}
