from __future__ import print_function, unicode_literals
import chalice
import unittest
import datetime
import json
import os
import sys
import time
import boto3
import app
from foursight_core.chalicelib import (
    app_utils,
    check_utils,
    sys_utils,
    sqs_utils,
    decorators,
    run_result,
    fs_connection,
    s3_connection,
    es_connection
)
from foursight_core.chalicelib.utils import *
from foursight_core.chalicelib.vars import *
from dcicutils import s3_utils, ff_utils
from dateutil import tz
from contextlib import contextmanager
import pytest

@pytest.fixture(scope='session', autouse=True)
def setup():
    app.set_stage('test')  # set the stage info for tests
    test_client = boto3.client('sqs')  # purge test queue
    queue_url = sqs_utils.SQS.get_sqs_queue().url
    try:
        test_client.purge_queue(
            QueueUrl=queue_url
        )
    except test_client.exceptions.PurgeQueueInProgress:
        print('Cannot purge test queue; purge already in progress')
