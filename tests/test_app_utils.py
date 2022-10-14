from conftest import DEV_ENV
import pytest
import chalice
from foursight_core import app_utils as app_utils_module
from foursight_core.app_utils import AppUtilsCore
from unittest import mock


class TestAppUtils:
    """
    Meant for non-route utilities in foursight_core/app_utils.py
    """
    environ = DEV_ENV

    def test_init_connection(self, app_utils_obj_conn):
        # test the fs connection
        _, conn = app_utils_obj_conn
        assert (conn.fs_env == 'fourfront-' + self.environ)
        assert (conn.connections)
        # test the ff connection
        assert (conn.ff_server)
        assert (conn.ff_es)
        assert (conn.ff_env == 'fourfront-' + self.environ)
        assert (conn.ff_s3 is not None)
        assert (isinstance(conn.ff_keys, dict))
        assert ({'key', 'secret', 'server'} <= set(conn.ff_keys.keys()))

    # belongs in foursight-ff / foursight-cgap
    # def test_get_favicon(self):
    #     """ Tests that given DEV_ENV we get the right url for favicon """
    #     expected = public_url_for_app('fourfront') + '/static/img/favicon-fs.ico'  # favicon acquired from prod
    #     actual = self.app_utils_obj.get_favicon()
    #     assert expected == actual

    def test_init_bad_connection(self, app_utils_obj_conn):
        app_utils, _ = app_utils_obj_conn
        with pytest.raises(Exception) as exc:
            app_utils.init_connection('not_an_environment')
        assert ('is not valid!' in str(exc.value))

    def test_bad_view_result(self, app_utils_obj_conn):
        """ Tests giving a bad response to process_view_result """
        app_utils, conn = app_utils_obj_conn
        res = 'a string, not a dict response'
        error = app_utils.process_view_result(conn, res, False)
        assert error['status'] == 'ERROR'

    # worth testing in foursight-cgap/ff
    @pytest.mark.skip
    def test_init_environments(self, app_utils_obj_conn):
        """ Simple validation testing on the mocked return result for init_environments """
        app_utils, conn = app_utils_obj_conn
        environments = app_utils.init_environments()  # default to 'all' environments
        assert (self.environ in environments)
        for env, env_data in environments.items():
            assert ('fourfront' in env_data)
            assert ('es' in env_data)
            assert ('bucket' in env_data)
            assert ('ff_env' in env_data)
        environments = app_utils.init_environments(self.environ)
        assert (self.environ in environments)

    def test_init_response(self, app_utils_obj_conn):
        app_utils, conn = app_utils_obj_conn
        # a good response
        connection, response = app_utils.init_response(self.environ)
        assert (connection is not None)
        assert (response.body == 'Foursight response')
        # a bad Response
        connection, response = app_utils.init_response('not_an_environment')
        assert (connection is None)
        assert (response.body != 'Foursight response')
        assert (response.status_code == 400)

    def test_check_authorization(self, app_utils_obj_conn):
        app_utils, conn = app_utils_obj_conn
        # try with a non-valid jwt
        # this should fully test self.app_utils_obj.get_jwt
        req_dict = {'headers': {'cookie': 'jwtToken=not_a_jwt;other=blah;'}}
        auth = app_utils.check_authorization(req_dict)
        assert not auth
        jwtToken = app_utils.get_jwt_token(req_dict)
        assert (jwtToken == 'not_a_jwt')
        # try with an empty dict
        auth = app_utils.check_authorization({})
        assert not auth

    @pytest.mark.integratedx
    def test_check_jwt_authorization(self, app_utils_obj_conn):
        """ Tests same functionality as above except with a valid jwt
            This test is not very robust in this setup and should be repeated in
            foursight-ff / foursight-cgap.
        """
        # build a 'request header' that just consists of the context we would expect
        # to see if authenticating from localhost
        ctx = {
            'context': {
                'identity': {
                    'sourceIp': '127.0.0.1'
                }
            }
        }
        app_utils, conn = app_utils_obj_conn
        payload1 = {
            "email": "william_ronchetti@hms.harvard.edu",
            "email_verified": True,
            "sub": "1234567890",
            "name": "Dummy",
            "iat": 1516239022
        }  # mock a 'correct' jwt decode
        with mock.patch('foursight_core.app_utils.AppUtils.get_jwt_token', return_value='token'):
            with mock.patch('jwt.decode', return_value=payload1):
                auth = app_utils.check_authorization(ctx, env=self.environ)
            assert auth
        with mock.patch('foursight_core.app_utils.AppUtils.get_jwt_token', return_value='token'):
            with mock.patch('jwt.decode', return_value=payload1):
                # test authenticating on more than one env
                auth = app_utils.check_authorization(ctx, env=self.environ)
            assert auth
        auth = app_utils.check_authorization(ctx, env='all')
        assert auth
        with mock.patch('foursight_core.app_utils.AppUtils.get_jwt_token', return_value='token'):
            with mock.patch('jwt.decode', return_value=payload1):
                auth = app_utils.check_authorization(ctx, env='data,staging')  # test more than one
            assert auth
            # Unverified email should fail
            payload2 = {
                "email": "william_ronchetti@hms.harvard.edu",
                "email_verified": False,
                "sub": "1234567890",
                "name": "Dummy",
                "iat": 1516239022
            }
            with mock.patch('jwt.decode', return_value=payload2):
                auth = app_utils.check_authorization({}, env=self.environ)
            assert not auth
            # Email not found
            payload3 = {
                "email": "blah@blah",
                "email_verified": True,
                "sub": "1234567890",
                "name": "Dummy",
                "iat": 1516239022
            }
            with mock.patch('jwt.decode', return_value=payload3):
                auth = app_utils.check_authorization({}, env=self.environ)
            assert not auth

    def test_forbidden_response(self, app_utils_obj_conn):
        app_utils, conn = app_utils_obj_conn
        res = app_utils.forbidden_response()
        assert (res.status_code == 403)
        assert (res.body == 'Forbidden. Login on the /view/<environment> page.')

    def test_get_domain_and_context(self, app_utils_obj_conn):
        app_utils, conn = app_utils_obj_conn
        domain, context = app_utils.get_domain_and_context(
            {'headers': {'host': 'xyz'}, 'context': {'path': '/api/123'}}
        )
        assert (domain == 'xyz')
        assert (context == '/api/')
        # with no context provided
        domain, context = app_utils.get_domain_and_context(
            {'headers': {'host': 'xyz'}}
        )
        assert (context == '/')

    def test_process_response(self, app_utils_obj_conn):
        app_utils, conn = app_utils_obj_conn
        response = chalice.Response(
            status_code=200,
            body="A reasonable body."
        )
        assert (response == app_utils.process_response(response))
        # test for a response that's too long
        response.body = 'A' * 6000000
        too_long_resp = app_utils.process_response(response)
        assert (too_long_resp.status_code == 413)
        assert (too_long_resp.body == 'Body size exceeded 6 MB maximum.')

    def test_trim_output(self, app_utils_obj_conn):
        app_utils, conn = app_utils_obj_conn
        short_output = {'some_field': 'some_value'}
        trimmed_short = app_utils.trim_output(short_output)
        assert (trimmed_short == {'some_field': 'some_value'})
        long_output = {'some_field': 'some_value ' * 100000}
        trimmed_long = app_utils.trim_output(long_output)
        assert trimmed_long == app_utils.TRIM_ERR_OUTPUT

    def test_query_params_to_literals(self, app_utils_obj_conn):
        app_utils, conn = app_utils_obj_conn
        test_params = {
            'primary': 'True',
            'bad_bool': 'false',
            'int': '12',
            'float': '12.1',
            'str': 'abc',
            'none_str': 'None',
            'empty_str': '',
            'special': '&limit=all'
        }
        literal_params = app_utils.query_params_to_literals(test_params)
        assert (literal_params['primary'] is True)
        assert (literal_params['bad_bool'] == 'false')
        assert (literal_params['int'] == 12)
        assert (literal_params['float'] == 12.1)
        assert (literal_params['str'] == 'abc')
        assert (literal_params['none_str'] is None)
        assert ('empty_str' not in literal_params)
        assert (literal_params['special'] == '&limit=all')


def test_get_env_schedule():

    with mock.patch.object(app_utils_module, "public_env_name") as mock_public_env_name:
        with mock.patch.object(app_utils_module, "full_env_name") as mock_full_env_name:
            with mock.patch.object(app_utils_module, "short_env_name") as mock_short_env_name:

                expected_prd = 'schedule-prd-stuff-here'
                expected_stg = 'schedule-stg-stuff-here'

                def mocked_public_name(x):
                    if x in ['prod', 'prd', 'acme-prd']:
                        return 'prod'
                    elif x in ['stage', 'stg', 'acme-stg']:
                        return 'stage'
                    else:
                        return f"public-{x}"

                def mocked_short_name(x):
                    if x in ['prod', 'prd', 'acme-prd']:
                        return 'prd'
                    elif x in ['stage', 'stg', 'acme-stg']:
                        return 'stg'
                    else:
                        return f"short-{x}"

                def mocked_full_name(x):
                    if x in ['prod', 'prd', 'acme-prd']:
                        return 'acme-prd'
                    elif x in ['stage', 'stg', 'acme-stg']:
                        return 'acme-stg'
                    else:
                        return f"full-{x}"

                mock_public_env_name.side_effect = mocked_public_name
                mock_short_env_name.side_effect = mocked_short_name
                mock_full_env_name.side_effect = mocked_full_name

                sched_using_public_name = {"prod": expected_prd, "stage": expected_stg}
                sched_using_short_name = {"prd": expected_prd, "stg": expected_stg}
                sched_using_full_name = {"acme-prd": expected_prd, "acme-stg": expected_stg}

                assert AppUtilsCore.get_env_schedule(sched_using_public_name, 'prod') == expected_prd
                assert AppUtilsCore.get_env_schedule(sched_using_public_name, 'prd') == expected_prd
                assert AppUtilsCore.get_env_schedule(sched_using_public_name, 'acme-prd') == expected_prd

                assert AppUtilsCore.get_env_schedule(sched_using_short_name, 'prod') == expected_prd
                assert AppUtilsCore.get_env_schedule(sched_using_short_name, 'prd') == expected_prd
                assert AppUtilsCore.get_env_schedule(sched_using_short_name, 'acme-prd') == expected_prd

                assert AppUtilsCore.get_env_schedule(sched_using_full_name, 'prod') == expected_prd
                assert AppUtilsCore.get_env_schedule(sched_using_full_name, 'prd') == expected_prd
                assert AppUtilsCore.get_env_schedule(sched_using_full_name, 'acme-prd') == expected_prd

                assert AppUtilsCore.get_env_schedule(sched_using_public_name, 'stage') == expected_stg
                assert AppUtilsCore.get_env_schedule(sched_using_public_name, 'stg') == expected_stg
                assert AppUtilsCore.get_env_schedule(sched_using_public_name, 'acme-stg') == expected_stg

                assert AppUtilsCore.get_env_schedule(sched_using_short_name, 'stage') == expected_stg
                assert AppUtilsCore.get_env_schedule(sched_using_short_name, 'stg') == expected_stg
                assert AppUtilsCore.get_env_schedule(sched_using_short_name, 'acme-stg') == expected_stg

                assert AppUtilsCore.get_env_schedule(sched_using_full_name, 'stage') == expected_stg
                assert AppUtilsCore.get_env_schedule(sched_using_full_name, 'stg') == expected_stg
                assert AppUtilsCore.get_env_schedule(sched_using_full_name, 'acme-stg') == expected_stg

                assert AppUtilsCore.get_env_schedule(sched_using_public_name, 'foo') == []
                assert AppUtilsCore.get_env_schedule(sched_using_short_name, 'foo') == []
                assert AppUtilsCore.get_env_schedule(sched_using_full_name, 'foo') == []
