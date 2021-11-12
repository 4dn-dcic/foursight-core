import os
import json
from .s3_connection import S3Connection


class Environment(object):

    def __init__(self, foursight_prefix):
        self.prefix = foursight_prefix
        self.s3_connection = S3Connection(self.get_env_bucket_name())

    def get_env_bucket_name(self):
        return self.prefix + '-envs'

    def list_environment_names(self):
        """
        Lists all environments in the foursight-envs s3. Returns a list of names
        """
        return self.s3_connection.list_all_keys()

    def list_valid_schedule_environment_names(self):
        """Lists all valid environ names used in schedules including 'all'"""
        return self.list_environment_names() + ['all']

    def is_valid_environment_name(self, env):
        """check if env is a valid environment name"""
        if env in self.list_environment_names():
            return True
        else:
            return False

    def get_environment_info_from_s3(self, env_name):
        return self.s3_connection.get_object(env_name)

    def get_environment_and_bucket_info(self, env_name, stage):
        env_res = self.get_environment_info_from_s3(env_name)
        # check that the keys we need are in the object
        if isinstance(env_res, dict) and {'fourfront', 'es'} <= set(env_res):
            env_entry = {
                'fourfront': env_res['fourfront'],
                'es': env_res['es'],
                'ff_env': env_res.get('ff_env', ''.join(['fourfront-', env_name])),
                'bucket': ''.join([self.prefix + '-', stage, '-', env_name])
            }
            return env_entry
        else:
            raise Exception(f'malformatted environment info on s3 for key {env_name}\n'
                            f'{env_res}')

    def get_selected_environment_names(self, env_name):
        if env_name == 'all':
            return self.list_environment_names()
        elif self.is_valid_environment_name(env_name):
            return [env_name]
        else:
            raise Exception("not a valid env name")

    def get_environment_and_bucket_info_in_batch(self, stage, env='all', envs=None):
        """
        Generate environment information from the envs bucket in s3.
        Returns a dictionary keyed by environment name with value of a sub-dict
        with the fields needed to initiate a connection.

        :param env: allows you to specify a single env to be initialized
        :param envs: allows you to specify multiple envs to be initialized
        """
        if envs is not None:
            env_keys = envs
        else:
            try:
                env_keys = self.get_selected_environment_names(env)
            except:
                return {}  # provided env is not in s3

        environments = {}
        for env_key in env_keys:
            environments[env_key] = self.get_environment_and_bucket_info(env_key, stage)
        return environments
