import os
from dcicutils.misc_utils import environ_bool

# When running 'chalice local' we do not (and seemingly can not) get the same "/api" prefix
# as we see when deployed to AWS (Lambda). So we set it explicitly here if your CHALICE_LOCAL
# environment variable is set. Seems to be a known issue: https://github.com/aws/chalice/issues/838

CHALICE_LOCAL = environ_bool("CHALICE_LOCAL")
if CHALICE_LOCAL:
    ROUTE_PREFIX = "/api/"
    ROUTE_EMPTY_PREFIX = "/api"
    ROUTE_PREFIX_EXPLICIT = "/api/"
else:
    ROUTE_PREFIX = "/"
    ROUTE_EMPTY_PREFIX = "/"
    ROUTE_PREFIX_EXPLICIT = "/api/"
