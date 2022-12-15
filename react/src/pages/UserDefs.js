import Json from '../utils/Json';
import Server from '../utils/Server';

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
        url: Server.Url("/users/projects")
    },
    {
        name: "institution",
        label: "Institution",
        type: "select",
        url: Server.Url("/users/institutions")
    },
    {
        name: "created",
        label: "Created",
        readonly: true
    },
    {
        name: "modified",
        label: "Modified",
        readonly: true
    },
    {
        name: "uuid",
        label: "UUID",
        readonly: true
    }
];

const exports = {
    Inputs: () => Json.Clone(_UserInputs)
}; export default exports;
