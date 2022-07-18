from .helpers.confchecks import (
    check_function, CheckResult,
)
from time import sleep
from dcicutils.ff_utils import get_counts_page, get_indexing_status
from dcicutils.es_utils import create_es_client, execute_lucene_query_on_es


AUTOMATED_ES_SNAPSHOT_REPOSITORY = 'cs-automated'


def indexing_status_is_clear(indexing_status):
    """ Returns True if indexing status is clear, meaning counts are all 0 """
    for k, v in indexing_status.items():
        if isinstance(v, int) and 'dlq' not in k:  # ignore dlq, only check integer (count) fields
            if v != 0:
                return False
    return True


def resolve_most_recent_snapshot(client):
    """ Calls out to ES to determine the most recent snapshot of the cluster """
    snapshots = client.snapshot.status(AUTOMATED_ES_SNAPSHOT_REPOSITORY)
    return sorted(snapshots['snapshots'])[0]


@check_function(env_name=None)
def rollback_es_to_snapshot(connection, **kwargs):
    check = CheckResult(connection, 'rollback_es_to_snapshot')
    env = kwargs.get('env_name')
    counts, indexing_status = get_counts_page(ff_env=env), get_indexing_status(ff_env=env)
    es_total = counts['db_es_total'].split()[3]  # dependent on page structure
    # if es is empty and indexing status is clear, we have detected
    if es_total == 0 and indexing_status_is_clear(indexing_status):
        sleep(15)  # give create_mapping 15 seconds to catch up...
        indexing_status = get_indexing_status(ff_env=env)
        if indexing_status_is_clear(indexing_status):
            es = connection.ff_es
            es_client = create_es_client(es_url=es)
            snapshots = resolve_most_recent_snapshot(es_client)
            # TODO process and restore

