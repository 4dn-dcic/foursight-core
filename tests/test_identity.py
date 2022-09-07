from foursight_core.identity import find_check_runner_lambda_name
from dcicutils import cloudformation_utils
from dcicutils.qa_utils import (MockBoto3, MockBoto3Lambda)
from unittest import mock
import uuid


def test_find_lambda_names():

    mocked_boto = MockBoto3()
    assert isinstance(mocked_boto, MockBoto3)

    mocked_boto_lambda = mocked_boto.client('lambda')
    assert isinstance(mocked_boto_lambda, MockBoto3Lambda)

    def generate_mocked_lambdas(n: int = 50) -> list:
        lambdas = []
        for i in range(n):
            lambdas.append(str(uuid.uuid4()))
        return lambdas

    first_mocked_lambda = "c4-foursight-fourfront-mastertest-stack-CheckRunner-ABC"
    second_mocked_lambda = "c4-foursight-fourfront-production-stac-CheckRunner-DEFGHI"
    third_mocked_lambda = "c4-foursight-cgap-supertest-stac-CheckRunner-JKLMNOPQRST"

    mocked_lambdas = [
        *generate_mocked_lambdas(), first_mocked_lambda,
        *generate_mocked_lambdas(), second_mocked_lambda,
        *generate_mocked_lambdas(), third_mocked_lambda,
        *generate_mocked_lambdas()
    ]

    mocked_boto_lambda.register_lambdas_for_testing({name: {} for name in mocked_lambdas})

    with mock.patch.object(cloudformation_utils, "boto3", mocked_boto):

        name = find_check_runner_lambda_name("c4-foursight-fourfront-mastertest-stack")
        assert name == first_mocked_lambda

        name = find_check_runner_lambda_name("c4-foursight-fourfront-production-stack")
        assert name == second_mocked_lambda

        name = find_check_runner_lambda_name("c4-foursight-cgap-supertest-stack")
        assert name == third_mocked_lambda
