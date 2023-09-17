import Char from '../utils/Char';
import DateTime from '../utils/DateTime';
import { ExternalLink } from '../Components';
import PagedTableComponent from '../PagedTableComponent';
import Str from '../utils/Str';
import Type from '../utils/Type';
import useHeader from '../hooks/Header';
import useFetch from '../hooks/Fetch';
import { useState } from 'react';

import { useParams, useSearchParams } from 'react-router-dom';

const IngestionSubmissionPage = (props) => {

    const header = useHeader();
    const submissions = useFetch("/ingestion_submissions?bucket=smaht-production-application-metadata-bundles");
    const [ args, setArgs ] = useSearchParams();

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
            url: `/ingestion_submissions?bucket=smaht-production-application-metadata-bundles&limit=${limit}&offset=${offset}&sort=${sort}`,
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
        <b style={{position:"relative", left:"2pt",bottom:"4pt"}}>Ingestion Submissions</b>
        <PagedTableComponent
            columns={columns}
            update={update}
            data={submissions}
            initialSort={"modified.desc"}>
            { submissions.map("list", (data, index) => (
                <RowContent data={data} columns={columns}
                    rowIndex={index} offset={parseInt(args.get("offset"))}
                    isExpanded={isExpanded} toggleExpanded={toggleExpanded} />
            ))}
        </PagedTableComponent>
    </div>
};

const RowContent = ({ data, columns, rowIndex, offset, isExpanded, toggleExpanded }) => {

    const bucket = "smaht-production-application-metadata-bundles";
    const uuid = data?.uuid;
    const submission = useFetch(`/ingestion_submissions/${uuid}/data/info?bucket=${bucket}`);

    function valueOf(data, column) {
        const column_data = data[column.key];
        if (column.type === "datetime") {
            return DateTime.Format(column_data);
        }
        else if (column.type === "boolean") {
            return column_data ? "Yes" : "No";
        }
        else if (column.key === "status") {
            if (data?.done) {
                return "Completed";
            }
            else if (data?.error) {
                return "Error";
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
            return submission.data?.size;
        }
        else {
            return column_data;
        }
    }

    function awsLink() {
        const region = "us-east-1";
        return `https://s3.console.aws.amazon.com/s3/buckets/${bucket}?region=${region}&prefix=${uuid}/&showversions=false`;
    }

    function awsDataLink(file) {
        const region = "us-east-1";
        return `https://s3.console.aws.amazon.com/s3/object/${bucket}?region=${region}&prefix=${uuid}/${file}`
    }

    function tdstyle(column) {
        return {
            width: column?.width,
            fontSize: column?.size,
            textAlign: column?.align,
            paddingRight:"16pt",
            whiteSpace: "nowrap",
            cursor: "pointer"
        };
    };

    return <>
        <tr>
            { columns.map((column, index) => <td style={tdstyle(column)} onClick={() => toggleExpanded(rowIndex)}>
                {valueOf(data, column)}
                { column.key === "uuid" && 
                    <ExternalLink href={awsLink()} style={{marginLeft:"6pt"}} />
                }
                { column.key === "file" && 
                    <ExternalLink href={awsDataLink(submission.data?.file)} style={{marginLeft:"6pt"}} />
                }
            </td>)}
        </tr>
        { isExpanded(rowIndex) &&
            <RowDetailContent uuid={uuid} />
        }
    </>
}

const RowDetailContent = ({ uuid }) => {
    const bucket = "smaht-production-application-metadata-bundles";
    const summary = useFetch(`/ingestion_submissions/${uuid}?bucket=${bucket}`);
    const detail = useFetch(`/ingestion_submissions/${uuid}/detail?bucket=${bucket}`);
    const manifest = useFetch(`/ingestion_submissions/${uuid}/manifest?bucket=${bucket}`);
    const resolution = useFetch(`/ingestion_submissions/${uuid}/resolution?bucket=${bucket}`);
    const traceback = useFetch(`/ingestion_submissions/${uuid}/traceback?bucket=${bucket}`);
    const prestyle= {
        background:"inherit",
        border:"1pt gray dotted",
        marginTop:"2pt"
    };
    return <tr>
        <td></td>
        <td colSpan="5">
            <div className="box smallpadding margin bigmarginbottom" colSpan="9" style={{}}>
                {summary.data?.summary && <div>
                    <b>Summary</b>:<br />
                    <pre style={prestyle}>
                        { summary.data?.summary?.map(item => <>
                            {item} <br />
                        </>)}
                    </pre>
                </div>}
                {detail.data?.detail && <div>
                    <b>Detail</b>:<br />
                    {JSON.stringify(detail.data)}
                </div>}
                {manifest.data?.manifest && <div>
                    <b>Manifest</b>:<br />
                    {JSON.stringify(manifest.data)}
                </div>}
                {resolution.data?.resolution && <div>
                    <b>Resolution</b>:<br />
                    {JSON.stringify(resolution.data)}
                </div>}
                {traceback.data?.traceback && <div>
                    <b>Traceback</b>:<br />
                    <pre style={prestyle}>
                        { traceback.data?.traceback?.split("\n").map(item => <>
                            {item}<br/>
                        </>)}
                    </pre>
                </div>}
            </div>
        </td>
    </tr>
}

export default IngestionSubmissionPage;
