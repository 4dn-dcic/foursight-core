import React, { useEffect, useState } from 'react';
import { StandardSpinner } from '../Spinners';
import useFetch from '../hooks/Fetch';
import Char from '../utils/Char';
import Image from '../utils/Image';
import Str from '../utils/Str';
import Type from '../utils/Type';
import Tooltip from '../components/Tooltip';
import Uuid from 'react-uuid';

const EMPTY_SELECT_KEY = "-";
const EMPTY_SELECT_VALUE = "-";

// Generic box to edit (create, update, delete) a list of plain input fields representing some data record.
// If the onCreate argument is specified then assume this is a create.

const DynamicSelect = (props) => {

    const values = useFetch(props.url, { nofetch: true, cache: true });
    const [ selected, setSelected ] = useState(props.selected);

    useEffect(() => {
        props.setLoadingCount(value => value + 1);
        values.fetch({ onDone: () => props.setLoadingCount(value => value - 1) });
        setSelected(props.selected);
    }, [props.selected, props.reset]);

    function onChange(e) {
        setSelected(e.target.value)
        if (props.onChange) {
            props.onChange(e);
        }
    }

    return <>
        <select id={props.id} className="select" value={selected || ""} onChange={onChange} disabled={props.disabled || values.loading}>
            { (!props.required || true) && <option key={EMPTY_SELECT_KEY} value={EMPTY_SELECT_VALUE}>-</option> }
            { values.map(value => {
                if (value.id) {
                    const MAX_TITLE_LENGTH = 30;
                    let title = value.title;
                    if (title.length > MAX_TITLE_LENGTH) title = title.substring(0, MAX_TITLE_LENGTH) + " ...";
                    return <option key={value.id} value={value.id}>{title || value.key}</option>
                }
                else {
                    return null;
                }
            })}
        </select>
        { props.subComponent && <>
            {props.subComponent(selected)}
        </> }
    </>
}

const InputLine = (props) => {
    const input = props.input;
    const valueOf = props.valueOf;
    const handleChange = props.handleChange;
    const isDisabled = props.isDisabled;
    let [ readonly, setReadonly ] = useState(input.readonly);
    return <>
        <input
            className="input icon-rtl"
            placeholder={input.placeholder || input.label}
            id={input.key}
            defaultValue={valueOf(input)}
            onChange={handleChange}
            readOnly={readonly}
            disabled={isDisabled()}
            autoFocus={input.focus ? true : false} />
        {  (input.readonlyOverridableOnCreate && props.isCreate) && <>
            <small id={`tooltip-${input.key}`} className="pointer">&nbsp;&nbsp;
                { readonly ? <>
                    <span onClick={() => setReadonly(false)}><img src={Image.EditIcon()} style={{height:"22px",marginBottom:"6px"}} /></span>
                </>:<>
                    <span onClick={() => { setReadonly(true); }}><img src={Image.EditIcon()} style={{height:"22px",marginBottom:"6px",marginRight:"-8px"}} /></span>
                &nbsp;&nbsp;</> }
            </small>
            <Tooltip id={`tooltip-${input.key}`} position="top" text={`Click to ${readonly ? "allow" : "disallow"} setting of this field.`} />
        { (input.readonlyOverridableOnCreate && !readonly && input.readonlyOverridableOnCreateMessage) && <>
            <br />
            <small><b style={{color:"red"}}>
                {input.readonlyOverridableOnCreateMessage}
            </b></small>
        </> }
        </> }
    </>
}

const EditBox = ({ inputs, setInputs, title, loading, onCreate, onUpdate, onDelete, onCancel, onRefresh, readonly = false }) => {

    const [ updating, setUpdating ] = useState(false);
    const [ changing, setChanging ] = useState(false);
    const [ deleting, setDeleting ] = useState(false);
    const [ inputsRequiredStatus, setInputsRequiredStatus ] = useState({});
    const [ loadingCount, setLoadingCount ] = useState(0);
    const [ reset, setReset ] = useState(); // To trigger a reset (call of useEffect) in DynamicSelect.

    useEffect(() => {
        resetInputValuesToOriginal();
    }, [inputs]);

    function handleSubmit(e) {
        if (onCreate) {
            handleCreate(e);
        }
        else {
            handleUpdate(e);
        }
    }

    function handleUpdate(e) {
        if (onUpdate) {
            e.preventDefault();
            setUpdating(true);
            onUpdate(gatherCurrentInputValues());
        }
    }

    function handleCreate(e) {
        if (onCreate) {
            e.preventDefault();
            onCreate(gatherCurrentInputValues());
        }
    }

    function handleDelete(e) {
        e.preventDefault();
        setDeleting(true);
    }

    function handleDeleteCancel(e) {
        setDeleting(false);
    }

    function handleDeleteConfirm(e) {
        if (onDelete) {
            onDelete();
        }
    }

    function handleCancel(e) {
        if (onCancel) {
            e.preventDefault();
            onCancel();
        }
    }

    function setFocus() {
        for (const input of inputs) {
            const element = document.getElementById(input.key);
            if (input.focus) {
                element.focus();
            }
        }
    }

    function handleRefresh() {
        setReset(Uuid())
        if (onCreate) {
            resetInputValuesToOriginal();
            setFocus();
        }
        else {
            setUpdating(false);
            setChanging(false);
            if (!loading && onRefresh) {
                onRefresh();
            }
            setFocus();
        }
    }

    function handleChange(e) {
        const input = getInputByName(e.target.id);
        if (input.required) {
            const currentValue = e.target.value?.toString();
            if (input.type == "select") {
                inputsRequiredStatus[input.key] =
                    (currentValue?.length > 0) && (currentValue !== EMPTY_SELECT_VALUE);
            }
            else {
                inputsRequiredStatus[input.key] = (currentValue?.length > 0);
            }
            setInputsRequiredStatus(current => ({...inputsRequiredStatus}));
        }
        if (input.type === "email") {
            const currentValue = e.target.value?.toString();
            inputsRequiredStatus[input.key] = isValidEmail(currentValue);
            setInputsRequiredStatus(current => ({...inputsRequiredStatus}));
        }
        else if (input.type === "uuid") {
            const currentValue = e.target.value?.toString();
            inputsRequiredStatus[input.key] = isValidUuid(currentValue);
            setInputsRequiredStatus(current => ({...inputsRequiredStatus}));
        }
        //
        // If this input which just changed has dependencies (i.e. inputs which
        // have a dependsOn property with a value which is the name of this input),
        // AND the dependent property has a value which is a function, then call
        // that dependent input value function with an argument which is the new
        // value of this input, and set the value of the dependent input to that
        // resultant value. TODO: And to get this to actually "take" we have a hack
        // for now is to set this in a timer callback; how to do this correctly.
        // TODO
        //
        const dependentInputs = getInputDependencies(input); 
        for (const dependentInput of dependentInputs) {
            if (typeof(dependentInput.value) === "function") {
                const dependentElement = document.getElementById(dependentInput.key);
                if (dependentElement) {
                    const dependentValue = dependentInput.value(e.target.value?.toString());
                    if (dependentValue !== undefined) {
                        dependentElement.value = dependentValue;
                        window.setTimeout(() => { dependentElement.value = dependentValue; }, 10);
                    }
                }
            }
        }
        setChanging(changesExist());
    }

    function getInputDependencies(input) {
        const results = [];
        if (input) {
            const inputName = input.key;
            for (const input of inputs) {
                if (input.dependsOn === inputName) {
                    results.push(input);
                }
            }
        }
        return results;
    }

    function getInputByName(key) {
        for (const input of inputs) {
            if (input.key === key) {
                return input;
            }
        }
        return false;
    }

    function changesExist() {
        for (const input of inputs) {
            if (input.readonly) {
                continue;
            }
            const originalValue = valueOf(input);
            const element = document.getElementById(input.key);
            const currentValue = element.value?.toString();
            if (originalValue?.toString() !== currentValue?.toString()) {
                return true;
            }
        }
        return false;
    }

    function resetInputValuesToOriginal() {
        for (const input of inputs) {
            const element = document.getElementById(input.key);
            if (element) {
                element.value = valueOf(input);
            }
        }
        setCurrentInputsRequiredStatus();
    }

    function gatherCurrentInputValues() {
        const values = {}
        for (const input of inputs) {
            let value = document.getElementById(input.key).value;
            if (!input.readonly || (input.readonlyOverridableOnCreate && Str.HasValue(value))) {
                if (input.type === "boolean") {
                    value = (value.toString().toLowerCase() === "true") ? true : false;
                }
                values[input.key] = value;
            }
        }
        return values;
    }

    function valueOf(input) {
        if (!input) return undefined;
        if (input.type === "boolean") {
            return input.value ? true : false;
        }
        else if ((input.value === null) || (input.value === undefined)) {
            return "";
        }
        else if (typeof(input.value) === "function") {
            //return input.value(input.dependsOn ? valueOf(input.dependsOn) : undefined);
            return input.dependsOn ? input.value(valueOf(input.dependsOn)) : input.value();
        }
        else {
            return input.value.toString();
        }
    }

    function isValidEmail(email) {
        return /\S+@\S+\.\S+/.test(email);
    }

    function isValidUuid(uuid) {
        return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid);
    }

    function setCurrentInputsRequiredStatus() {
        const inputsRequiredStatus = {};
        for (const input of inputs) {
            if (input.required) {
                inputsRequiredStatus[input.key] = document.getElementById(input.key)?.value?.toString()?.length > 0;
            }
            if (input.type === "email") {
                inputsRequiredStatus[input.key] = isValidEmail(document.getElementById(input.key)?.value?.toString());
            }
        }
        setInputsRequiredStatus(inputsRequiredStatus);
    }

    function inputRequiredIndicatorColor(input) {
        return inputsRequiredStatus[input.key] ? "green" : "red";
    }

    function inputRequiredIndicatorTooltip(input) {
        return inputsRequiredStatus[input.key] ? "Required and set." : "Required and NOT set.";
    }

    function allowSubmit() {
        for (const inputRequiredStatusKey of Object.keys(inputsRequiredStatus)) {
            if (!inputsRequiredStatus[inputRequiredStatusKey]) {
                return false;
            }
        }
        return changing;
    }

    function isLoading() {
        return loading || loadingCount > 0;
    }

    function isDisabled() {
        return deleting || isLoading();
    }

    return <>
        <div className="box thickborder" style={{width:"fit-content",maxWidth:"600pt"}}>
            <form onSubmit={handleSubmit}>
                <table><tbody>
                { inputs?.map((input, index) =>
                    <tr key={input.label}>
                        <td align={input.label_align || "right"} style={{verticalAlign:"top",paddingTop:"0.6em",paddingRight:"0.4em",whiteSpace:"nowrap"}}>
                            {input.label}:
                        </td>
                        <td style={{paddingTop: "0.6em",whiteSpace:"nowrap"}}>
                            { input.type === "boolean" ? <>
                                <select className="select" id={input.key} defaultValue={valueOf(input)} onChange={handleChange} disabled={isDisabled() || input.readonly}>
                                    <option value={false}>False</option>
                                    <option value={true}>True</option>
                                </select>
                            </>:<>
                                { input.type === "select" ? <>
                                    <DynamicSelect
                                        id={input.key}
                                        url={input.url}
                                        required={input.required}
                                        selected={valueOf(input)}
                                        onChange={handleChange}
                                        disabled={isDisabled() || input.readonly}
                                        setLoadingCount={setLoadingCount}
                                        subComponent={input.subComponent}
                                        reset={reset}
                                    />
                                </>:<>
                                    <InputLine input={input} valueOf={valueOf} handleChange={handleChange} isDisabled={isDisabled} isCreate={!Type.IsNull(onCreate)} />
                                </>}
                            </>}
                            { input.required && <>
                                <span id={`tooltip-required-${input.key}`}>
                                    <small style={{fontSize:"large",fontWeight:"bold",paddingLeft:"0.6em",color:inputRequiredIndicatorColor(input)}}>{Char.Check}</small>
                                    <Tooltip id={`tooltip-required-${input.key}`} position="bottom" text={inputRequiredIndicatorTooltip(input)} />
                                </span>
                            </> }
                        </td>
                    </tr>
                )}
                <tr>
                    { deleting ? <>
                        <td style={{colSpan:"2",paddingTop:"0.8em"}} colSpan="2">
                            <i><b style={{color:"darkred"}}>Are you sure you want to delete this item?</b></i>
                            <div style={{float:"right"}}>
                            <button className="button cancel" type="button" onClick={handleDeleteCancel}>Cancel</button><>&nbsp;</>
                            <button className="button delete" type="button" onClick={handleDeleteConfirm}>Delete</button>
                            </div>
                        </td>
                    </>:<>
                        <td style={{verticalAlign:"bottom",fontSize:"large"}}>
                            { !onCreate && <>
                                <span style={{padding:"1px 5px", borderRadius:"4px", border:"1px solid gray", cursor:loading ? "not-allowed" : "pointer"}} onClick={handleRefresh}>{Char.Refresh}</span><>&nbsp;</>
                            </> }
                        </td>
                        <td align="right" style={{paddingTop:"0.8em"}}>
                            { isLoading() ? <>
                                <div style={{marginTop:"0.8em"}}> <StandardSpinner condition={isLoading()} label={updating ? "Updating" : "Loading"}/> </div>
                            </>:<>
                                { (readonly) ? <>
                                   <button className="button cancel" type="button" onClick={handleCancel}>Cancel</button><>&nbsp;</>
                                   <button className="button cancel" type="button"><b>Read Only Mode</b></button><>&nbsp;</>
                                </>:<>
                                    <button className="button cancel" type="button" onClick={handleCancel}>Cancel</button><>&nbsp;</>
                                    { onCreate ? <>
                                        <span id="tooltip-editbox-create">
                                            <button className="button" data-text={allowSubmit() ? "Click to create." : "Nothing to create."} id="create" disabled={!allowSubmit()}>Create</button>
                                        </span>
                                        <Tooltip id="tooltip-editbox-create" position="bottom" text={allowSubmit() ? "Click to create." : "Nothing to create."} />
                                    </>:<>
                                        { onDelete && <>
                                            <button className="button delete" type="button" onClick={handleDelete}>Delete</button><>&nbsp;</>
                                        </>}
                                        <span id="tooltip-editbox-save">
                                            <button className="button" id="update" disabled={!allowSubmit()}>Update</button>
                                        </span>
                                        <Tooltip id="tooltip-editbox-save" position="bottom" text={allowSubmit() ? "Click to save changes." : "No changes to save."} />
                                    </>}
                                </>}
                            </>}
                        </td>
                    </>}
                </tr>
                </tbody></table>
            </form>
        </div>
    </>
}

export default EditBox;
