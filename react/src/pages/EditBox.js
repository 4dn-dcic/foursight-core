import React, { useEffect, useState } from 'react';
import { StandardSpinner } from '../Spinners';
import Char from '../utils/Char';

// Generic box to edit (create, update, delete) a list of plain input fields representing some data record.
// If the onCreate argument is specified then assume this is a create.
//
const EditBox = ({ inputs, title, loading, onCreate, onUpdate, onDelete, onCancel, onRefresh, readonly = false }) => {

    const [ updating, setUpdating ] = useState(false);
    const [ changing, setChanging ] = useState(false);
    const [ deleting, setDeleting ] = useState(false);
    const [ inputsRequiredStatus, setInputsRequiredStatus ] = useState({});

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
            const element = document.getElementById(input.name);
            if (input.focus) {
                element.focus();
            }
        }
    }

    function handleRefresh() {
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
            inputsRequiredStatus[input.name] = (currentValue?.toString()?.length > 0);
            setInputsRequiredStatus(current => ({...inputsRequiredStatus}));
        }
        if (input.type === "email") {
            const currentValue = e.target.value?.toString();
            inputsRequiredStatus[input.name] = isValidEmail(currentValue);
            setInputsRequiredStatus(current => ({...inputsRequiredStatus}));
        }
        setChanging(changesExist());
    }

    function getInputByName(name) {
        for (const input of inputs) {
            if (input.name == name) {
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
            const element = document.getElementById(input.name);
            const currentValue = element.value?.toString();
            if (originalValue?.toString() != currentValue?.toString()) {
                return true;
            }
        }
        return false;
    }

    function resetInputValuesToOriginal() {
        for (const input of inputs) {
            const element = document.getElementById(input.name);
            element.value = valueOf(input);
        }
        setCurrentInputsRequiredStatus();
    }

    function gatherCurrentInputValues() {
        const values = {}
        for (const input of inputs) {
            if (!input.readonly) {
                let value = document.getElementById(input.name).value;
                if (input.type === "boolean") {
                    value = (value.toString().toLowerCase() === "true") ? true : false;
                }
                values[input.name] = value;
            }
        }
        return values;
    }

    function valueOf(input) {
        if (input.type === "boolean") {
            return input.value ? true : false;
        }
        else if ((input.value === null) || (input.value === undefined)) {
            return "";
        }
        else {
            return input.value.toString();
        }
    }

    function isValidEmail(email) {
        const valid = /\S+@\S+\.\S+/.test(email);
        return valid;
    }

    function setCurrentInputsRequiredStatus() {
        const inputsRequiredStatus = {};
        for (const input of inputs) {
            if (input.required) {
                inputsRequiredStatus[input.name] = document.getElementById(input.name)?.value?.toString()?.length > 0;
            }
            if (input.type === "email") {
                inputsRequiredStatus[input.name] = isValidEmail(document.getElementById(input.name)?.value?.toString());
            }
        }
        setInputsRequiredStatus(inputsRequiredStatus);
    }

    function inputRequiredIndicatorColor(input) {
        return inputsRequiredStatus[input.name] ? "green" : "red";
    }

    function allowSubmit() {
        for (const inputRequiredStatusKey of Object.keys(inputsRequiredStatus)) {
            if (!inputsRequiredStatus[inputRequiredStatusKey]) {
                return false;
            }
        }
        return changing;
    }

    return <>
        <div className="box cell thickborder">
            <form onSubmit={handleSubmit}>
                <table><tbody>
                { inputs?.map((input, index) =>
                    <tr key={input.label}>
                        <td align={input.label_align || 'right'} style={{paddingTop: "0.6em", paddingRight:"0.4em", whiteSpace:"nowrap"}}>
                            {input.label}:
                        </td>
                        <td style={{paddingTop: "0.6em",whiteSpace:"nowrap"}}>
                            { input.type === "boolean" ? <>
                                <select className="select" id={input.name} defaultValue={valueOf(input)} onChange={handleChange} disabled={input.readonly || deleting}>
                                    <option value={false}>False</option>
                                    <option value={true}>True</option>
                                </select>
                            </>:<>
                                <input
                                    className="input icon-rtl"
                                    placeholder={input.placeholder || input.label}
                                    id={input.name}
                                    defaultValue={valueOf(input)}
                                    onChange={handleChange}
                                    readOnly={input.readonly || deleting ? true : false}
                                    autoFocus={input.focus ? true : false} />
                            </>}
                            { input.required &&
                                <small style={{fontWeight:"bold",paddingLeft:"0.6em",color:inputRequiredIndicatorColor(input)}}>{Char.Check}</small>
                            }
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
                            <span style={{padding:"1px 5px", borderRadius:"4px", border:"1px solid gray", cursor:loading ? "not-allowed" : "pointer"}} onClick={handleRefresh}>{Char.Refresh}</span><>&nbsp;</>
                        </td>
                        <td align="right" style={{paddingTop:"0.8em"}}>
                            { loading ? <>
                                <div style={{marginTop:"0.45em"}}> <StandardSpinner condition={loading} label={updating ? "Updating" : "Loading"}/> </div>
                            </>:<>
                                { (readonly) ? <>
                                   <div className="box thickborder" style={{width:"fit-content",marginRight:"10pt",fontSize:"small"}}>
                                        <b>Read Only Mode</b>
                                   </div>
                                </>:<>
                                    <button className="button cancel" type="button" onClick={handleCancel}>Cancel</button><>&nbsp;</>
                                    { onCreate ? <>
                                        <button className="button tool-tip" data-text={allowSubmit() ? "Click to create." : "Nothing to create."} id="create" disabled={!allowSubmit()}>Create</button>
                                    </>:<>
                                        { onDelete && <>
                                            <button className="button delete" type="button" onClick={handleDelete}>Delete</button><>&nbsp;</>
                                        </>}
                                        <button className="button tool-tip" data-text={allowSubmit() ? "Click to save changes." : "No changes to save."} id="update" disabled={!allowSubmit()}>Update</button>
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
