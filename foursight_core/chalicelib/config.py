from __future__ import print_function, unicode_literals
import os
import json
from .s3_connection import S3Connection
from .vars import (
    FOURSIGHT_PREFIX,
)


class Config(object):

    prefix = FOURSIGHT_PREFIX

    @classmethod
    def get_stage_info(cls):
        """
        Returns a dictionary with stage info and queue/check runner names that
        depend on that. If test=True, use the test runner_name
        """
        # set environmental variables in .chalice/config.json
        stage = os.environ.get('chalice_stage', 'dev') # default to dev
        queue_name = '-'.join([cls.prefix, stage, 'check_queue'])
        # when testing, use dev stage with test queue
        if stage == 'test':
            stage = 'dev'
            queue_name = cls.prefix + '-test-check_queue'
        runner_name = '-'.join([cls.prefix, stage, 'check_runner'])
        return {'stage': stage, 'queue_name': queue_name, 'runner_name': runner_name}

    @classmethod
    def list_environments(cls):
        """
        Lists all environments in the foursight-envs s3. Returns a list of names
        """
        s3_connection = S3Connection(cls.prefix + '-envs')
        return s3_connection.list_all_keys()
