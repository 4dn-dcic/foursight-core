import os
from .vars import FOURSIGHT_PREFIX as PlaceholderPrefix


class Stage(object):

    # overwrite the following in an inherited class
    prefix = PlaceholderPrefix

    prod_stage_name = 'prod'

    @classmethod
    def get_stage_from_env_variable(cls):
        # set environmental variables in .chalice/config.json
        return os.environ.get('chalice_stage', 'dev')  # default to dev

    @classmethod
    def get_stage(cls):
        stage = cls.get_stage_from_env_variable()
        if stage == 'test':
            stage = 'dev'
        return stage

    @classmethod
    def get_queue_name(cls):
        return '-'.join([cls.prefix, cls.get_stage_from_env_variable(), 'check_queue'])

    @classmethod
    def get_runner_name(cls):
        return '-'.join([cls.prefix, cls.get_stage(), 'check_runner'])

    @classmethod
    def is_stage_prod(cls):
        if cls.get_stage() == cls.prod_stage_name:
            return True
        else:
            return False
