from foursight_core import environment

class TestEnvironment():
    def test_list_environments(self):
        env_list = environment.Environment.list_environments()
        # assume we have at least one environments
        assert (isinstance(env_list, list))
        assert (self.environ in env_list)

