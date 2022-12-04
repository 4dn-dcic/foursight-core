import Json from '../utils/Json';

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
/*
 * TODO ...
 *
    {
        name: "project",
        label: "Project",
        type: "boolean"
    },
    {
        name: "institution",
        label: "Institution",
        type: "boolean"
    },
*/
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
