import pytest
import re

from foursight_core.environment import Environment
from dcicutils.common import CHALICE_STAGES
from dcicutils.env_base import EnvBase
from dcicutils.env_utils import full_env_name, infer_foursight_from_env
from dcicutils.lang_utils import disjoined_list


LEGACY_GLOBAL_ENV_BUCKET = 'foursight-prod-envs'
LEGACY_PREFIX = "foursight-"
LEGACY_ENVS = ['fourfront-mastertest', 'fourfront-hotseat', 'fourfront-production-blue', 'fourfront-production-green']
PUBLIC_ENV_NAMES = ['mastertest', 'hotseat', 'data', 'staging']

CONFIG_KEYS = ['ff_env', 'es', 'fourfront']


def test_get_env_bucket_name():

    with EnvBase.global_env_bucket_named(LEGACY_GLOBAL_ENV_BUCKET):

        environment = Environment()

        assert environment.get_env_bucket_name() == EnvBase.global_env_bucket_name()


def test_list_environment_names():

    with EnvBase.global_env_bucket_named(LEGACY_GLOBAL_ENV_BUCKET):
        environment = Environment()
        envs = environment.list_environment_names()
        check_environment_names(envs, with_all=False)


def test_list_valid_schedule_environment_names():

    with EnvBase.global_env_bucket_named(LEGACY_GLOBAL_ENV_BUCKET):
        environment = Environment()
        envs = environment.list_valid_schedule_environment_names()
        check_environment_names(envs, with_all=True)


def check_environment_names(envs, *, with_all):

        full_envs = [full_env_name(env) for env in envs if env != 'all']

        for env in envs:
            assert not env.endswith(".ecosystem")

        for env in LEGACY_ENVS:
            assert env in full_envs

        if with_all:
            assert 'all' in envs


def test_is_valid_environment_name():

    with EnvBase.global_env_bucket_named(LEGACY_GLOBAL_ENV_BUCKET):
        environment = Environment()
        envs = environment.list_environment_names()
        for env in envs:
            assert environment.is_valid_environment_name(env)
            assert not environment.is_valid_environment_name("not-" + env)


def test_get_environment_info_from_s3():

    with EnvBase.global_env_bucket_named(LEGACY_GLOBAL_ENV_BUCKET):

        for test_env in LEGACY_ENVS + PUBLIC_ENV_NAMES:
            full_test_env = full_env_name(test_env)

            config = Environment.get_environment_info_from_s3(test_env)

            for key in CONFIG_KEYS:
                assert key in config, "Missing '{key}' tag in config for {test_env}."

            portal_env = config['ff_env']
            portal_url = config['fourfront']
            es_url = config['es']

            def equivalent_names(env1, env2):
                return full_env_name(env1) == full_env_name(env2)

            assert equivalent_names(portal_env, test_env)

            is_blue = 'blue' in full_test_env
            is_green = 'green' in full_test_env
            is_bluegreen = is_blue or is_green

            if is_bluegreen:
                assert ('blue' if is_blue else 'green') in es_url
                print(f"{es_url} is properly {'blue' if is_blue else 'green'}.")

            env_pattern = full_test_env.replace("-", ".*")
            assert re.match(f"https?://.*{env_pattern}.*", es_url)
            print(f"{es_url} is of the proper form to match env {test_env} (full name = {full_test_env}.")

            if es_url.endswith(":80"):
                assert es_url.startswith("http://")
                print(f"{es_url} has matching 'http' and ':80'.")
            elif es_url.endswith(":443"):
                assert es_url.startswith("https://")
                print(f"{es_url} has matching 'https' and ':443'.")
            else:
                raise AssertionError(f"es url {es_url} does not end with ':80' or ':443'.")

            foursight_token = infer_foursight_from_env(envname=test_env)
            assert re.match(f"https?://({full_test_env}|{foursight_token})[.-]", portal_url)
            options = {full_test_env}
            if foursight_token != full_test_env:
                options.add(foursight_token)
            print(f"{portal_url} matches {disjoined_list(options)}.")


def test_get_environment_and_bucket_info():

    with EnvBase.global_env_bucket_named(LEGACY_GLOBAL_ENV_BUCKET):
        environment = Environment()
        envs = environment.list_environment_names()
        for stage in CHALICE_STAGES:
            for env in envs:
                config = environment.get_environment_info_from_s3(env).copy()
                info = environment.get_environment_and_bucket_info(env, stage=stage)
                for key in CONFIG_KEYS:
                    assert config[key] == info[key]
                info_bucket = info['bucket']
                full_env = full_env_name(env)
                foursight_env = infer_foursight_from_env(envname=env)
                assert re.match(f"{LEGACY_PREFIX}{stage}-({full_env}|{foursight_env})", info_bucket)


def test_get_selected_environment_names():

    with EnvBase.global_env_bucket_named(LEGACY_GLOBAL_ENV_BUCKET):
        environment = Environment()
        envs = environment.list_environment_names()
        assert environment.get_selected_environment_names('all') == envs
        for env in envs:
            assert environment.get_selected_environment_names(env) == [env]
            with pytest.raises(Exception):
                environment.get_selected_environment_names("NOT-" + env)


def test_get_environment_and_bucket_info_in_batch():

    def check_result_format(d):
        assert isinstance(d, dict)
        for k, v in d.items():
            assert environment.is_valid_environment_name(k)
            assert isinstance(v, dict)
            for key in CONFIG_KEYS:
                assert key in v

    with EnvBase.global_env_bucket_named(LEGACY_GLOBAL_ENV_BUCKET):
        environment = Environment()
        all_env_names = environment.list_environment_names()
        some_env_names = [all_env_names[0], all_env_names[1]]
        set_of_all_env_names = set(all_env_names)
        for stage in CHALICE_STAGES:
            all_envs_dict = environment.get_environment_and_bucket_info_in_batch(stage=stage, env='all')
            assert set(all_envs_dict) == set_of_all_env_names
            check_result_format(all_envs_dict)
            some_envs_dict = environment.get_environment_and_bucket_info_in_batch(stage=stage, envs=some_env_names)
            assert set(some_envs_dict) == set(some_env_names)
            check_result_format(some_envs_dict)
            for env in set_of_all_env_names:
                env_dict = environment.get_environment_and_bucket_info_in_batch(stage=stage, env=env)
                assert list(env_dict) == [env]
                check_result_format(env_dict)
