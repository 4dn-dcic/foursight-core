import useFetch from './Fetch';

const useUserMetadataCgap = () => {
    const projects = useFetch("/users/projects", { cache: true });
    const roles = useFetch("/users/roles", { cache: true });
    const institutions = useFetch("/users/institutions", { cache: true });
    const statuses = useFetch("/users/statuses", { cache: true });
    const response = {
        projectTitle: (id) => projects.data?.find(item => item.id === id)?.title || "",
        roleTitle: (id) => roles.data?.find(item => item.id === id)?.title || "",
        institutionTitle: (id) => institutions.data?.find(item => item.id === id)?.title || "",
        statusTitle: (id) => statuses.data?.find(item => item.id === id)?.title || "",
        userRole: (user, projectId) => user.roles?.find(item => item.project === projectId)?.role || "",
        title: (s) => s.replace(/\w\S*/g, (s) => s.charAt(0).toUpperCase() + s.substr(1).toLowerCase()) || "",
        principleInvestigator: (institutionId) => institutions?.data?.find(item => item.id === institutionId)?.pi
    }
    response.userRoleTitle = (user, projectId) => response.roleTitle(response.userRole(user, projectId)) || "";
    response.titles = (sa) => sa?.map(s => response.title(s)).join(", ") || "";
    return response;
}

const useUserMetadataSmaht = () => {
    const consortia = useFetch("/users/consortia", { cache: true });
    const roles = useFetch("/users/roles", { cache: true });
    const submissionCenters = useFetch("/users/submission_centers", { cache: true });
    const statuses = useFetch("/users/statuses", { cache: true });
    const response = {
        consortiumTitle: (id) => {
            let value = consortia.data?.find(item => item.id === id)?.title || "";
            if (value?.endsWith(" Consortium")) {
                value = value.replace(" Consortium", "");
            }
            return value;
        },
        roleTitle: (id) => roles.data?.find(item => item.id === id)?.title || "",
        submissionCenterTitle: (id) => {
            let value = submissionCenters.data?.find(item => item.id === id)?.title || "";
            if (value?.endsWith(" Submission Center")) {
                value = value.replace(" Submission Center", "");
            }
            return value;
        },
        statusTitle: (id) => statuses.data?.find(item => item.id === id)?.title || "",
        userRole: (user, consortiumId) => user.roles?.find(item => item.consortium === consortiumId)?.role || "",
        title: (s) => s.replace(/\w\S*/g, (s) => s.charAt(0).toUpperCase() + s.substr(1).toLowerCase()) || "",
        principleInvestigator: (submissionCenterId) => submissionCenters?.data?.find(item => item.id === submissionCenterId)?.pi
    }
    response.userRoleTitle = (user, consortiumId) => response.roleTitle(response.userRole(user, consortiumId)) || "";
    response.titles = (sa) => sa?.map(s => response.title(s)).join(", ") || "";
    return response;
}

//const useUserMetadata = useUserMetadataCgap;
const useUserMetadata = useUserMetadataSmaht;

export default useUserMetadata;
