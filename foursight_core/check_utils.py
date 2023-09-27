from collections import namedtuple
import copy
import importlib
import json
import logging
import os
from typing import Callable, Optional
from dcicutils.env_base import EnvBase
from dcicutils.env_utils import infer_foursight_from_env
from dcicutils.misc_utils import json_leaf_subst
from foursight_core.check_schema import CheckSchema
from foursight_core.exceptions import BadCheckSetup
from foursight_core.environment import Environment
from foursight_core.decorators import Decorators


logging.basicConfig()
logger = logging.getLogger(__name__)


class CheckHandler(object):
    """
    Class CheckHandler is a collection of utils related to checks
    """
    def __init__(self, foursight_prefix, check_package_name='foursight_core', check_setup_file=None, env=None):
        self.prefix = foursight_prefix
        self.check_package_name = check_package_name
        self.decorators = Decorators(foursight_prefix)
        self.CheckResult = self.decorators.CheckResult
        self.ActionResult = self.decorators.ActionResult
        self.CHECK_DECO = self.decorators.CHECK_DECO
        self.ACTION_DECO = self.decorators.ACTION_DECO
        self.environment = Environment(self.prefix)

        # read in the check_setup.json and parse it
        # NOTE: previously, we globbed for all possible paths - no reason to do this IMO, just check
        # that the passed path exists - Will 5/26/21

        # The check_setup_file is now pass in. It is supposed to ultimately come from chalicelib_cgap or
        # chalicelib_fourfront via the AppUtils there (derived from AppUtilsCore here in foursight-core),
        # which calls back to the locate_check_setup_file function AppUtilsCore here in foursight-core).
        if not os.path.exists(check_setup_file):
            raise BadCheckSetup(f"Did not locate the specified check setup file: {check_setup_file}")
        self.CHECK_SETUP_FILE = check_setup_file  # for display/troubleshooting
        with open(check_setup_file, 'r') as jfile:
            self.CHECK_SETUP = json.load(jfile)
        logger.debug(f"foursight_core/CheckHandler: Loaded check_setup.json file: {check_setup_file} ...")
        logger.debug(self.CHECK_SETUP)
        # Validate and finalize CHECK_SETUP
        logger.debug(f"foursight_core/CheckHandler: Validating check_setup.json file: {check_setup_file}")
        self.CHECK_SETUP = self.expand_check_setup(self.CHECK_SETUP, env)
        self.CHECK_SETUP = self.validate_check_setup(self.CHECK_SETUP)
        logger.debug(f"foursight_core/CheckHandler: Done validating check_setup.json file: {check_setup_file}")

    def get_module_names(self):
        """ Pulls checks from both the pass check_package_name and foursight_core itself (if they differ) """
        check_modules = importlib.import_module('.checks', self.check_package_name).__dict__["__all__"]
        if self.check_package_name != 'foursight_core':
            core_modules = importlib.import_module('.checks', 'foursight_core').__dict__["__all__"]
            return {
                self.check_package_name: check_modules,
                'foursight_core': core_modules
            }
        return {
            self.check_package_name: check_modules
        }

    def import_check_module(self, module_package, module_name):
        return importlib.import_module('.checks.' + module_name, module_package)

    def _extract_module_and_functions(self, mod_package, mod_name, func_type, specific_func=None):
        """ Extracts the module and check or action names from the given mod_name - if
            a specific check is given then just return that check, otherwise
            append to all_checks
        """
        collected_funcs = []
        mod = self.import_check_module(mod_package, mod_name)
        methods = self.get_methods_by_deco(mod, func_type)
        for method in methods:
            func_str = '/'.join([mod_name, method.__name__])
            if specific_func and specific_func == method.__name__:
                return func_str
            elif mod_name != 'test_checks':
                collected_funcs.append(func_str)
        return collected_funcs

    def get_check_strings(self, specific_check=None):
        """
        Return a list of all formatted check strings (<module>/<check_name>) in system.
        By default runs on all checks (specific_check == None), but can be used
        to get the check string of a certain check name as well.

        IMPORTANT: any checks in test_checks module are excluded.
        """
        all_checks = []
        for mod_package, mods in self.get_module_names().items():
            for mod_name in mods:
                collected_checks = self._extract_module_and_functions(mod_package, mod_name, self.CHECK_DECO,
                                                                      specific_check)
                if specific_check and isinstance(collected_checks, str):
                    return collected_checks  # we are looking for a specific one and should return
                else:
                    all_checks += collected_checks
        if specific_check:
            # if we've gotten here, it means the specific check was not checks_found
            return None
        else:
            return list(set(all_checks))

    def get_checks_within_schedule(self, schedule_name):
        """
        Simply return a list of string check names within the given schedule
        """
        checks_in_schedule = []
        for check_name, detail in self.CHECK_SETUP.items():
            if schedule_name not in detail['schedule']:
                continue
            checks_in_schedule.append(check_name)
        return checks_in_schedule

    def locate_defined_checks(self):
        """ Helper function for getting all available check strings (useful for mocking) """
        found_checks = {}
        all_check_strings = self.get_check_strings()
        # validate all checks
        for check_string in all_check_strings:
            mod_name, check_name = check_string.split('/')
            if check_name in found_checks:
                raise BadCheckSetup(f'More than one check with name "{check_name}" was found. See module "{mod_name}"')
            found_checks[check_name] = mod_name
        return found_checks

    @staticmethod
    def expand_check_setup(check_setup_json: dict, env: str) -> dict:
        """
        Expand/replace instance of <env-name> in the given dictionary with the given env name.
        Does this replacment in-place, i.e. to the given dictionary; and also returns this value.
        This does what 4dn-cloud-infra/resolve-foursight-checks was doing; and that now uses this.
        """
        if env:
            ENV_NAME_MARKER = "<env-name>"
            check_setup_json = json_leaf_subst(check_setup_json, {ENV_NAME_MARKER: env})
        return check_setup_json

    def validate_check_setup(self, check_setup):
        """
        Go through the check_setup json that was read in and make sure everything
        is properly formatted. Since scheduled kwargs and dependencies are
        optional, add those in at this point.

        Also takes care of ensuring that multiple checks were not written with the
        same name and adds check module information to the check setup. Accordingly,
        verifies that each check in the check_setup is a real check.
        """
        found_checks = self.locate_defined_checks()
        for check_name in check_setup:
            if check_name not in found_checks:
                raise BadCheckSetup(f'Check with name {check_name} was in check_setup.json'
                                    f' but does not have a proper check function defined.')
            if not isinstance(check_setup[check_name], dict):
                raise BadCheckSetup(f'Entry for "{check_name}" in check_setup.json must be a dictionary.')
            # these fields are required
            if not {'title', 'group', 'schedule'} <= set(check_setup[check_name].keys()):
                raise BadCheckSetup(f'Entry for "{check_name}" in check_setup.json must have'
                                    f' the required keys: "title", "group", and "schedule".')
            # these fields must be strings
            for field in ['title', 'group']:
                if not isinstance(check_setup[check_name][field], str):
                    raise BadCheckSetup(f'Entry for "{check_name}" in check_setup.json'
                                        f' must have a string value for field "{field}".')
            if not isinstance(check_setup[check_name]['schedule'], dict):
                raise BadCheckSetup(f'Entry for "{check_name}" in check_setup.json'
                                    f' must have a dictionary value for field "schedule".')
            # make sure a display is set up if there is no schedule
            if check_setup[check_name]['schedule'] == {} and check_setup[check_name].get('display') is None:
                raise BadCheckSetup(f'Entry for "{check_name}" in check_setup.json'
                                    f' must have a list of "display" environments if it lacks a schedule.')
            # now validate and add defaults to the schedule
            for sched_name, schedule in check_setup[check_name]['schedule'].items():
                if not isinstance(schedule, dict):
                    raise BadCheckSetup(f'Schedule "{sched_name}" for "{check_name}" in check_setup.json'
                                        f' must have a dictionary value.')
                for env_name, env_detail in schedule.items():
                    env_name = infer_foursight_from_env(envname=env_name)
                    if not self.environment.is_valid_environment_name(env_name, or_all=True, strict=True):
                        raise BadCheckSetup(f'Environment "{env_name}" in schedule "{sched_name}" for "{check_name}"'
                                            f' in check_setup.json is not an existing environment.'
                                            f' Environments are defined in the global env bucket'
                                            f' ({EnvBase.global_env_bucket_name()}) in S3.')
                    if not isinstance(env_detail, dict):
                        raise BadCheckSetup(f'Environment "{env_name}" in schedule "{sched_name}"'
                                            f' for "{check_name}" in check_setup.json'
                                            f' must have a dictionary value.')
                    # default values
                    if 'kwargs' not in env_detail:
                        env_detail['kwargs'] = {'primary': True}
                    else:
                        if not isinstance(env_detail['kwargs'], dict):
                            raise BadCheckSetup(f'Environment "{env_name}" in schedule "{sched_name}"'
                                                f' for "{check_name}" in check_setup.json'
                                                f' must have a dictionary value for "kwargs".')
                    if 'dependencies' not in env_detail:
                        env_detail['dependencies'] = []
                    else:
                        if not isinstance(env_detail['dependencies'], list):
                            raise BadCheckSetup(f'Environment "{env_name}" in schedule "{sched_name}"'
                                                f' for "{check_name}" in check_setup.json'
                                                f' must have a list value for "dependencies".')
                        else:
                            # confirm all dependencies are legitimate check names
                            for dep_id in env_detail['dependencies']:
                                if dep_id not in self.get_checks_within_schedule(sched_name):
                                    raise BadCheckSetup(f'Environment "{env_name}" in schedule "{sched_name}"'
                                                        f' for "{check_name}" in check_setup.json'
                                                        f' must has a dependency "{dep_id}" that'
                                                        f' is not a valid check name that shares the same schedule.')

            # lastly, add the check module information to each check in the setup
            check_setup[check_name]['module'] = found_checks[check_name]
        return check_setup

    def get_action_strings(self, specific_action=None):
        """
        Basically the same thing as get_check_strings, but for actions...
        """
        all_actions = []
        for mod_package, mods in self.get_module_names().items():
            for mod_name in mods:
                collected_actions = self._extract_module_and_functions(mod_package, mod_name, self.ACTION_DECO,
                                                                       specific_action)
                if specific_action and isinstance(collected_actions, str):
                    return collected_actions  # we are looking for a specific one and should return
                else:
                    all_actions += collected_actions

        if specific_action:
            # if we've gotten here, it means the specific action was not found
            return None
        else:
            return list(set(all_actions))

    def get_schedule_names(self):
        """
        Simply return a list of all valid schedule names, as defined in CHECK_SETUP
        """
        schedules = set()
        for _, detail in self.CHECK_SETUP.items():
            for schedule in detail.get('schedule', []):
                schedules.add(schedule)
        return list(schedules)

    def get_check_title_from_setup(self, check_name):
        """
        Return a title of a check from CHECK_SETUP
        If not found, just return check_name
        """
        return self.CHECK_SETUP.get(check_name, {}).get("title", check_name)

    def get_check_schedule(self, schedule_name, conditions=None):
        """
        Go through CHECK_SETUP and return all the required info for to run a given
        schedule for any environment.

        If a list of conditions is provided, filter the schedule to only include
        checks that match ALL of the conditions.

        Returns a dictionary keyed by environ.
        The check running info is the standard format of:
        [<check_mod/check_str>, <kwargs>, <dependencies>]
        """
        check_schedule = {}
        for check_name, detail in self.CHECK_SETUP.items():
            if schedule_name not in detail['schedule']:
                continue
            # skip the check if conditions provided and any are not met
            if conditions and isinstance(conditions, list):
                check_conditions = detail.get('conditions', [])
                if any([cond not in check_conditions for cond in conditions]):
                    continue
            for env_name, env_detail in detail['schedule'][schedule_name].items():
                check_str = '/'.join([detail['module'], check_name])
                run_info = [check_str, env_detail['kwargs'], env_detail['dependencies']]
                if env_name in check_schedule:
                    check_schedule[env_name].append(run_info)
                else:
                    check_schedule[env_name] = [run_info]
        # although not strictly necessary right now, this is a precaution
        return copy.deepcopy(check_schedule)

    def get_check_results(self, connection, checks=None, use_latest=False):
        """
        Initialize check results for each desired check and get results stored
        in s3, sorted by status and then alphabetically by title.
        May provide a list of string check names as `checks`; otherwise get all
        checks by default.
        By default, gets the 'primary' results. If use_latest is True, get the
        'latest' results instead.
        """
        checks = checks or []
        check_results = []
        if not checks:
            checks = [check_str.split('/')[1] for check_str in self.get_check_strings()]

        if connection.connections['es'] is None:
            for check_name in checks:
                tempCheck = self.CheckResult(connection, check_name)
                if use_latest:
                    found = tempCheck.get_latest_result()
                else:
                    found = tempCheck.get_primary_result()
                # checks with no records will return None. Skip IGNORE checks
                if found and found.get('status') != 'IGNORE':
                    check_results.append(found)
                if not found:  # add placeholder check
                    check_results.append(CheckSchema().create_placeholder_check(check_name))

        else:
            if use_latest:
                check_results = connection.connections['es'].get_main_page_checks(checks, primary=False)
            else:
                check_results = connection.connections['es'].get_main_page_checks(checks)
            check_results = list(filter(lambda obj: obj['status'] != 'IGNORE' and obj['name'] in checks, check_results))

        # sort them by status and then alphabetically by check_setup title
        stat_order = ['ERROR', 'FAIL', 'WARN', 'PASS']
        return sorted(
            check_results,
            key=lambda v: (stat_order.index(v['status'])
                           if v['status'] in stat_order
                           else 9, self.get_check_title_from_setup(v['name']).lower())
        )

    def get_grouped_check_results(self, connection):
        """
        Return a group-centric view of the information from get_check_results for
        given connection (i.e. fs environment).
        Returns a list of dicts dict that contains dicts of check results
        keyed by title and also counts of result statuses and group name.
        All groups are returned
        """
        grouped_results = {}
        check_res = self.get_check_results(connection)
        for res in check_res:
            setup_info = self.CHECK_SETUP.get(res['name'])
            # this should not happen, but fail gracefully
            if not setup_info:
                logger.debug('-VIEW-> Check %s not found in CHECK_SETUP for env %s' % (res['name'], connection.fs_env))
                continue
            # make sure this environment displays this check
            used_envs = [env for sched in setup_info['schedule'].values() for env in sched]
            used_envs.extend(setup_info.get('display', []))
            if connection.fs_env in used_envs or 'all' in used_envs:
                group = setup_info['group']
                if group not in grouped_results:
                    grouped_results[group] = {}
                    grouped_results[group]['_name'] = group
                    grouped_results[group]['_statuses'] = {'ERROR': 0, 'FAIL': 0, 'WARN': 0, 'PASS': 0}
                grouped_results[group][setup_info['title']] = res
                if res['status'] in grouped_results[group]['_statuses']:
                    grouped_results[group]['_statuses'][res['status']] += 1
        # format into a list and sort alphabetically
        grouped_list = [group for group in grouped_results.values()]
        return sorted(grouped_list, key=lambda v: v['_name'])

    def run_check_or_action(self, connection, check_str, check_kwargs):
        """
        Does validation of provided check_str, it's module, and kwargs.
        Determines by decorator whether the method is a check or action, then runs
        it. All errors are taken care of within the running of the check/action.

        Takes a FS_connection object, a check string formatted as: <str check module/name>
        and a dictionary of check arguments.
        For example:
        check_str: 'system_checks/my_check'
        check_kwargs: '{"foo":123}'
        Fetches the check function and runs it (returning whatever it returns)
        Return a string for failed results, CheckResult/ActionResult object otherwise.
        """
        check_method = None
        try:
            check_method = self._get_check_or_action_function(check_str)
        except Exception as e:
            return f"ERROR: {str(e)}"
        if not isinstance(check_kwargs, dict):
            return "ERROR: Check kwargs must be a dictionary: {check_str}"
        return check_method(connection, **check_kwargs)

    def _get_check_or_action_function(self, check_or_action_string: str, check_or_action: str = "check") -> Callable:
        if len(check_or_action_string.strip().split('/')) != 2:
            raise Exception(f"{check_or_action.title()} string must be of form"
                            "module_name/{check_or_action}_function_name: {check_or_action_string}")
        module_name = check_or_action_string.strip().split('/')[0]
        function_name = check_or_action_string.strip().split('/')[1]
        module = None
        for package_name in [self.check_package_name, 'foursight_core']:
            try:
                module = self.import_check_module(package_name, module_name)
            except ModuleNotFoundError:
                continue
            except Exception as e:
                raise e
        if not module:
            raise Exception(f"Cannot find check module: {module_name}")
        function = module.__dict__.get(function_name)
        if not function:
            raise Exception(f"Cannot find check function: {module_name}/{function_name}")
        if not self.check_method_deco(function, self.CHECK_DECO) and \
           not self.check_method_deco(function, self.ACTION_DECO):
            raise Exception(f"{check_or_action.title()} function must use"
                            "@{check_or_action}_function decorator: {module_name}/{function_name}")
        return function

    @staticmethod
    def get_checks_info(search: str = None) -> list:
        checks = []
        registry = Decorators.get_registry()
        for item in registry:
            info = CheckHandler._create_check_or_action_info(registry[item])
            if search and search not in info.qualified_name.lower():
                continue
            if info.is_check:
                checks.append(info)
        return sorted(checks, key=lambda item: item.qualified_name)

    @staticmethod
    def get_actions_info(search: str = None) -> list:
        actions = []
        registry = Decorators.get_registry()
        for item in registry:
            info = CheckHandler._create_check_or_action_info(registry[item])
            if search and search not in info.qualified_name.lower():
                continue
            if info.is_action:
                actions.append(info)
        return sorted(actions, key=lambda item: item.qualified_name)

    @staticmethod
    def get_check_info(check_function_name: str, check_module_name: str = None) -> Optional[namedtuple]:
        return CheckHandler._get_check_or_action_info(check_function_name, check_module_name, "check")

    @staticmethod
    def get_action_info(action_function_name: str, action_module_name: str = None) -> Optional[namedtuple]:
        return CheckHandler._get_check_or_action_info(action_function_name, action_module_name, "action")

    @staticmethod
    def _get_check_or_action_info(function_name: str,
                                  module_name: str = None, kind: str = None) -> Optional[namedtuple]:

        function_name = function_name.strip();
        if module_name:
            module_name = module_name.strip();
        if not module_name:
            if len(function_name.split("/")) == 2:
                module_name = function_name.split("/")[0].strip()
                function_name = function_name.split("/")[1].strip()
            elif len(function_name.split(".")) == 2:
                module_name = function_name.split(".")[0].strip()
                function_name = function_name.split(".")[1].strip()
        registry = Decorators.get_registry()
        for name in registry:
            if not kind or registry[name]["kind"] == kind:
                item = registry[name]
                if item["name"] == function_name:
                    if not module_name:
                        return CheckHandler._create_check_or_action_info(item)
                    if item["module"].endswith("." + module_name):
                        return CheckHandler._create_check_or_action_info(item)

    @staticmethod
    def _create_check_or_action_info(info: dict) -> Optional[namedtuple]:

        def unqualified_module_name(module_name: str) -> str:
            return module_name.rsplit(".", 1)[-1] if "." in module_name else module_name

        def qualified_check_or_action_name(check_or_action_name: str, module_name: str) -> str:
            unqualified_module = unqualified_module_name(module_name)
            return f"{unqualified_module}/{check_or_action_name}" if unqualified_module else check_or_action_name

        Info = namedtuple("CheckInfo", ["kind",
                                        "is_check",
                                        "is_action",
                                        "name",
                                        "qualified_name",
                                        "file",
                                        "line",
                                        "module",
                                        "unqualified_module",
                                        "package",
                                        "github_url",
                                        "args",
                                        "kwargs",
                                        "function",
                                        "associated_action",
                                        "associated_check"])
        return Info(info["kind"],
                    info["kind"] == "check",
                    info["kind"] == "action",
                    info["name"],
                    qualified_check_or_action_name(info["name"], info["module"]),
                    info["file"],
                    info["line"],
                    info["module"],
                    unqualified_module_name(info["module"]),
                    info["package"],
                    info["github_url"],
                    info["args"],
                    info["kwargs"],
                    info["function"],
                    info.get("action"),
                    info.get("check"))

    def init_check_or_action_res(self, connection, check):
        """
        Use in cases where a string is provided that could be a check or an action
        Returns None if neither are valid. Tries checks first then actions.
        If successful, returns a CheckResult or ActionResult
        """
        is_action = False
        # determine whether it is a check or action
        check_str = self.get_check_strings(check)
        if not check_str:
            check_str = self.get_action_strings(check)
            is_action = True
        if not check_str:  # not a check or an action. abort
            return None
        return self.ActionResult(connection, check) if is_action else self.CheckResult(connection, check)

    @classmethod
    def get_methods_by_deco(cls, mod, decorator):
        """
        Returns all methods in module with decorator as a list;
        the decorator is set in check_function()
        """
        methods = []
        for maybeDecorated in mod.__dict__.values():
            if hasattr(maybeDecorated, 'check_decorator'):
                if maybeDecorated.check_decorator == decorator:
                    methods.append(maybeDecorated)
        return methods

    @classmethod
    def check_method_deco(cls, method, decorator):
        """
        See if the given method has the given decorator. Returns True if so,
        False if not.
        """
        return hasattr(method, 'check_decorator') and method.check_decorator == decorator
