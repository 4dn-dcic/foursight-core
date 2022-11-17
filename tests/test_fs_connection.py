import pytest
import datetime
from copy import deepcopy
from conftest import FOURSIGHT_PREFIX, ES_HOST

from foursight_core import fs_connection
from foursight_core import decorators


pytestmark = [pytest.mark.integrated]


@pytest.fixture
def connection():
    environ_info = {
        'fourfront': 'test1',
        'es': 'test2',
        'bucket': None,
        'ff_env': 'fourfront-mastertest'
    }
    connection = fs_connection.FSConnection('test', environ_info, test=True, host=ES_HOST)
    return connection


class TestFSConnection:
    environ_info = {
        'fourfront': 'test1',
        'es': 'test2',
        'bucket': None,
        'ff_env': 'fourfront-mastertest'
    }

    def test_connection_fields(self, connection):
        assert (connection.fs_env == 'fourfront-test')
        assert (connection.connections['s3'].status_code == 404)
        assert (connection.ff_server == 'test1')
        assert (connection.ff_es == 'test2')
        assert (connection.ff_env == 'fourfront-mastertest')
        assert (connection.ff_s3 is None)
        assert (connection.ff_keys is None)

    def test_check_result_basics(self, connection):
        test_check = decorators.Decorators(FOURSIGHT_PREFIX).CheckResult(connection, 'test_check')
        test_check.summary = 'Unittest check'
        test_check.ff_link = 'not_a_real_http_link'
        assert (test_check.connections['s3'].status_code == 404)
        assert (test_check.get_latest_result() is None)
        assert (test_check.get_primary_result() is None)
        with pytest.raises(Exception) as exec_info:
            test_check.get_closest_result(1)
        assert ('Could not find any results' in str(exec_info.value))
        formatted_res = test_check.format_result(datetime.datetime.utcnow())
        assert (formatted_res.get('status') == 'IGNORE')
        assert (formatted_res.get('summary') == 'Unittest check')
        assert (formatted_res.get('description') == 'Unittest check')
        assert (formatted_res.get('type') == 'check')
        # set a bad status on purpose
        test_check.status = "BAD_STATUS"
        check_res = test_check.store_result()
        assert (check_res.get('name') == formatted_res.get('name'))
        assert (check_res.get('description') == "Malformed status; look at Foursight check definition.")
        assert (check_res.get('brief_output') == formatted_res.get('brief_output') == None)
        assert (check_res.get('ff_link') == 'not_a_real_http_link')

    def test_bad_ff_connection_in_fs_connection(self):
        try:
            # Note we do not set test=True. This should raise a ClientError because it's not a real FF env.
            bad_environ_info = deepcopy(self.environ_info)
            bad_environ_info['ff_env'] = 'nosuchenv'
            fs_connection.FSConnection('nosuchenv', bad_environ_info, host=ES_HOST)
        except RuntimeError:  # we are caught sooner now
            # This is what we expect to happen.
            assert 'env nosuchenv has no entry in public_url_table'
        except Exception as e:
            # Should never get here.
            raise AssertionError(f"Got unexpected error ({type(e)}: {e}")
        else:
            # Should never get here either.
            raise AssertionError(f"Got no error where a ClientError was expected.")
