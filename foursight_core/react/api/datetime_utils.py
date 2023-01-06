import datetime
import dateutil.parser as dateutil_parser
import pytz
from typing import Optional, Union


EPOCH = datetime.datetime.utcfromtimestamp(0)  # I.e.: 1970-01-01 00:00:00 UTC
TIMEZONE_USEASTERN = "US/Eastern"


def convert_utc_datetime_to_datetime_string(t: Union[datetime.datetime, str], tzname: str) -> Optional[str]:
    """
    Converts the given datetime object OR string, which is ASSUMED to by in the UTC timezone,
    into a datetime string in the given/named timezone, and returns its value in a form that looks
    like 2022-08-22 13:25:34 EDT. If the argument is a string it is ASSUMED to have a value which
    looks like 2022-08-22T14:24:49.000+0000; this is (for example) the format we get from AWS via
    boto3 (e.g. for a lambda last-modified value) or from values in ElasticSearch.

    :param t: A datetime object or string value ASSUMED to be in the UTC timezone.
    :return: A datetime string in the given timezone formatted like: 2022-08-22 13:25:34 EDT
    """
    def make_utc_aware_datetime(t: datetime) -> datetime:
        return t.replace(tzinfo=pytz.UTC)
    try:
        if isinstance(t, str):
            #
            # Can sometimes get dates (from user ElasticSearch index)
            # which look like this: 2019-06-20T00:00:00.0000000+00:00
            # i.e. with 7-digits for ms which does not parse (up to 6).
            # Was doing this hack below but found that the Python
            # dateutil.parser is more forgiving so using that now.
            #
            # if ".0000000" in t:
            #     t = t.replace(".0000000", ".000000")
            # t = datetime.datetime.strptime(t, "%Y-%m-%dT%H:%M:%S.%f%z")
            #
            t = dateutil_parser.parse(t)
        t = make_utc_aware_datetime(t).astimezone(pytz.timezone(tzname))
        return t.strftime("%Y-%m-%d %H:%M:%S %Z")
    except Exception:
        return None


def convert_utc_datetime_to_useastern_datetime_string(t: Union[datetime.datetime, str]) -> Optional[str]:
    """
    Same as convert_utc_datetime_to_datetime_string (above) but specifically for US/Eastern timezone.
    """
    return convert_utc_datetime_to_datetime_string(t, TIMEZONE_USEASTERN)


def convert_time_t_to_datetime_string(time_t: int, tzname: str) -> Optional[str]:
    """
    Converts the given "epoch" time (seconds since 1970-01-01T00:00:00Z)
    integer value to a datetime string in the given/named timezone,
    and returns its value in a form that looks like 2022-08-22 13:25:34 EDT.

    :param time_t: Epoch time value (i.e. seconds since 1970-01-01T00:00:00Z)
    :return: A datetime string in the given timezone formatted like: 2022-08-22 13:25:34 EDT
    """
    return convert_utc_datetime_to_datetime_string(convert_time_t_to_datetime(time_t), tzname)


def convert_time_t_to_useastern_datetime_string(time_t: int) -> Optional[str]:
    """
    Same as convert_time_t_to_datetime_string (above) but specifically for US/Eastern timezone.
    """
    return convert_time_t_to_datetime_string(time_t, TIMEZONE_USEASTERN)


def convert_time_t_to_datetime(time_t: int) -> datetime.datetime:
    """
    Converts the given "epoch" time (seconds since 1970-01-01T00:00:00Z)
    to a datetime and returns its value.
    """
    return datetime.datetime.fromtimestamp(time_t, tz=pytz.UTC)


def convert_datetime_to_time_t(value: datetime.datetime) -> int:
    """
    Converts the given datatime value to an "epoch"
    time (seconds since 1970-01-01T00:00:00Z) and returns its value.
    """
    return int(value.timestamp())


def convert_utc_datetime_to_cookie_expires_format(t) -> str:
    """
    Converts the given UTC datetime object or string format suitable
    for use by a cookie expires date/time value.
    """
    return t.strftime("%a, %d %b %Y %H:%M:%S GMT")


def convert_uptime_to_datetime(uptime: str, relative_to: datetime = None) -> Optional[datetime.datetime]:
    """
    Converts the given duration string which (happens to be) from the Portal health endpoint
    into its equivalent datetime. Format of the given upatime looks something like this:

      1 week, 2 days, 3 hours, 4 minutes, 5.67 seconds

    If the given uptime is not parsable then returns None, otherwise returns the datetime corresponding
    to this uptime, relative to now, by default, or to the relative_to datetime argument if given.
    We THINK it's right to interpret the given uptime relative to UTC (TODO).
    """
    def normalize_spaces(s: str) -> str:
        return " ".join(s.split())

    if not uptime:
        return None
    try:
        minutes_per_hour = 60
        minutes_per_day = minutes_per_hour * 24
        minutes_per_week = minutes_per_day * 7
        minutes = 0
        seconds = 0
        uptime = normalize_spaces(uptime)
        for item in uptime.split(","):
            item = item.strip()
            if item:
                item = item.split(" ")
                if len(item) == 2:
                    unit = item[1].lower()
                    value = float(item[0])
                    if unit.startswith("week"):
                        minutes += minutes_per_week * value
                    elif unit.startswith("day"):
                        minutes += minutes_per_day * value
                    elif unit.startswith("hour"):
                        minutes += minutes_per_hour * value
                    elif unit.startswith("minute"):
                        minutes += value
                    elif unit.startswith("second"):
                        seconds += value
        t = relative_to if relative_to else datetime.datetime.now(datetime.timezone.utc)
        return t + datetime.timedelta(minutes=-minutes, seconds=-seconds)
    except Exception:
        pass
    return None
