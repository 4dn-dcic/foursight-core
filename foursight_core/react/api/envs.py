import copy
import os
from dcicutils.env_utils import (
    infer_foursight_from_env,
    full_env_name,
    public_env_name,
    short_env_name,
)
from dcicutils import ff_utils


class Envs:

    def __init__(self, known_envs: list):
        self.known_envs = known_envs

    def get_known_envs(self) -> str:
        return self.known_envs

    def get_known_envs_with_gac_names(self, gac) -> list:
        known_envs = copy.deepcopy(self.get_known_envs())
        for known_env in known_envs:
            known_env["gac_name"] = gac.get_gac_name(known_env["full_name"])
        return known_envs

    def get_default_env(self) -> str:
        return os.environ.get("ENV_NAME", "no-default-env")

    def is_known_env(self, env: str) -> bool:
        if not env:
            return False
        env = env.upper()
        for environment_name in self.known_envs:
            if environment_name["name"].upper() == env:
                return True
            if environment_name["short_name"].upper() == env:
                return True
            if environment_name["full_name"].upper() == env:
                return True
            if environment_name["public_name"].upper() == env:
                return True
            if environment_name["foursight_name"].upper() == env:
                return True
        return False

    def is_allowed_env(self, env: str, allowed_envs: list) -> bool:
        if not env or not allowed_envs:
            return False
        for allowed_env in allowed_envs:
            if self.is_same_env(env, allowed_env):
                return True
        return False

    @staticmethod
    def is_same_env(env_a: str, env_b: str) -> bool:
        if not env_a or not env_b:
            return False
        env_b = env_b.lower()
        full_env_a = full_env_name(env_a) or ""
        short_env_a = short_env_name(env_a) or ""
        public_env_a = public_env_name(env_a) or ""
        foursight_env_a = infer_foursight_from_env(envname=env_a) or ""
        return (env_a.lower() == env_b
            or  full_env_a.lower() == env_b
            or  short_env_a.lower() == env_b
            or  public_env_a.lower() == env_b
            or  foursight_env_a.lower() == env_b)

    def get_envs_for_user(self, email: str) -> [list, list, str, str]:
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
                user = ff_utils.get_metadata('users/' + email.lower(), ff_env=known_env["full_name"], add_on="frame=object&datastore=database")
                if user:
                    if not first_name:
                        first_name = user.get("first_name")
                    if not last_name:
                        last_name = user.get("last_name")
                    allowed_envs.append(known_env["full_name"])
            except Exception as e:
                print(f"Exception getting allowed envs for: {email}")
                print(e)
        return (self.known_envs, allowed_envs, first_name, last_name)
