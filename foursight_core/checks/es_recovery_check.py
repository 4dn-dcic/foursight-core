from .helpers.confchecks import (
    check_function, CheckResult,
)
from time import sleep
from dcicutils import ff_utils
from dcicutils.es_utils import create_es_client
from dcicutils.misc_utils import PRINT
from elasticsearch.exceptions import NotFoundError


AUTOMATED_ES_SNAPSHOT_REPOSITORIES = ['cs-automated-enc', 'cs-automated']


def indexing_status_is_clear(indexing_status):
    """ Returns True if indexing status is clear, meaning counts are all 0 """
    for k, v in indexing_status.items():
        if isinstance(v, int) and 'dlq' not in k:  # ignore dlq, only check integer (count) fields
            if v != 0:
                return False
    return True


def resolve_most_recent_snapshot(client):
    """ Calls out to ES to determine the most recent snapshot of the cluster """
    snapshots, snapshot_repo = [], None
    for snapshot_repo in AUTOMATED_ES_SNAPSHOT_REPOSITORIES:
        try:
            snapshots = list(filter(lambda d: d['status'] == 'SUCCESS',  # only show successful snapshots
                                    client.cat.snapshots(repository=snapshot_repo,
                                                         format='JSON',
                                                         h='id,status,end_time')))
        except NotFoundError:
            continue
        if snapshots:
            break
    return (snapshot_repo, snapshots[-1]) if snapshots else (None, None)  # most recent snapshot shows up last


def restore_snapshot(client, snapshot_repo, snapshot_id, index=None, include_global_state=False):
    """ Restores ES at client handle to snapshot_id, usually in response to a
        critical failure in the cluster. Note that for this routine to work, no indices can
        exist on the cluster (since restore names will clash).
    """
    if not index:
        body = {
            'include_global_state': include_global_state
        }
    else:
        body = {
            'indices': index,
            'include_global_state': include_global_state
        }
    return client.snapshot.restore(snapshot_repo, snapshot_id, body=body)


@check_function(env_name=None)
def rollback_es_to_snapshot(connection, **kwargs):
    """ Checks for empty ES counts with clear indexing status, indicating a failure occurred in the
        ES cluster, and we need to do a snapshot restore to rapidly bring the cluster back online.
    """
    check = CheckResult(connection, 'rollback_es_to_snapshot')
    env = kwargs.get('env_name') or connection.fs_env
    counts = ff_utils.get_metadata('/counts', ff_env=env, add_on='datastore=database')
    indexing_status = ff_utils.get_metadata('/indexing_status', ff_env=env, add_on='datastore=database')
    PRINT(f'Response from counts {counts}')
    PRINT(f'Response from indexing_status: {indexing_status}')
    es_total = int(counts['db_es_total'].split()[3])  # dependent on page structure
    # if es is empty and indexing status is clear, we have detected
    if es_total == 0 and indexing_status_is_clear(indexing_status):
        sleep(30)  # give create_mapping 30 seconds to catch up...
        indexing_status = ff_utils.get_metadata('/indexing_status', ff_env=env, add_on='datastore=database')
        if indexing_status_is_clear(indexing_status):
            es = connection.ff_es
            es_client = create_es_client(es_url=es, options={
               'request_timeout': 30
            })
            snapshot_repo, snapshot = resolve_most_recent_snapshot(es_client)
            if not snapshot:
                check.status = 'FAIL'
                check.summary = f'Could not acquire snapshot from {AUTOMATED_ES_SNAPSHOT_REPOSITORIES}'
                check.brief_output = check.full_output = check.summary
                return check
            else:
                foursight_index = connection.ff_bucket
                fs_result = restore_snapshot(es_client, snapshot_repo, snapshot, index=foursight_index)
                sleep(15)  # allow snapshot restore of FS index to proceed
                ff_result = restore_snapshot(es_client, snapshot_repo, snapshot, index=env + '*')
                check.status = 'WARN'
                check.summary = f'Restored snapshot for foursight {fs_result} and portal {ff_result}'
                check.brief_output = check.full_output = check.summary
                return check
        else:
            check.status = 'WARN'
            check.summary = f'Detected blank ES, but indexing status is not clear - assuming we are remapping'
            check.brief_output = check.full_output = check.summary
            return check
    else:
        check.status = 'PASS'
        check.summary = f'ES is not empty so not restoring'
        check.brief_output = check.full_output = check.summary
        return check
