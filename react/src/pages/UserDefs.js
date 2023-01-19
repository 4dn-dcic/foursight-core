import { useState } from 'react';
import Char from '../utils/Char';
import Client from '../utils/Client';
import Env from '../utils/Env';
import { ExternalLink } from '../Components';
import Json from '../utils/Json';
import useHeader from '../hooks/Header';
import useUserMetadata from '../hooks/UserMetadata';

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
        name: "status",
        label: "Status",
        type: "select",
        url: "/users/statuses",
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

const useUserInputs = () => {
    const header = useHeader();
    let inputs = Env.IsFoursightFourfront(header)
                 ? _UserInputs.filter(input => (input.name !== "project") &&
                                               (input.name !== "role") &&
                                               (input.name !== "institution"))
                 : _UserInputs;
    return useState(Json.Clone(Json.Clone(inputs)));
}

const PrincipalInvestigatorLine = (props) => {
    const { institution } = props;
    const userMetadata = useUserMetadata();
    return <div style={props.style}>
        { userMetadata.principleInvestigator(institution) && <small>
            <b>Principle Investigator {Char.RightArrow}</b> {userMetadata.principleInvestigator(institution)?.name}&nbsp;
            <ExternalLink
                href={Client.Path(`/users/${userMetadata.principleInvestigator(institution)?.uuid}`)} />
        </small> }
    </div>
}

const exports = {
    PrincipalInvestigatorLine: PrincipalInvestigatorLine,
    useUserInputs: useUserInputs
}; export default exports;
