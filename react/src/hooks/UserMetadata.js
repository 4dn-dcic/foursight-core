import { useFetch } from '../utils/Fetch';

const useUserMetadata = () => {
    const projects = useFetch("/users/projects", { cache: true });
    const roles = useFetch("/users/roles", { cache: true });
    const institutions = useFetch("/users/institutions", { cache: true });
    const statuses = useFetch("/users/statuses", { cache: true });
    const response = {
        projectTitle: (id) => projects.data?.find(item => item.id === id)?.title || "",
        roleTitle: (id) => roles.data?.find(item => item.id === id)?.title || "",
        institutionTitle: (id) => institutions.data?.find(item => item.id === id)?.title || "",
        statusTitle: (id) => statuses.data?.find(item => item.id === id)?.title || "",
        userRole: (user, projectId) => user.roles?.find(item => item.project == projectId)?.role || "",
        title: (s) => s.replace(/\w\S*/g, (s) => s.charAt(0).toUpperCase() + s.substr(1).toLowerCase()) || "",
        principleInvestigator: (institutionId) => institutions?.data?.find(item => item.id === institutionId)?.pi
    }
    response.userRoleTitle = (user, projectId) => response.roleTitle(response.userRole(user, projectId)) || "";
    response.titles = (sa) => sa?.map(s => response.title(s)).join(", ") || "";
    return response;
}

export default useUserMetadata;
