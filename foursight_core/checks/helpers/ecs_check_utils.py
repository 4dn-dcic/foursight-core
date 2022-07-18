from dcicutils.ecs_utils import ECSUtils


def check_for_active_deployment(*, cluster):
    """ Checks if any services in the given cluster have an active deployment. """
    ecs_client = ECSUtils()
    ecs_services = ecs_client.list_ecs_services(cluster_name=cluster)
    return ecs_client.service_has_active_deployment(cluster_name=cluster, services=ecs_services)


def rollback_application_version(*, cluster):
    """ Resolves the ECR and tag to roll back, then rolls the image back by moving the tag back by one image """
    ecs_client = ECSUtils()
    ecs_services = ecs_client.list_ecs_services(cluster_name=cluster)
    service_meta = ecs_client.client.describe_services(cluster=cluster, services=ecs_services[0])
    # TODO: use ECR scripts to rollback version if an active deployment is detected
