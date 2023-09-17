import DateTime from '../utils/DateTime';
import { ExternalLink } from '../Components';
import PagedTableComponent from '../PagedTableComponent';
import Str from '../utils/Str';
import Type from '../utils/Type';
import useHeader from '../hooks/Header';
import useFetch from '../hooks/Fetch';

import { useParams, useSearchParams } from 'react-router-dom';

const IngestionSubmissionPage = (props) => {

    const header = useHeader();
    const submissions = useFetch("/ingestion_submissions?bucket=smaht-production-application-metadata-bundles");
    const [ args, setArgs ] = useSearchParams();

    const columns =  [
        {
            key: "index",
            label: "",
            width: "1%",
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

    return <div className="container">
        <b style={{position:"relative", left:"2pt",bottom:"4pt"}}>Ingestion Submissions</b>
        <PagedTableComponent
            columns={columns}
            update={update}
            data={submissions}
            initialSort={"modified.desc"}>
            { submissions.map("list", (data, index) => (
                <tr>
                    <RowContent data={data} columns={columns} row_index={index} />
                </tr>
            ))}
        </PagedTableComponent>
    </div>
};

const RowContent = ({ data, columns, row_index }) => {

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
            return `${row_index + 1}.`;
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

    return <>
        { columns.map((column, index) => <td style={{width: column?.width, fontSize: column?.size, textAlign: column?.align, paddingRight:"16pt", whiteSpace: "nowrap"}}>
            {valueOf(data, column)}
            { column.key === "uuid" && 
                <ExternalLink href={awsLink()} style={{marginLeft:"6pt"}} />
            }
            { column.key === "file" && 
                <ExternalLink href={awsDataLink(submission.data?.file)} style={{marginLeft:"6pt"}} />
            }
        </td>)}
    </>
}

const ErrorContent = ({ uuid }) => {
    return <>
     </>
}

export default IngestionSubmissionPage;
