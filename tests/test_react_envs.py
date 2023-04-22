from unittest import mock
import os
from foursight_core.react.api import envs as react_envs
from foursight_core.react.api.envs import Envs
from test_react_auth_defs import (
    KNOWN_ENVS,
    KNOWN_ENV_A,
    KNOWN_ENV_B,
    KNOWN_ENV_C,
    ALLOWED_ENV,
    DISALLOWED_ENV,
    mock_foursight_env_name
)


def test_envs():

    def find_known_env(env: str, envs: Envs) -> dict:
        known_env = envs.find_known_env(env)
        return known_env

    with mock.patch.object(react_envs, "foursight_env_name", mock_foursight_env_name):

        envs = Envs(KNOWN_ENVS)

        for env in KNOWN_ENVS:
            assert envs.is_known_env(env["name"]) is True

        allowed_envs = [ALLOWED_ENV]
        assert envs.is_allowed_env(ALLOWED_ENV, allowed_envs) is True
        assert envs.is_allowed_env(DISALLOWED_ENV, allowed_envs) is False
        assert envs.is_same_env(ALLOWED_ENV, ALLOWED_ENV) is True
        assert not envs.is_same_env(ALLOWED_ENV, DISALLOWED_ENV) is True

        os.environ["ENV_NAME"] = "xyzzy"
        assert envs.get_default_env() == "xyzzy"

        def check_find_known_env(known_env):
            assert find_known_env(known_env["name"], envs) == known_env
            assert find_known_env(known_env["full_name"], envs) == known_env
            assert find_known_env(known_env["short_name"], envs) == known_env
            assert find_known_env(known_env["public_name"], envs) == known_env
            assert find_known_env(known_env["foursight_name"], envs) == known_env

        check_find_known_env(KNOWN_ENV_A)
        check_find_known_env(KNOWN_ENV_B)
        check_find_known_env(KNOWN_ENV_C)
