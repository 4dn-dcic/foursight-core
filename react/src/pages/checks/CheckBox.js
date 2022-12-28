// REWRITE IN PROGRESS | NOT YET IN USE | 2022-12-27

import React from 'react';
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StandardSpinner } from '../../Spinners';
import { useFetch } from '../../utils/Fetch';
import { ExternalLink } from '../../Components';
import Char from '../../utils/Char';
import Clipboard from '../../utils/Clipboard';
import Env from '../../utils/Env';
import Json from '../../utils/Json';
import Str from '../../utils/Str';
import Type from '../../utils/Type';
import Yaml from '../../utils/Yaml';
import Uuid from 'react-uuid';
import { useComponentDefinitions, useSelectedComponents } from '../../Hooks.js';
import { useKeyedState, useOptionalKeyedState } from '../../Hooks.js';

const background = "lightyellow";

const TestCheckBox = (props) => {

    let { environ } = useParams();
    const checkBoxState = useKeyedState();
    const [ show, setShow ] = useState(false);
    //const checkName =  "elastic_search_space";
    const checkName =  "biorxiv_is_now_published"; // "elastic_search_space";
    return <>
        { show ? <>
            <span className="pointer" onClick={() => setShow(value => !value)}>Hide CheckBox</span>
            <CheckBox checkName={checkName} env={environ} parentState={checkBoxState.keyed(checkName)} />
        </>:<>
            <span className="pointer" onClick={() => setShow(value => !value)}>Show CheckBox</span>
        </>}
        <pre>{Json.Format(checkBoxState.__get())}</pre>
    </>
}

const CheckBox = (props) => {

    let { checkName, env, parentState } = props;

    const check = useFetch(`/checks/${checkName}`, { cache: true, delay: 0 });

    const [ state, setState ] = useOptionalKeyedState(parentState);
    const isShowRunBox = () => state.showRunBox;
    const toggleShowRunBox = () => setState({ showRunBox: !isShowRunBox() });

    if (check.loading || !check.data) return <div><StandardSpinner label="Loading check run info ..." /></div>
    return <div className="box" style={{width:props.width || "500pt"}}>
        <div style={{marginBottom:"4pt"}}>
            Check: {check.data.name}
            <span className="pointer" style={{float:"right"}} onClick={toggleShowRunBox}>
                { isShowRunBox() ? <>
                    Configure {Char.DownArrowHollow}
                </>:<>
                    Run ...
                </>}
            </span>
        </div>
        { isShowRunBox() && <>
            <CheckRunBox check={check.data} env={env} parentState={parentState.keyed("run-box")} />
        </>}
    </div>
}

const CheckRunBox = (props) => {

    let { check, env, parentState } = props;

    function onCheckRun(value) {
    }

    function onActionRun(value) {
    }

    // Parses out the the arguments for the check run from the info (ultimately) from the
    // check_setup.json file and the check_function decorator. Returned object has a property
    // named for each argument and its value an object with three propertie: "type" for its
    // type, i.e. "boolean", "list", or "string"; "initial", its initial value; "list" for
    // list type only containing the list of possible values; and "value" its current value,
    // equal to "initial" but updated as the user updates with via UI.
    //
    function getArgs(check, env) {

        // Extract the basic arguments (ultimately) from check_setup.json for the given check.
        //
        function extractArgs(check, env) {
            if (check.schedule) {
                for (let schedule_key of Object.keys(check.schedule)) {
                    for (let schedule_env_key of Object.keys(check.schedule[schedule_key])) {
                        if (schedule_env_key.toLowerCase() === "all" || Env.Equals(schedule_env_key, env)) {
                            const args = {};
                            const kwargs = check.schedule[schedule_key][schedule_env_key]["kwargs"];
                            for (const kwargName in kwargs) {
                                defineArg(args, kwargName, kwargs[kwargName]);
                            }
                            return args;
                        }
                    }
                }
            }
            return {};
        }

        // Amend the given extracted arguments with info (ultimately) from the check_function decorator
        // for the tiven check. Adds any arguments not already present (ultimately) from check_setup.json
        // via extractArgs above, and adds any initial values for those already present.
        //
        function amendArgs(args, check) {
            if (check.registered_kwargs) {
                //
                // Factor in kwargs defined in the (check_function) decorator.
                // Order here matters; have the kwargs (from check_setup.json) override the
                // registered kwargs (from the check_function decorator); actually comes up for example for the wrangler_checks.core_project_status.
                //
                for (const kwargName in check.registered_kwargs) {
                    if (args[kwargName]) {
                        if (args[kwargName]?.type == "list") {
                            //
                            // Extract the initial value for a list type.
                            //
                            const kwargValue = check.registered_kwargs[kwargName];
                            if (Type.IsArray(kwargValue)) {
                                if (kwargValue.length > 0) {
                                    //
                                    // If multiple values for some reason in the check_function decorator,
                                    // just pick the first one. I.e. we only support single selection lists.
                                    //
                                    args[kwargName].value = kwargValue[0];
                                }
                            }
                            else if (Str.HasValue(kwargValue)) {
                                //
                                // To be generous allow either a list type (above) or
                                // a string type for the initial value for a list type.
                                //
                                args[kwargName].value = kwargValue;
                            }
                        }
                    }
                    else {
                        //
                        // Argument not present (ultimately) in check_setup.json be
                        // present in the check_function decorator.
                        //
                        defineArg(args, kwargName, check.registered_kwargs[kwargName]);
                    }
                }
            }
        }

        function defineArg(args, name, value) {
            if (Type.IsBoolean(value)) {
                args[name] = { type: "boolean", value: value };
            }
            else if (Type.IsNonEmptyArray(value)) {
                args[name] = { type: "list", list: value, value: null };
            }
            else {
                args[name] = { type: "string", value: value };
            }
        }

        const args = extractArgs(check, env);
        amendArgs(args, check);
        return args;
    }

    // Note we use the useOptionaKeyState hook passing in the passed in parentState
    // which is from useKeyedState (TODO: need better names for these), so that
    // our state gets stored in the parent, so that it can maintained between
    // instantiations of this component, which can happen via component hide/show.
    //
    const [ args, setArgs ] = useOptionalKeyedState(parentState, () => getArgs(check, env));

    return <div style={{width:"100%"}}>
        <div className="box thickborder" style={{background:background}}>
            <table style={{width:"100%"}}><tbody><tr>
                <td style={{paddingRight:"8pt"}}>
                    <CheckRunArgs check={check} env={env} args={args} setArgs={setArgs} />
                </td>
                <td style={{verticalAlign:"top",textAlign:"right"}}>
                    <CheckRunButton />
                </td>
            </tr></tbody></table>
        </div>
    </div>
}

const CheckRunArgs = (props) => {

    const { check, env, args, setArgs } = props;

    const tdstyle = { paddingTop:"2pt", paddingBottom:"2pt", paddingRight:"8pt" };

    return <>
        <table><tbody>
            { Object.keys(args).map((argName, argIndex) => {
                function setArg(value) {
                    setArgs({ ...args, [argName]: { ...args[argName], value: value } });
                }
                return <tr key={argName} style={{}}>
                    <td style={tdstyle}>
                        <b>{argName}</b>:
                    </td>
                    <td style={tdstyle}>
                        <CheckRunArg arg={args[argName]} setArg={setArg} />
                    </td>
                </tr>
                }
            )}
        </tbody></table>
    </>
}

const CheckRunArg = (props) => {
    const { arg, setArg } = props;
    if (arg.type === "boolean") {
        return <CheckRunArgBoolean arg={arg} setArg={setArg} />
    }
    else if (arg.type === "list") {
        return <CheckRunArgList arg={arg} setArg={setArg} />
    }
    else {
        return <CheckRunArgString arg={arg} setArg={setArg} />
    }
}

const CheckRunArgBoolean = (props) => {
    const { arg, setArg } = props;
    return <>
        <select defaultValue={arg.value} style={{background:background,border:"1px solid lightgray",borderRadius:"4pt"}}
            onChange={(e) => {
               const value = e.target.value === "true" ? true : false;
               setArg(value);
            }}>
            <option>false</option>
            <option>true</option>
        </select> 
    </>
}

const CheckRunArgList = (props) => {
    const { arg, setArg } = props;
    const EMPTY = "-";
    return <>
        <select key={Uuid()} defaultValue={arg.value} style={{background:"lightyellow",border:"1px solid lightgray"}}
            onChange={(e) => {
                const value = e.target.value;
                setArg(value === EMPTY ? null : value);
            }}>
            { (!arg.initial || !arg.value || arg.value == EMPTY) && 
                <option key={0}>{EMPTY}</option>
            }
            { arg.list.map(item =>
                <option key={Uuid()}>{item}</option>
            )}
        </select>
    </>
}

const CheckRunArgString = (props) => {
    const { arg, setArg } = props;
    return <>
        <input
            defaultValue={arg.value}
            onChange={(e) => {
                const value = e.target.value;
                setArg(value);
            }}
            placeholder="Empty"
            style={{marginLeft:"0pt",height:"14pt",background:"lightyellow",border:"1px solid lightgray",borderRadius:"2pt"}}
        />
    </>
}

const CheckRunButton = (props) => {
    return <>
        <button>RUN-BUTTON</button>
    </>
}

export default TestCheckBox;
