from dateutil import tz
from foursight_core.checks.helpers import sys_utils


class TestHelpers():
    timestr_1 = '2017-04-09T17:34:53.423589+00:00'  # UTC
    timestr_2 = '2017-04-09T17:34:53.423589+05:00'  # 5 hours ahead of UTC
    timestr_3 = '2017-04-09T17:34:53.423589-05:00'  # 5 hours behind of UTC
    timestr_4 = '2017-04-09T17:34:53.423589'
    timestr_5 = '2017-04-09T17:34:53'
    timestr_bad_1 = '2017-04-0589+00:00'
    timestr_bad_2 = '2017-xxxxxT17:34:53.423589+00:00'
    timestr_bad_3 = '2017-xxxxxT17:34:53.423589'

    def test_parse_datetime_to_utc(self):
        [dt_tz_a, dt_tz_b, dt_tz_c] = ['None'] * 3
        for t_str in [self.timestr_1, self.timestr_2, self.timestr_3, self.timestr_4]:
            dt = sys_utils.parse_datetime_to_utc(t_str)
            assert (dt is not None)
            assert (dt.tzinfo is not None and dt.tzinfo == tz.tzutc())
            if t_str == self.timestr_1:
                dt_tz_a = dt
            elif t_str == self.timestr_2:
                dt_tz_b = dt
            elif t_str == self.timestr_3:
                dt_tz_c = dt
        assert (dt_tz_c > dt_tz_a > dt_tz_b)
        for bad_tstr in [self.timestr_bad_1, self.timestr_bad_2, self.timestr_bad_3]:
            dt_bad = sys_utils.parse_datetime_to_utc(bad_tstr)
            assert (dt_bad is None)
        # use a manual format
        dt_5_man = sys_utils.parse_datetime_to_utc(self.timestr_5, manual_format="%Y-%m-%dT%H:%M:%S")
        dt_5_auto = sys_utils.parse_datetime_to_utc(self.timestr_5)
        assert (dt_5_auto == dt_5_man)
