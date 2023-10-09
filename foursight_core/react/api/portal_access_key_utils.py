from datetime import datetime, timedelta
import pytz
from dcicutils import ff_utils
from dcicutils.misc_utils import future_datetime
from typing import Optional, Tuple
from ...app import app
from .datetime_utils import (
    convert_iso_datetime_string_to_datetime as normalize_portal_datetime,
    convert_datetime_to_utc_datetime_string as datetime_to_string
)


_PORTAL_ACCESS_KEY_NAME = "access_key_foursight"
_PORTAL_ACCESS_KEY_USER_EMAIL = "foursight.app@gmail.com"
_PORTAL_ACCESS_KEY_EXPIRES_SOON_WARNING_DAYS = 12


def get_portal_access_key_info(env: str,
                               logged_in: bool = False,
                               test_mode_access_key_simulate_error: bool = False,
                               test_mode_access_key_expiration_warning_days: int = 0) -> dict:
    try:
        now = datetime.now(pytz.utc)
        connection = app.core.init_connection(env)
        connection_keys = connection.ff_keys
        key = connection_keys.get("key")
        if key and not logged_in:
            # This logged_in flag is passed from caller (react_api.reactapi_portal_access_key)
            # and is False iff the user is NOT logged in; so if logged in then we do NOT
            # obfuscate the access key (ID) but if we are NOT logged in we do obfuscate it.
            # And of course we do not return any part of the secret at all, ever.
            key = "********"
        server = connection_keys.get("server")
        access_key_info = {"key": key, "secret": "********", "server": server, "logged_in": logged_in}
        access_key_create_date, access_key_expires_date, access_key_expires_exception = \
            _get_portal_access_key_expires_date(connection_keys)
        if access_key_expires_date:
            access_key_info["created_at"] = datetime_to_string(access_key_create_date)
            if access_key_expires_date == datetime.max:
                access_key_info["expires_at"] = None
                access_key_info["expired"] = False
                access_key_info["invalid"] = False
                access_key_info["expires_soon"] = False
            else:
                access_key_info["expires_at"] = datetime_to_string(access_key_expires_date)
                access_key_info["expired"] = now >= access_key_expires_date
                access_key_info["invalid"] = access_key_info["expired"]
                # Note that these "test_mode_xyz" variables are for testing only and are set
                # via cookies and if used must be manually set, e.g. via Chrome Developer Tools.
                if test_mode_access_key_expiration_warning_days > 0:
                    expires_soon_days = test_mode_access_key_expiration_warning_days
                else:
                    expires_soon_days = _PORTAL_ACCESS_KEY_EXPIRES_SOON_WARNING_DAYS
                access_key_info["expires_soon"] = _is_datetime_within_future_ndays(access_key_expires_date,
                                                                                   ndays=expires_soon_days,
                                                                                   now=now)
            if test_mode_access_key_simulate_error:
                access_key_info["exception"] = "test_mode_access_key_simulate_error"
                access_key_info["invalid"] = True
        else:
            # If we don't get an expires date at all, then assume there is a problem.
            access_key_info["exception"] = str(access_key_expires_exception)
            e = str(access_key_info["exception"]).lower()
            if "credenti" in e or "expir" in e:
                access_key_info["probably_expired"] = True
            access_key_info["invalid"] = True
        access_key_info["timestamp"] = datetime_to_string(now)
        return access_key_info
    except Exception:
        return {}


def _get_portal_access_key_expires_date(keys: dict) -> Tuple[datetime, Optional[datetime], Optional[Exception]]:
    try:
        query = f"/search/?type=AccessKey&description={_PORTAL_ACCESS_KEY_NAME}&sort=-date_created"
        access_key = ff_utils.search_metadata(query, key=keys)[0]
        access_key_create_date = normalize_portal_datetime(access_key["date_created"])
        access_key_expires_date = access_key.get("expiration_date")
        if access_key_expires_date:
            access_key_expires_date = normalize_portal_datetime(access_key_expires_date)
        else:
            # There may or may not be an expiration date (e.g. for fourfront);
            # if not then make it the max date which is 9999-12-31 23:59:59.999999.
            access_key_expires_date = datetime.max
        return (access_key_create_date, access_key_expires_date, None)
    except Exception as e:
        return (None, None, e)


def _is_datetime_within_future_ndays(d: datetime, ndays: int, now: Optional[datetime] = None) -> bool:
    """
    Returns True iff the given datatime is within ndays IN THE FUTURE of the CURRENT
    datetime. I.e. if the current datetime plus ndays is greater-than-or-equal to
    the given datetime the returns True; otherwise returns False.
    """
    if not now:
        now = datetime.now(pytz.utc)
    return d <= future_datetime(now=now, days=ndays)
