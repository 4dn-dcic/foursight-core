from foursight_core.deploy import Deploy


# TODO: This is just one ceremonial test, an invitation to write some real tests.
def test_deploy_default_lambda_timeout():

    assert Deploy.DEFAULT_LAMBDA_TIMEOUT == 60 * 15  # 15 minutes
