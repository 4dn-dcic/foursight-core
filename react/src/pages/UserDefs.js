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

const CommonInputs = [
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
        pages: [ "edit", "create" ]
    },
    {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        url: "/users/statuses",
        map: (value, user) => user.status_title,
        pages: [ "list", "view", "edit" , "create" ]
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
        type: "uuid",
        readonly: true,
        readonlyOverridableOnCreate: true,
        readonlyOverridableOnCreateMessage: "Warning: Only set UUID if you know what you are doing.",
        pages: [ "view", "edit", "create" ]
    }
];

function Inputs(additionalInputs) {
    const inputs = [ ...CommonInputs ];
    const index = inputs.findIndex((item) => item.key === "status");
    inputs.splice(index, 0, ...additionalInputs);
    return inputs;
}

const UserInfo = {
    [Env.FoursightTitleCgap]: {
        inputs: function () {
            const affiliationInfo = UserInfo[Env.FoursightTitleCgap].useAffiliationInfo();
            const inputs = [
                { label: "Role", key: "role", type: "select", sortable: false,
                  url: "/users/roles",
                  map: (value, user) => affiliationInfo.roleTitle(value) },
                { label: "Roles", key: "roles", sortable: false,
                  ui: (user) => <RolesBox affiliationInfo={affiliationInfo} user={user} />, toggle: true,
                  pages: [ "view" ] },
                { label: "Project", key: "project", type: "select", sortable: false,
                  url: "/users/projects",
                  map: (value, user) => affiliationInfo.projectTitle(value) },
                { label: "Institution", key: "institution", type: "select", sortable: false,
                  url: "/users/institutions",
                  map: (value, user) => affiliationInfo.institutionTitle(value),
                  subComponent: (institution) => <PrincipalInvestigatorLine institution={institution} /> }
            ];
            return Inputs(inputs);
        },
        useAffiliationInfo: function () {
            const projects = useFetch("/users/projects", { cache: true });
            const roles = useFetch("/users/roles", { cache: true });
            const institutions = useFetch("/users/institutions", { cache: true });
            const response = {
                projectTitle: (id) => projects.data?.find(item => item.id === id)?.title || "",
                roleTitle: (id) => roles.data?.find(item => item.id === id)?.title || "",
                userRole: (user, projectId) => user.roles?.find(item => item.project === projectId)?.role || "",
                institutionTitle: (id) => institutions.data?.find(item => item.id === id)?.title || "",
                principleInvestigator: (institutionId) => {
                    return institutions?.data?.find(item => item.id === institutionId)?.pi
                }
            }
            return response;
        },
        normalize: function (user) {
            user.role = user.roles?.find(role => role.project === user.project)?.role || "";
        },
        normalizeForUpdate: function (user, values) {
            if (values.project === "-") values.project = null;
            if (values.institution === "-") values.institution = null;
            if (values.role === "-") values.role = null;
            return { ...values, "roles": user.get("roles") };
        }
    },
    [Env.FoursightTitleFourfront]: {
        inputs: function () {
            const affiliationInfo = UserInfo[Env.FoursightTitleFourfront].useAffiliationInfo();
            const inputs = [
                { label: "Award", key: "award", type: "select", sortable: false,
                  url: "/users/awards",
                  map: (value, user) => affiliationInfo.awardTitle(value) },
                { label: "Lab", key: "lab", type: "select", required: true, sortable: false,
                  url: "/users/labs",
                  map: (value, user) => affiliationInfo.labTitle(value) }
            ];
            return Inputs(inputs);
        },
        useAffiliationInfo: function () {
            const awards = useFetch("/users/awards", { cache: true });
            const labs = useFetch("/users/labs", { cache: true });
            const response = {
                awardTitle: (id) => awards.data?.find(item => item.id === id)?.title || "",
                labTitle: (id) => labs.data?.find(item => item.id === id)?.title || "",
            }
            return response;
        },
        normalizeForUpdate: function (user, values) {
            if (values.award === "-") values.award = null;
            if (values.lab === "-") values.lab = null;
            // TODO: Award not allowed on update?
            delete values["award"];
            return { ...values };
        }
    },
    [Env.FoursightTitleSmaht]: {
        inputs: function () {
            const affiliationInfo = UserInfo[Env.FoursightTitleSmaht].useAffiliationInfo();
            const inputs = [
                { label: "Consortium", key: "consortium", type: "select", sortable: false,
                  url: "/users/consortia",
                  map: (value, user) => affiliationInfo.consortiumTitle(value) },
                { label: "Submission Center", key: "submission_center", type: "select", sortable: false,
                  url: "/users/submission_centers",
                  map: (value, user) => affiliationInfo.submissionCenterTitle(value) }
            ];
            return Inputs(inputs);
        },
        useAffiliationInfo: function () {
            const consortia = useFetch("/users/consortia", { cache: true });
            const submissionCenters = useFetch("/users/submission_centers", { cache: true });
            return {
                consortiumTitle: (id) => consortia.data?.find(item => item.id === id)?.title || "",
                submissionCenterTitle: (id) => submissionCenters.data?.find(item => item.id === id)?.title || "",
            }
        },
        normalize: function (user) {
            if (Type.IsArray(user.submission_centers) && (user.submission_centers.length > 0)) {
                user.submission_center = user.submission_centers[0];
            }
            if (Type.IsArray(user.consortia) && (user.consortia.length > 0)) {
                user.consortium = user.consortia[0];
            }
        },
        normalizeForUpdate: function (user, values) {
            if (values.consortium === "-") values.consortium = null;
            if (values.submission_center === "-") values.submission_center = null;
            values = {
                ...values,
                "consortia": values.consortium ? [values.consortium] : [],
                "submission_centers": values.submission_center ? [values.submission_center] : [],
                "roles": user.get("roles")
            };
            delete values["consortium"]
            delete values["submission_center"]
            return values;
        }
    }
};

const RolesBox = (props) => {
    if (!props.user?.roles) return;
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

const useUserInfo = () =>  {
    const header = useHeader();
    let flavor = Env.FoursightTitle(header);
    if (flavor == Env.FoursightTitleUnknown) {
        flavor = Env.FoursightTitleFourfront;
    }
    const userInfo = UserInfo[flavor];
    const statuses = useFetch("/users/statuses", { cache: false });
    userInfo.normalizeUser = (user) => {
        user.name = `${user.first_name} ${user.last_name}`.trim();
        if (Str.HasValue(user.title) && user.title !== user.key) {
            user.name = user.title;
        }
        user.admin = user.groups?.includes("admin") ? true : false;
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
    userInfo.normalizeUserForEdit = (user, inputs) => {
        userInfo.normalizeUser(user)
        for (const input of inputs) {
            if (input.type === "datetime") {
                input.value = DateTime.Format(user[input.key]);
            }
            else {
                input.value = user[input.key];
            }
        }
        return [...inputs];
    };
    userInfo.normalizeUserForUpdate = (user, values) => {
        let groupsWithoutAdmin = user.get("groups")?.filter(group => group !== "admin") || [];
        if (values.admin) {
            values = {...values, "groups": [ ...groupsWithoutAdmin, "admin" ] }
        }
        else {
            values = {...values, "groups": groupsWithoutAdmin }
        }
        delete values["admin"]
        if (values.status === "-") values.status = null;
        if (userInfo.normalizeForUpdate) {
            values = userInfo.normalizeForUpdate(user, values);
        }
        return values;
    }
    return userInfo;
}

const useUserInputs = (page) => {
    let inputs = useUserInfo().inputs();
    if (Str.HasValue(page)) {
        inputs = inputs.filter(item => !item.pages ||
                               item.pages === "all" ||
                               item.pages == page ||
                               item.pages.includes(page));
    }
    return inputs;
}

const exports = {
    useUserInputs: useUserInputs,
    useUserInfo: useUserInfo
}; export default exports;
