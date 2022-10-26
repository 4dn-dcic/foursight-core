import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFetch } from '../utils/Fetch';
import { StandardSpinner } from '../Spinners';
import Uuid from 'react-uuid';
import Json from '../utils/Json';
import Char from '../utils/Char';
import Server from '../utils/Server';
import Yaml from '../utils/Yaml';

// Generic box to edit (create, update, delete) a list of plain input fields representing some data record.
// If the onCreate argument is specified then assume this is a create.
//
const EditBox = ({inputs, title, loading, onCreate, onUpdate, onDelete, onCancel, onRefresh }) => {

    const [ updating, setUpdating ] = useState(false);
    const [ changing, setChanging ] = useState(false);
    const [ deleting, setDeleting ] = useState(false);

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

    function handleRefresh() {
        if (onCreate) {
            for (const input of inputs) {
                const element = document.getElementById(input.name);
                element.value = null;
                if (input.focus) {
                    element.focus();
                }
            }
            document.getElementById("create").disabled = true;
        }
        else {
            setUpdating(false);
            setChanging(false);
            if (!loading && onRefresh) {
                onRefresh();
            }
        }
    }

    function handleChange(e) {
        setChanging(changesExist());
    }

    function changesExist() {
        for (const input of inputs) {
            const originalValue = input.value?.toString();
            const element = document.getElementById(input.name);
            const currentValue = element.value?.toString();
            if (originalValue !== currentValue) {
                return true;
            }
        }
        return false;
    }

    function resetInputValuesToOriginal() {
        for (const input of inputs) {
            const element = document.getElementById(input.name);
            element.value = input.value;
        }
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

    return <>
        <div className="box">
            <form onSubmit={handleSubmit}>
                <table><tbody>
                { inputs?.map((input, index) =>
                    <tr key={input.label}>
                        <td align={input.label_align || 'right'} style={{paddingTop: "0.6em", paddingRight:"0.4em", whiteSpace:"nowrap"}}>
                            {input.label}:
                        </td>
                        <td style={{paddingTop: "0.6em"}}>
                            { input.type === "boolean" ? <>
                                <select id={input.name} defaultValue={input.value} onChange={handleChange} disabled={input.readonly}>
                                    <option value={false}>False</option>
                                    <option value={true}>True</option>
                                </select>
                            </>:<>
                                { input.readonly ?
                                    <input className="input" placeholder={input.placeholder || input.label} id={input.name} defaultValue={input.value} readOnly />
                                : input.focus ?
                                    <input className="input" placeholder={input.placeholder || input.label} id={input.name} defaultValue={input.value} onChange={handleChange} autoFocus />
                                : <input className="input" placeholder={input.placeholder || input.label} id={input.name} defaultValue={input.value} onChange={handleChange} />
                                }
                            </>}
                        </td>
                    </tr>
                )}
                <tr>
                    { deleting ? <>
                        <td style={{colSpan:"2",paddingTop:"0.8em"}} colSpan="2">
                            <i><b style={{color:"darkred"}}>Are you sure you wnat to delete this item?</b></i>
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
                                <button className="button cancel" type="button" onClick={handleCancel}>Cancel</button><>&nbsp;</>
                                { onCreate ? <>
                                    <button className="button tool-tip" data-text={changing ? "Click to create." : "Nothing to create."} id="create" disabled={!changing}>Create</button>
                                </>:<>
                                    { onDelete && <>
                                        <button className="button delete" type="button" onClick={handleDelete}>Delete</button><>&nbsp;</>
                                    </>}
                                    <button className="button tool-tip" data-text={changing ? "Click to save changes." : "No changes to save."} id="update" disabled={!changing}>Update</button>
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
