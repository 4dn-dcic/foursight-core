from datetime import datetime


CHECK_DECO = 'check_function'
ACTION_DECO = 'action_function'


CHECK_TIMEOUT = 870  # in seconds. set to less than lambda limit (900 s)
POLL_INTERVAL = 10  # check child process every 10 seconds
LAMBDA_MAX_BODY_SIZE = 5500000  # 6Mb is the "real" threshold


ES_SEARCH_SIZE = 10000


# compare strings in both python 2 and python 3
# in other files, compare with vars.basestring
try:
    basestring = basestring
except NameError:
    basestring = str


def create_placeholder_check(check_name):
    """
    Creates a placeholder check for the given check_name to be rendered on the UI
    in the case that this check has not been run yet.
    """
    _uuid = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%f')
    placeholder = {
        'name': check_name,
        'uuid': _uuid,
        'kwargs': {'uuid': _uuid, 'primary': True},
        'status': 'PASS',  # so these show up green
        'summary': 'Check has not yet run',
        'description': 'If queued, this check will run with default arguments'
    }
    return placeholder
