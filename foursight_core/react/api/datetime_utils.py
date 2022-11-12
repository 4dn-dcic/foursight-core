import datetime
import pytz
import re
from typing import Optional, Tuple, Union


EPOCH = datetime.datetime.utcfromtimestamp(0)  # I.e.: 1970-01-01 00:00:00 UTC


def convert_utc_datetime_to_useastern_datetime_string(t: Union[datetime.datetime, str]) -> str:
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
            # Can sometimes get dates (from userr database) which
            # look like this: 2019-06-20T00:00:00.0000000+00:00
            # with 7-digits for ms which does not parse (up to 6).
            if ".0000000" in t:
                t = t.replace(".0000000", ".000000")
            t = datetime.datetime.strptime(t, "%Y-%m-%dT%H:%M:%S.%f%z")
        t = t.replace(tzinfo=pytz.UTC).astimezone(pytz.timezone("US/Eastern"))
        return t.strftime("%Y-%m-%d %H:%M:%S %Z")
    except Exception:
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
    except Exception:
        return "datetime-parse-error"


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

    Where the week part is optional. If the given uptime is not parsable then returns None,
    otherwise returns the datetime corresponding to this uptime, relative to now by
    default or if the relative_to datetime argument is then relative to that.
    """
    def parse_uptime(uptime: str) -> Optional[Tuple]:
        """
        Parses the given duration string which (happens to be) from the Portal health endpoint
        and returns its constituent components, i.e. days, hours, minutes, seconds, as a tuple.
        See above for assumed format  of the given uptime string.
        If the given uptime is not parsable then returns None, otherwise returns the consituent
        components as a tuple containing in (left-right) order: days, hours, minutes, seconds.
        """
        r = re.compile("([0-9]+[ ]+weeks?,[ ]*)?([0-9]+)[ ]+days?,[ ]*([0-9]+)[ ]+hours?,[ ]*([0-9]+)[ ]+minutes?,[ ]*([0-9]*\.?[0-9]*)[ ]+seconds?$")
        match = r.match(uptime)
        if not match:
            return None
        groups = match.groups()
        if not groups or len(groups) != 5:
            return None
        weeks = groups[0]
        days = int(groups[1])
        hours = int(groups[2])
        minutes = int(groups[3])
        seconds = float(groups[4])
        if weeks:
            r = re.compile("([0-9]+)[ ]+weeks?")
            match = r.match(weeks)
            if match:
                groups = match.groups()
                if groups and len(groups) == 1:
                    days += int(groups[0]) * 7
        return days, hours, minutes, seconds
    if not uptime:
        return None
    try:
        uptime = parse_uptime(uptime)
        if not uptime:
            return None
        days, hours, minutes, seconds = uptime
        now = datetime.datetime.now()
        return now + datetime.timedelta(days=-days, hours=-hours, minutes=-minutes, seconds=-seconds)
    except Exception:
        return None
