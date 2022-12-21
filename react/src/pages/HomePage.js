import React from 'react';
import { useContext, useEffect, useState } from 'react';
import Env from '../utils/Env';
import HeaderData from '../HeaderData';
import Logout from '../utils/Logout';
import Server from '../utils/Server';
import Char from '../utils/Char';
import { HorizontalLine, Link, LoggedInUser } from '../Components';
import { useComponentDefinitions, useSelectedComponents, useKeyedState, useOptionalKeyedState } from '../Hooks.js';

const Stack = (props) => {

    //let [ state, setState ] = useState(props.keyedState?.get() || {});
    let [ state, setState ] = useOptionalKeyedState(props.keyedState);

    function isShowOutputs() { return state.showOutputs; }
    function isShowResources() { return state.showResources; }
    function toggleOutputs() {
        setState({showOutputs: state.showOutputs ? false : true });
        //setState({...state, showOutputs: state.showOutputs ? false : true });
        //_setState({...state, showOutputs: state.showOutputs ? false : true });
    }
    function toggleResources() {
        setState({showResources: state.showResources ? false : true });
        //setState({...state, showResources: state.showResources ? false : true });
        //_setState({...state, showResources: state.showResources ? false : true });
    }
    //function _setState(state) {
        //setState(state);
        //props.keyedState?.set(state);
    //}

    return <div className="box darken" style={{marginBottom:"4pt"}}>
        STACK-STATE[{JSON.stringify(state)}]
        <b>Stack {props.stackName}</b> &nbsp; <span className="pointer" onClick={() => props.hideStack("stack", props.stackName)}>{Char.X}</span>
        <br />
        { isShowOutputs() ? <>
            <span className="pointer" onClick={toggleOutputs}>Hide Outputs</span>
            <StackOutputs />
        </>:<>
            <span className="pointer" onClick={toggleOutputs}>Show Outputs</span>
        </> }
        <br />
        { isShowResources() ? <>
            <span className="pointer" onClick={toggleResources}>Hide Resources</span>
                <StackResources keyedState={props.keyedState?.keyed("::resources")} />
        </>:<>
            <span className="pointer" onClick={toggleResources}>Show Resources</span>
        </> }
    </div>
}

const StackOutputs = (props) => {
    return <div className="box" style={{marginBottom:"4pt"}}>
        Stack {props.stackName} Outputs &nbsp;
    </div>
}

const StackResources = (props) => {
    let [ state, setState ] = useOptionalKeyedState(props.keyedState);
    function isShowDetails() { return state.showDetails; }
    function toggleDetails() {
        //setState({...state, showDetails: state.showDetails ? false : true });
        setState({showDetails: state.showDetails ? false : true });
    }
    return <div className="box" style={{marginBottom:"4pt"}}>
        Stack {props.stackName} Resources &nbsp; <br />
        { isShowDetails() ? <>
            <span className="pointer" onClick={toggleDetails}>Hide Details</span>
            <StackResourceDetails keyedState={props.keyedState?.keyed("::details")} />
        </>:<>
            <span className="pointer" onClick={toggleDetails}>Show Details</span>
        </> }
    </div>
}

const StackResourceDetails = (props) => {
    let [ state, setState ] = useOptionalKeyedState(props.keyedState);

    function isShowMoreDetails() { return state.showMoreDetails; }
    function toggleMoreDetails() { setState({...state,showMoreDetails: state.showMoreDetails ? false : true }); }

    function isShowTediousDetails() { return state.showTediousDetails; }
    function toggleTediousDetails() { setState({...state,showTediousDetails: state.showTediousDetails ? false : true }); }

    return <div className="box lighten" style={{marginBottom:"4pt"}}>
        <small>Stack {props.stackName} Resource Details &nbsp;</small>
        { isShowMoreDetails() ? <>
            <span className="pointer" onClick={toggleMoreDetails}>Hide More Details</span>
            <StackResourceMoreDetails />
        </>:<>
            <span className="pointer" onClick={toggleMoreDetails}>Show More Details</span>
        </> }
        { isShowTediousDetails() ? <>
            <span className="pointer" onClick={toggleTediousDetails}>Hide Tedious Details</span>
            <StackResourceTediousDetails />
        </>:<>
            <span className="pointer" onClick={toggleTediousDetails}>Show Tedious Details</span>
        </> }
    </div>
}

const StackResourceMoreDetails = (props) => {
    return <div className="box" style={{marginBottom:"4pt"}}>
        <small>More Stack {props.stackName} Resource Details &nbsp;</small>
    </div>
}

const StackResourceTediousDetails = (props) => {
    return <div className="box" style={{marginBottom:"4pt"}}>
        <small>Tedious Stack {props.stackName} Resource Details &nbsp;</small>
    </div>
}

const HomePage = (props) => {

    let keyedState = useKeyedState({abc:"123"});

    const [ header ] = useContext(HeaderData);
    const versionsToolTip = `Deployed: ${header?.app?.deployed} / `
                          + (Env.IsFoursightFourfront(header) ? "foursight" : "foursight-cgap") + ": "
                          + header?.versions?.foursight_core + " / foursight-core: "
                          + header?.versions?.foursight + " / dcicutils: " + header?.versions?.dcicutils;

    function hideStack(stackName) {
        componentsLeft.toggle("stack", stackName);
    }

    const createStack = (stackName, key, keyedState, remove) => {
        // TODO:
        // The useComponentDefinitions create function should (maybe) take as args:
        // - name (type not needed as we know what type we are)
        // - key (used as unique key for this component - composed of type and name)
        // - hide (function - some work to figure out how to pass from useComponents.toggle/add 
        // - args (aribitray data passed to useComponents.toggle or useCOmponents.add)
        return <Stack
            stackName={stackName}
            keyedState={keyedState.keyed(key)}
            hideStack={remove}
        />
    }

    const componentDefinitions = useComponentDefinitions([
         { type: "stack", create: createStack }
    ]);

    const componentsLeft = useSelectedComponents(componentDefinitions);

    const stacks = [ "Abc", "Def" ];

        const [ x, setX ] = useState({foo:'bar'});
        const ks = useKeyedState({hello:'bye'});
        const [ ls, setLs ] = useState({});

    return <>
                <span onClick={() => setX(value => ({goo:'baz'}))}>XXX[{JSON.stringify(x)}]XXX</span>
        keyedState:[{JSON.stringify(keyedState.get())}]<br/>

        <div className="box" style={{marginBottom:"10pt",width:"fit-content"}}>
            {stacks.map(stack =>
                <div
                    key={stack}
                    className="pointer"
                    style={{fontWeight:componentsLeft.selected("stack", stack) ? "bold" : "normal"}}
                    onClick={() => componentsLeft.toggle("stack", stack, keyedState)}>{stack}</div>
            )}
        </div>

        <div>
            { componentsLeft.map(component => <div key={component.key}>{component.ui}</div>) }
        </div>

        <br />
        COMPONENT-COUNT:[{componentsLeft.count()}]<br />
        COMPONENT-DEFINITION-COUNT:[{componentDefinitions.count()}]

        <div className="box thickborder error">
                {/* <span className="pointer" onClick={() => ks.set("K", ({...ks.get("K"),abc:!ks.get("K").abc}))}>A</span> */}
                {/* <span className="pointer" onClick={() => ks.set("K", ({...ks.get("K"),def:!ks.get("K").def}))}>B</span> */}
                <span className="pointer" onClick={() => ks.set("K", {abc:!ks.get("K").abc})}>A</span>
                <span className="pointer" onClick={() => ks.set("K", {def:!ks.get("K").def})}>B</span>
                <pre style={{background:"lightred"}}>{JSON.stringify(ks.get())}</pre>
        </div>
        <br/>
        <div className="box thickborder error">
                <span className="pointer" onClick={() => setLs({...ls,abc:!ls.abc})}>A</span>
                <span className="pointer" onClick={() => setLs({...ls,def:!ls.def})}>B</span>
                <pre style={{background:"lightred"}}>{JSON.stringify(ls)}</pre>
        </div>

        <div className="container" style={{marginTop:"-16pt"}}>
            <div className="box lighten" style={{margin:"20pt",padding:"10pt"}}>
                <b style={{fontSize:"x-large"}}>Welcome to Foursight &nbsp;<span style={{fontWeight:"normal"}}>({Env.IsFoursightFourfront(header) ? 'Fourfront' : 'CGAP'})</span></b>
                <div style={{float:"right",fontSize:"x-small",textAlign:"right",marginTop:"-3pt",marginRight:"2pt"}}>
                    Foursight Version: <b className="tool-tip" data-text={versionsToolTip}>{header?.versions?.foursight}</b> <br />
                    { header?.app?.credentials?.aws_account_name ? <>
                        <span className="tool-tip" data-text={"AWS Account Number: " + header?.app?.credentials?.aws_account_number}>AWS Account: <b>{header?.app?.credentials?.aws_account_name}</b></span> <br />
                    </>:<>
                        <span>AWS Account: <b>{header?.app?.credentials?.aws_account_number}</b></span> <br />
                    </>}
                    Foursight Stage: <b>{header?.app?.stage}</b> <br />
                </div>
                <HorizontalLine top="10pt" bottom="4pt" />
                This is the <b>new</b> React version of Foursight. To use the previous version click <b><a href={Env.LegacyFoursightLink(header)} style={{color:"inherit"}}><u>here</u></a></b>.
                <HorizontalLine top="4pt" bottom="10pt" />
                <p />
                <ul>
                    <li> To view Foursight <b><Link to="/checks">checks</Link></b> click <b><Link to="/checks"><u>here</u></Link></b>.  </li>
                    <li> To view Foursight <b><Link to="/info">general</Link></b> info click <b><Link to="/info"><u>here</u></Link></b>.  </li>
                    <li> To view Foursight <b><Link to="/env">environments</Link></b> info click <b><Link to="/env"><u>here</u></Link></b>. </li>
                    <li> To view Foursight <b><Link to="/users">users</Link></b> click <b><Link to="/users"><u>here</u></Link></b>.  </li>
                    <li> To view <b><Link to="/aws/s3">AWS S3</Link></b> info click <b><Link to="/aws/s3"><u>here</u></Link></b>.  </li>
                    <li> To view <b><Link to="/aws/infrastructure">AWS infrastructure</Link></b> info click <b><Link to="/aws/infrastructure"><u>here</u></Link></b>.  </li>
                    <li> To view other Foursight <b><Link to="/accounts">accounts</Link></b> click <b><Link to="/accounts"><u>here</u></Link></b>.  </li>
                </ul>
            </div>
            <div className="box lighten thickborder" style={{margin:"20pt",padding:"10pt",marginTop:"-10pt"}}>
                You are logged in as: <LoggedInUser />
                <br />
                To view your <b><Link to="/login">session</Link></b> info click <b><Link to="/login"><u>here</u></Link></b>. <br />
                To <b onClick={Logout}><Link>logout</Link></b> click <b onClick={Logout}><Link><u>here</u></Link></b>.
            </div>
            { (header.app?.accounts_file || header.app?.accounts_file_from_s3) && <>
                <div className="box" style={{margin:"20pt",padding:"10pt",marginTop:"-10pt"}}>
                    Click <Link to="/accounts">here</Link> to view other <Link to="/accounts" bold={false}>known accounts</Link>.
                </div>
            </>}
        </div>
    </>
};

export default HomePage;
