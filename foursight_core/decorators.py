import inspect
import json
import os
import signal
import sys
import time
import traceback
from typing import Tuple
from dcicutils.misc_utils import ignored, get_error_message, PRINT
from functools import wraps
from foursight_core.check_schema import CheckSchema
from foursight_core.run_result import (
    CheckResult as CheckResultBase,
    ActionResult as ActionResultBase
)
from foursight_core.exceptions import BadCheckOrAction
from foursight_core.react.api.misc_utils import get_github_url
from foursight_core.sqs_utils import SQS
from foursight_core.react.api.misc_utils import get_function_info

# dmichaels/2022-09-20: Foursight React related addition.
# Added this to get a handle on the check function kwargs defined via the check_function
# decorator on the checks. Currently the Foursight UI seems to display these only by
# virtue of them having been in a result set of an actual check run. But we would
# like to get and present these without having to get the check history;
# and without the check having to been run.
_decorator_registry = {}

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
            PRINT(f'ERROR! Timeout must be an integer. You gave: {timeout}')
        else:
            self.CHECK_TIMEOUT = timeout

    def create_registry_check_record(self, func, default_args, default_kwargs) -> None:
        self.create_registry_record("check", func, default_args, default_kwargs)

    def create_registry_action_record(self, func, default_args, default_kwargs) -> None:
        self.create_registry_record("action", func, default_args, default_kwargs)

    def create_registry_record(self, kind, func, default_args, default_kwargs) -> None:
        func_name, func_file, func_module, func_package, func_line, func_github_url = get_function_info(func)
        if _decorator_registry.get(func_name):
            PRINT(f"WARNING: Duplicate {kind} decorator registration (skipping): {func_name}")
            return
        PRINT(f"Registering {kind}: {func_module}.{func_name}")
        if kind == "check" and default_kwargs.get("action"):
            associated_action = default_kwargs["action"]
            del default_kwargs["action"]
        else:
            associated_action = None
        registry_record = {
            "kind": kind,
            "name": func_name,
            "file": func_file,
            "line": func_line,
            "module": func_module,
            "package": func_package,
            "github_url": get_github_url(func_package, func_file, func_line),
            "args": default_args,
            "kwargs": default_kwargs,
            "function": func.__name__
        }
        if associated_action:
            registry_record["action"] = associated_action
        elif kind == "action":
            for name in _decorator_registry:
                item = _decorator_registry[name]
                if item.get("action") == func_name:
                    registry_record["check"] = item["name"] 
        _decorator_registry[func_name] = registry_record

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
        outer_args = default_args
        outer_kwargs = default_kwargs

        def check_deco(func):

            # 2024-03-03/dmichaels: Added action_auto, action_manual, action_disable check decorator boolean
            # or callable-returning-boolean options to force any associated action, after the check run, to
            # run automatically, or to force it to not run automatically but to allow it to be run manually,
            # or to not allow it to be run at allow, respectively. These are mutually exclusive; if more than
            # one is set, then the first one to resolve to True, in reverse order (i.e. in order from disable,
            # to manual, to auto) will be respected. NOTE: These work by setting the allow_check and prevent_check
            # properties of the check result, and these new options will OVERRIDE these values which might have
            # been expliclity set within the check code itself.
            action_disable = None
            action_manual = None
            action_auto = None
            if default_kwargs.get("action_disable") is True or callable(default_kwargs.get("action_disable")):
                action_disable = default_kwargs.get("action_disable")
            elif default_kwargs.get("action_manual") is True or callable(default_kwargs.get("action_manual")):
                action_manual = default_kwargs.get("action_manual")
            elif default_kwargs.get("action_auto") is True or callable(default_kwargs.get("action_auto")):
                action_auto = default_kwargs.get("action_auto")
            default_kwargs.pop("action_auto", None)
            default_kwargs.pop("action_manual", None)
            default_kwargs.pop("action_disable", None)

            self.create_registry_check_record(func, default_args, default_kwargs)

            @wraps(func)
            def wrapper(*args, **kwargs):
                start_time = time.time()
                kwargs = self.handle_kwargs(kwargs, default_kwargs)
                parent_pid = os.getpid()
                child_pid = os.fork()
                if child_pid != 0:  # we are the parent who will execute the check
                    try:
                        check = func(*args, **kwargs)
                        if ((action_disable is True) or
                            (callable(action_disable) and action_disable(check) is True)):
                            check.allow_action = False
                            check.prevent_action = True
                        elif ((action_manual is True) or
                              (callable(action_manual) and action_manual(check) is True)):
                            check.allow_action = True
                            check.prevent_action = True
                        elif ((action_auto is True) or
                              (callable(action_auto) and action_auto(check) is True)):
                            check.allow_action = True
                            check.prevent_action = False
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
            self.create_registry_action_record(func, default_args, default_kwargs)
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
