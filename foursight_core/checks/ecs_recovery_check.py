from .helpers.confchecks import (
    check_function, CheckResult,
)
from dcicutils.ecs_utils import ECSUtils
from dcicutils.ecr_scripts import DEFAULT_ACCOUNT_NUMBER, ecr_command_context, ECRCommandContext


@check_function(env_name=None, account_number=None, ecr_repo=None, image_tag=None)
def rollback_application_version(connection, **kwargs):
    """ Checks for an active deployment that has been running for > 30 minutes,
        after which we can assume there is an issue with it and it should be
        rolled back. In our setup, rolling back means moving the image tag back
        to the previous version. If that version fails to deploy, this check will
        run again, continuing the rollback mechanism until a stable version is found.

        Note that this check assumes it is run on a 15 minute schedule - it will not function
        correctly otherwise! It also will ignore deployments that occur while counts are uneven.
    """
    check = CheckResult(connection, 'rollback_application_version')
    env = kwargs.get('env_name') or connection.ff_env
    ecr_repo = kwargs.get('ecr_repo', 'main')  # typically main
    image_tag = kwargs.get('image_tag', 'latest')  # typically 'latest' but could be blue/green
    account_number = kwargs.get('account_number', DEFAULT_ACCOUNT_NUMBER)  # os.environ.get('ACCOUNT_NUMBER')
    ecs_utils = ECSUtils()
    clusters = ecs_utils.list_ecs_clusters()
    matching_cluster = list(filter(lambda c: env in c, clusters))
    if len(matching_cluster) == 0:
        check.status = 'FAIL'
        check.summary = f'Could not resolve a cluster given env name {env}'
        check.brief_output = check.full_output = check.summary
        return check
    elif len(matching_cluster) > 1:
        check.status = 'FAIL'
        check.summary = f'Could not resolve a single cluster given env name {env}, resolved:' \
                        f' {matching_cluster}'
        check.brief_output = check.full_output = check.summary
        return check
    else:  # we found a single cluster to check
        matching_cluster = matching_cluster[0]
        services = ecs_utils.list_ecs_services(cluster_name=matching_cluster)
        deploy_is_active = ecs_utils.service_has_active_deployment(cluster_name=matching_cluster, services=services)
        # check previous run, checking that ES is reachable
        if deploy_is_active and (connection.test_es_connection()):
            last_result = check.get_primary_result()
            prior_result = check.get_closest_result(diff_mins=30)
            # set to warn if either of previous results don't exist
            if not last_result or not prior_result:
                check.status = 'WARN'
                check.summary = f'Detected that deployment is still running - after 3 consecutive checks, image will' \
                                f' be rolled back on cluster {matching_cluster}'
                check.brief_output = check.full_output = check.summary
                return check
            # 2 consecutive prior warns indicate deployment failure
            elif last_result.status == 'WARN' and prior_result.status == 'WARN':
                with ecr_command_context(account_number=account_number, ecs_repository=ecr_repo):
                    ecr = ECRCommandContext(account_number, ecs_repository=ecr_repo)
                    images = ecr.get_images_descriptions()
                    for i in range(len(images) - 1):
                        current_image = images[i]
                        if image_tag in current_image.get('imageTags', []):
                            image_prior_to_latest = images[i+1]
                            ecr.add_image_tag(digest=image_prior_to_latest['imageDigest'], tag=image_tag)
                check.status = 'PASS'
                check.summary = f'Triggered image rollback on tag {image_tag} on repo {ecr_repo} associated with' \
                                f' cluster {matching_cluster}'
                check.brief_output = check.full_output = check.summary
                return check
            else:  # we are at the first or second warn
                check.status = 'WARN'
                check.summary = f'Detected that deployment is still running - after 3 consecutive checks, image will' \
                                f' be rolled back on cluster {matching_cluster}'
                check.brief_output = check.full_output = check.summary
                return check
        else:
            check.status = 'PASS'
            check.summary = 'No active deployment detected (or counts are uneven) - all good!'
            check.brief_output = check.full_output = check.summary
            return check
