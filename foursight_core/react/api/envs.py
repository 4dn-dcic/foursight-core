import copy
from functools import lru_cache as memoize
import logging
import os
from typing import Optional, Tuple
from dcicutils import ff_utils
from dcicutils.env_utils import foursight_env_name
from dcicutils.misc_utils import find_association
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
        known_envs = self.get_known_envs_with_gac_names()
        return find_association(known_envs, foursight_name=foursight_env_name(env))

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

    def get_user_auth_info(self, email: str) -> Tuple[list, list, str]:
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
                user = ff_utils.get_metadata('users/' + email.lower(),
                                             ff_env=known_env["full_name"], add_on="frame=object&datastore=database")
                if user:
                    # Since this is in a loop, for each env, this setup here will end up getting first/last name
                    # from the last env in the loop; doesn't really matter, just pick one set; this is just for
                    # informational/display purposes in the UI.
                    first_name = user.get("first_name")
                    last_name = user.get("last_name")
                    if True:
                        # New; 2022-10-25; almost forgot; from app_utils.check_authorization; check groups.
                        groups = user.get("groups")
                        if groups and "admin" in groups or "foursight" in groups:
                            allowed_envs.append(known_env["full_name"])
                    else:
                        allowed_envs.append(known_env["full_name"])
            except Exception as e:
                logger.warning(f"Exception getting allowed envs for {email}: {e}")
        return allowed_envs, first_name, last_name

    def cache_clear(self) -> None:
        self.get_known_envs_with_gac_names.cache_clear()
        self.is_known_env.cache_clear()
        self.find_known_env.cache_clear()
        self.is_same_env.cache_clear()
