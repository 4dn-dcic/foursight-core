from .helpers.confchecks import (
    check_function, CheckResult,
)
from foursight_core.stage import Stage
import boto3
from dcicutils import es_utils, ecs_utils


@check_function
def datastore_status(connection, **kwargs):
    """ Check that returns the valid names of RDS and ES clusters for convenience """
    check = CheckResult(connection, 'datastore_status')
    db_client = boto3.client('rds', region_name=ecs_utils.COMMON_REGION)
    es_client = boto3.client('es', region_name=ecs_utils.COMMON_REGION)
    try:
        databases = db_client.describe_db_instances()
        es_clusters = es_client.list_domain_names()
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
        client.modify_db_instasnce(
            **modify_kwargs
        )
    except Exception as e:
        check.status = 'FAIL'
        check.summary = f'Error encountered resizing database {str(e)}'
        return check
    else:
        check.status = 'PASS'
        check.summary = f'Successfully resized DB {rds_name} to {db_instance_class}' \
                        f' with EBS {allocated_storage}'
        return check


@check_function(es_domain=None, master_node_type='c5.large.elasticsearch', master_node_count=0,
                data_node_type='c5.xlarge.elasticsearch', data_node_count=3)
def scale_elasticsearch(connection, **kwargs):
    """ Scales ElasticSearch """
    check = CheckResult(connection, 'scale_down_elasticsearch_production')
    es_client = es_utils.ElasticSearchServiceClient()
    es_domain = kwargs.get('es_domain')
    if not es_domain:
        check.status = 'FAIL'
        check.summary = 'Must pass an ES domain name - see datastore status check'
        return check
    master_node_type, master_node_count = kwargs.get('master_node_type'), kwargs.get('master_node_count')
    data_node_type, data_node_count = kwargs.get('data_node_type'), kwargs.get('data_node_count')
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
