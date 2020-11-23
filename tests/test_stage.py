from foursight_core.chalice import stage


class TestStage():
    def test_get_stage_info(self):
        os.environ['chalice_stage'] = 'test'
        assert stage.Stage.get_stage() == 'dev'
        assert 'dev' in stage.Stage.get_runner_name()
        assert 'test' in stage.Stage.get_queue_name()
