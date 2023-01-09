import Char from '../utils/Char';
import Json from '../utils/Json';
import { useFetch } from '../utils/Fetch';
import { ExternalLink } from '../Components';
import Client from '../utils/Client';

const _UserInputs = [
    {
        name: "email",
        label: "Email Address",
        type: "email",
        focus: true,
        required: true
    },
    {
        name: "first_name",
        label: "First Name",
        required: true
    },
    {
        name: "last_name",
        label: "Last Name",
        required: true
    },
    {
        name: "admin",
        label: "Administrator",
        type: "boolean"
    },
    {
        name: "project",
        label: "Project",
        type: "select",
        url: "/users/projects",
    },
    {
        name: "role",
        label: "Role",
        type: "select",
        url: "/users/roles",
        dependsOn: "project"
    },
    {
        name: "institution",
        label: "Institution",
        type: "select",
        url: "/users/institutions",
        dependsOn: "institution"
    },
    {
        name: "created",
        label: "Created",
        readonly: true
    },
    {
        name: "updated",
        label: "Updated",
        readonly: true
    },
    {
        name: "uuid",
        label: "UUID",
        readonly: true
    }
];

function getProjectRole(user, project) {
    if (user?.roles) {
        for (const projectRole of user.roles) {
            if (projectRole.project === project) {
                return projectRole.role;
            }
        }
        return "";
    }
}

const PrincipalInvestigatorLine = (props) => {
    const { institution } = props;
    const institutions = useFetch("/users/institutions", { cache: true });
    const getPI = (institution) => institutions?.data?.find(item => item.id === institution)?.pi;
    return <div style={props.style}>
        { getPI(institution) && <small>
            <b>Principle Investigator {Char.RightArrow}</b> {getPI(institution).name}&nbsp;
            <ExternalLink
                href={Client.Path(`/users/${getPI(institution).uuid}`)} />
        </small> }
    </div>
}

const exports = {
    Inputs: () => Json.Clone(_UserInputs),
    GetProjectRole: getProjectRole,
    PrincipalInvestigatorLine: PrincipalInvestigatorLine
}; export default exports;
