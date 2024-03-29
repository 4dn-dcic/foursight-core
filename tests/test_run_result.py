import datetime
from conftest import *
from foursight_core import run_result


@pytest.fixture
def run(app_utils_obj_conn):
    check_name = 'test_only_check'
    app_utils_obj, conn = app_utils_obj_conn
    run = run_result.CheckResult(conn, check_name)  # test RunResult using the inherited class
    return run


class TestRunResult:
    check_name = 'test_only_check'
    environ = DEV_ENV

    def setup_valid_check(self, app_utils_obj_conn):
        """ Sets up a 'valid' check according to ES """
        _, conn = app_utils_obj_conn
        check = run_result.CheckResult(conn, 'test_check')
        check.summary = 'A string summary'
        check.description = 'A string description'
        check.ff_link = 'A string link'
        check.action = 'A string action'
        check.kwargs = {}
        return check

    def test_validate_check_result(self, app_utils_obj_conn):
        """ Tests some check validation errors """
        _, conn = app_utils_obj_conn
        check = self.setup_valid_check(app_utils_obj_conn)
        check.store_result = 'Not a fxn'
        with pytest.raises(run_result.BadCheckOrAction) as exc:
            check.validate()
        assert (str(exc.value) == 'Do not overwrite the store_result method.')
        check = run_result.CheckResult(conn, 'test_check')
        check.kwargs = 'this is a string, expected a dict'
        with pytest.raises(run_result.BadCheckOrAction) as exc:
            check.validate()
        assert ("is not of type <class 'dict'>" in str(exc.value))
        check = self.setup_valid_check(app_utils_obj_conn)
        check.name = 5
        check.allow_action = 'yes please'
        with pytest.raises(run_result.BadCheckOrAction) as exc:
            check.validate()
        assert ("is not of type <class 'str'>" in str(exc.value))
        assert ("is not of type <class 'bool'>" in str(exc.value))

    def test_validate_action_result(self, app_utils_obj_conn):
        """ Tests some action validation errors """
        _, conn = app_utils_obj_conn
        action = run_result.ActionResult(conn, 'test_check')
        action.validate() # constructor should pass validation
        action.store_result = 'Not a fxn'
        with pytest.raises(run_result.BadCheckOrAction) as exc:
            action.validate()
        assert (str(exc.value) == 'Do not overwrite the store_result method.')
        action.kwargs = 17
        with pytest.raises(run_result.BadCheckOrAction) as exc:
            action.validate()
        assert ("is not of type <class 'dict'>" in str(exc.value))
        action.name = {}
        with pytest.raises(run_result.BadCheckOrAction) as exc:
            action.validate()
        assert ("is not of type <class 'str'>" in str(exc.value))

    def test_BadCheckOrAction(self):
        test_exc = run_result.BadCheckOrAction()
        assert (str(test_exc) == 'Check or action function seems to be malformed.')
        test_exc = run_result.BadCheckOrAction('Abcd')
        assert (str(test_exc) == 'Abcd')

    @pytest.mark.flaky
    def test_delete_results_nonprimary(self, app_utils_obj_conn, run):
        """
        Makes 5 non-primary checks and 1 primary check, deletes those 5 checks,
        verifies only those 5 were deleted, then deletes the primary check
        """
        _, conn = app_utils_obj_conn
        # post some new checks
        for _ in range(5):
            check = run_result.CheckResult(conn, self.check_name)
            check.description = 'This check is just for testing purposes.'
            check.status = 'PASS'
            check.store_result()

        # post a primary check (should persist)
        primary_check = run_result.CheckResult(conn, self.check_name)
        primary_check.description = 'This is a primary check - it should persist'
        primary_check.kwargs = {'primary': True}
        res = primary_check.store_result()
        if primary_check.connections['es'] is not None:
            primary_check.connections['es'].refresh_index()
        num_deleted_s3, num_deleted_es = run.delete_results(prior_date=datetime.datetime.utcnow())
        assert num_deleted_s3 == 5 # primary result should not have been deleted
        if primary_check.connections['es'] is not None:
            assert num_deleted_es == 5
            assert primary_check.get_es_object('test_only_check/' + res['kwargs']['uuid'] + '.json')
        queried_primary = run.get_result_by_uuid(res['kwargs']['uuid'])
        assert res['kwargs']['uuid'] == queried_primary['kwargs']['uuid']
        primary_deleted_s3, primary_deleted_es = run.delete_results(primary=False)
        assert primary_deleted_s3 >= 1 # now primary result should be gone
        if primary_check.connections['es'] is not None:
            assert primary_deleted_es >= 1
        assert not run.get_result_by_uuid(res['kwargs']['uuid'])

    @pytest.mark.flaky
    def test_delete_results_primary(self, app_utils_obj_conn, run):
        """
        Tests deleting a primary check
        """
        _, conn = app_utils_obj_conn
        check = run_result.CheckResult(conn, self.check_name)
        check.description = 'This check is just for testing purposes.'
        check.status = 'PASS'
        check.kwargs = {'primary': True}
        res = check.store_result()
        queried_primary = run.get_result_by_uuid(res['kwargs']['uuid'])
        assert res['kwargs']['uuid'] == queried_primary['kwargs']['uuid']
        if check.connections['es'] is not None:  # force a refresh before the delete
            check.connections['es'].refresh_index()
        num_deleted_s3, num_deleted_es = run.delete_results(primary=False)
        assert num_deleted_s3 == 1
        if check.connections['es'] is not None:
            assert num_deleted_es == 1
        assert not run.get_result_by_uuid(res['kwargs']['uuid'])

    @pytest.mark.flaky
    def test_delete_results_custom_filter(self, app_utils_obj_conn, run):
        """
        Post some checks with a term in the description that we filter out
        based on a custom_filter
        """
        _, conn = app_utils_obj_conn
        def term_in_descr(key):
            obj = run.get_s3_object(key)
            if obj.get('description') is not None:
                return 'bad_term' in obj.get('description')
            return False

        # post some checks to be filtered
        for _ in range(5):
            check = run_result.CheckResult(conn, self.check_name)
            check.description = 'This check contains bad_term which should be filtered.'
            check.status = 'PASS'
            check.store_result()
        for _ in range(3):
            check = run_result.CheckResult(conn, self.check_name)
            check.description = 'This check is just for testing purposes.'
            check.status = 'PASS'
            check.store_result()
            check.connections['es'].refresh_index()  # force refresh
        num_deleted_s3, num_deleted_es = run.delete_results(custom_filter=term_in_descr)
        assert num_deleted_s3 == 5
        if check.connections['es'] is not None:
            assert num_deleted_es == 5
        num_deleted_s3, num_deleted_es = run.delete_results()
        assert num_deleted_s3 == 3
        if check.connections['es'] is not None:
            assert num_deleted_es == 3

    @pytest.mark.flaky
    def test_delete_results_bad_filter(self, app_utils_obj_conn, run):
        """
        Posts a check then attempts to delete it with an invalid custom_filter
        Should raise an exception. Check is then deleted.
        """
        _, conn = app_utils_obj_conn
        def bad_filter(key):
            raise Exception

        check = run_result.CheckResult(conn, self.check_name)
        check.description = 'This check is just for testing purposes.'
        check.status = 'PASS'
        check.store_result()
        with pytest.raises(Exception):
            run.delete_results(custom_filter=bad_filter)
        num_deleted, _ = run.delete_results()
        assert num_deleted == 1

    @pytest.mark.flaky
    def test_delete_results_primary_custom_filter(self, app_utils_obj_conn, run):
        """
        Posts two primary checks, deletes more recent one based on custom filter
        and checks get_primary_result gives the second one still since it will
        have been copied
        """
        _, conn = app_utils_obj_conn
        one_uuid = datetime.datetime.utcnow().isoformat()
        two_uuid = datetime.datetime.utcnow().isoformat()

        # this function will look to delete a specific primary check based on
        # two_uuid (ie: it should only delete that uuid)
        def filter_specific_uuid(key):
            obj = run.get_s3_object(key)
            return obj['kwargs']['uuid'] == two_uuid

        # setup, post checks
        p_check_one = run_result.CheckResult(conn, self.check_name)
        p_check_one.description = "This is the first primary check"
        p_check_one.status = 'PASS'
        p_check_one.kwargs = {'primary': True, 'uuid': one_uuid}
        p_check_one.store_result()
        p_check_two = run_result.CheckResult(conn, self.check_name)
        p_check_two.description = "This is the second primary check"
        p_check_two.status = 'PASS'
        p_check_two.kwargs = {'primary': True, 'uuid': two_uuid}
        p_check_two.store_result()
        queried_primary = run.get_primary_result()
        assert queried_primary['kwargs']['uuid'] == two_uuid
        num_deleted, _ = run.delete_results(primary=False, custom_filter=filter_specific_uuid)
        assert num_deleted == 1
        queried_primary = run.get_primary_result()
        assert queried_primary['kwargs']['uuid'] == two_uuid

    @pytest.mark.flaky
    def test_delete_results_error_filter(self, app_utils_obj_conn, run):
        """
        Posts two checks - one successful, one fail, deletes the failed check
        using a custom filter, deletes the successful check after
        """
        _, conn = app_utils_obj_conn
        def filter_error(key):
            obj = run.get_s3_object(key)
            return obj['status'] == 'ERROR'

        check_one = run_result.CheckResult(conn, self.check_name)
        check_one.description = "This is the first check, it failed"
        check_one.status = 'ERROR'
        check_one.store_result()
        check_two = run_result.CheckResult(conn, self.check_name)
        check_two.description = "This is the second check, it passed"
        check_two.status = 'PASS'
        resp = check_two.store_result()
        assert len(check_one.list_keys()) >= 2
        num_deleted, _ = run.delete_results(custom_filter=filter_error)
        assert num_deleted == 1
        assert run.get_result_by_uuid(resp['uuid'])
        num_deleted, _ = run.delete_results()
        assert num_deleted == 1
