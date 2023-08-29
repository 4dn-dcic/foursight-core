import datetime
from time import sleep
from conftest import *
from foursight_core import exceptions
from foursight_core import run_result
from foursight_core import check_schema


@pytest.fixture
def check_handler(app_utils_obj_conn):
    app_utils_obj, _ = app_utils_obj_conn
    check_handler = app_utils_obj.check_handler
    return check_handler


class TestCheckUtils:
    """ Not all of these have been ported, some are specific to checks written in
        foursight that should remain there """
    environ = DEV_ENV

    def test_get_check_strings(self, app_utils_obj_conn, check_handler):
        app_utils_obj, _ = app_utils_obj_conn
        # do this for every check
        all_check_strs = check_handler.get_check_strings()
        for check_str in all_check_strs:
            get_check = check_str.split('/')[1]
            chalice_resp = app_utils_obj.run_get_check(self.environ, get_check)
            body = chalice_resp.body
            print("chalice_resp.body= " + str(body))
            if body.get('status') == 'success':
                assert (chalice_resp.status_code == 200)
                if body.get('data') is None:  # check not run yet
                    continue
                assert (body.get('data', {}).get('name') == get_check)
                assert (body.get('data', {}).get('status') in ['PASS', 'WARN', 'FAIL', 'ERROR', 'IGNORE'])
            elif body.get('status') == 'error':
                error_msg = "Not a valid check or action."
                assert (body.get('description') == error_msg)

    def test_validate_check_setup(self, check_handler):
        assert (check_handler.validate_check_setup(check_handler.CHECK_SETUP) == check_handler.CHECK_SETUP)
        with mock.patch.object(check_handler, 'locate_defined_checks', return_value={
            'test_random_nums': 'test_checks'
        }):  # mock out the resolution of defined checks
            for check in check_handler.CHECK_SETUP.values():
                assert ('module' in check)
            # do a whole bunch of validation failure cases
            bad_setup = {'not_a_check': {}}
            with pytest.raises(exceptions.BadCheckSetup) as exc:
                check_handler.validate_check_setup(bad_setup)
            assert ('does not have a proper check function defined' in str(exc.value))
            bad_setup = {'test_random_nums': []}
            with pytest.raises(exceptions.BadCheckSetup) as exc:
                check_handler.validate_check_setup(bad_setup)
            assert ('must be a dictionary' in str(exc.value))
            bad_setup = {'test_random_nums': {'title': {}, 'group': {}, 'blah': {}}}
            with pytest.raises(exceptions.BadCheckSetup) as exc:
                check_handler.validate_check_setup(bad_setup)
            assert ('must have the required keys' in str(exc.value))
            bad_setup = {'test_random_nums': {'title': {}, 'group': {}, 'schedule': []}}
            with pytest.raises(exceptions.BadCheckSetup) as exc:
                check_handler.validate_check_setup(bad_setup)
            assert ('must have a string value for field' in str(exc.value))
            bad_setup = {'test_random_nums': {'title': '', 'group': '', 'schedule': []}}
            with pytest.raises(exceptions.BadCheckSetup) as exc:
                check_handler.validate_check_setup(bad_setup)
            assert ('must have a dictionary value for field' in str(exc.value))
            bad_setup = {'test_random_nums': {'title': '', 'group': '', 'schedule': {}}}
            with pytest.raises(exceptions.BadCheckSetup) as exc:
                check_handler.validate_check_setup(bad_setup)
            assert ('must have a list of "display" environments' in str(exc.value))
            bad_setup = {'test_random_nums': {'title': '', 'group': '', 'schedule': {'fake_sched': []}}}
            with pytest.raises(exceptions.BadCheckSetup) as exc:
                check_handler.validate_check_setup(bad_setup)
            assert ('must have a dictionary value' in str(exc.value))
            bad_setup = {'test_random_nums': {'title': '', 'group': '', 'schedule': {'fake_sched': {'not_an_env': []}}}}
            with pytest.raises(exceptions.BadCheckSetup) as exc:
                check_handler.validate_check_setup(bad_setup)
            assert ('is not an existing environment' in str(exc.value))
            bad_setup = {'test_random_nums': {'title': '', 'group': '', 'schedule': {'fake_sched': {'all': []}}}}
            with pytest.raises(exceptions.BadCheckSetup) as exc:
                check_handler.validate_check_setup(bad_setup)
            assert ('must have a dictionary value' in str(exc.value))
            bad_setup = {'test_random_nums': {'title': '', 'group': '', 'schedule': {'fake_sched': {'all': {'kwargs': []}}}}}
            with pytest.raises(exceptions.BadCheckSetup) as exc:
                check_handler.validate_check_setup(bad_setup)
            assert ('must have a dictionary value' in str(exc.value))
            bad_setup = {'test_random_nums': {'title': '', 'group': '', 'schedule': {'fake_sched': {'all': {'dependencies': {}}}}}}
            with pytest.raises(exceptions.BadCheckSetup) as exc:
                check_handler.validate_check_setup(bad_setup)
            assert ('must have a list value' in str(exc.value))
            bad_setup = {'test_random_nums': {'title': '', 'group': '', 'schedule': {'fake_sched': {'all': {'dependencies': ['not_a_real_check']}}}}}
            with pytest.raises(exceptions.BadCheckSetup) as exc:
                check_handler.validate_check_setup(bad_setup)
            assert ('is not a valid check name that shares the same schedule' in str(exc.value))
            # this one will work -- display provided
            okay_setup = {'test_random_nums': {'title': '', 'group': '', 'schedule': {}, 'display': ['data']}}
            okay_validated = check_handler.validate_check_setup(okay_setup)
            assert (okay_validated['test_random_nums'].get('module') == 'test_checks')
            # this one adds kwargs and id to setup
            okay_setup = {'test_random_nums': {'title': '', 'group': '', 'schedule': {'fake_sched': {'all': {}}}}}
            okay_validated = check_handler.validate_check_setup(okay_setup)
            assert ({'kwargs', 'dependencies'} <= set(okay_validated['test_random_nums']['schedule']['fake_sched']['all'].keys()))

    @pytest.mark.flaky
    def test_run_check_or_action(self, app_utils_obj_conn, check_handler):
        _, conn = app_utils_obj_conn
        test_uuid = datetime.datetime.utcnow().isoformat()
        check = run_result.CheckResult(conn, 'test_random_nums')
        # with a check (primary is True)
        test_info = ['test_checks/test_random_nums', {'primary': True, 'uuid': test_uuid}, [], 'xxx']
        check_res = check_handler.run_check_or_action(conn, test_info[0], test_info[1])
        assert (isinstance(check_res, dict))
        assert ('name' in check_res)
        assert ('status' in check_res)
        # make sure runtime is in kwargs and pop it
        assert ('runtime_seconds' in check_res.get('kwargs'))
        check_res.get('kwargs').pop('runtime_seconds')
        assert (check_res.get('kwargs') == {'primary': True, 'uuid': test_uuid, 'queue_action': 'Not queued'})
        primary_uuid = check_res.get('uuid')
        sleep(5)
        primary_res = check.get_primary_result()
        assert (primary_res.get('uuid') == primary_uuid)
        latest_res = check.get_latest_result()
        assert (latest_res.get('uuid') == primary_uuid)
        # with a check and no primary=True flag
        check_res = check_handler.run_check_or_action(conn, test_info[0], {})
        latest_uuid = check_res.get('uuid')
        assert ('runtime_seconds' in check_res.get('kwargs'))
        check_res.get('kwargs').pop('runtime_seconds')
        assert (check_res.get('kwargs') == {'primary': False, 'uuid': latest_uuid, 'queue_action': 'Not queued'})
        # latest res will be more recent than primary res now
        latest_res = check.get_latest_result()
        assert (latest_res.get('uuid') == latest_uuid)
        primary_res = check.get_primary_result()
        assert (primary_uuid < latest_uuid)

        # with an action
        action = run_result.ActionResult(conn, 'add_random_test_nums')
        act_kwargs = {'primary': True, 'uuid': test_uuid, 'check_name': 'test_random_nums',
                      'called_by': test_uuid}
        test_info_2 = ['test_checks/add_random_test_nums', act_kwargs, [], 'xxx']
        action_res = check_handler.run_check_or_action(conn, test_info_2[0], test_info_2[1])
        assert (isinstance(action_res, dict))
        assert ('name' in action_res)
        assert ('status' in action_res)
        assert ('output' in action_res)
        # pop runtime_seconds kwarg
        assert ('runtime_seconds' in action_res['kwargs'])
        action_res['kwargs'].pop('runtime_seconds')
        assert (action_res.get('kwargs') == {'primary': True, 'offset': 0, 'uuid': test_uuid, 'check_name': 'test_random_nums', 'called_by': test_uuid})
        act_uuid = action_res.get('uuid')
        act_res = action.get_result_by_uuid(act_uuid)
        assert (act_res['uuid'] == act_uuid)
        latest_res = action.get_latest_result()
        assert (latest_res['uuid'] == act_uuid)
        # make sure the action can get its associated check result
        assc_check = action.get_associated_check_result(act_kwargs)
        assert (assc_check is not None)
        assert (assc_check['name'] == act_kwargs['check_name'])
        assert (assc_check['uuid'] == act_uuid)

    def test_run_check_errors(self, app_utils_obj_conn, check_handler):
        _, conn = app_utils_obj_conn
        bad_check_group = [
            ['test_random_nums', {}, [], 'xx1'],
            ['wrangler_checks/item_counts_by_type', 'should_be_a_dict', [], 'xx1'],
            ['syscks/test_random_nums', {}, [], 'xx1'],
            ['wrangler_checks/iteasdts_by_type', {}, [], 'xx1'],
            ['test_checks/test_function_unused', {}, [], 'xx1']
        ]
        for bad_check_info in bad_check_group:
            check_res = check_handler.run_check_or_action(conn, bad_check_info[0], bad_check_info[1])
            assert not (isinstance(check_res, dict))
            assert ('ERROR' in check_res)

    def test_run_check_exception(self, app_utils_obj_conn, check_handler):
        _, conn = app_utils_obj_conn
        check_res = check_handler.run_check_or_action(conn, 'test_checks/test_check_error', {})
        assert (check_res['status'] == 'ERROR')
        # this output is a list
        assert ('by zero' in ''.join(check_res['full_output']))
        assert (check_res['description'] == 'Check failed to run. See full output.')

    def test_run_action_no_check_name_called_by(self, app_utils_obj_conn, check_handler):
        _, conn = app_utils_obj_conn
        action_res = check_handler.run_check_or_action(conn, 'test_checks/test_action_error', {})
        assert (action_res['status'] == 'FAIL')
        # this output is a list
        assert ('Action requires check_name and called_by in its kwargs' in ''.join(action_res['output']))
        assert (action_res['description'] == 'Action failed to run. See output.')

    def test_run_action_exception(self, app_utils_obj_conn, check_handler):
        _, conn = app_utils_obj_conn
        action_res = check_handler.run_check_or_action(conn, 'test_checks/test_action_error', {'check_name': '', 'called_by': None})
        assert (action_res['status'] == 'FAIL')
        # this output is a list
        assert ('by zero' in ''.join(action_res['output']))
        assert (action_res['description'] == 'Action failed to run. See output.')

    def test_create_placeholder_check(self):
        """ Tests that placeholder checks are properly generated """
        placeholder = check_schema.CheckSchema().create_placeholder_check('test_check')
        assert placeholder['name'] == 'test_check'
        assert placeholder['status'] == 'PASS'
        assert placeholder['description'] == 'If queued, this check will run with default arguments'
