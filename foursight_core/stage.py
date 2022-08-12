import logging
import os

from dcicutils.cloudformation_utils import AbstractOrchestrationManager


logging.basicConfig()
logger = logging.getLogger(__name__)


class Stage(object):

    prod_stage_name = 'prod'

    def __init__(self, foursight_prefix):
        self.prefix = foursight_prefix

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

    def get_queue_name(self):
        return '-'.join([self.prefix, self.get_stage_from_env_variable(), 'check_queue'])

    ENCACHE_RUNNER_NAME = True

    def get_runner_name(self, encache=ENCACHE_RUNNER_NAME):
        """
        Gets the name of the Lambda function to use as a check runner.
        """
        stage = self.get_stage()
        check_runner = os.environ.get('CHECK_RUNNER', None)

        if not check_runner:
            check_runner = AbstractOrchestrationManager.discover_foursight_check_runner_name(stage=stage,
                                                                                             encache=encache)

        if not check_runner:
            # TODO: Is there EVER a situation where this works any more? Can we ditch this heuristic? -kmp 23-Jun-2022
            check_runner = '-'.join([self.prefix, stage, 'check_runner'])

        return check_runner

    @classmethod
    def is_stage_prod(cls):
        if cls.get_stage() == cls.prod_stage_name:
            return True
        else:
            return False
