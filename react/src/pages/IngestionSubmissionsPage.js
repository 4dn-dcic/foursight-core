import Char from '../utils/Char';
import DateTime from '../utils/DateTime';
import { ExternalLink } from '../Components';
import Json from '../utils/Json';
import PagedTableComponent from '../PagedTableComponent';
import { StandardSpinner } from '../Spinners';
import Str from '../utils/Str';
import Type from '../utils/Type';
import useHeader from '../hooks/Header';
import useFetch from '../hooks/Fetch';
import { useParams, useSearchParams } from 'react-router-dom';
import { useRef, useState } from 'react';
import Yaml from '../utils/Yaml';

function awsLink(bucket, uuid, file) {
    const region = "us-east-1";
    if (uuid) {
        if (file) {
            return `https://s3.console.aws.amazon.com/s3/buckets/${bucket}?region=${region}&prefix=${uuid}/${file}&showversions=false`;
        }
        else {
            return `https://s3.console.aws.amazon.com/s3/buckets/${bucket}?region=${region}&prefix=${uuid}/&showversions=false`;
        }
    }
    else {
        return `https://s3.console.aws.amazon.com/s3/buckets/${bucket}?region=${region}`;
    }
}

function awsDataLink(bucket, uuid, file) {
    const region = "us-east-1";
    return `https://s3.console.aws.amazon.com/s3/object/${bucket}?region=${region}&prefix=${uuid}/${file}`
}


function formatFileSize(bytes) {
    if (bytes === 0) return "0B";
    const sizes = ["", "K", "M", "G", "T"];
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return (Math.round((bytes / Math.pow(1024, i)) * 100) / 100).toFixed(1) + sizes[i];
}

const IngestionSubmissionPage = (props) => {

    const header = useHeader();
    const [ args, setArgs ] = useSearchParams();
    const bucket = () => args.get("bucket") || header?.s3?.buckets?.metadata_bucket;
    const submissions = useFetch(`/ingestion_submissions?bucket=${bucket()}`);

    const columns =  [
        {
            key: "index",
            label: "",
            width: "1pt",
            align: "right",
            size: "small",
            sortable: false
        },
        {
            key: "uuid",
            label: "UUID",
            width: "10%"
        },
        {
            key: "modified",
            label: "Modified",
            type: "datetime",
            width: "10%"
        },
        {
            key: "status",
            label: "Finished",
            width: "10%",
            sortable: false
        },
        {
            key: "file",
            label: "File",
            width: "10%",
            sortable: false
        },
        {
            key: "size",
            label: "Size",
            width: "10%",
            sortable: false
        },
        {
            key: "portal",
            label: "Portal",
            width: "70%",
            sortable: false
        }
    ];

    function update({ limit, offset, sort, search, onDone }) {
        if (!Type.IsInteger(limit)) limit = parseInt(args.get("limit")) || 25;
        if (!Type.IsInteger(offset)) offset = parseInt(args.get("offset")) || 0;
        if (!Str.HasValue(sort)) sort = args.get("sort") || "email.asc";
        if (!Type.IsFunction(onDone)) onDone = () => {}
        submissions.refresh({
            url: `/ingestion_submissions?bucket=${bucket()}&limit=${limit}&offset=${offset}&sort=${sort}`,
            onDone: (response) => onDone(response)
        });
    }

    const [expanded, setExpanded] = useState([]);

    const toggleExpanded = (toggledIndex) => {
        if (expanded.includes(toggledIndex)) {
            setExpanded(expanded.filter((index) => index !== toggledIndex));
        } else {
            setExpanded([...expanded, toggledIndex]);
        }
    }

    const isExpanded = (index) => {
        return expanded.includes(index);
    }

    return <div className="container">
        <span style={{position:"relative", left:"2pt",bottom:"4pt"}}>
            <b>Ingestion Submissions</b>
            <ExternalLink href={`${header?.portal?.url}/search/?type=IngestionSubmission`} style={{marginLeft: "4pt"}}/>
            &nbsp;| {bucket()}
            <ExternalLink href={awsLink(bucket())} style={{marginLeft: "4pt"}}/>
        </span>
        <PagedTableComponent
            columns={columns}
            update={update}
            data={submissions}
            initialSort={"modified.desc"}>
            { submissions.map("list", (data, index) => (
                    <RowContent data={data} bucket={bucket} columns={columns}
                        rowIndex={index} offset={parseInt(args.get("offset"))}
                        isExpanded={isExpanded} toggleExpanded={toggleExpanded}
                        header={header} />
            ))}
        </PagedTableComponent>
    </div>
};

const RowContent = ({ data, bucket, columns, rowIndex, offset, isExpanded, toggleExpanded, header }) => {

    const uuid = data?.uuid;
    const widthRef = useRef(null);

    function valueOf(data, column) {
        const column_data = data[column.key];
        if (column.type === "datetime") {
            return DateTime.Format(column_data);
        }
        else if (column.type === "boolean") {
            return column_data ? "Yes" : "No";
        }
        else if (column.key === "status") {
            if (data?.error) {
                return "ERROR";
            }
            else if (data?.done) {
                return "Completed";
            }
            else if (data?.started) {
                return "Started";
            }
            else {
                return "Unknown";
            }
        }
        else if (column.key === "index") {
            const i = rowIndex + offset + 1;
            if (isExpanded(rowIndex)) {
                return `${i}. ${Char.DownArrow}`;
            }
            else {
                return `${i}. ${Char.UpArrow}`;
            }
        }
        else if (column.key === "size") {
            const file = data.files.find(item => item.file == data.file);
            return formatFileSize(file?.size);
        }
        else {
            return column_data;
        }
    }

    function tdstyle(column) {
        return {
            width: column?.width,
            fontSize: column?.size,
            textAlign: column?.align,
            paddingRight:"16pt",
            whiteSpace: "nowrap"
        };
    };

    return <>
        <tr>
            { columns.map((column, index) => <td style={tdstyle(column)}>
                <span onClick={() => toggleExpanded(rowIndex)} className="pointer">
                    {valueOf(data, column)}
                </span>
                { column.key === "uuid" && 
                    <ExternalLink href={awsLink(bucket(), uuid)} style={{marginLeft:"6pt"}} />
                }
                { column.key === "file" && 
                    <ExternalLink href={awsDataLink(bucket(), uuid, valueOf(data, column))} style={{marginLeft:"6pt"}} />
                }
                { column.key === "portal" && <>
                    View <ExternalLink href={`${header?.portal?.url}/ingestion-submissions/${uuid}/`} />
                </>}
            </td>)}
        </tr>
        { isExpanded(rowIndex) &&
            <RowDetail data={data} uuid={uuid} bucket={bucket()} widthRef={widthRef} />
        }
    </>
}

const RowDetail = ({ data, uuid, bucket, widthRef }) => {

    const manifest           = useFetch(`/ingestion_submissions/${uuid}/manifest?bucket=${bucket}`);
    const resolution         = useFetch(`/ingestion_submissions/${uuid}/resolution?bucket=${bucket}`);
    const submissionResponse = useFetch(`/ingestion_submissions/${uuid}/submission_response?bucket=${bucket}`);
    const summary            = useFetch(`/ingestion_submissions/${uuid}?bucket=${bucket}`);
    const traceback          = useFetch(`/ingestion_submissions/${uuid}/traceback?bucket=${bucket}`);
    const uploadInfo         = useFetch(`/ingestion_submissions/${uuid}/upload_info?bucket=${bucket}`);
    const validationReport   = useFetch(`/ingestion_submissions/${uuid}/validation_report?bucket=${bucket}`);

    const [showDetail, setShowDetail] = useState(false); const toggleDetail = () => setShowDetail(!showDetail);
    const [showManifest, setShowManifest] = useState(false); const toggleManifest = () => setShowManifest(!showManifest);
    const [showResolution, setShowResolution] = useState(false); const toggleResolution = () => setShowResolution(!showResolution);
    const [showSubmissionResponse, setShowSubmissionResponse] = useState(false); const toggleSubmissionResponse = () => setShowSubmissionResponse(!showSubmissionResponse);
    const [showSummary, setShowSummary] = useState(true); const toggleSummary = () => setShowSummary(!showSummary);
    const [showTraceback, setShowTraceback] = useState(true); const toggleTraceback = () => setShowTraceback(!showTraceback);
    const [showUploadInfo, setShowUploadInfo] = useState(false); const toggleUploadInfo = () => setShowUploadInfo(!showUploadInfo);
    const [showValidationReport, setShowValidationReport] = useState(true); const toggleValidationReport = () => setShowValidationReport(!showValidationReport);
    const [showFiles, setShowFiles] = useState(true); const toggleFiles = () => setShowFiles(!showFiles);
    const [detailFile, setDetailFile] = useState(null);

    const prestyle = {
        background:"inherit",
        border:"1pt gray dotted",
        marginTop:"2pt",
    };
    const divstyle = {
        background:"inherit",
        wordBreak:"break-all",
        maxWidth: widthRef?.current?.offsetWidth
    }

    function lines(lines) {
        return lines?.split("\n")?.filter(item => item?.length > 0);
    }

    function tracebacks(traceback) {
        return lines(traceback?.data?.traceback);
    }

    function loading() {
        return summary.loading || manifest.loading || resolution.loading || traceback.loading;
    }

    return <tr>
        <td></td>
        <td colSpan="6" ref={widthRef}>
            <div className="box smallpadding margin bigmarginbottom" colSpan="9" style={divstyle}>
                {loading() && <>
                    <pre style={prestyle}>
                        <StandardSpinner condition={loading()} label={"Loading"} style={{paddingBottom:"4pt"}} />
                    </pre>
                </>}
                {data?.files && <div>
                    <b onClick={toggleFiles} className="pointer">Files</b>&nbsp;
                    <ExternalLink href={awsLink(bucket, uuid)} style={{marginLeft: "4pt"}}/> <br />
                    <pre style={prestyle}>
                        { showFiles ? <>
                             { data.files.map((file, index) => <>
                                 {index > 0 && <br />}
                                 {file.file} ({formatFileSize(file.size)}) <ExternalLink href={awsLink(bucket, uuid, file.file)} style={{marginLeft: "4pt"}}/>
                             </>)}
                        </>:<>
                            <i onClick={toggleFiles} className="pointer">Click to show ...</i>
                        </>}
                    </pre>
                </div>}
                {summary.data?.summary && <div>
                    <b onClick={toggleSummary} className="pointer">Summary</b>&nbsp;
                    <ExternalLink href={awsDataLink(bucket, uuid, summary.data?.file)} />&nbsp;&nbsp;&ndash;&nbsp;&nbsp;<small><i>{summary.data?.file}</i></small><br />
                    <pre style={prestyle}>
                        { showSummary ? <>
                            { summary?.data?.summary?.map((item, index) => <>{index > 0 && <br />}{item.trim()}</>)}
                        </>:<>
                            <span onClick={toggleSummary} className="pointer">Click to show ...</span>
                        </>}
                    </pre>
                </div>}
                <b onClick={toggleDetail} className="pointer">Detail</b>&nbsp;
                { detailFile && <>
                    <ExternalLink href={awsDataLink(bucket, uuid, detailFile)} />&nbsp;&nbsp;&ndash;&nbsp;&nbsp;<small><i>{detailFile}</i></small><br />
                </>}
                <pre style={{...prestyle}}>
                    { showDetail ? <>
                        <RowDetailDetail uuid={uuid} bucket={bucket} prestyle={prestyle} setDetailFile={setDetailFile} widthRef={widthRef} />
                    </>:<>
                        <span onClick={toggleDetail} className="pointer">Click to retreive details ...</span>
                    </>}
                </pre>
                {submissionResponse.data?.submission_response && <div>
                    <b onClick={toggleSubmissionResponse} className="pointer">Submission Response</b>&nbsp;
                    <ExternalLink href={awsDataLink(bucket, uuid, submissionResponse.data?.file)} />&nbsp;&nbsp;&ndash;&nbsp;&nbsp;<small><i>{submissionResponse.data?.file}</i></small><br />
                    <pre style={prestyle}>
                        { showSubmissionResponse ? lines(submissionResponse.data.submission_response).map((item, index) => <>{index > 0 && <br />} {item}</>) : <i onClick={toggleSubmissionResponse} className="pointer">Click to show ...</i>}
                    </pre>
                </div>}
                {uploadInfo.data?.upload_info && <div>
                    <b onClick={toggleUploadInfo} className="pointer">Upload Info</b>&nbsp;
                    <ExternalLink href={awsDataLink(bucket, uuid, uploadInfo.data?.file)} />&nbsp;&nbsp;&ndash;&nbsp;&nbsp;<small><i>{uploadInfo.data?.file}</i></small><br />
                    <pre style={prestyle}>
                        { showUploadInfo ? Yaml.Format(uploadInfo.data) : <i onClick={toggleUploadInfo} className="pointer">Click to show ...</i>}
                    </pre>
                </div>}
                {validationReport.data?.validation_report && <div>
                    <b onClick={toggleValidationReport} className="pointer">Validation Report</b>&nbsp;
                    <ExternalLink href={awsDataLink(bucket, uuid, validationReport.data?.file)} />&nbsp;&nbsp;&ndash;&nbsp;&nbsp;<small><i>{validationReport.data?.file}</i></small><br />
                    <pre style={prestyle}>
                        { showValidationReport ? lines(validationReport.data.validation_report).map((item, index) => <>{index > 0 && <br />} {item}</>) : <i onClick={toggleValidationReport} className="pointer">Click to show ...</i>}
                    </pre>
                </div>}
                {manifest.data?.manifest && <div>
                    <b onClick={toggleManifest} className="pointer">Manifest</b>&nbsp;
                    <ExternalLink href={awsDataLink(bucket, uuid, manifest.data?.file)} />&nbsp;&nbsp;&ndash;&nbsp;&nbsp;<small><i>{manifest.data?.file}</i></small><br />
                    <pre style={prestyle}>
                        { showManifest ? Yaml.Format(manifest.data) : <i onClick={toggleManifest} className="pointer">Click to show ...</i>}
                    </pre>
                </div>}
                {resolution.data?.resolution && <div>
                    <b onClick={toggleResolution} className="pointer">Resolution</b>&nbsp;
                    <ExternalLink href={awsDataLink(bucket, uuid, resolution.data?.file)} />&nbsp;&nbsp;&ndash;&nbsp;&nbsp;<small><i>{resolution.data?.file}</i></small><br />
                    <pre style={prestyle}>
                        { showResolution ? Yaml.Format(resolution.data) : <i onClick={toggleResolution} className="pointer">Click to show ...</i>}
                    </pre>
                </div>}
                {traceback.data?.traceback && <div>
                    <b onClick={toggleTraceback} className="pointer">Traceback</b>&nbsp;
                    <ExternalLink href={awsDataLink(bucket, uuid, traceback.data?.file)} />&nbsp;&nbsp;&ndash;&nbsp;&nbsp;<small><i>{traceback.data?.file}</i></small><br />
                    <pre style={prestyle}>
                        { showTraceback ? tracebacks(traceback).map((item, index) => <>{index > 0 && <br />} {item}</>) : <i onClick={toggleTraceback} className="pointer">Click to show ...</i>}
                    </pre>
                </div>}
            </div>
        </td>
    </tr>
}

const RowDetailDetail = ({ uuid, bucket, prestyle, setDetailFile, widthRef }) => {
    const detail = useFetch(`/ingestion_submissions/${uuid}/detail?bucket=${bucket}`, {onDone: data => setDetailFile(data.data?.file)});
    if (detail.loading) return <StandardSpinner condition={detail.loading} label={"Loading"} style={{paddingBottom:"4pt"}} />
    return <>
        {detail.data?.detail ? <div>
            {Yaml.Format(detail.data?.detail)}
        </div>:<div>
            No details found.
        </div>}
    </>
}

export default IngestionSubmissionPage;
