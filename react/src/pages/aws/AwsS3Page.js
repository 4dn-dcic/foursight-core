import React from 'react';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { BarSpinner } from "../../Spinners";
import Clipboard from '../../utils/Clipboard';
import Fetch from '../../utils/Fetch';
import Image from '../../utils/Image';
import Server from '../../utils/Server';
import Yaml from '../../utils/Yaml';
import TableHead from '../../TableHead';

const AwsS3Page = (props) => {

    let { environ } = useParams();
    let [ bucketList, setBucketList ] = useState([]);
    let [ bucketKeysList, setBucketKeysList ] = useState([]);
    let [ bucketKeyContentList, setBucketKeyContentList ] = useState([]);
    let [ bucketListFilter, setBucketListFilter ] = useState("");

    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);

    useEffect(() => {
        const bucketsUrl = Server.Url("/aws/s3/buckets", environ);
        Fetch.get(bucketsUrl, bucketList => {
            setBucketList(bucketList);
        }, setLoading, setError);
    }, []);

    // Only allow fetching/displaying S3 bucket key content for keys (file) with a '.json' suffix,
    // or all files within a bucket with a name ending with '-envs'; AND which are not too large.
    //
    function mayLookAtKeyContent(bucket, key, size) {
        if (size > 50000) {
            return false;
        }
        if (key.endsWith(".json")) {
            return true;
        }
        if (bucket.endsWith("-envs")) {
            return true;
        }
        return false;
    }

    // Bucket list functions.

    function getBucketList() {
        return bucketList.filter(bucket => bucket.toLowerCase().includes(bucketListFilter.toLowerCase()));
    }

    function onBucketListSearch(e) {
        setBucketListFilter(e.currentTarget.value);
        setBucketList(existing => [...existing]);
    }

    // Bucket keys list functions.

    function isShowingAnyBucketKeys() {
        return bucketKeysList.length > 0;
    }

    function isShowingBucketKeysBox(bucket) {
        return findBucketKeysListIndex(bucket) >= 0;
    }

    function showBucketKeysBox(bucket) {
        if (isShowingBucketKeysBox(bucket)) {
            return;
        }
        let bucketKeys = {
            bucket: bucket,
            keys: [ ],
            loading: true
        };
        bucketKeysList.unshift(bucketKeys);
        setBucketKeysList(existing => [...existing]);
        const bucketKeysUrl = Server.Url(`/aws/s3/buckets/${bucket}`, environ);
        Fetch.get(bucketKeysUrl, data => {
            bucketKeys.keys = data;
            bucketKeys.loading = false;
            setBucketKeysList(existing => [...existing]);
        }, setLoading, setError);
    }

    function hideBucketKeysBox(bucket) {
        const index = findBucketKeysListIndex(bucket);
        if (index < 0) {
            return;
        }
        bucketKeysList.splice(index, 1);
        setBucketKeysList(existing => [...existing]);
    }

    function toggleBucketKeysBox(bucket) {
        const index = findBucketKeysListIndex(bucket);
        if (index >= 0) {
            hideBucketKeysBox(bucket);
        }
        else {
            showBucketKeysBox(bucket);
        }
    }

    function findBucketKeysListIndex(bucket) {
        for (let i = 0 ; i < bucketKeysList.length ; i++) {
            const bucketKeys = bucketKeysList[i]
            if (bucketKeys.bucket === bucket) {
                return i;
            }
        }
        return -1;
    }

    // Bucket key content list functions.

    function isShowingAnyBucketKeyContent() {
        return bucketKeyContentList.length > 0;
    }

    function isShowingBucketKeyContentBox(bucket, key) {
        return findBucketKeyContentListIndex(bucket, key) >= 0;
    }

    function showBucketKeyContentBox(bucket, key) {
        if (isShowingBucketKeyContentBox(bucket, key)) {
            return;
        }
        key = encodeURIComponent(key);
        const url = Server.Url(`/aws/s3/buckets/${bucket}/${key}`, environ);
        let data = {
            bucket: bucket,
            key: key,
            content: null,
            loading: true
        };
        bucketKeyContentList.unshift(data);
        setBucketKeyContentList(existing => [...existing]);
        Fetch.get(url, response => {
            data.content = response;
            data.loading = false;
            setBucketKeyContentList(existing => [...existing]);
        }, setLoading, setError);
    }

    function hideBucketKeyContentBox(bucket, key) {
        const index = findBucketKeyContentListIndex(bucket, key);
        if (index < 0) {
            return;
        }
        bucketKeyContentList.splice(index, 1);
        setBucketKeyContentList(existing => [...existing]);
    }

    function toggleBucketKeyContentBox(bucket, key) {
        const index = findBucketKeyContentListIndex(bucket, key);
        if (index >= 0) {
            hideBucketKeyContentBox(bucket, key);
        }
        else {
            showBucketKeyContentBox(bucket, key);
        }
    }

    function findBucketKeyContentListIndex(bucket, key) {
        for (let i = 0 ; i < bucketKeyContentList.length ; i++) {
            const bucketKeyContent = bucketKeyContentList[i]
            if ((bucketKeyContent.bucket === bucket) && (bucketKeyContent.key === key)) {
                return i;
            }
        }
        return -1;
    }

    const BucketsBox = () => {
        return <div>
            <div style={{float:"left",fontWeight:"bold",paddingBottom:"3pt"}}>&nbsp;S3 Buckets</div>&nbsp;&nbsp;
            <input placeholder="Search ..." type="text" autoFocus style={{outline:"none",paddingLeft:"2pt",border:"1px solid gray",borderRadius:"3pt",position:"relative",bottom:"1pt",fontSize:"small",marginBottom:"3pt"}} defaultValue={bucketListFilter} onChange={onBucketListSearch} />
            <div className="boxstyle info" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>
                { getBucketList().map((bucket, i) => {
                    return <div key={i}>
                        <span style={{cursor:"pointer",fontWeight:isShowingBucketKeysBox(bucket) ? "bold" : "normal"}} onClick={() => toggleBucketKeysBox(bucket)}>{bucket}</span>
                        { i < getBucketList().length - 1 &&
                            <div style={{marginTop:"3pt",marginBottom:"3pt",height:"1px", backgroundColor:"darkblue"}} />
                        }
                    </div>
                })}
            </div>
        </div>
    }

    const BucketKeysPanel = () => {
        return isShowingAnyBucketKeys() && <div>
            <div style={{fontWeight:"bold",paddingBottom:"3pt"}}>&nbsp;S3 Bucket Keys</div>
            { bucketKeysList?.map((bucketKeys, i) => {
                return <BucketKeysBox key={i} bucketKeys={bucketKeys} style={{paddingTop:"3pt"}}/>
            })}
        </div>
    }

    const BucketKeysBox = ({bucketKeys}) => {

        const columns = [
            { label: "Key", key: "key" },
            { label: "Size", key: "size", align: "right" },
            { label: "Modified", key: "modified" }
        ];

        return <>
            <div className="boxstyle info" style={{paddingTop:"6pt",paddingBottom:"6pt",marginBottom:"8pt",minWidth:"240pt"}}>
                <span style={{float:"right",cursor:"pointer"}} onClick={(() => {hideBucketKeysBox(bucketKeys.bucket)})}><b>&nbsp;&nbsp;&#x2717;</b></span>
                <b>{bucketKeys.bucket}</b>
                <p />
                { <Spinner condition={bucketKeys.loading} label={"Fetching bucket keys"} color={"darkblue"} /> }
                { bucketKeys.keys.length > 0 ? (<>
                    <div style={{height:"1px",background:"darkblue",marginBottom:"1pt"}}></div>
                    <table width="100%">
                        <TableHead columns={columns} list={bucketKeys.keys} update={() => setBucketKeysList(existing => [...existing])} style={{color:"darkblue",fontWeight:"bold"}}/>
                        <tr><td style={{paddingTop:"1pt"}}></td></tr>
                        <tr><td style={{height:"1px",background:"darkblue"}} colSpan="3"></td></tr>
                        <tr><td style={{paddingTop:"4pt"}}></td></tr>
                        <tbody>
                        { bucketKeys.keys.map((bucketKey, i) => { return <React.Fragment key={i}>
                            <tr key={i}>
                            <td>
                                { mayLookAtKeyContent(bucketKeys.bucket, bucketKey.key, bucketKey.size) ? (<>
                                    <span style={{cursor:"pointer",
                                                  color:"darkblue",
                                                  fontWeight:isShowingBucketKeyContentBox(bucketKeys.bucket, bucketKey.key) ? "bold" : "normal"}}
                                                  onClick={() => toggleBucketKeyContentBox(bucketKeys.bucket, bucketKey.key)}>
                                        {bucketKey.key}
                                     </span>
                                </>):(<>
                                    <span style={{color:"black",
                                                  fontWeight:isShowingBucketKeyContentBox(bucketKeys.bucket, bucketKey.key) ? "bold" : "normal"}}>
                                        {bucketKey.key}
                                     </span>
                                </>)}
                            &nbsp;&nbsp;</td>
                            <td align="right">
                                {bucketKey.size}
                            &nbsp;&nbsp;</td>
                            <td style={{whiteSpace:"nowrap"}}>
                                {bucketKey.modified}
                            &nbsp;&nbsp;</td>
                            </tr>
                            { i < bucketKeys.keys.length - 1 && <> 
                                <tr><td style={{paddingTop:"2pt"}}></td></tr>
                                <tr><td style={{height:"1px",background:"lightblue"}} colSpan="3"></td></tr>
                                <tr><td style={{paddingTop:"2pt"}}></td></tr>
                            </>}
                        </React.Fragment>})}
                </tbody>
                </table>
                </>):(<>
                    { !bucketKeys.loading && <i>No keys found for this bucket.</i> }
                </>)}
            </div>
        </>
    }

    const BucketKeyContentPanel = () => {
        return isShowingAnyBucketKeyContent() && <div>
            <div style={{fontWeight:"bold",paddingBottom:"3pt"}}>&nbsp;S3 Bucket Key Content</div>
            { bucketKeyContentList?.map((bucketKeyContent, i) => {
                return <BucketKeyContentBox key={i} bucketKeyContent={bucketKeyContent} style={{paddingTop:"3pt"}}/>
            })}
        </div>
    }

    const BucketKeyContentBox = ({bucketKeyContent}) => {
        return <>
            <div className="boxstyle info" style={{paddingTop:"6pt",paddingBottom:"6pt",marginBottom:"8pt",minWidth:"300pt"}}>
                <span style={{float:"right",cursor:"pointer"}} onClick={(() => {hideBucketKeyContentBox(bucketKeyContent.bucket, bucketKeyContent.key)})}><b>&nbsp;&nbsp;&#x2717;</b></span>
                Bucket: <b>{bucketKeyContent.bucket}</b> <br />
                Key: <b>{bucketKeyContent.key}</b>
                <p />
                { <Spinner condition={bucketKeyContent.loading} label={"Fetching bucket key content"} color={"darkblue"} /> }
                { bucketKeyContent.content && <pre style={{marginTop:"6pt",marginBottom:"0pt",background:"inherit",borderRadius:"8pt",filter:"brightness(1.1)",maxWidth:"800pt"}}>
                    <span style={{fontSize:"0",opacity:"0"}} id={bucketKeyContent.key}>{JSON.stringify(bucketKeyContent.content)}</span>
                    <img alt="copy" onClick={() => Clipboard.Copy(bucketKeyContent.key)} style={{cursor:"copy",float:"right",fontFamily:"monospace"}} src={Image.Clipboard()} height="19" />
                    {Yaml.Format(bucketKeyContent.content)}
                </pre> }
            </div>
        </>
    }

    const Spinner = ({condition, color = "darkblue", size = 100, label = "Loading"}) => {
        return condition && <table><tbody><tr>
            {label && <td nowrap="1"><small style={{color:color}}><b><i>{label}</i></b></small>&nbsp;&nbsp;</td>}
            <td style={{paddingTop:"5px"}} nowrap="1"> <BarSpinner loading={condition} size={size} color={color} /></td>
        </tr></tbody></table>
    }

    if (error) return <>Cannot load data from Foursight API: {error}</>;
    if (loading) return <>Loading ...</>;
    return <>
        <div>
            <table><tbody>
                <tr>
                    <td style={{paddingLeft:"10pt",verticalAlign:"top"}}>
                        <BucketsBox />
                    </td>
                    <td style={{paddingLeft:isShowingAnyBucketKeys() ? "10pt" : "0",verticalAlign:"top"}}>
                        <BucketKeysPanel />
                    </td>
                    <td style={{paddingLeft:isShowingAnyBucketKeyContent() ? "10pt" : "0",verticalAlign:"top"}}>
                        <BucketKeyContentPanel />
                    </td>
                </tr>
            </tbody></table>
        </div>
    </>
};

export default AwsS3Page;
