from foursight_core import app_utils as app_utils_module
from foursight_core.app_utils import AppUtilsCore
from unittest import mock


def test_get_env_schedule():

    with mock.patch.object(app_utils_module, "public_env_name") as mock_public_env_name:
        with mock.patch.object(app_utils_module, "full_env_name") as mock_full_env_name:
            with mock.patch.object(app_utils_module, "short_env_name") as mock_short_env_name:

                expected_prd = 'schedule-prd-stuff-here'
                expected_stg = 'schedule-stg-stuff-here'

                def mocked_public_name(x):
                    if x in ['prod', 'prd', 'acme-prd']:
                        return 'prod'
                    elif x in ['stage', 'stg', 'acme-stg']:
                        return 'stage'
                    else:
                        return f"public-{x}"

                def mocked_short_name(x):
                    if x in ['prod', 'prd', 'acme-prd']:
                        return 'prd'
                    elif x in ['stage', 'stg', 'acme-stg']:
                        return 'stg'
                    else:
                        return f"short-{x}"

                def mocked_full_name(x):
                    if x in ['prod', 'prd', 'acme-prd']:
                        return 'acme-prd'
                    elif x in ['stage', 'stg', 'acme-stg']:
                        return 'acme-stg'
                    else:
                        return f"full-{x}"

                mock_public_env_name.side_effect = mocked_public_name
                mock_short_env_name.side_effect = mocked_short_name
                mock_full_env_name.side_effect = mocked_full_name

                sched_using_public_name = {"prod": expected_prd, "stage": expected_stg}
                sched_using_short_name = {"prd": expected_prd, "stg": expected_stg}
                sched_using_full_name = {"acme-prd": expected_prd, "acme-stg": expected_stg}

                assert AppUtilsCore.get_env_schedule(sched_using_public_name, 'prod') == expected_prd
                assert AppUtilsCore.get_env_schedule(sched_using_public_name, 'prd') == expected_prd
                assert AppUtilsCore.get_env_schedule(sched_using_public_name, 'acme-prd') == expected_prd

                assert AppUtilsCore.get_env_schedule(sched_using_short_name, 'prod') == expected_prd
                assert AppUtilsCore.get_env_schedule(sched_using_short_name, 'prd') == expected_prd
                assert AppUtilsCore.get_env_schedule(sched_using_short_name, 'acme-prd') == expected_prd

                assert AppUtilsCore.get_env_schedule(sched_using_full_name, 'prod') == expected_prd
                assert AppUtilsCore.get_env_schedule(sched_using_full_name, 'prd') == expected_prd
                assert AppUtilsCore.get_env_schedule(sched_using_full_name, 'acme-prd') == expected_prd

                assert AppUtilsCore.get_env_schedule(sched_using_public_name, 'stage') == expected_stg
                assert AppUtilsCore.get_env_schedule(sched_using_public_name, 'stg') == expected_stg
                assert AppUtilsCore.get_env_schedule(sched_using_public_name, 'acme-stg') == expected_stg

                assert AppUtilsCore.get_env_schedule(sched_using_short_name, 'stage') == expected_stg
                assert AppUtilsCore.get_env_schedule(sched_using_short_name, 'stg') == expected_stg
                assert AppUtilsCore.get_env_schedule(sched_using_short_name, 'acme-stg') == expected_stg

                assert AppUtilsCore.get_env_schedule(sched_using_full_name, 'stage') == expected_stg
                assert AppUtilsCore.get_env_schedule(sched_using_full_name, 'stg') == expected_stg
                assert AppUtilsCore.get_env_schedule(sched_using_full_name, 'acme-stg') == expected_stg

                assert AppUtilsCore.get_env_schedule(sched_using_public_name, 'foo') == []
                assert AppUtilsCore.get_env_schedule(sched_using_short_name, 'foo') == []
                assert AppUtilsCore.get_env_schedule(sched_using_full_name, 'foo') == []
