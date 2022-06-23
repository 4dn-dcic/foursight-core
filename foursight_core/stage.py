import boto3
import logging
import os
import re

from dcicutils.lang_utils import conjoined_list


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

    CHECK_RUNNER_DEV_PATTERN = re.compile(".*foursight.*development.*CheckRunner.*")
    CHECK_RUNNER_PROD_PATTERN = re.compile(".*foursight.*production.*CheckRunner.*")

    ENCACHE_RUNNER_NAME = True

    def get_runner_name(self, encache=ENCACHE_RUNNER_NAME):
        """
        Gets the name of the Lambda function to use as a check runner.
        """
        stage = self.get_stage()
        check_runner = os.environ.get('CHECK_RUNNER', None)

        if not check_runner:
            # Prod has its own check runner, distinct from dev and test, though .get_stage() will have converted
            # 'test' to 'dev' by this point anyway. Still, this code is tolerant of not doing that...
            name_pattern = self.CHECK_RUNNER_PROD_PATTERN if stage == 'prod' else self.CHECK_RUNNER_DEV_PATTERN
            lambda_client = boto3.client('lambda')
            candidates = []
            chunk = lambda_client.list_functions()
            while True:
                entries = chunk['Functions']
                for entry in entries:
                    name = entry['FunctionName']
                    if name_pattern.match(name):
                        candidates.append(name)
                next_marker = chunk.get('NextMarker')
                if not next_marker:
                    break
                chunk = lambda_client.list_functions(Marker=next_marker)
            if len(candidates) == 1:
                check_runner = candidates[0]
                logger.warning(f"CHECK_RUNNER inferred to be {check_runner}")
            else:
                logger.error(f"CHECK_RUNNER cannot be defaulted"
                             f" from {conjoined_list(candidates, nothing='no matches')}.")

        if not check_runner:
            # TODO: Is there EVER a situation where this works any more? Can we ditch this heuristic? -kmp 23-Jun-2022
            check_runner = '-'.join([self.prefix, stage, 'check_runner'])

        if encache:
            # Discovery is slow. We could encache this value so it's faster next time. I defaulted this to off for now.
            logger.warning(f"Setting environment variable CHECK_RUNNER={check_runner}.")
            os.environ['CHECK_RUNNER'] = check_runner

        return check_runner

    @classmethod
    def is_stage_prod(cls):
        if cls.get_stage() == cls.prod_stage_name:
            return True
        else:
            return False
