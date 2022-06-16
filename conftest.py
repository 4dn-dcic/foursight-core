import pytest
from unittest import mock
import app
import boto3
from dcicutils.env_utils import EnvUtils
from dcicutils.env_base import EnvManager
from dcicutils.misc_utils import override_environ, ignored
from foursight_core.app_utils import AppUtils
from foursight_core.sqs_utils import SQS


GLOBAL_ENV_BUCKET = 'GLOBAL_ENV_BUCKET'
FOURSIGHT_PREFIX = 'foursight-core-simulated'
SIMULATED_GLOBAL_ENV_BUCKET = FOURSIGHT_PREFIX + '-envs'
DEV_ENV = 'simulated'
ES_HOST = 'https://search-foursight-fourfront-ylxn33a5qytswm63z52uytgkm4.us-east-1.es.amazonaws.com'
SIMULATED_ENV_CONFIG = {
    'simulated': {
        'fourfront': 'dummy-url',
        'es': ES_HOST,  # maybe dont even need this?
        'ff_env': 'fourfront-simulated',
        'bucket': 'foursight-core-simulated-results',
    }
}
SIMULATED_ENV_HEALTH_PAGE = {
    "@type": [
        "Health",
        "Portal"
    ],
    "@context": "/health",
    "@id": "/health",
    "content": None,
    "application_bucket_prefix": "elasticbeanstalk-",
    "beanstalk_app_version": "unknown-version-at-20220614112027174894",
    "beanstalk_env": "foursight-core-simulated",
    "blob_bucket": "elasticbeanstalk-fourfront-mastertest-blobs",
    "elasticsearch": "vpc-es-fourfront-mastertest-b3j36tdu7mwrgdxt6y7jt46dem.us-east-1.es.amazonaws.com:443",
    "file_upload_bucket": "elasticbeanstalk-fourfront-mastertest-files",
    "identity": "C4AppConfigFourfrontMastertestApplicationConfigurationfourfrontmastertest",
    "indexer": "true",
    "namespace": "foursight-core-simulated",
    "processed_file_bucket": "elasticbeanstalk-fourfront-mastertest-wfoutput",
    "project_version": "4.2.9",
    "python_version": "3.7.12",
    "snovault_version": "5.5.1",
    "system_bucket": "elasticbeanstalk-fourfront-mastertest-system",
    "tibanna_output_bucket": "tibanna-output",
    "utils_version": "3.12.0.1b0"
}


class SimulatedAppUtils(AppUtils):
    """ Overrides metadata such that we can bring up a simulated AppUtils object
        without backing data in the cloud
    """
    prefix = FOURSIGHT_PREFIX
    host = ES_HOST  # we need a live ES

    def init_environments(self, env='all', envs=None):
        """ Overrides this method to mock out the call to s3 to get valid
            env info for simulation
        """
        return SIMULATED_ENV_CONFIG


@pytest.fixture(scope='session', autouse=True)
def setup():
    app.set_stage('test')  # set the stage info for tests
    test_client = boto3.client('sqs')  # purge test queue
    queue_url = SQS(FOURSIGHT_PREFIX).get_sqs_queue().url
    try:
        test_client.purge_queue(
            QueueUrl=queue_url
        )
    except test_client.exceptions.PurgeQueueInProgress:
        print('Cannot purge test queue; purge already in progress')


@pytest.yield_fixture(scope='session', autouse=True)
def global_env_bucket():
    with override_environ(GLOBAL_ENV_BUCKET=SIMULATED_GLOBAL_ENV_BUCKET):
        yield


@pytest.yield_fixture(scope='session')
def app_utils_obj_conn(global_env_bucket):  # noQA pytest fixture
    """ Mocks appropriate operations such that we can generate a simulated app_utils
        object for a non-existent foursight environment.

        Description of mocks:
            * FOURSIGHT_BUCKET_PREFIX so consistency checks are passed
            * verify_and_get_env_config to simulate an env entry
            * fetch_health_page_json to simulate a portal health page API call
            * queue_check to
    """
    ignored(global_env_bucket)
    with mock.patch.object(EnvUtils, 'FOURSIGHT_BUCKET_PREFIX', FOURSIGHT_PREFIX):
        apputils = SimulatedAppUtils()
        with mock.patch.object(EnvManager, 'verify_and_get_env_config',
                               return_value=SIMULATED_ENV_CONFIG['simulated']):
            with mock.patch.object(EnvManager, 'fetch_health_page_json',
                                   return_value=SIMULATED_ENV_HEALTH_PAGE):
                conn = apputils.init_connection(DEV_ENV)
                yield apputils, conn
