import json
from conftest import *
from foursight_core import s3_connection
from dcicutils import ff_utils


class TestS3Connection:
    environ = DEV_ENV

    def test_s3_conn_fields(self, app_utils_obj_conn):
        _, conn = app_utils_obj_conn
        s3_conn = conn.connections['s3']
        assert (s3_conn.bucket)
        assert (s3_conn.location)
        assert (s3_conn.status_code != 404)

    def test_test_s3_conn_methods(self):
        test_bucket = FOURSIGHT_PREFIX + '-test-s3'
        test_s3_conn = s3_connection.S3Connection(test_bucket)
        run_prefix = 'test/' + ff_utils.generate_rand_accession() + '/'
        test_key = run_prefix + 'obj'
        test_value = {'abc': 123}
        assert test_s3_conn.bucket == 'foursight-core-simulated-test-s3'
        assert test_s3_conn.status_code == 200, (
            f"Cannot access S3 test bucket {test_s3_conn.bucket}: {test_s3_conn.head_info}"
        )
        try:
            put_res = test_s3_conn.put_object(test_key, json.dumps(test_value))
            assert (put_res is not None)
            get_res = test_s3_conn.get_object(test_key)
            assert (get_res == test_value)
            assert test_s3_conn.get_size() >= 1
            assert test_s3_conn.get_size_bytes() is not None

            prefix_keys = test_s3_conn.list_all_keys_w_prefix(run_prefix)
            assert prefix_keys == [test_key]

            all_keys = test_s3_conn.list_all_keys()
            assert (test_key in all_keys)
        finally:
            leftover_keys = test_s3_conn.list_all_keys_w_prefix(run_prefix)
            if leftover_keys:
                test_s3_conn.delete_keys(leftover_keys)

        assert test_s3_conn.list_all_keys_w_prefix(run_prefix) == []
