import { useState } from 'react';
import Char from '../utils/Char';
import Client from '../utils/Client';
import Date from '../utils/Date';
import DateTime from '../utils/DateTime';
import Env from '../utils/Env';
import { Link } from '../Components';
import useFetch from '../hooks/Fetch';
import { ExternalLink } from '../Components';
import Json from '../utils/Json';
import Str from '../utils/Str';
import Time from '../utils/Time';
import Tooltip from '../components/Tooltip';
import Type from '../utils/Type';
import useHeader from '../hooks/Header';

const _UserInputsCommon = [
    {
        key: "email",
        label: "Email Address",
        type: "email",
        focus: true,
        required: true,
        uiList: (user) => <>
            <u>{user.name}</u> <br />
            <Link to={"/users/" + user.email}><b>{user.email}</b></Link> <br />
            <small id="{user.uuid}" style={{cursor:"copy"}}>{user.uuid}</small>
        </>
    },
    {
        key: "first_name",
        label: "First Name",
        required: true,
        pages: [ "view", "edit", "create" ]
    },
    {
        key: "last_name",
        label: "Last Name",
        required: true,
        pages: [ "view", "edit", "create" ]
    },
    {
        key: "group_titles",
        label: "Groups",
        pages: [ "list", "view" ]
    },
    {
        key: "admin",
        label: "Administrator",
        type: "boolean",
        pages: [ "edit" ]
    },
    {
        key: "status",
        label: "Status",
        type: "select",
        url: "/users/statuses",
        xmapWithUser: true,
        map: (value, user) => user.status_title,
        pages: [ "list", "view", "edit" ]
    },
    {
        key: "created",
        label: "Created",
        type: "datetime",
        readonly: true,
        map: (value, user) => DateTime.Format(value),
        pages: [ "list", "view", "edit" ]
    },
    {
        key: "updated",
        label: "Updated",
        type: "datetime",
        readonly: true,
        map: (value, user) => DateTime.Format(value),
        pages: [ "list", "view", "edit" ]
    },
    {
        key: "uuid",
        label: "UUID",
        readonly: true,
        readonlyOverridableOnCreate: true,
        readonlyOverridableOnCreateMessage: "Warning: Only set UUID if you know what you are doing.",
        pages: [ "view", "edit" ]
    }
];

const _UserInputs = [
    {
        key: "email",
        label: "Email Address",
        type: "email",
        focus: true,
        required: true
    },
    {
        key: "first_name",
        label: "First Name",
        required: true,
    },
    {
        key: "last_name",
        label: "Last Name",
        required: true,
    },
    {
        key: "group_titles",
        label: "Groups",
        pages: [ "view" ]
    },
    {
        key: "admin",
        label: "Administrator",
        type: "boolean",
        pages: [ "edit" ]
    },
    {
        key: "role",
        label: "Role",
        type: "select",
        url: "/users/roles",
        dependsOn: "project",
        flavors: [Env.FoursightTitleCgap],
        pages: [ "list", "view", "edit" ]
    },
    {
        key: "institution",
        label: "Institution",
        type: "select",
        url: "/users/institutions",
        dependsOn: "institution",
        subComponent: (institution) => <PrincipalInvestigatorLine institution={institution} />,
        flavors: [Env.FoursightTitleCgap],
        pages: [ "list", "view", "edit" ]
    },
    {
        key: "project",
        label: "Project",
        type: "select",
        url: "/users/projects",
        flavors: [Env.FoursightTitleCgap],
        pages: [ "list", "view", "edit" ]
    },
    {
        key: "award",
        label: "Award",
        type: "select",
        url: "/users/awards",
        dependsOn: "award",
        flavors: [Env.FoursightTitleFourfront],
        pages: [ "list", "view", "edit" ]
    },
    {
        key: "lab",
        label: "Lab",
        type: "select",
        url: "/users/labs",
        flavors: [Env.FoursightTitleFourfront],
        pages: [ "list", "view", "edit" ]
    },
    {
        key: "consortium",
        label: "Consortium",
        type: "select",
        url: "/users/consortia",
        dependsOn: "consortia",
        flavors: [Env.FoursightTitleSmaht],
        pages: [ "list", "view", "edit" ]
    },
    {
        key: "submission_center",
        label: "Submission Center",
        type: "select",
        url: "/users/submission_centers",
        flavors: [Env.FoursightTitleSmaht],
        pages: [ "list", "view", "edit" ]
    },
    {
        key: "status",
        label: "Status",
        type: "select",
        url: "/users/statuses",
        pages: [ "list", "view", "edit" ]
    },
    {
        key: "created",
        label: "Created",
        readonly: true,
        map: (value, user) => DateTime.Format(value),
        pages: [ "list", "view", "edit" ]
    },
    {
        key: "updated",
        label: "Updated",
        readonly: true,
        map: (value, user) => DateTime.Format(value),
        pages: [ "list", "view", "edit" ]
    },
    {
        key: "uuid",
        label: "UUID",
        readonly: true,
        readonlyOverridableOnCreate: true,
        readonlyOverridableOnCreateMessage: "Warning: Only set UUID if you know what you are doing.",
        pages: [ "list", "view", "edit" ]
    }
];

const RolesBox = (props) => {
    return <div className="box lighten" style={{marginTop:"2pt",marginBottom:"2pt"}}>
        <table style={{width:"100%",fontSize:"small",marginTop:"-3pt",marginBottom:"-2pt"}}><tbody>
            <tr>
                <td> <b>Project</b> </td>
                <td style={{paddingLeft:"8pt"}}> <b>Role</b> </td>
            </tr>
            <tr><td style={{height:"2pt"}} /></tr>
            <tr><td style={{height:"1px",background:"var(--box-fg)"}} colSpan="2" ></td></tr>
            <tr><td style={{height:"2pt"}} /></tr>
            { props.user.roles.sort((a,b) => a.project > b.project ? 1 : (a.project < b.project ? -1 : 0)).map(role => <tr key={role.project}>
                <td style={{width:"5%",whiteSpace:"nowrap"}}>
                    {props.affiliationInfo.projectTitle(role.project)}
                </td>
                <td style={{paddingLeft:"8pt",whiteSpace:"nowrap"}}>
                    {props.affiliationInfo.roleTitle(role.role)}
                </td>
            </tr>)}
        </tbody></table>
    </div>
}

const PrincipalInvestigatorLine = (props) => {
    const userInfo = useUserInfo();
    const affiliationInfo = userInfo.useAffiliationInfo();
    if (!affiliationInfo.principleInvestigator) return;
    return <div style={props.style}>
        { affiliationInfo.principleInvestigator(props.institution) && <small>
            <b>Principle Investigator {Char.RightArrow}</b> {affiliationInfo.principleInvestigator(props.institution)?.name}&nbsp;
            <ExternalLink
                href={Client.Path(`/users/${affiliationInfo.principleInvestigator(props.institution)?.uuid}`)} />
        </small> }
    </div>
}

const _userInfo = {
    [Env.FoursightTitleCgap]: {
        inputs: function () {
            const affiliationInfo = _userInfo[Env.FoursightTitleCgap].useAffiliationInfo();
            const inputsAdditional = [
                { label: "Role", key: "role", type: "select",
                  url: "/users/roles",
                  dependsOn: "project",
                  xmapWithUser: true,
                  map: (value, user) => affiliationInfo.userRoleTitle(user, user.project) },
                { label: "Project", key: "project", type: "select",
                  url: "/users/projects",
                  dependsOn: "project",
                  map: (value, user) => affiliationInfo.projectTitle(value) },
                { label: "Institution", key: "institution", type: "select",
                  url: "/users/institutions",
                  dependsOn: "institution",
                  map: (value, user) => affiliationInfo.institutionTitle(value),
                  subComponent: (institution) => <PrincipalInvestigatorLine institution={institution} /> },
                { label: "Roles", key: "roles",
                  ui: (user) => <RolesBox affiliationInfo={affiliationInfo} user={user} />,
                  toggle: true,
                  pages: [ "view" ] }
            ];
            const inputs = [ ..._UserInputsCommon ];
            const index = inputs.findIndex((item) => item.key === "status");
            inputs.splice(index, 0, ...inputsAdditional);
            return inputs;
        },
/*
        affiliations: function (edit = false) {
            const affiliationInfo = _userInfo[Env.FoursightTitleCgap].useAffiliationInfo();
            return [
                { label: "Role", key: "project", xmapWithUser: true,
                  //map: value => affiliationInfo.roleTitle(value) },
                  map: (user, value) => affiliationInfo.userRoleTitle(user, value) },
                { label: "Project", key: "project",
                  map: value => affiliationInfo.projectTitle(value) },
                { label: "Institution", key: "institution",
                  map: value => affiliationInfo.institutionTitle(value),
                  subComponent: (institution) => <PrincipalInvestigatorLine institution={institution} /> },
                { label: "Roles", key: "roles",
                  ui: (user) => <RolesBox affiliationInfo={affiliationInfo} user={user} />, toggle: true,
                  flavors: [Env.FoursightTitleCgap],
                  pages: [ "view", "edit" ] }
            ];
        },
*/
        useAffiliationInfo: function () {
            const projects = useFetch("/users/projects", { cache: true });
            const roles = useFetch("/users/roles", { cache: true });
            const institutions = useFetch("/users/institutions", { cache: true });
            const response = {
                projectTitle: (id) => projects.data?.find(item => item.id === id)?.title || "",
                roleTitle: (id) => roles.data?.find(item => item.id === id)?.title || "",
                institutionTitle: (id) => institutions.data?.find(item => item.id === id)?.title || "",
                userRole: (user, projectId) => user.roles?.find(item => item.project === projectId)?.role || "",
                principleInvestigator: (institutionId) => {
                    return institutions?.data?.find(item => item.id === institutionId)?.pi
                }
            }
            response.userRoleTitle = (user, projectId) => response.roleTitle(response.userRole(user, projectId)) || "";
            return response;
        },
        AffiliationTableRows: (props) => {
            const user = props.user;
            const tdStyle = props.tdStyle;
            const affiliationInfo = _userInfo[Env.FoursightTitleCgap].useAffiliationInfo();
            return <>
                <td style={tdStyle}>
                    <span id={`tooltip-users-role-${user.email}`}>
                        {affiliationInfo.userRoleTitle(user, user.project) || Char.EmptySet}
                        {user.roles?.length > 1 && <small>&nbsp;({user.roles?.length})</small>}
                    </span>
                    <Tooltip id={`tooltip-users-role-${user.email}`} position="bottom" size="small"
                             text={`Role: ${affiliationInfo.userRole(user, user.project)}${user.roles?.length > 1 ? `. Total: ${user.roles.length}` : ""}`} />
                </td>
                <td style={tdStyle}>
                    <span id={`tooltip-users-project-${user.email}`}>{affiliationInfo.projectTitle(user.project) || Char.EmptySet}</span>
                    <Tooltip id={`tooltip-users-project-${user.email}`} position="bottom" size="small" text={`Project: ${user.project}`} />
                </td>
                <td style={tdStyle}>
                    <span id={`tooltip-users-institution-${user.email}`}>{affiliationInfo.institutionTitle(user.institution) || Char.EmptySet}</span>
                    <Tooltip id={`tooltip-users-institution-${user.email}`} position="bottom" size="small" text={`Institution: ${user.institution}`} />
                </td>
            </>
        }
    },
    [Env.FoursightTitleFourfront]: {
        affiliations: [
            { label: "Award", key: "award" },
            { label: "Lab", key: "lab" },
        ],
        useAffiliationInfo: function () {
            const awards = useFetch("/users/awards", { cache: true });
            const labs = useFetch("/users/labs", { cache: true });
            const response = {
                awardTitle: (id) => awards.data?.find(item => item.id === id)?.title || "",
                labTitle: (id) => labs.data?.find(item => item.id === id)?.title || "",
            }
            return response;
        },
        AffiliationTableRows: function (props) {
            const user = props.user;
            const tdStyle = props.tdStyle;
            const affiliationInfo = _userInfo[Env.FoursightTitleFourfront].useAffiliationInfo();
            return <>
                <td style={tdStyle}>
                    <span id={`tooltip-users-award-${user.email}`}>{affiliationInfo.awardTitle(user.award) || Char.EmptySet}</span>
                    <Tooltip id={`tooltip-users-award-${user.email}`} position="bottom" size="small" text={`Award: ${user.award}`} />
                </td>
                <td style={tdStyle}>
                    <span id={`tooltip-users-lab-${user.email}`}>{affiliationInfo.labTitle(user.lab) || Char.EmptySet}</span>
                    <Tooltip id={`tooltip-users-lab-${user.email}`} position="bottom" size="small" text={`Lab: ${user.lab}`} />
                </td>
            </>
        }
    },
    [Env.FoursightTitleSmaht]: {
        normalize: function (user) {
            if (Type.IsArray(user.submission_centers) && (user.submission_centers.length > 0)) {
                user.submission_center = user.submission_centers[0];
            }
            if (Type.IsArray(user.consortia) && (user.consortia.length > 0)) {
                user.consortium = user.consortia[0];
            }
        },
        affiliations: function (edit = false) {
            const affiliationInfo = _userInfo[Env.FoursightTitleSmaht].useAffiliationInfo();
            return [
                { label: "Consortium", key: "consortium", key: "consortium",
                  map: (value, user) => affiliationInfo.consortiumTitle(value) },
                { label: "Submission Center", key: "submission_center", key: "submission_center",
                  map: (value, user) => affiliationInfo.submissionCenterTitle(value) }
            ];
        },
        useAffiliationInfo: function () {
            const consortia = useFetch("/users/consortia", { cache: true });
            const submissionCenters = useFetch("/users/submission_centers", { cache: true });
            return {
                consortiumTitle: (id) => consortia.data?.find(item => item.id === id)?.title || "",
                submissionCenterTitle: (id) => submissionCenters.data?.find(item => item.id === id)?.title || "",
            }
        },
        AffiliationTableRows: function (props) {
            const user = props.user;
            const tdStyle = props.tdStyle;
            const affiliationInfo = _userInfo[Env.FoursightTitleSmaht].useAffiliationInfo();
            return <>
                <td style={tdStyle}>
                    <span id={`tooltip-users-consortium-${user.email}`}>{affiliationInfo.consortiumTitle(user.consortium) || Char.EmptySet}</span>
                    <Tooltip id={`tooltip-users-consortium-${user.email}`} position="bottom" size="small" text={`Consortium: ${user.consortium}`} />
                </td>
                <td style={tdStyle}>
                    <span id={`tooltip-users-submission-center-${user.email}`}>{affiliationInfo.submissionCenterTitle(user.submission_center) || Char.EmptySet}</span>
                    <Tooltip id={`tooltip-users-submission-center-${user.email}`} position="bottom" size="small" text={`Submission Center: ${user.submission_center}`} />
                </td>
            </>
        },
        UserAffiliationTableRows: function (props) {
        }
    }
};

const useUserInfo = () =>  {
    const header = useHeader();
    const userInfo = _userInfo[Env.FoursightFlavorTitle(header)];
    const statuses = useFetch("/users/statuses", { cache: false });
    userInfo.normalizeUser = (user) => {
        user.name = `${user.first_name} ${user.last_name}`.trim();
        if (Str.HasValue(user.title) && user.title !== user.key) {
            user.name = user.title;
        }
        user.group_titles = Str.StringArrayToCommaSeparatedListOfTitles(user.groups);
        user.status_title = statuses.data?.find(item => item.id === user.status)?.title;
        if (userInfo.normalize) {
            userInfo.normalize(user);
        }
    }
    userInfo.normalizeUsers = (users) => {
        for (const user of users) {
            userInfo.normalizeUser(user);
        }
    };
    return userInfo;
}

const useUserInputs = (page) => {
    const info = useUserInfo();
    let inputs = info.inputs();
    if (Str.HasValue(page)) {
        inputs = inputs.filter(item => !item.pages ||
                               item.pages === "all" ||
                               item.pages == page ||
                               item.pages.includes(page));
    }
    return inputs;
}

const exports = {
    PrincipalInvestigatorLine: PrincipalInvestigatorLine,
    useUserInputs: useUserInputs,
    useUserInfo: useUserInfo
}; export default exports;
