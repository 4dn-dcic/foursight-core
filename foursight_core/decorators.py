import traceback
import signal
import time
import sys
import os
from dcicutils.misc_utils import ignored
from functools import wraps
from .check_schema import CheckSchema
from .run_result import (
    CheckResult as CheckResultBase,
    ActionResult as ActionResultBase
)
from .exceptions import BadCheckOrAction
from .sqs_utils import SQS

# dmichaels/2022-09-20: Foursight React related addition.
# Added this to get a handle on the check function kwargs defined via the check_function
# decorator on the checks. Currently the Foursight UI seems to display these only by
# virtue of them having been in a result set of an actual check run. But we would
# like to get and present these without having to get the check history; and only
# displaying if the check has ever been run.
_decorator_registry = []

class Decorators(object):

    @staticmethod
    def get_registry():
        return _decorator_registry

    CHECK_DECO = 'check_function'
    ACTION_DECO = 'action_function'
    POLL_INTERVAL = 10  # check child process every 10 seconds
    CHECK_TIMEOUT = 870  # in seconds. set to less than lambda limit (900 s)

    def __init__(self, foursight_prefix):
        if os.environ.get('CHECK_TIMEOUT'):
            self.set_timeout(os.environ.get('CHECK_TIMEOUT'))
        self.prefix = foursight_prefix
        self.sqs = SQS(self.prefix)

    def CheckResult(self, *args, **kwargs):
        check = CheckResultBase(*args, **kwargs)
        check.set_prefix(self.prefix)
        return check

    def ActionResult(self, *args, **kwargs):
        action = ActionResultBase(*args, **kwargs)
        action.set_prefix(self.prefix)
        return action

    def set_timeout(self, timeout):
        try:
            timeout = int(timeout)
        except ValueError:
            print(f'ERROR! Timeout must be an integer. You gave: {timeout}')
        else:
            self.CHECK_TIMEOUT = timeout

    def check_function(self, *default_args, **default_kwargs):
        """
        Import decorator, used to decorate all checks.
        Sets the check_decorator attribute so that methods can be fetched.
        Any kwargs provided to the decorator will be passed to the function
        if no kwargs are explicitly passed.
        Handles all exceptions within running of the check, including validation
        issues/some common errors when writing checks. Will also keep track of overall
        runtime and cancel the check with status=ERROR if runtime exceeds CHECK_TIMEOUT.
        If an exception is raised, will store the result in full_output and
        return an ERROR CheckResult.
        """
        ignored(default_args)

        def check_deco(func):
            decorator_registry_record = {
                "function": func.__name__,
                "args": default_args,
                "kwargs": default_kwargs,
            }
            _decorator_registry.append(decorator_registry_record)
            @wraps(func)
            def wrapper(*args, **kwargs):
                start_time = time.time()
                kwargs = self.handle_kwargs(kwargs, default_kwargs)
                parent_pid = os.getpid()
                child_pid = os.fork()
                if child_pid != 0:  # we are the parent who will execute the check
                    try:
                        check = func(*args, **kwargs)
                        check.validate()
                    except Exception:
                        # connection should be the first (and only) positional arg
                        check = self.CheckResult(args[0], func.__name__)
                        check.status = 'ERROR'
                        check.description = 'Check failed to run. See full output.'
                        check.full_output = traceback.format_exc().split('\n')
                    kwargs['runtime_seconds'] = round(time.time() - start_time, 2)
                    check.kwargs = kwargs
                    os.kill(child_pid, signal.SIGKILL)  # we finished, so kill child
                    return check.store_result()
                else:  # we are the child who handles the timeout
                    partials = {'name': func.__name__, 'kwargs': kwargs, 'is_check': True,
                                'start_time': start_time, 'connection': args[0]}
                    self.do_timeout(parent_pid, partials)

            wrapper.check_decorator = self.CHECK_DECO
            return wrapper

        return check_deco

    def action_function(self, *default_args, **default_kwargs):
        """
        Import decorator, used to decorate all actions.
        Required for action functions.
        Any kwargs provided to the decorator will be passed to the function
        if no kwargs are explicitly passed.
        Handles all exceptions within running of the action, including validation
        issues/some common errors when writing actions. Will also keep track of overall
        runtime and cancel the check with status=ERROR if runtime exceeds CHECK_TIMEOUT.
        If an exception is raised, will store the result in output and return an
        ActionResult with status FAIL.
        """
        ignored(default_args)

        def action_deco(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                start_time = time.time()
                kwargs = self.handle_kwargs(kwargs, default_kwargs)
                parent_pid = os.getpid()
                child_pid = os.fork()
                if child_pid != 0:  # we are the parent who will execute the check
                    try:
                        if 'check_name' not in kwargs or 'called_by' not in kwargs:
                            raise BadCheckOrAction('Action requires check_name and called_by in its kwargs.')
                        action = func(*args, **kwargs)
                        action.validate()
                    except Exception:
                        # connection should be the first (and only) positional arg
                        action = self.ActionResult(args[0], func.__name__)
                        action.status = 'FAIL'
                        action.description = 'Action failed to run. See output.'
                        action.output = traceback.format_exc().split('\n')
                    kwargs['runtime_seconds'] = round(time.time() - start_time, 2)
                    action.kwargs = kwargs
                    os.kill(child_pid, signal.SIGKILL)  # we finished, so kill child
                    return action.store_result()
                else:  # we are the child who handles the timeout
                    partials = {'name': func.__name__, 'kwargs': kwargs, 'is_check': False,
                                'start_time': start_time, 'connection': args[0]}
                    self.do_timeout(parent_pid, partials)

            wrapper.check_decorator = self.ACTION_DECO
            return wrapper

        return action_deco

    def do_timeout(self, parent_pid, partials):
        """ Wrapper for below method that handles:
                1. Polling across the CHECK_TIMEOUT at POLL_INTERVAL
                2. Exiting if we succeeded (the parent process died)
                3. Killing the parent if it timed out
                4. Invoking the timeout handler if it timed out

            :arg parent_pid: parent pid to check on/kill if necessary
            :arg partials: partial result to be passed to timeout handler if necessary
        """
        for t in range(self.CHECK_TIMEOUT // self.POLL_INTERVAL):  # Divide CHECK_TIMEOUT into POLL_INTERVAL slices
            time.sleep(self.POLL_INTERVAL)
            if not self.pid_is_alive(parent_pid):
                sys.exit(0)

        # We have timed out. Kill the parent and invoke the timeout handler.
        # NOTE: Timeouts in Pytest will trigger undefined behavior since the parent is Pytest, not the thing
        # executing the check. Execute Pytest with --forked option to override this.
        os.kill(parent_pid, signal.SIGTERM)
        self.timeout_handler(partials)

    def timeout_handler(self, partials, signum=None, frame=None):
        """
        Custom handler for signal that stores the current check
        or action with the appropriate information and then exits using sys.exit
        """
        ignored(signum, frame)
        if partials['is_check']:
            result = self.CheckResult(partials['connection'], partials['name'])
            result.status = 'ERROR'
        else:
            result = self.ActionResult(partials['connection'], partials['name'])
            result.status = 'FAIL'
        result.description = 'AWS lambda execution reached the time limit. Please see check/action code.'
        kwargs = partials['kwargs']
        kwargs['runtime_seconds'] = round(time.time() - partials['start_time'], 2)
        result.kwargs = kwargs
        result.store_result()
        # need to delete the sqs message and propogate if this is using the queue
        if kwargs.get('_run_info') and {'receipt', 'sqs_url'} <= set(kwargs['_run_info'].keys()):
            runner_input = {'sqs_url': kwargs['_run_info']['sqs_url']}
            self.sqs.delete_message_and_propogate(runner_input, kwargs['_run_info']['receipt'])
        sys.exit(f"-RUN-> TIMEOUT for execution of {partials['name']}."
                 f" Elapsed time is {kwargs['runtime_seconds']} seconds;"
                 f" keep under {self.CHECK_TIMEOUT}.")

    @classmethod
    def handle_kwargs(cls, kwargs, default_kwargs):
        # add all default args that are not defined in kwargs
        # also ensure 'uuid' and 'primary' are in there
        for key in default_kwargs:
            if key not in kwargs:
                kwargs[key] = default_kwargs[key]
        if 'uuid' not in kwargs:
            kwargs['uuid'] = CheckSchema().create_uuid()
        if 'primary' not in kwargs:
            kwargs['primary'] = False
        return kwargs

    @classmethod
    def pid_is_alive(cls, pid):
        """
        Returns True if pid is still alive
        """
        try:
            os.kill(pid, 0)  # do not send a signal, just error check
        except OSError:
            return False
        else:
            return True
