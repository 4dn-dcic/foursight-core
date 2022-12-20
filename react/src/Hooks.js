import { useState } from 'react';

// Component/hook to provide a generic "keyed" state which can be useful for
// passing down to children components (recursively) from a parent component
// so that the state of the children component can be stored in the parent,
// so that it it is maintained, for example, between instantiations, i.e.
// e.g. between hide/show of the (child) component.
//
export const useKeyedState = (initial) => {
    const [ keyedState, setKeyedState ] = useState(initial || {});
    const response = {
        get: (key) => {
            return (key ? keyedState[key] : keyedState) || {};
        },
        set: (key, state) => {
            if (key) setKeyedState(keyedState => ({ ...keyedState, [key]: state }));
        },
    };
    // Don't *think* I need to bind this function to the response (doesn't seem to need it anyways).
    response.keyed = function (key) {
        const outer = this;
        return {
            key: key,
            get: () => this.get(key),
            set: (state) => this.set(key, state),
            keyed: function (key, exact = false) { return outer.keyed(exact || !this.key ? key : this.key + key, true); }
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
        (newState) => {
            setState(state => newState);
            keyedState?.set(newState);
        }
    ];
}

// Component/hook to dynamically define/create components by type.
// In service of useSelectedComponent component/hook below to add
// remove arbitrary components to a list of "selected" (shown) components.
//
export const useComponentDefinitions = (componentTypes) => {
    return {
        count: () => componentTypes.length,
        instantiate: (type, name, arg) => {
            const componentTypeIndex = componentTypes.findIndex(componentType => componentType.type === type);
            if (componentTypeIndex >= 0) {
                const key = name ? `${type}::${name}` : type;
                return {
                    type: type,
                    name: name,
                    key: key,
                    ui: componentTypes[componentTypeIndex].create(name, key, arg)
                };
            }
        },
        label: (type, name) => {
            const componentTypeIndex = componentTypes.findIndex(componentType => componentType.type === type);
            return (componentTypeIndex >= 0) ? componentTypes[componentTypeIndex]?.label : null;
        },
    };
}

export const useSelectedComponents = (componentDefinitions) => {
    const [ selectedComponents, setSelectedComponents ] = useState([]);
    // TODO: Figure out precisely why we need to wrap in useState (but we do or else e.g. X-ing out from
    // a stack box gets confused - removes all (previously selected) stack boxes - something to do with
    // the useSelectedComponents state getting captured on each select). 
    return useState({
        count: () => {
            return selectedComponents.length;
        },
        empty: () => {
            return selectedComponents.length == 0;
        },
        selected: (type, name = null) => {
            return selectedComponents.findIndex(
                selectedComponent => selectedComponent.type === type && selectedComponent.name === name
            ) >= 0;
        },
        map: (f) => {
            return selectedComponents.map(f);
        },
        key: (type, name = null) => {
            return name ? `${type}::${name}` : type;
        },
        toggle: (type, name = null, arg = null) => {
            const selectedComponentIndex = selectedComponents.findIndex(
                selectedComponent => selectedComponent.type === type && selectedComponent.name === name
            );
            if (selectedComponentIndex >= 0) {
                selectedComponents.splice(selectedComponentIndex, 1);
                setSelectedComponents([...selectedComponents]);
            }
            else {
                const component = componentDefinitions.instantiate(type, name, arg);
                if (component) {
                    selectedComponents.unshift(component);
                    setSelectedComponents([...selectedComponents]);
                }
            }
        },
        remove: (type, name = null) => {
            const selectedComponentIndex = selectedComponents.findIndex(
                selectedComponent => selectedComponent.type === type && selectedComponent.name === name
            );
            if (selectedComponentIndex >= 0) {
                selectedComponents.splice(selectedComponentIndex, 1);
                setSelectedComponents([...selectedComponents]);
            }
        },
        label: (type, name) => {
            return componentDefinitions.label(type, name);
        }
    })[0];
}
