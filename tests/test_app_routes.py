from conftest import *
import datetime
from foursight_core import run_result


class MockContext:
    def __init__(self):
        self.path = ''


class MockRequest:
    def __init__(self):
        self.req = {}
        self.context = MockContext()

    def to_dict(self):
        return self.req


class TestAppRoutes:

    def test_view_foursight(self, app_utils_obj_conn):
        test_check_name = 'test_random_nums'
        app_utils_obj, connection = app_utils_obj_conn
        res = app_utils_obj.view_foursight(MockRequest(), DEV_ENV)  # not is_admin
        assert (res.headers == {u'Content-Type': u'text/html'})
        assert (res.status_code == 200)
        assert (set(res.to_dict().keys()) == {'body', 'headers', 'statusCode', 'multiValueHeaders'})
        assert ('<!DOCTYPE html>' in res.body)
        assert ('Foursight' in res.body)
        assert ('Not logged in.' in res.body)
        # run a check, which redirects to future check result
        res2 = app_utils_obj.view_run_check(DEV_ENV, test_check_name, {})
        assert (res2.status_code == 302)
        assert ('/view/' + DEV_ENV + f'/{test_check_name}/' in res2.body)
        # get check uuid from res location
        chk_uuid = res2.headers['Location'].split('/')[-1]
        # running action w/ an check brings you to the action bound to a check
        act_kwargs = {'check_name': test_check_name, 'called_by': chk_uuid}
        res3 = app_utils_obj.view_run_action(DEV_ENV, 'add_random_test_nums', act_kwargs)
        assert (res3.status_code == 302)
        assert (res3.body == res2.body)
        # running action w/o check info gives 200 with action info
        res4 = app_utils_obj.view_run_action(DEV_ENV, 'add_random_test_nums', {})
        assert (res4.status_code == 200)
        assert ('Action is queued.' in res4.body['details'])
        res = app_utils_obj.view_foursight(MockRequest(), DEV_ENV, True)  # is_admin
        assert (res.status_code == 200)
        assert ('Not logged in.' not in res.body)

    @pytest.mark.skip  # assumes an existing check
    def test_view_foursight_check(self, app_utils_obj_conn):
        test_check_name = 'test_random_nums'
        app_utils_obj, connection = app_utils_obj_conn

        test_check = run_result.CheckResult(connection, test_check_name)
        uuid = test_check.get_primary_result()['uuid']
        res = app_utils_obj.view_foursight_check(DEV_ENV, test_check_name, uuid)
        assert (res.status_code == 200)
        assert ('<!DOCTYPE html>' in res.body)
        assert ('Foursight' in res.body)

    def test_view_foursight_history(self, app_utils_obj_conn):
        test_check = 'test_random_nums'
        app_utils_obj, connection = app_utils_obj_conn

        res = app_utils_obj.view_foursight_history(MockRequest(), DEV_ENV, test_check)  # not admin
        assert (res.headers == {u'Content-Type': u'text/html'})
        assert (res.status_code == 200)
        assert ('<!DOCTYPE html>' in res.body)
        assert ('Foursight' in res.body)
        assert ('Not logged in.' in res.body)
        # run with bad environ
        res = app_utils_obj.view_foursight_history(MockRequest(), 'not_an_environment', test_check)
        assert ('not_an_environment' in res.body)  # should be handled differently?
        # run with bad check
        res = app_utils_obj.view_foursight_history(MockRequest(), DEV_ENV, 'not_a_check')
        assert ('not_a_check' not in res.body)  # should be handled differently?
        # run with is_admin
        res = app_utils_obj.view_foursight_history(MockRequest(), DEV_ENV, test_check, is_admin=True)  # admin
        assert (res.status_code == 200)
        assert ('Not logged in.' not in res.body)
        assert (f'History for test_random_nums ({DEV_ENV})' in res.body)
        # run with some limits/starts
        res = app_utils_obj.view_foursight_history(MockRequest(), DEV_ENV, test_check, start=4, limit=2)
        assert (res.status_code == 200)
        assert ('Previous 2' not in res.body)  # no info since not admin
        res = app_utils_obj.view_foursight_history(MockRequest(), DEV_ENV, test_check, start=4, limit=2, is_admin=True)
        assert (res.status_code == 200)
        assert ('Previous 2' in res.body)  # present now since admin

    def test_run_get_environment(self, app_utils_obj_conn):
        app_utils_obj, connection = app_utils_obj_conn
        environments = app_utils_obj.init_environments()
        env_resp = app_utils_obj.run_get_environment(DEV_ENV)
        assert (env_resp.status_code == 200)
        body = env_resp.body
        assert (body.get('environment') == DEV_ENV)
        assert (body.get('status') == 'success')
        details = body.get('details')
        assert (details.get('bucket').startswith('foursight-'))
        assert (DEV_ENV in details.get('bucket'))
        this_env = environments.get(DEV_ENV)
        assert (this_env == details)
        # bad environment
        resp2 = app_utils_obj.run_get_environment('not_an_environment')
        assert (resp2.status_code == 400)
        assert (resp2.body['status'] == 'error')
        assert ('Invalid environment provided' in resp2.body['description'])

    @pytest.mark.skip  # put_environment should no longer be used
    def test_put_environment(self, app_utils_obj_conn):
        app_utils_obj, connection = app_utils_obj_conn
        # this one is interesting... will be tested by putting a clone of
        # DEV_ENV into itself. actual fxn run is run_put_environment
        get_res = app_utils_obj.run_get_environment(DEV_ENV)
        env_data = get_res.body.get('details')
        # make sure the environ we have is legit
        assert (env_data and 'fourfront' in env_data and 'es' in env_data and 'ff_env' in env_data)
        env_res = app_utils_obj.run_put_environment(DEV_ENV, env_data)
        assert (env_res.status_code == 200)
        assert (env_res.body.get('status') == 'success')
        assert (env_res.body.get('environment') == DEV_ENV)
        assert (env_res.body.get('description') == 'Succesfully made: ' + DEV_ENV)
        # failure case
        bad_res = app_utils_obj.run_put_environment(DEV_ENV, {'key1': 'res1'})
        assert (bad_res.status_code == 400)
        assert (bad_res.body.get('status') == 'error')
        assert (bad_res.body.get('body') == {'key1': 'res1'})
        assert (bad_res.body.get('description') == 'Environment creation failed')
        # make sure they match after run_put_environment
        get_res2 = app_utils_obj.run_get_environment(DEV_ENV)
        assert (get_res.body == get_res2.body)

    def test_put_check(self, app_utils_obj_conn):
        app_utils_obj, connection = app_utils_obj_conn
        # actually tests run_put_check, which holds all functionality
        # besides app.current_request
        check_name = 'test_put_check'
        ts_uuid = datetime.datetime.utcnow().isoformat()
        put_data = {
            'description': 'Just a test for run_put_check',
            'brief_output': ['res1'],
            'full_output': {'key1': 'res1', 'key2': 'res2'},
            'admin_output': 'xyz',
            'uuid': ts_uuid
        }
        res = app_utils_obj.run_put_check(DEV_ENV, check_name, put_data)
        assert (res.status_code == 200)
        assert (res.body['environment'] == DEV_ENV)
        assert (res.body['status'] == 'success')
        assert (res.body['check'] == check_name)
        put_res = res.body['updated_content']
        assert (put_res is not None)
        assert (put_res.get('uuid') == ts_uuid)
        # now put another one with the same uuid
        put_data['brief_output'] = ['res2']
        put_data['full_output'] = {'key2': 'res3'}
        put_data['admin_output'] = '890'
        res = app_utils_obj.run_put_check(DEV_ENV, check_name, put_data)
        assert (res.status_code == 200)
        put_res = res.body['updated_content']
        assert (put_res['brief_output'] == ['res1', 'res2'])
        assert (put_res['full_output'] == {'key1': 'res1', 'key2': 'res3'})
        assert (put_res['admin_output'] == 'xyz890')
        # now do it with strings. brief_output should be unchanged if we don't overwrite it
        del put_data['brief_output']
        put_data['full_output'] = 'abc '
        res = app_utils_obj.run_put_check(DEV_ENV, check_name, put_data)
        assert (res.status_code == 200)
        put_data['full_output'] = '123'
        res = app_utils_obj.run_put_check(DEV_ENV, check_name, put_data)
        assert (res.status_code == 200)
        put_res = res.body['updated_content']
        assert (put_res['brief_output'] == ['res1', 'res2'])
        assert (put_res['full_output'] == '123')
        # lastly, cover bad output
        put_data = 'NOT_A_DICT'
        res = app_utils_obj.run_put_check(DEV_ENV, check_name, put_data)
        assert (res.status_code == 400)
        assert (res.body['status'] == 'error')
        assert (res.body['description'] == 'PUT request is malformed: NOT_A_DICT')
        # bad response
        res = app_utils_obj.run_get_check(DEV_ENV, 'not_a_real_check')
        assert (res.status_code == 400)
        assert (res.body['status'] == 'error')
        assert (res.body['description'] == 'Not a valid check or action.')
