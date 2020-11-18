# General utils for foursight
from __future__ import print_function, unicode_literals
import traceback
import signal
import time
import os
from functools import wraps
from .run_result import CheckResult, ActionResult
from .vars import CHECK_TIMEOUT
from .exceptions import BadCheckOrAction
from .sqs_utils import delete_message_and_propogate


class Decorators(object):

    CheckResult = CheckResult
    ActionResult = ActionResult

    @classmethod
    def check_function(cls, *default_args, **default_kwargs):
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
        def check_deco(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                start_time = time.time()
                kwargs = cls.handle_kwargs(kwargs, default_kwargs)
                parent_pid = os.getpid()
                child_pid = os.fork()
                if child_pid != 0:  # we are the parent who will execute the check
                    try:
                        check = func(*args, **kwargs)
                        check.validate()
                    except Exception as e:
                        # connection should be the first (and only) positional arg
                        check = cls.CheckResult(args[0], func.__name__)
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
                    cls.do_timeout(parent_pid, partials)
    
            wrapper.check_decorator = CHECK_DECO
            return wrapper
        return check_deco
    
    @classmethod
    def action_function(cls, *default_args, **default_kwargs):
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
        def action_deco(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                start_time = time.time()
                kwargs = cls.handle_kwargs(kwargs, default_kwargs)
                parent_pid = os.getpid()
                child_pid = os.fork()
                if child_pid != 0:  # we are the parent who will execute the check
                    try:
                        if 'check_name' not in kwargs or 'called_by' not in kwargs:
                            raise BadCheckOrAction('Action requires check_name and called_by in its kwargs.')
                        action = func(*args, **kwargs)
                        action.validate()
                    except Exception as e:
                        # connection should be the first (and only) positional arg
                        action = cls.ActionResult(args[0], func.__name__)
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
                    cls.do_timeout(parent_pid, partials)
    
            wrapper.check_decorator = ACTION_DECO
            return wrapper
        return action_deco

    @classmethod
    def do_timeout(cls, parent_pid, partials):
        """ Wrapper for below method that handles:
                1. Polling across the CHECK_TIMEOUT at POLL_INTERVAL
                2. Exiting if we succeeded (the parent process died)
                3. Killing the parent if it timed out
                4. Invoking the timeout handler if it timed out
    
            :arg parent_pid: parent pid to check on/kill if necessary
            :arg partials: partial result to be passed to timeout handler if necessary
        """
        for t in range(CHECK_TIMEOUT // POLL_INTERVAL):  # Divide CHECK_TIMEOUT into POLL_INTERVAL slices
            time.sleep(POLL_INTERVAL)
            if not cls.pid_is_alive(parent_pid):
                sys.exit(0)
    
        # We have timed out. Kill the parent and invoke the timeout handler.
        # NOTE: Timeouts in Pytest will trigger undefined behavior since the parent is Pytest, not the thing
        # executing the check. Execute Pytest with --forked option to override this.
        os.kill(parent_pid, signal.SIGTERM)
        cls.timeout_handler(partials)
    
    @classmethod
    def timeout_handler(cls, partials, signum=None, frame=None):
        """
        Custom handler for signal that stores the current check
        or action with the appropriate information and then exits using sys.exit
        """
        if partials['is_check']:
            result = CheckResult(partials['connection'], partials['name'])
            result.status = 'ERROR'
        else:
            result = ActionResult(partials['connection'], partials['name'])
            result.status = 'FAIL'
        result.description = 'AWS lambda execution reached the time limit. Please see check/action code.'
        kwargs = partials['kwargs']
        kwargs['runtime_seconds'] = round(time.time() - partials['start_time'], 2)
        result.kwargs = kwargs
        result.store_result()
        # need to delete the sqs message and propogate if this is using the queue
        if kwargs.get('_run_info') and {'receipt', 'sqs_url'} <= set(kwargs['_run_info'].keys()):
            runner_input = {'sqs_url': kwargs['_run_info']['sqs_url']}
            delete_message_and_propogate(runner_input, kwargs['_run_info']['receipt'])
        sys.exit('-RUN-> TIMEOUT for execution of %s. Elapsed time is %s seconds; keep under %s.'
              % (partials['name'], kwargs['runtime_seconds'], CHECK_TIMEOUT))

    @classmethod
    def handle_kwargs(cls, kwargs, default_kwargs):
        # add all default args that are not defined in kwargs
        # also ensure 'uuid' and 'primary' are in there
        for key in default_kwargs:
            if key not in kwargs:
                kwargs[key] = default_kwargs[key]
        if 'uuid' not in kwargs:
            kwargs['uuid'] = datetime.utcnow().isoformat()
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
