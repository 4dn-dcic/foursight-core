import re
import boto3
from dcicutils.diff_utils import DiffManager
from dcicutils.env_utils import short_env_name
from dcicutils.misc_utils import override_environ
from dcicutils.obfuscation_utils import obfuscate_dict
from dcicutils.secrets_utils import get_identity_secrets
from ...misc_utils import sort_dictionary_by_lowercase_keys


class Gac:

    @staticmethod
    def get_secrets_names() -> list:
        try:
            boto_secrets_manager = boto3.client('secretsmanager')
            return [secrets['Name'] for secrets in boto_secrets_manager.list_secrets()['SecretList']]
        except Exception as e:
            print("Exception getting secrets")
            print(e)
            return []

    @staticmethod
    def get_gac_names() -> list:
        secrets_names = Gac.get_secrets_names()
        return [secret_name for secret_name in secrets_names if re.match('.*App(lication)?Config(uration)?.*', secret_name, re.IGNORECASE)]

    @staticmethod
    def get_gac_name(env_name: str) -> str:
        gac_names = Gac.get_gac_names()
        env_name_short = short_env_name(env_name)
        pattern = re.compile(".*" + env_name_short.replace('-', '.*').replace('_', '.*') + ".*", re.IGNORECASE)
        matching_gac_names = [gac_name for gac_name in gac_names if pattern.match(gac_name)]
        if len(matching_gac_names):
            return matching_gac_names[0]
        else:
            return " OR ".join(matching_gac_names)

    @staticmethod
    def compare_gacs(env_name_a: str, env_name_b: str) -> dict:
        gac_name_a = Gac.get_gac_name(env_name_a)
        gac_name_b = Gac.get_gac_name(env_name_b)
        with override_environ(IDENTITY=gac_name_a):
            gac_values_a = get_identity_secrets()
        with override_environ(IDENTITY=gac_name_b):
            gac_values_b = get_identity_secrets()
        diff = DiffManager(label=None)
        diffs = diff.diffs(gac_values_a, gac_values_b)
        return {
            "gac": sort_dictionary_by_lowercase_keys(obfuscate_dict(gac_values_a)),
            "gac_compare": sort_dictionary_by_lowercase_keys(obfuscate_dict(gac_values_b)),
            "gac_diffs": diffs
        }