# General utils for foursight
from __future__ import print_function, unicode_literals
import types
import datetime
from importlib import import_module
from functools import wraps
from .run_result import CheckResult, ActionResult

CHECK_DECO = 'check_function'
ACTION_DECO = 'action_function'


def init_check_res(connection, name, uuid=None, runnable=False):
    """
    Initialize a CheckResult object, which holds all information for a
    check and methods necessary to store and retrieve latest/historical
    results. name is the only required parameter and MUST be equal to
    the method name of the check as defined in CheckSuite.

    uuid is a timestamp-style unique identifier that can be used to control
    where the output of the check is written.

    runnable is a boolean that determines if the check can be executed from UI.
    """
    return CheckResult(connection.s3_connection, name, uuid=uuid, runnable=runnable)


def init_action_res(connection, name):
    """
    Similar to init_check_res, but meant to be used for ActionResult items
    """
    return ActionResult(connection.s3_connection, name)

def build_dummy_result(check_name):
    """
    Simple function to return a dict consistent with a CheckResult dictionary
    content but is not actually stored.
    """
    return {
        'status': 'IGNORE',
        'name': check_name,
        'uuid': datetime.datetime.utcnow().isoformat()
    }


def get_methods_by_deco(cls, decorator):
    """
    Returns all methods in cls/module with decorator as a list;
    the decorator is set in check_function()
    """
    methods = []
    for maybeDecorated in cls.__dict__.values():
        if hasattr(maybeDecorated, 'check_decorator'):
            if maybeDecorated.check_decorator == decorator:
                methods.append(maybeDecorated)
    return methods


def check_method_deco(method, decorator):
    """
    See if the given method has the given decorator. Returns True if so,
    False if not.
    """
    return hasattr(method, 'check_decorator') and method.check_decorator == decorator


def check_function(*default_args, **default_kwargs):
    """
    Import decorator, used to decorate all checks.
    Sets the check_decorator attribute so that methods can be fetched.
    Any kwargs provided to the decorator will be passed to the function
    if no kwargs are explicitly passed.
    """
    def check_deco(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # add all default args that are not defined in kwargs
            for key in default_kwargs:
                if key not in kwargs:
                    kwargs[key] = default_kwargs[key]
            return func(*args, **kwargs)
        wrapper.check_decorator = CHECK_DECO
        return wrapper
    return check_deco


def action_function(*default_args, **default_kwargs):
    """
    Import decorator, used to decorate all actions.
    Required for action functions.
    Any kwargs provided to the decorator will be passed to the function
    if no kwargs are explicitly passed.
    """
    def action_deco(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # add all default args that are not defined in kwargs
            for key in default_kwargs:
                if key not in kwargs:
                    kwargs[key] = default_kwargs[key]
            return func(*args, **kwargs)
        wrapper.check_decorator = ACTION_DECO
        return wrapper
    return action_deco
