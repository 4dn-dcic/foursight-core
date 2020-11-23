from foursight_core.chalicelib.checks.helpers import sys_utils


class TestHelpers():
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
