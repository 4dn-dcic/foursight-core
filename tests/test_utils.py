import os
import datetime

from conftest import *
from foursight_core import run_result
from foursight_core import check_utils
from foursight_core.decorators import Decorators
from dcicutils.misc_utils import ignored


class TestUtils:
    environ = DEV_ENV  # hopefully this is up

    def test_check_timeout(self):
        assert (isinstance(Decorators(FOURSIGHT_PREFIX).CHECK_TIMEOUT, int))

    @pytest.mark.skip  # the built-in timeout mechanism does not (did not ever?) work - Will Oct 14 2022
    def test_check_times_out(self, app_utils_obj_conn):
        _, conn = app_utils_obj_conn
        old_timeout = os.environ.get('CHECK_TIMEOUT', None)
        # set to one second, which is slower than test check
        try:
            os.environ['CHECK_TIMEOUT'] = '1'
            with pytest.raises(SystemExit) as exc:
                check_utils.CheckHandler(FOURSIGHT_PREFIX).run_check_or_action(conn, 'test_checks/test_random_nums', {})
            assert ('-RUN-> TIMEOUT' in str(exc.value))
        finally:
            if old_timeout:
                os.environ['CHECK_TIMEOUT'] = old_timeout
            else:
                del os.environ['CHECK_TIMEOUT']

    def test_check_function_deco_default_kwargs(self, app_utils_obj_conn):
        # test to see if the check_function decorator correctly overrides
        # definition moved here so can reference app_utils_obj_conn fixture
        @check_function(abc=123, do_not_store=True, uuid=datetime.datetime.utcnow().isoformat())
        def test_function_dummy(*args, **kwargs):
            ignored(args, kwargs)
            _, conn = app_utils_obj_conn
            check = run_result.CheckResult(conn, 'not_a_check')
            check.summary = 'A string summary'
            check.description = 'A string description'
            check.ff_link = 'A string link'
            check.action = 'A string action'
            check.kwargs = {}
            return check

        # kwargs of decorated function if none are provided
        kwargs_default = test_function_dummy().get('kwargs')
        # pop runtime_seconds from here
        assert ('runtime_seconds' in kwargs_default)
        runtime = kwargs_default.pop('runtime_seconds')
        assert (isinstance(runtime, float))
        assert ('_run_info' not in kwargs_default)
        uuid = kwargs_default.get('uuid')
        assert (kwargs_default
                == {'abc': 123, 'do_not_store': True, 'uuid': uuid, 'primary': False,
                    'queue_action': 'Not queued'})
        kwargs_add = test_function_dummy(bcd=234).get('kwargs')
        assert ('runtime_seconds' in kwargs_add)
        kwargs_add.pop('runtime_seconds')
        assert (kwargs_add
                == {'abc': 123, 'bcd': 234, 'do_not_store': True, 'uuid': uuid, 'primary': False,
                    'queue_action': 'Not queued'})
        kwargs_override = test_function_dummy(abc=234, primary=True).get('kwargs')
        assert ('runtime_seconds' in kwargs_override)
        kwargs_override.pop('runtime_seconds')
        assert (kwargs_override
                == {'abc': 234, 'do_not_store': True, 'uuid': uuid, 'primary': True,
                    'queue_action': 'Not queued'})

    def test_handle_kwargs(self):
        default_kwargs = {'abc': 123, 'bcd': 234}
        kwargs = Decorators.handle_kwargs({'abc': 345}, default_kwargs)
        assert (kwargs.get('abc') == 345)
        assert (kwargs.get('bcd') == 234)
        assert (kwargs.get('uuid').startswith('20'))
        assert (kwargs.get('primary') is False)
