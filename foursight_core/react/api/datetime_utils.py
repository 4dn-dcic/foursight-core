import datetime
import pytz


def convert_utc_datetime_to_useastern_datetime_string(t) -> str:
    """
    Converts the given UTC datetime object or string into a US/Eastern datetime string
    and returns its value in a form that looks like 2022-08-22 13:25:34 EDT.
    If the argument is a string it is ASSUMED to have a value which looks
    like 2022-08-22T14:24:49.000+0000; this is the datetime string format
    we get from AWS via boto3 (e.g. for a lambda last-modified value).

    :param t: UTC datetime object or string value.
    :return: US/Eastern datetime string (e.g.: 2022-08-22 13:25:34 EDT).
    """
    try:
        if isinstance(t, str):
            t = datetime.datetime.strptime(t, "%Y-%m-%dT%H:%M:%S.%f%z")
        t = t.replace(tzinfo=pytz.UTC).astimezone(pytz.timezone("US/Eastern"))
        return t.strftime("%Y-%m-%d %H:%M:%S %Z")
    except:
        return "datetime-utc-parse-error"


def convert_time_t_to_useastern_datetime_string(time_t: int) -> str:
    """
    Converts the given "epoch" time (seconds since 1970-01-01T00:00:00Z)
    integer value to a US/Eastern datetime string and returns its value
    in a form that looks like 2022-08-22 13:25:34 EDT.

    :param time_t: Epoch time value (i.e. seconds since 1970-01-01T00:00:00Z)
    :return: US/Eastern datetime string (e.g.: 2022-08-22 13:25:34 EDT).
    """
    try:
        if not isinstance(time_t, int):
            return ""
        t = datetime.datetime.fromtimestamp(time_t, tz=pytz.UTC)
        return convert_utc_datetime_to_useastern_datetime_string(t)
    except:
        return "datetime-parse-error"

def convert_time_t_to_datetime(time_t: int) -> datetime.datetime:
    return datetime.datetime.fromtimestamp(time_t, tz=pytz.UTC)

def convert_datetime_to_time_t(value: datetime.datetime) -> int:
    return int(value.timestamp())
