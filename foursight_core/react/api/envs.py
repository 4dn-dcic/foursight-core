import copy
import logging
import os
from typing import Optional, Tuple
from dcicutils import ff_utils
from dcicutils.env_utils import foursight_env_name
from dcicutils.function_cache_decorator import function_cache
from dcicutils.misc_utils import find_association
from ...app import app
from .gac import Gac

logging.basicConfig()
logger = logging.getLogger(__name__)


# TODO
# Rationalize this with dcicutil.utils env_utils functions for name versions, normalizations, comparisons.
# Did at least some of this (below, e.g. find_known_env, is_same_env); but see if we can perhaps get away
# from even having to keep these (5) name versions around (i.e. name, short_name, full_name, public_name,
# foursight_name); the UI currently relies on these.
class Envs:

    _DEFAULT_ENV_PLACHOLDER = 'no-default-env'

    def __init__(self, known_envs: list):
        # This known_envs should be the list of annotated environment name objects
        # as returned by app_utils.get_unique_annotated_environment_names, where each
        # object contains these fields: name, short_name, full_name, public_name, foursight_name
        self._known_envs = known_envs
        # Set any green/blue production/staging info.
        for known_env in self._known_envs:
            if self._env_contains(known_env, "blue"):
                known_env["color"] = "blue"
            elif self._env_contains(known_env, "green"):
                known_env["color"] = "green"
            if known_env.get("color"):
                if self._env_contains(known_env, "stage") or self._env_contains(known_env, "staging"):
                    known_env["is_staging"] = True
                else:
                    known_env["is_production"] = True

    def get_known_envs(self) -> list:
        return self._known_envs

    def get_known_envs_count(self) -> int:
        return len(self._known_envs)

    @function_cache
    def get_known_envs_with_gac_names(self) -> list:
        known_envs = copy.deepcopy(self._known_envs)
        for known_env in known_envs:
            gac_name = Gac.get_gac_name(known_env["full_name"])
            if gac_name:
                known_env["gac_name"] = gac_name
        return known_envs

    @staticmethod
    def get_default_env() -> str:
        return os.environ.get("ENV_NAME", Envs._DEFAULT_ENV_PLACHOLDER)

    @function_cache
    def is_known_env(self, env: str) -> bool:
        return self.find_known_env(env) is not None

    @function_cache
    def find_known_env(self, env: str) -> Optional[dict]:
        known_envs = self.get_known_envs_with_gac_names()
        return find_association(known_envs, foursight_name=foursight_env_name(env))

    def is_allowed_env(self, env: str, allowed_envs: list) -> bool:
        if not env or not allowed_envs:
            return False
        for allowed_env in allowed_envs:
            if self.is_same_env(env, allowed_env):
                return True
        return False

    @function_cache
    def is_same_env(self, env_a: str, env_b: str) -> bool:
        return foursight_env_name(env_a) == foursight_env_name(env_b)

    def get_user_auth_info(self, email: str, raise_exception: bool = False) -> Tuple[list, str, str]:
        """
        Returns a tuple containing (in left-right order): the list of known environments,
        i.e the list of annotated environment name objects; the list of allowed environment
        names for the given user/email, via the users store in ElasticSearch; and since we're
        getting the user record anyways, the first/last name of the user, for display only.
        """
        allowed_envs = []
        first_name = None
        last_name = None
        for known_env in self._known_envs:
            try:
                # Note we must lower case the email to find the user. This is because all emails
                # in the database are lowercased; it causes issues with OAuth if we don't do this.
                known_env_name = known_env["full_name"]
                envs = app.core.init_environments(known_env_name)
                connection = app.core.init_connection(known_env_name, envs)
                user = ff_utils.get_metadata('users/' + email.lower(),
                                             key=connection.ff_keys,
                                             add_on="frame=object&datastore=database")
                if self._is_user_allowed_access(user):
                    # Since this is in a loop, for each env, this setup here will end up getting first/last name
                    # from the last env in the loop; doesn't really matter, just pick one set; this is just for
                    # informational/display purposes in the UI.
                    first_name = user.get("first_name")
                    last_name = user.get("last_name")
                    allowed_envs.append(known_env_name)
            except Exception as e:
                if raise_exception:
                    raise
                logger.warning(f"Exception getting allowed envs for {email}: {e}")
        return allowed_envs, first_name, last_name

    @staticmethod
    def _is_user_allowed_access(user: Optional[dict]) -> bool:
        return user and Envs._is_user_in_one_or_more_groups(user, ["admin", "foursight"])

    @staticmethod
    def _is_user_in_one_or_more_groups(user: Optional[dict], allowed_groups: list) -> bool:
        user_groups = user.get("groups") if user else None
        return user_groups and any(allowed_group in user_groups for allowed_group in allowed_groups or [])

    @staticmethod
    def _env_contains(env: dict, value: str, ignore_case: bool = True) -> bool:
        if ignore_case:
            value = value.lower()
            return (value in env["full_name"].lower() or
                    value in env["short_name"].lower() or
                    value in env["public_name"].lower() or
                    value in env["foursight_name"].lower())
        else:
            return (value in env["full_name"] or
                    value in env["short_name"] or
                    value in env["public_name"] or
                    value in env["foursight_name"])

    @staticmethod
    def _env_contained_within(env: dict, value: str) -> bool:
        """
        Returns True iff the given environment (dictionary) is contained or somehow represented
        within the given string value. Originally created for determining (sort of heuristically)
        the environment to which an AWS task definition name should be associated. For example,
        the name "c4-ecs-fourfront-hotseat-stack-FourfrontDeployment-xTDwbIYxIZh7" would belong
        to the "hotseat" environment.
        """
        value = value.lower()
        if "color" in env and env["color"] in ["blue", "green"] and env["color"] in value:
            # Handle situations like this where both blue and green appear, but green appears twice:
            # c4-ecs-blue-green-smaht-production-stack-SmahtgreenDeployment-mIHBLXIQ1pok
            blue_count = value.count("blue")
            green_count = value.count("green")
            if env["color"] == "blue":
                if blue_count > green_count:
                    return True
            elif green_count > blue_count:
                return True
        result = (env["full_name"].lower() in value or
                  env["short_name"].lower() in value or
                  env["public_name"].lower() in value or
                  env["foursight_name"].lower() in value)
        return result

    def get_production_color(self) -> Tuple[Optional[str], Optional[str]]:
        for known_env in self._known_envs:
            if known_env.get("is_production"):
                return (known_env["color"], known_env)
        return (None, None)

    def get_staging_color(self) -> Tuple[Optional[str], Optional[str]]:
        for known_env in self._known_envs:
            if known_env.get("is_staging"):
                return (known_env["color"], known_env)
        return (None, None)

    def get_associated_env(self, name: str) -> Optional[dict]:
        known_envs_with_colors = [env for env in self._known_envs if env.get("color")]
        known_envs_sans_colors = [env for env in self._known_envs if not env.get("color")]
        for known_env in known_envs_with_colors:
            if self._env_contained_within(known_env, name):
                return known_env
        for known_env in known_envs_sans_colors:
            if self._env_contained_within(known_env, name):
                return known_env
        return None
