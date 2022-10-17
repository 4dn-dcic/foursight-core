import copy
from typing import Optional, Tuple
import os
from dcicutils import ff_utils
from .gac import Gac


class Envs:

    def __init__(self, known_envs: list):
        # This known_envs should be the list of annotated environment name objects
        # as returned by app_utils.get_unique_annotated_environment_names, where each
        # object contains these fields: name, short_name, full_name, public_name, foursight_name
        self.known_envs = known_envs

    def get_known_envs(self) -> list:
        return self.known_envs

    def get_known_envs_with_gac_names(self, gac: Gac) -> list:
        known_envs = copy.deepcopy(self.get_known_envs())
        for known_env in known_envs:
            known_env["gac_name"] = gac.get_gac_name(known_env["full_name"])
        return known_envs

    def get_default_env(self) -> str:
        return os.environ.get("ENV_NAME", "no-default-env")

    def is_known_env(self, env: str) -> bool:
        return self.find_known_env(env) is not None

    def find_known_env(self, env: str) -> Optional[dict]:
        if not env:
            return None
        env = env.lower()
        for known_env in self.known_envs:
            if (known_env["name"].lower() == env
                or known_env["short_name"].lower() == env
                or known_env["full_name"].lower() == env
                or known_env["public_name"].lower() == env
                or known_env["foursight_name"].lower() == env):
                return known_env
        return None

    def is_allowed_env(self, env: str, allowed_envs: list) -> bool:
        if not env or not allowed_envs:
            return False
        for allowed_env in allowed_envs:
            if self.is_same_env(env, allowed_env):
                return True
        return False

    def is_same_env(self, env_a: str, env_b: str) -> bool:
        if not env_a or not env_b:
            return False
        known_env_a = self.find_known_env(env_a)
        known_env_b = self.find_known_env(env_b)
        if not known_env_a or not known_env_b:
            return False
        return id(known_env_a) == id(known_env_b)

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
        for known_env in self.known_envs:
            try:
                user = ff_utils.get_metadata('users/' + email.lower(),
                                             ff_env=known_env["full_name"], add_on="frame=object&datastore=database")
                if user:
                    if not first_name:
                        first_name = user.get("first_name")
                    if not last_name:
                        last_name = user.get("last_name")
                    allowed_envs.append(known_env["full_name"])
            except Exception as e:
                print(f"Exception getting allowed envs for: {email}")
                print(e)
        return allowed_envs, first_name, last_name
