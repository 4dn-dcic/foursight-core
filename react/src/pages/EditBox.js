import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFetch } from '../utils/Fetch';
import { StandardSpinner } from '../Spinners';
import Json from '../utils/Json';
import Char from '../utils/Char';
import Server from '../utils/Server';

const InputsBox = ({inputs, title, loading, onSave, onCancel, onRefresh}) => {

    const [ updating, setUpdating ] = useState(false);

    function handleSave(e) {
        if (onSave) {
            setUpdating(true);
            e.preventDefault();
            const values = {}
            for (const input of inputs) {
                if (!input.readonly) {
                    values[input.name] = document.getElementById(input.name).value;
                }
            }
            onSave(values);
        }
    }

    function handleCancel(e) {
        if (onCancel) {
            e.preventDefault();
            onCancel();
        }
    }

    function handleChange(e) {
        document.getElementById("save").disabled = (e.target.value == e.target.defaultValue);
    }

    function handleRefresh() {
        setUpdating(false);
        if (!loading && onRefresh) {
            onRefresh();
        }
    }

    return <>
        { title &&
            <div style={{display:"table-row",textAlign:"left"}}>
                <b>{title}</b>
            </div>
        }
        <div className="box">
            <form onSubmit={handleSave}>
                <table><tbody>
                { inputs.map((input, index) =>
                    <tr key={input.label}>
                        <td align={input.label_align || 'right'} style={{paddingTop: "0.6em", paddingRight:"0.4em", whiteSpace:"nowrap"}}>
                            {input.label}:
                        </td>
                        <td style={{paddingTop: "0.6em"}}>
                            { input.readonly ?
                                <input className="input" placeholder={input.placeholder || input.label} id={input.name} defaultValue={input.value()} readOnly />
                            : input.focus ?
                                <input className="input" placeholder={input.placeholder || input.label} id={input.name} defaultValue={input.value()} onChange={handleChange} autoFocus />
                              : <input className="input" placeholder={input.placeholder || input.label} id={input.name} defaultValue={input.value()} onChange={handleChange} />
                            }
                        </td>
                    </tr>
                )}
                <tr>
                <td style={{verticalAlign:"bottom"}}><span style={{padding:"1px 5px", borderRadius:"4px", border:"1px solid gray", cursor:loading ? "not-allowed" : "pointer"}} onClick={handleRefresh}>{Char.Refresh}</span><>&nbsp;</></td>
                <td align="right" style={{paddingTop:"0.8em"}}>
                    { loading ?
                      <div style={{marginTop:"0.45em"}}> <StandardSpinner condition={loading} label={updating ? "Updating" : "Loading"}/> </div>
                    : <>
                        
                        <button className="button" type="button" onClick={handleCancel}>Cancel</button><>&nbsp;</>
                        <button className="button" id="save" disabled={true}>Save</button>
                      </>
                    }
                </td>
                </tr>
                </tbody></table>
            </form>
        </div>
    </>
}

export default InputsBox;
