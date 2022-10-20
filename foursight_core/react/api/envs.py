import copy
from functools import lru_cache as memoize
import logging
import os
from typing import Optional, Tuple
from dcicutils import ff_utils
from dcicutils.env_utils import foursight_env_name, full_env_name, public_env_name, short_env_name
from dcicutils.misc_utils import find_association
from .gac import Gac

logging.basicConfig()
logger = logging.getLogger(__name__)


# TODO
# Rationalize this with dcicutil.utils env_utils functions for name versions, normalizations, comparisons.
class Envs:

    _DEFAULT_ENV_PLACHOLDER = 'no-default-env'

    def __init__(self, known_envs: list):
        # This known_envs should be the list of annotated environment name objects
        # as returned by app_utils.get_unique_annotated_environment_names, where each
        # object contains these fields: name, short_name, full_name, public_name, foursight_name
        self._known_envs = known_envs

    def get_known_envs(self) -> list:
        return self._known_envs

    def get_known_envs_count(self) -> int:
        return len(self._known_envs)

    @memoize(100)
    def get_known_envs_with_gac_names(self) -> list:
        known_envs = copy.deepcopy(self._known_envs)
        for known_env in known_envs:
            known_env["gac_name"] = Gac.get_gac_name(known_env["full_name"])
        return known_envs

    def get_default_env(self) -> str:
        return os.environ.get("ENV_NAME", Envs._DEFAULT_ENV_PLACHOLDER)

    @memoize(100)
    def is_known_env(self, env: str) -> bool:
        return self.find_known_env(env) is not None

    @memoize(100)
    def find_known_env(self, env: str) -> Optional[dict]:
        return find_association(self._known_envs, foursight_name=foursight_env_name(env))
#       if not env:
#           return None
#       env = env.lower()
#       for known_env in self._known_envs:
#           if (known_env["name"].lower() == env
#                   or known_env["short_name"].lower() == env
#                   or known_env["full_name"].lower() == env
#                   or known_env["public_name"].lower() == env
#                   or known_env["foursight_name"].lower() == env):
#               return known_env
#       return None

    def is_allowed_env(self, env: str, allowed_envs: list) -> bool:
        if not env or not allowed_envs:
            return False
        for allowed_env in allowed_envs:
            if self.is_same_env(env, allowed_env):
                return True
        return False

    @memoize(100)
    def is_same_env(self, env_a: str, env_b: str) -> bool:
        return foursight_env_name(env_a) == foursight_env_name(env_b)
#       if not env_a or not env_b:
#           return False
#       known_env_a = self.find_known_env(env_a)
#       known_env_b = self.find_known_env(env_b)
#       if not known_env_a or not known_env_b:
#           return False
#       return id(known_env_a) == id(known_env_b)

    def get_user_auth_info(self, email: str) -> Tuple[list, list, str]:
        """
        Returns a tuple containing (in left-right order): the list of known environments;
        the list of allowed environment names (via the users store in ElasticSearch);
        and (since we're getting the user record anyways) the first and last name of
        the user (for informational/display purposes).
        """
        allowed_envs = []
        first_name = None
        last_name = None
        for known_env in self._known_envs:
            try:
                # Must be lower case to find (TODO: find out why exactly).
                user = ff_utils.get_metadata('users/' + email.lower(),
                                             ff_env=known_env["full_name"], add_on="frame=object&datastore=database")
                if user:
                    if not first_name:
                        first_name = user.get("first_name")
                    if not last_name:
                        last_name = user.get("last_name")
                    allowed_envs.append(known_env["full_name"])
            except Exception as e:
                logger.warning(f"Exception getting allowed envs for {email}: {e}")
        return allowed_envs, first_name, last_name

    def cache_clear(self) -> None:
        self.get_known_envs_with_gac_names.cache_clear()
        self.is_known_env.cache_clear()
        self.find_known_env.cache_clear()
        self.is_same_env.cache_clear()
