import random
import time

# Use confchecks to import decorators object and its methods for each check module
# rather than importing check_function, action_function, CheckResult, ActionResult
# individually - they're now part of class Decorators in foursight-core::decorators
# that requires initialization with foursight prefix.

from dcicutils.misc_utils import ignored
# from .helpers.confchecks import *
from .helpers.confchecks import (
    check_function, CheckResult,
    action_function, ActionResult,
)


def test_function_unused():
    return


# meant to raise an error on execution by dividing by 0
@check_function()
def test_check_error(connection, **kwargs):
    ignored(connection, kwargs)
    bad_op = 10 * 1/0
    return bad_op


@action_function()
def test_action_error(connection, **kwargs):
    ignored(connection, kwargs)
    bad_op = 10 * 1/0
    return bad_op


# silly check that stores random numbers in a list
@check_function(action="add_random_test_nums")
def test_random_nums(connection, **kwargs):
    ignored(kwargs)
    check = CheckResult(connection, 'test_random_nums')
    check.status = 'IGNORE'
    check.action = 'add_random_test_nums'
    check.allow_action = True
    output = []
    for i in range(random.randint(1, 20)):
        output.append(random.randint(1, 100))
    check.full_output = {
        "output": output
    }
    check.description = 'A test check'
    # sleep for 4 secs because this is used to test timing out
    time.sleep(4)
    return check


# same as above
@check_function()
def test_random_nums_2(connection, **kwargs):
    ignored(kwargs)
    check = CheckResult(connection, 'test_random_nums_2')
    check.status = 'IGNORE'
    output = []
    for i in range(random.randint(1, 20)):
        output.append(random.randint(1, 100))
    check.full_output = {
        "output": output
    }
    check.description = 'A test check as well'
    return check


@action_function(offset=0)
def add_random_test_nums(connection, **kwargs):
    action = ActionResult(connection, 'add_random_test_nums')
    check = CheckResult(connection, 'test_random_nums')
    # output includes primary and latest results, to compare
    check_latest = check.get_latest_result()
    nums_latest = check_latest.get('full_output', [])
    total_latest = sum(nums_latest.get('output')) + int(kwargs.get('offset', 0))
    check_primary = check.get_primary_result()
    nums_primary = check_primary.get('full_output', []) if check_primary else None
    total_primary = (sum(nums_primary.get('output')) + int(kwargs.get('offset', 0))) if nums_primary else None
    action.output = {'latest': total_latest, 'primary': total_primary}
    action.status = 'DONE'
    action.description = 'A test action'
    return action
