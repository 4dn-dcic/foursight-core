import pytest
from foursight_core import run_result


class TestActionResult:
    act_name = 'test_only_action'

    def test_action_result_methods(self, app_utils_obj_conn):
        _, connection = app_utils_obj_conn
        action = run_result.ActionResult(connection, self.act_name)
        res = action.store_result()
        assert (res.get('status') == 'PEND')
        assert (res.get('output') is None)
        assert (res.get('type') == 'action')
        assert ('uuid' in res.get('kwargs'))
        action.kwargs = {'do_not_store': True}
        unstored_res = action.store_result()  # will not update the latest result
        assert ('do_not_store' in unstored_res['kwargs'])
        res2 = action.get_latest_result()
        # remove id_alias's which will differ
        del res['id_alias']
        del res2['id_alias']
        assert (res == res2)
        # bad status
        action.kwargs = {'abc': 123}
        action.status = 'NOT_VALID'
        res = action.store_result()
        assert (res.get('status') == 'FAIL')
        assert (res.get('description') == 'Malformed status; look at Foursight action definition.')
        assert (res['kwargs']['abc'] == 123)
        assert ('uuid' in res.get('kwargs'))
        # this action has no check_name/called_by kwargs, so expect KeyError
        with pytest.raises(KeyError):
            action.get_associated_check_result(action.kwargs)
