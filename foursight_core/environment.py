import logging

from dcicutils.common import EnvName, ChaliceStage
from dcicutils.env_manager import EnvManager
from dcicutils.function_cache_decorator import function_cache
from dcicutils.misc_utils import full_class_name
from dcicutils.s3_utils import s3Utils
from typing import Optional, List
from foursight_core.s3_connection import S3Connection
from dcicutils.env_utils import get_foursight_bucket, get_foursight_bucket_prefix, full_env_name, infer_foursight_from_env


logging.basicConfig()
logger = logging.getLogger(__name__)


class Environment(object):

    def __init__(self, foursight_prefix: Optional[str] = None):  # the foursight_prefix argument can go away.

        prefix = get_foursight_bucket_prefix()

        # This consistency check AND INTERIM HEURISTIC ERROR CORRECTION can go away later,
        # but when it does we can also get
        # rid of the argument that is passed, since it should be possible to look up.
        # For now we have made the argument optional so that it can be gradually phased out,
        # but failing to pass it causes a requirement to declare the "foursight_bucket_prefix"
        # in the ecosystem file of the global env bucket. -kmp 22-Jun-2022
        if not prefix:
            if foursight_prefix is not None:
                prefix = foursight_prefix
                logger.error(f"There is no declared foursight bucket prefix."
                             f" The value from a deprecated data flow path, {foursight_prefix!r}, will be used.")
            else:
                raise RuntimeError(f"There is no declared foursight bucket prefix,"
                                   f" and no suitable substitute can be inferred through legacy means.")
        elif foursight_prefix and prefix != foursight_prefix:
            logger.error(f"A value of deprecated argument 'foursight_prefix', {foursight_prefix},"
                         f" was given when initializing an instance of the class {full_class_name(self)},"
                         f" but the value does not match the declared foursight bucket prefix, {prefix}.")

        self.prefix = prefix
        self.s3_connection = S3Connection(self.get_env_bucket_name())

    def get_env_bucket_name(self) -> Optional[str]:

        bucket_name = EnvManager.global_env_bucket_name()

        # This consistency check can go away later but has been downgraded to a warning after initial testing
        # confirms this approach can work.
        legacy_bucket_name = self.prefix + '-envs'
        if bucket_name != legacy_bucket_name:
            # Note the inconsistency, but don't flag an error.
            logger.warning(f"{full_class_name(self)}.get_env_bucket_name is returning {bucket_name!r},"
                           f" where it previously would have returned {legacy_bucket_name!r}.")

        return bucket_name

    def list_unique_environment_names(self) -> List[EnvName]:
        result = set()
        for env in self.list_environment_names():
            result.add(infer_foursight_from_env(envname=env))
        return sorted(result)  # a list and sorted

    @function_cache
    def list_environment_names(self) -> List[EnvName]:
        """
        Lists all environments in the foursight-envs s3.

        Returns: a list of names
        """
        environment_names = [infer_foursight_from_env(envname=env)
                             for env in sorted(EnvManager.get_all_environments(env_bucket=self.get_env_bucket_name()))]

        # This consistency check can go away later..
        legacy_return_value = sorted([key
                                      for key in self.s3_connection.list_all_keys()
                                      if not key.endswith(".ecosystem")])
        modern_full_names = list(map(full_env_name, environment_names))
        legacy_full_names = list(map(full_env_name, legacy_return_value))
        if modern_full_names != legacy_full_names:
            logger.warning(f"{full_class_name(self)}.list_environment_names has consistency problems.")

        return environment_names

    def list_valid_schedule_environment_names(self) -> List[EnvName]:
        """
        Lists all valid environ names used in schedules including 'all'.

        Returns: A list of names.
        """

        return self.list_unique_environment_names() + ['all']

    def is_valid_environment_name(self, env: Optional[EnvName], or_all: bool = False, strict: bool = False) -> bool:
        """
        Returns True if env is a valid environment name, and False otherwise.

        :param env: The name of an environment.
        :param or_all: if True, allows 'all' as a valid name, otherwise does not.
        :param strict: if True, restricts valid names to exactly the set of foursight names.
                       Otherwise allows all declared names.
        """
        if or_all and env == 'all':
            return True
        valid_envs = self.list_unique_environment_names() if strict else self.list_environment_names()
        return infer_foursight_from_env(envname=env) in valid_envs

    @classmethod
    def get_environment_info_from_s3(cls, env_name: EnvName) -> dict:
        return s3Utils.get_synthetic_env_config(env_name)

    def get_environment_and_bucket_info(self, env_name: EnvName, stage: ChaliceStage) -> dict:
        logger.warning(f'Getting env info from s3 for {env_name}')
        env_info = self.get_environment_info_from_s3(env_name)

        portal_url = env_info['fourfront']
        es_url = env_info['es']
        ff_env = env_info['ff_env']

        bucket_name = get_foursight_bucket(envname=env_name, stage=stage)

        # This consistency check can go away later. -kmp 22-Jun-2022
        legacy_bucket_name = ''.join([self.prefix + '-', stage, '-', env_name])
        if bucket_name != legacy_bucket_name:
            logger.warning(f"{full_class_name(self)}.get_environment_and_bucket_info({env_name!r}, {stage!r})"
                           f" is returning {bucket_name!r},"
                           f" but it previously would have returned {legacy_bucket_name!r}.")

        env_and_bucket_info = {
            'fourfront': portal_url,
            'es': es_url,
            'ff_env': ff_env,
            'bucket': bucket_name,
        }
        return env_and_bucket_info

    def get_selected_environment_names(self, env_name: EnvName):

        # This is weirdly named. A better name would be expand_environment_names or get_matching_environment_names.
        # But it doesn't need to change. -kmp 24-May-2022
        if env_name == 'all':
            return self.list_unique_environment_names()
        elif self.is_valid_environment_name(env_name):
            return [env_name]
        else:
            raise ValueError(f"Not a valid env name: {env_name}")

    def get_environment_and_bucket_info_in_batch(self, stage: ChaliceStage, env: Optional[EnvName] = None,
                                                 envs: Optional[List[EnvName]] = None):
        """
        Generate environment information from the envs bucket in s3.
        Returns a dictionary keyed by environment name with value of a sub-dict
        with the fields needed to initiate a connection.

        :param stage: a chalice stage (generally one of 'dev' or 'prod')
        :param env: allows you to specify a single env to be initialized, or the token 'all'.
        :param env: allows you to specify a single env to be initialized
        :param envs: allows you to specify multiple envs to be initialized
        """
        if envs is not None:
            if env is not None:
                ValueError(f"{full_class_name(self)}.get_environment_and_bucket_info_in_batch"
                           f" accepts either 'env=' or 'envs=' but not both.")
            env_keys = envs
        else:
            try:
                env_keys = self.get_selected_environment_names(env or 'all')
            except Exception as e:
                logger.warning(f"Returning {{}} from get_environment_and_bucket_info_in_batch due to error: {e}.")
                return {}  # provided env is not in s3

        return {
            env_key: self.get_environment_and_bucket_info(env_key, stage)
            for env_key in env_keys
        }
