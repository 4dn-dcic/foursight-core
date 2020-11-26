import os
from foursight_core import stage


class TestStage():
    def test_get_stage_info(self):
        os.environ['chalice_stage'] = 'test'
        stage_obj = stage.Stage('placeholder_prefix)
        assert stage_obj.get_stage() == 'dev'
        assert stage.Stage.get_stage() == 'dev'  # this one is also a classmethod
        assert 'dev' in stage_obj.get_runner_name()
        assert 'test' in stage_obj.get_queue_name()
