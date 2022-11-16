from .helpers.confchecks import (
    check_function, CheckResult,
)
from foursight_core.stage import Stage
import boto3
from dcicutils import es_utils, ecs_utils


@check_function()
def datastore_status(connection, **kwargs):
    """ Check that returns the valid names of RDS and ES clusters for convenience """
    check = CheckResult(connection, 'datastore_status')
    db_client = boto3.client('rds', region_name=ecs_utils.COMMON_REGION)
    es_client = boto3.client('es', region_name=ecs_utils.COMMON_REGION)
    try:
        databases = [d['DBInstanceIdentifier'] for d in db_client.describe_db_instances()['DBInstances']]
        es_clusters = es_client.list_domain_names()['DomainNames']
    except Exception as e:
        check.status = 'FAIL'
        check.summary = f'Could not resolve RDS or ES clusters: {str(e)}'
        return check
    else:
        check.status = 'PASS'
        check.summary = 'See full output for datastore information'
        check.full_output = {
            'rds': databases,
            'es': es_clusters
        }
        return check


@check_function()
def ecs_task_listing(connection, **kwargs):
    """ Returns information on the available task definitions for launch """
    check = CheckResult(connection, 'ecs_task_listing')
    ecs_client = ecs_utils.ECSUtils()
    try:
        available_tasks = ecs_client.list_ecs_tasks()
    except Exception as e:
        check.status = 'FAIL'
        check.summary = f'Could not resolve available ECS tasks: {str(e)}'
        return check
    else:
        check.status = 'PASS'
        check.summary = 'See full output for list of tasks'
        check.full_output = {
            'taskDefinitionArns': available_tasks
        }
        return check


@check_function(cluster_name=None, task_name=None, subnet=None, security_group=None)
def invoke_ecs_task(connection, **kwargs):
    """ Invokes an ECS task - intended for use with the deployment action """
    check = CheckResult(connection, 'invoke_ecs_task')
    cluster_name = kwargs.get('cluster_name')
    task_name = kwargs.get('task_name')
    subnet = kwargs.get('subnet')
    security_group = kwargs.get('security_group')
    if not (cluster_name and task_name and subnet and security_group):
        check.status = 'FAIL'
        check.summary = 'Did not pass all required parameters: cluster_name, task_name, subnet and security_group'
        return check
    else:
        try:
            ecs_client = ecs_utils.ECSUtils()
            # TODO: fix in utils
            resp = ecs_client.client.run_task(
                cluster=cluster_name,
                count=1,
                taskDefinition=task_name,
                launchType='FARGATE',  # needs this param
                networkConfiguration={
                    'awsvpcConfiguration': {
                        'subnets': [
                            subnet
                        ],
                        'securityGroups': [
                            security_group
                        ]
                    }
                })
        except Exception as e:
            check.status = 'FAIL'
            check.summary = f'Got an error trying to run_task: {str(e)}'
            return check
        else:
            check.status = 'PASS'
            check.summary = f'Successfully invoked task {task_name} on cluster {cluster_name}' \
                            f' in subnet {subnet} with security group {security_group}'
            check.full_output = {
                'response': resp
            }
            return check


@check_function(cluster_name=None, service_name=None, parallelization=None)
def scale_ecs_service(connection, **kwargs):
    """ Adjusts the service parallelization of a particular ECS service """
    check = CheckResult(connection, 'scale_ecs_service')
    cluster_name = kwargs.get('cluster_name')
    service_name = kwargs.get('service_name')
    parallelization = int(kwargs.get('parallelization'))
    if not (cluster_name and service_name and parallelization):
        check.status = 'FAIL'
        check.summary = 'Did not pass required arguments: cluster_name, service_name and parallelization'
        return check
    else:
        try:
            client = boto3.client('ecs', region_name=ecs_utils.COMMON_REGION)  # TODO: move to utils
            resp = client.update_service(cluster=cluster_name, service=service_name,
                                         desiredCount=parallelization)
        except Exception as e:
            check.status = 'FAIL'
            check.summary = f'Got an error back from ECS: {str(e)}'
            return check
        else:
            check.status = 'PASS'
            check.summary = f'Successfully adjusted service {service_name} to run with desiredCount={parallelization}'
            check.full_output = {
                'response': resp
            }
            return check


@check_function(db_instance_class='db.t3.xlarge', rds_name=None, allocated_storage=None)
def scale_rds(connection, **kwargs):
    """ Adjusts the cluster size of the RDS instance """
    check = CheckResult(connection, 'scale_rds')
    if Stage.is_stage_prod() is False:
        check.summary = check.description = 'This check only runs on Foursight prod'
        return check
    rds_name = kwargs.get('cluster_name', f'rds-{connection.ff_env}')
    db_instance_class = kwargs.get('db_instance_class')
    allocated_storage = kwargs.get('allocated_storage')
    if not db_instance_class:
        check.summary = check.description = 'Must pass a DB Instance class to this check'
        return check
    client = boto3.client('rds', region_name=ecs_utils.COMMON_REGION)
    modify_kwargs = {
        'DBInstanceIdentifier': rds_name,
        'DBInstanceClass': db_instance_class
    }
    if allocated_storage:
        modify_kwargs['AllocatedStorage'] = int(allocated_storage)
    try:
        client.modify_db_instance(
            **modify_kwargs
        )
    except Exception as e:
        check.status = 'FAIL'
        check.summary = f'Error encountered resizing database {str(e)}'
        return check
    else:
        check.status = 'PASS'
        check.summary = f'Successfully resized DB {rds_name} to {db_instance_class}' \
                        f' with EBS {allocated_storage} (scheduled for next maintenance window)'
        return check


@check_function(es_domain=None, master_node_type='c5.large.elasticsearch', master_node_count=0,
                data_node_type='c5.xlarge.elasticsearch', data_node_count=3)
def scale_elasticsearch(connection, **kwargs):
    """ Scales ElasticSearch """
    check = CheckResult(connection, 'scale_elasticsearch')
    es_client = es_utils.ElasticSearchServiceClient()
    es_domain = kwargs.get('es_domain')
    if not es_domain:
        check.status = 'FAIL'
        check.summary = 'Must pass an ES domain name - see datastore status check'
        return check
    master_node_type, master_node_count = kwargs.get('master_node_type'), int(kwargs.get('master_node_count'))
    data_node_type, data_node_count = kwargs.get('data_node_type'), int(kwargs.get('data_node_count'))
    node_count = master_node_count + data_node_count
    if not (node_count % 2):  # even node count
        check.status = 'FAIL'
        check.summary = f'ES does not support even # of nodes, must have an odd total' \
                        f' ie: 1, 3, 5, 7, 9 etc. You specified {node_count}'
        return check
    if not (data_node_count and data_node_type):
        check.status = 'FAIL'
        check.summary = f'Did not pass new data node configuration!'
        return check
    success = es_client.resize_elasticsearch_cluster(
                domain_name=es_domain,
                master_node_type=master_node_type,
                master_node_count=master_node_count,
                data_node_type=data_node_type,
                data_node_count=data_node_count
            )
    if not success:
        check.status = 'ERROR'
        check.description = 'Could not trigger cluster resize - check lambda logs'
    else:
        check.status = 'PASS'
        check.description = f'Cluster resize triggered to {node_count} nodes with' \
                            f' {master_node_count} x {master_node_type} master nodes' \
                            f' and {data_node_count} x {data_node_type} data nodes.'
    return check
