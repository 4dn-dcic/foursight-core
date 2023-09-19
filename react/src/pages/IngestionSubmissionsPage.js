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
    if (!Type.IsInteger(bytes)) return "-";
    if (bytes <= 1000) return `${bytes} bytes`;
    const sizes = ["b", "K", "M", "G", "T"];
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return (Math.round((bytes / Math.pow(1024, i)) * 100) / 100).toFixed(1) + sizes[i];
}

const IngestionSubmissionPage = (props) => {

    const header = useHeader();
    const [ args, setArgs ] = useSearchParams();
    const bucket = () => args.get("bucket") || header?.s3?.buckets?.metadata_bucket;
    const submissions = useFetch();
    const offset = parseInt(args.get("offset")) || 0;

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
            label: "Ingestion ID",
            width: "10%"
        },
        {
            key: "modified",
            label: "Modified",
            width: "10%",
            value: (data, columnData) => DateTime.Format(columnData)
        },
        {
            key: "status",
            label: "Status",
            width: "10%",
            sortable: false,
            value: (data) => {
                let value;
                if      (data?.error)   value = "ERROR";
                else if (data?.done)    value = "Completed";
                else if (data?.started) value = "Started";
                else                    value = "Unknown";
                return <>{value}
                    { data.started && <small>
                        &nbsp;{ data.error ? <> {Char.X} </>:<> { data.done && <> {Char.Check} </>} </>}
                    </small>}
                </>
            }
        },
        {
            key: "file",
            label: "File",
            width: "10%",
            sortable: false,
            value: (data, columnData) => {
                if      (columnData?.endsWith(".json"))   return "JSON";
                else if (columnData?.endsWith(".txt"))    return "Text";
                else if (columnData?.endsWith(".xlsx"))   return "Excel";
                else if (columnData?.endsWith(".zip"))    return "ZIP";
                else if (columnData?.endsWith(".tar.gz")) return "Tarball";
                else                                      return columnData || "Unknown";
            }
        },
        {
            key: "size",
            label: "Size",
            width: "10%",
            sortable: false,
            value: (data, columnData) => {
                const file = data.files?.find(item => item.file == data.file);
                return formatFileSize(file?.size);
            }
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
        toggledIndex += offset;
        if (expanded.includes(toggledIndex)) {
            setExpanded(expanded.filter((index) => index !== toggledIndex));
        } else {
            setExpanded([...expanded, toggledIndex]);
        }
    }

    const isExpanded = (index) => {
        index += offset;
        return expanded.includes(index);
    }

    return <div className="container">
        <big style={{position:"relative", bottom:"6pt"}}>
            <b>Ingestion Submissions</b>
            <small>
            <ExternalLink href={`${header?.portal?.url}/search/?type=IngestionSubmission`} style={{marginLeft: "4pt"}} tooltip="Click to view in Portal." />
            &nbsp;&nbsp;|&nbsp;&nbsp;{bucket()}
            <ExternalLink href={awsLink(bucket())} style={{marginLeft: "4pt"}} tooltip="Click to view in AWS S3." />
            </small>
        </big>
        <PagedTableComponent
            columns={columns}
            update={update}
            data={submissions}
            initialSort={"modified.desc"}>
            { submissions.map("list", (data, index) => (
                <IngestionSubmissionRow data={data} bucket={bucket} columns={columns}
                    rowIndex={index} offset={parseInt(args.get("offset"))}
                    isExpanded={isExpanded} toggleExpanded={toggleExpanded}
                    header={header} />
            ))}
        </PagedTableComponent>
    </div>
};

const IngestionSubmissionRow = ({ data, bucket, columns, rowIndex, offset, isExpanded, toggleExpanded, header }) => {

    const uuid = data?.uuid;
    const widthRef = useRef(null);

    function value(data, column) {
        if (column.value) return column.value(data, data[column.key]);
        else if (column.key === "index") {
            const index = rowIndex + offset + 1;
            if (isExpanded(rowIndex)) return `${index}. ${Char.DownArrow}`;
            else                      return `${index}. ${Char.UpArrow}`;
        }
        else {
            return data[column.key];
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
                    {value(data, column)}
                </span>
                { column.key === "uuid" && 
                    <ExternalLink href={awsLink(bucket(), uuid)} style={{marginLeft:"6pt"}} tooltip="Click to view in AWS S3." />
                }
                { column.key === "file" && data[column.key] &&
                    <ExternalLink href={awsDataLink(bucket(), uuid, data[column.key])} style={{marginLeft:"6pt"}} tooltip="Click to view in AWS S3." />
                }
                { column.key === "portal" && <>
                    View <ExternalLink href={`${header?.portal?.url}/ingestion-submissions/${uuid}/`} tooltip="Click to view in Portal." />
                </>}
            </td>)}
        </tr>
        { isExpanded(rowIndex) &&
            <IngestionSubmissionBox data={data} uuid={uuid} bucket={bucket()} widthRef={widthRef} />
        }
    </>
}

const IngestionSubmissionBox = ({ data, uuid, bucket, widthRef }) => {

    const manifest           = useFetch(`/ingestion_submissions/${uuid}/manifest?bucket=${bucket}`);
    const resolution         = useFetch(`/ingestion_submissions/${uuid}/resolution?bucket=${bucket}`);
    const submissionResponse = useFetch(`/ingestion_submissions/${uuid}/submission_response?bucket=${bucket}`);
    const summary            = useFetch(`/ingestion_submissions/${uuid}?bucket=${bucket}`);
    const traceback          = useFetch(`/ingestion_submissions/${uuid}/traceback?bucket=${bucket}`);
    const uploadInfo         = useFetch(`/ingestion_submissions/${uuid}/upload_info?bucket=${bucket}`);
    const validationReport   = useFetch(`/ingestion_submissions/${uuid}/validation_report?bucket=${bucket}`);

    const prestyle = {
        background:"inherit",
        border:"1pt gray dotted",
        marginTop:"2pt",
    };
    const divstyle = {
        wordBreak:"break-all",
        maxWidth: widthRef?.current?.offsetWidth
    }

    function lines(lines) {
        return lines?.split("\n")?.filter(item => item?.length > 0);
    }

    function loading() {
        return summary.loading || manifest.loading || resolution.loading || traceback.loading;
    }

    return <tr>
        <td colSpan="7" ref={widthRef}>
            <div className="box lighten smallpadding margin bigmarginbottom" colSpan="9" style={divstyle}>
                <FileInfoRow data={data} uuid={uuid} bucket={bucket} manifest={manifest} traceback={traceback} loading={loading} prestyle={prestyle} />
                <SummaryRow summary={summary} uuid={uuid} bucket={bucket} prestyle={prestyle} />
                <DetailRow data={data} uuid={uuid} bucket={bucket} prestyle={prestyle} widthRef={widthRef} />
                <SubmissionResponseRow submissionResponse={submissionResponse} uuid={uuid} bucket={bucket} lines={lines} prestyle={prestyle} />
                <UploadInfoRow uploadInfo={uploadInfo} uuid={uuid} bucket={bucket} prestyle={prestyle} />
                <ValidationReportRow validationReport={validationReport} uuid={uuid} bucket={bucket} lines={lines} prestyle={prestyle} />
                <ManifestRow manifest={manifest} uuid={uuid} bucket={bucket} prestyle={prestyle} />
                <ResolutionRow resolution={resolution} uuid={uuid} bucket={bucket} prestyle={prestyle} />
                <TracebackRow traceback={traceback} uuid={uuid} bucket={bucket} lines={lines} prestyle={prestyle} />
            </div>
        </td>
    </tr>
}

const FileInfoRow = ({ data, uuid, bucket, manifest, traceback, loading, prestyle }) => {
    const heightRef = useRef(null);
    const minRows = data.files?.length + 1;

    function dataExists() {
        return manifest.data?.manifest?.parameters?.datafile_bucket &&
               manifest.data?.manifest?.parameters?.datafile_key;
    }

    function dataBucket(path) {
        return manifest.data?.manifest?.parameters?.datafile_bucket;
    }

    function dataUuid(path) {
        const parts = manifest.data?.manifest?.parameters?.datafile_key?.split("/");
        return parts[0];
    }

    function dataPath(path) {
        const parts = manifest.data?.manifest?.parameters?.datafile_key?.split("/");
        return parts[1];
    }

    return <>
        <table style={{width:"100%"}}><tr><td valign="top" width="35%">
            <b>Files</b>&nbsp;
            <ExternalLink href={awsLink(bucket, uuid)} style={{marginLeft: "4pt"}} tooltip="Click to view in AWS S3." /> <br />
            <pre style={prestyle} ref={heightRef}>
                { data.files.map((file, index) => <>
                    {index > 0 && <br />}
                    {file.file} ({formatFileSize(file.size)})<ExternalLink href={awsLink(bucket, uuid, file.file)} style={{marginLeft: "5pt"}} tooltip="Click to view in AWS S3." />
                </>)}
                { (data.files && data.files.length < minRows) && <>
                    {Array.from({length: minRows - data.files.length + 1}, (_, i) => i).map(() => <br/>)}
                </>}
            </pre>
        </td><td valign="top" style={{paddingLeft:"4pt"}}>
            <b>Info</b>&nbsp;
            <pre style={{...prestyle,height: heightRef?.current?.offsetHeight}}>
                { loading() ? <StandardSpinner condition={loading()} label={"Loading"} style={{paddingBottom:"4pt"}} /> : <>
                    <table style={{width:"100%",fontSize:"inherit"}}>
                        <tr><td style={{whiteSpace:"nowrap",width:"2%",paddingRight:"8pt"}}>Source File:</td><td><b>{manifest.data?.manifest?.filename}</b></td></tr>
                        { dataExists() && <>
                            <tr>
                                <td style={{whiteSpace:"nowrap",width:"2%",paddingRight:"8pt"}}> Target Bucket:</td>
                                <td><b>{dataBucket()}</b>
                                    <ExternalLink href={awsLink(dataBucket())} style={{marginLeft: "5pt"}} tooltip="Click to view in AWS S3." />
                                </td>
                            </tr>
                            <tr>
                                <td style={{whiteSpace:"nowrap",width:"2%",paddingRight:"8pt"}}>Target UUID:</td>
                                <td><b>{dataUuid()}</b>
                                    <ExternalLink href={awsLink(dataBucket(), dataUuid())} style={{marginLeft: "5pt"}} tooltip="Click to view in AWS S3." />
                                </td>
                            </tr>
                            <tr>
                                <td style={{whiteSpace:"nowrap",width:"2%",paddingRight:"8pt"}}>Target File:</td>
                                <td><b>{dataPath()}</b>
                                    <ExternalLink href={awsLink(dataBucket(), dataUuid(), dataPath())} style={{marginLeft: "5pt"}} tooltip="Click to view in AWS S3." />
                                </td>
                            </tr>
                        </>}
                        <tr><td style={{whiteSpace:"nowrap",width:"2%",paddingRight:"8pt"}}>Submitter:</td><td><b>{manifest.data?.manifest?.email}</b></td></tr>
                        { manifest.data?.manifest?.parameters?.consortium && 
                            <tr><td style={{whiteSpace:"nowrap",width:"2%",paddingRight:"8pt"}}>Consortium:</td><td><b>{manifest.data?.manifest?.parameters.consortium}</b></td></tr>
                        }
                        { manifest.data?.manifest?.parameters?.submission_center && 
                            <tr><td style={{whiteSpace:"nowrap",width:"2%",paddingRight:"8pt"}}>Submission Center:</td><td><b>{manifest.data?.manifest?.parameters.submission_center}</b></td></tr>
                        }
                        { manifest.data?.manifest?.parameters?.project && 
                            <tr><td style={{whiteSpace:"nowrap",width:"2%",paddingRight:"8pt"}}>Project:</td><td><b>{manifest.data?.manifest?.parameters.project}</b></td></tr>
                        }
                        { manifest.data?.manifest?.parameters?.institution && 
                            <tr><td style={{whiteSpace:"nowrap",width:"2%",paddingRight:"8pt"}}>Institution:</td><td><b>{manifest.data?.manifest?.parameters.institution}</b></td></tr>
                        }
                        { manifest.data?.manifest?.parameters?.award && 
                            <tr><td style={{whiteSpace:"nowrap",width:"2%",paddingRight:"8pt"}}>Award:</td><td><b>{manifest.data?.manifest?.parameters.award}</b></td></tr>
                        }
                        { manifest.data?.manifest?.parameters?.lab && 
                            <tr><td style={{whiteSpace:"nowrap",width:"2%",paddingRight:"8pt"}}>Lab:</td><td><b>{manifest.data?.manifest?.parameters.lab}</b></td></tr>
                        }
                        <tr><td style={{whiteSpace:"nowrap",width:"2%",paddingRight:"8pt"}}>Validate Only:</td><td><b>{manifest.data?.manifest?.parameters.validate_onlye ? "Yes" : "No"}</b></td></tr>
                        <tr><td style={{whiteSpace:"nowrap",width:"2%",paddingRight:"8pt"}}>Exceptions:</td><td><b style={{color:traceback.data?.traceback ? "red" : ""}}>{traceback.data?.traceback ? "Yes" : "No"}</b></td></tr>
                    </table>
                </> }
            </pre>
        </td></tr></table>
    </>
}

const SummaryRow = ({ summary, uuid, bucket, prestyle }) => {
    const [showSummary, setShowSummary] = useState(true); const toggleSummary = () => setShowSummary(!showSummary);
    return  <>
        {summary.data?.summary && <div>
            <b onClick={toggleSummary} className="pointer">Summary</b>&nbsp;
            <ExternalLink href={awsDataLink(bucket, uuid, summary.data?.file)} tooltip="Click to view in AWS S3." />&nbsp;&nbsp;&ndash;&nbsp;&nbsp;<small><i>{summary.data?.file}</i></small><br />
            <pre style={prestyle}>
                { showSummary ? <>
                    { summary?.data?.summary?.map((item, index) => <>{index > 0 && <br />}{item.trim()}</>)}
                </>:<>
                    <span onClick={toggleSummary} className="pointer">Click to show ...</span>
                </>}
            </pre>
        </div>}
    </>
}

const DetailRow = ({ data, uuid, bucket, prestyle, widthRef }) => {
    const [showDetail, setShowDetail] = useState(false); const toggleDetail = () => setShowDetail(!showDetail);
    const detailFileName = () => data?.files?.find(item => item.detail)?.file;
    const detailFileSize = ()  => data?.files?.find(item => item.detail)?.size;
    return <>
        { detailFileName() && <>
            <b onClick={toggleDetail} className="pointer">Detail</b>&nbsp;
            { detailFileName() && <>
                <ExternalLink href={awsDataLink(bucket, uuid, detailFileName())} tooltip="Click to view in AWS S3."/>&nbsp;&nbsp;&ndash;&nbsp;&nbsp;<small><i>{detailFileName()}</i></small><br />
            </>}
            <pre style={{...prestyle}}>
                { showDetail ? <>
                    <DetailRowDetail uuid={uuid} bucket={bucket} prestyle={prestyle} widthRef={widthRef} />
                </>:<>
                    <span onClick={toggleDetail} className="pointer">Click to retreive details ... {detailFileSize() && `(${formatFileSize(detailFileSize())})`} </span>
                </>}
            </pre>
        </>}
    </>
}

const DetailRowDetail = ({ uuid, bucket, prestyle }) => {
    const detail = useFetch(`/ingestion_submissions/${uuid}/detail?bucket=${bucket}`);
    if (detail.loading) return <StandardSpinner condition={detail.loading} label={"Loading"} style={{paddingBottom:"4pt"}} />
    return <>
        {detail.data?.detail ? <div>
            {Yaml.Format(detail.data?.detail)}
        </div>:<div>
            No details found.
        </div>}
    </>
}

const SubmissionResponseRow = ({ submissionResponse, uuid, bucket, lines, prestyle }) => {
    const [showSubmissionResponse, setShowSubmissionResponse] = useState(false);
    const toggleSubmissionResponse = () => setShowSubmissionResponse(!showSubmissionResponse);
    return <>
        {submissionResponse.data?.submission_response && <div>
            <b onClick={toggleSubmissionResponse} className="pointer">Submission Response</b>&nbsp;
            <ExternalLink href={awsDataLink(bucket, uuid, submissionResponse.data?.file)} tooltip="Click to view in AWS S3." />&nbsp;&nbsp;&ndash;&nbsp;&nbsp;<small><i>{submissionResponse.data?.file}</i></small><br />
            <pre style={prestyle}>
                { showSubmissionResponse ? lines(submissionResponse.data.submission_response).map((item, index) => <>{index > 0 && <br />} {item}</>) : <i onClick={toggleSubmissionResponse} className="pointer">Click to show ...</i>}
            </pre>
        </div>}
    </>
}

const UploadInfoRow = ({ uploadInfo, uuid, bucket, prestyle }) => {
    const [showUploadInfo, setShowUploadInfo] = useState(false); const toggleUploadInfo = () => setShowUploadInfo(!showUploadInfo);
    return <>
        {uploadInfo.data?.upload_info && <div>
            <b onClick={toggleUploadInfo} className="pointer">Upload Info</b>&nbsp;
            <ExternalLink href={awsDataLink(bucket, uuid, uploadInfo.data?.file)} tooltip="Click to view in AWS S3." />&nbsp;&nbsp;&ndash;&nbsp;&nbsp;<small><i>{uploadInfo.data?.file}</i></small><br />
            <pre style={prestyle}>
                { showUploadInfo ? Yaml.Format(uploadInfo.data.upload_info) : <i onClick={toggleUploadInfo} className="pointer">Click to show ...</i>}
            </pre>
        </div>}
    </>
}

const ValidationReportRow = ({ validationReport, uuid, bucket, lines, prestyle }) => {
    const [showValidationReport, setShowValidationReport] = useState(true);
    const toggleValidationReport = () => setShowValidationReport(!showValidationReport);
    return <>
        {validationReport.data?.validation_report && <div>
            <b onClick={toggleValidationReport} className="pointer">Validation Report</b>&nbsp;
            <ExternalLink href={awsDataLink(bucket, uuid, validationReport.data?.file)} tooltip="Click to view in AWS S3." />&nbsp;&nbsp;&ndash;&nbsp;&nbsp;<small><i>{validationReport.data?.file}</i></small><br />
            <pre style={prestyle}>
                { showValidationReport ? lines(validationReport.data.validation_report).map((item, index) => <>{index > 0 && <br />} {item}</>) : <i onClick={toggleValidationReport} className="pointer">Click to show ...</i>}
            </pre>
        </div>}
    </>
}

const ManifestRow = ({ manifest, uuid, bucket, prestyle }) => {
    const [showManifest, setShowManifest] = useState(false);
    const toggleManifest = () => setShowManifest(!showManifest);
    return <>
        {manifest.data?.manifest && <div>
            <b onClick={toggleManifest} className="pointer">Manifest</b>&nbsp;
            <ExternalLink href={awsDataLink(bucket, uuid, manifest.data?.file)} tooltip="Click to view in AWS S3." />&nbsp;&nbsp;&ndash;&nbsp;&nbsp;<small><i>{manifest.data?.file}</i></small><br />
            <pre style={prestyle}>
                { showManifest ? Yaml.Format(manifest.data.manifest) : <i onClick={toggleManifest} className="pointer">Click to show ...</i>}
            </pre>
        </div>}
    </>
}

const ResolutionRow = ({ resolution, uuid, bucket, prestyle }) => {
    const [showResolution, setShowResolution] = useState(false); const toggleResolution = () => setShowResolution(!showResolution);
    return <>
        {resolution.data?.resolution && <div>
            <b onClick={toggleResolution} className="pointer">Resolution</b>&nbsp;
            <ExternalLink href={awsDataLink(bucket, uuid, resolution.data?.file)} tooltip="Click to view in AWS S3." />&nbsp;&nbsp;&ndash;&nbsp;&nbsp;<small><i>{resolution.data?.file}</i></small><br />
            <pre style={prestyle}>
                { showResolution ? Yaml.Format(resolution.data.resolution) : <i onClick={toggleResolution} className="pointer">Click to show ...</i>}
            </pre>
        </div>}
    </>
}

const TracebackRow = ({ traceback, uuid, bucket, lines, prestyle }) => {
    const [showTraceback, setShowTraceback] = useState(true); const toggleTraceback = () => setShowTraceback(!showTraceback);
    const tracebacks = (traceback) => lines(traceback?.data?.traceback);
    return <>
        {traceback.data?.traceback && <div>
            <b onClick={toggleTraceback} className="pointer">Traceback</b>&nbsp;
            <ExternalLink href={awsDataLink(bucket, uuid, traceback.data?.file)} tooltip="Click to view in AWS S3." />&nbsp;&nbsp;&ndash;&nbsp;&nbsp;<small><i>{traceback.data?.file}</i></small><br />
            <pre style={prestyle}>
                { showTraceback ? tracebacks(traceback).map((item, index) => <>{index > 0 && <br />} {item}</>) : <i onClick={toggleTraceback} className="pointer">Click to show ...</i>}
            </pre>
        </div>}
    </>
}

export default IngestionSubmissionPage;
