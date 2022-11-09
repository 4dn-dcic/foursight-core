from unittest import mock
import os
from foursight_core.react.api import envs as react_envs
from foursight_core.react.api.envs import Envs
from test_react_auth_defs import KNOWN_ENVS, KNOWN_ENV_A, KNOWN_ENV_B, KNOWN_ENV_C, ALLOWED_ENV, DISALLOWED_ENV, mock_foursight_env_name



def test_envs():

    with mock.patch.object(react_envs, "foursight_env_name", mock_foursight_env_name):

        envs = Envs(KNOWN_ENVS)

        for env in KNOWN_ENVS:
            assert envs.is_known_env(env["name"]) == True

        allowed_envs = [ ALLOWED_ENV ]
        assert envs.is_allowed_env(ALLOWED_ENV, allowed_envs) == True
        assert envs.is_allowed_env(DISALLOWED_ENV, allowed_envs) == False
        assert envs.is_same_env(ALLOWED_ENV, ALLOWED_ENV) == True
        assert not envs.is_same_env(ALLOWED_ENV, DISALLOWED_ENV) == True

        os.environ["ENV_NAME"] = "xyzzy"
        assert envs.get_default_env() == "xyzzy"

        assert envs.find_known_env(KNOWN_ENV_A["name"]) == KNOWN_ENV_A
        assert envs.find_known_env(KNOWN_ENV_A["full_name"]) == KNOWN_ENV_A
        assert envs.find_known_env(KNOWN_ENV_A["short_name"]) == KNOWN_ENV_A
        assert envs.find_known_env(KNOWN_ENV_A["public_name"]) == KNOWN_ENV_A
        assert envs.find_known_env(KNOWN_ENV_A["foursight_name"]) == KNOWN_ENV_A

        assert envs.find_known_env(KNOWN_ENV_B["name"]) == KNOWN_ENV_B
        assert envs.find_known_env(KNOWN_ENV_B["full_name"]) == KNOWN_ENV_B
        assert envs.find_known_env(KNOWN_ENV_B["short_name"]) == KNOWN_ENV_B
        assert envs.find_known_env(KNOWN_ENV_B["public_name"]) == KNOWN_ENV_B
        assert envs.find_known_env(KNOWN_ENV_B["foursight_name"]) == KNOWN_ENV_B

        assert envs.find_known_env(KNOWN_ENV_C["name"]) == KNOWN_ENV_C
        assert envs.find_known_env(KNOWN_ENV_C["full_name"]) == KNOWN_ENV_C
        assert envs.find_known_env(KNOWN_ENV_C["short_name"]) == KNOWN_ENV_C
        assert envs.find_known_env(KNOWN_ENV_C["public_name"]) == KNOWN_ENV_C
        assert envs.find_known_env(KNOWN_ENV_C["foursight_name"]) == KNOWN_ENV_C
