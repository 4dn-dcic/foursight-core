import { useState } from 'react';

// Component/hook to dynamically maintain a list of "selected" components, i.e. components
// which are currently being shown (versus hidden). Instantiated with an instance of the
// above useComponentDefinitions hook which defines the list of possible components to
// create on the fly when selected (added).
//
const useSelectedComponents = (componentDefinitions) => {
    componentDefinitions = __useComponentDefinitions(componentDefinitions);
    const [ components, setComponents ] = useState([]);
    // TODO: Figure out precisely why we need to wrap in useState (but we do or else e.g. X-ing out from
    // a stack box gets confused - removes all (previously selected) stack boxes - something to do with
    // the useSelectedComponents state getting captured on each select). 
    return useState({
        count: () => components.length,
        empty: () => components.length === 0,
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

// Component/hook to dynamically define/create components by type name and an optional
// identifying name. This is in service of the useSelectedComponents component/hook
// below to add/remove arbitrary components to a list of "selected" components,
// i.e components which may dynamically be shown or hidden in in specified order.
// Instantiated with an array of objects each containing a type name, an optional
// identifying name, and a required create function which is used to create the component.
// The given create function is called the type name, identifying name, an arbitrary
// opaque argument, and an unselect function (to unselect/hide/remove) the component.
//
const __useComponentDefinitions = (componentTypes) => {
    return {
        __get: (type, name, unselect, createArgs) => {
            const index = componentTypes.findIndex(componentType => componentType.type === type);
            if (index >= 0) {
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

export default useSelectedComponents;
