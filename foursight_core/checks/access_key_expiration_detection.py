from .helpers.confchecks import (
    check_function, CheckResult, action_function, ActionResult
)
import json
from datetime import datetime, timedelta
from dcicutils import s3_utils
from dcicutils.ff_utils import get_metadata, search_metadata, patch_metadata, post_metadata


@check_function(action="refresh_access_keys")
def access_key_status(connection, **kwargs):
    """ Checks the creation date of the admin access keys and if expiration is soon
        emit warning and error eventually as it gets closer. Once these keys expire
        (every 90 days), foursight and tibanna will no longer function.
    """
    check = CheckResult(connection, 'access_key_status')
    check.action = 'refresh_access_keys'
    check.allow_action = True
    check.prevent_action = False
    fs_user_email, fs_user_kp = 'foursight.app@gmail.com', 'access_key_foursight'
    user_props = get_metadata(f'/users/{fs_user_email}?datastore=database', key=connection.ff_keys)
    user_uuid = user_props['uuid']
    access_keys = search_metadata(f'/search/?type=AccessKey&description={fs_user_kp}&user.uuid={user_uuid}'
                                  f'&sort=-date_created', key=connection.ff_keys)
    most_recent_key = access_keys[0]  # should always be present if deploy has run
    # date format: 2022-07-05T01:01:43.498347+00:00 (isoformat)
    most_recent_key_creation_date = datetime.fromisoformat(most_recent_key['date_created'])
    expiration_date = most_recent_key_creation_date + timedelta(days=90)
    one_week_to_expiration = expiration_date - timedelta(days=7)
    three_weeks_to_expiration = expiration_date - timedelta(days=21)
    now = datetime.now(most_recent_key_creation_date.tzinfo)
    if now > one_week_to_expiration:
        check.status = 'FAIL'
        check.summary = (f'Application access keys will expire in less than 7 days! Please run'
                         f' the deployment action ASAP')
        check.brief_output = check.full_output = check.summary
        return check
    elif now > three_weeks_to_expiration:
        check.status = 'WARN'
        check.summary = (f'Application access keys will expire in less than 21 days! Please run'
                         f' the deployment action soon')
        check.brief_output = check.full_output = check.summary
        # This prevents the from running automatically after the check;
        # though the user is still allowed to run it manually in any case.
        check.prevent_action = True
        return check
    else:
        check.status = 'PASS'
        check.summary = (f'Application access keys expiration is more than 3 weeks away. All good.'
                         f' Expiration date: {expiration_date}')
        # This prevents the from running automatically after the check;
        # though the user is still allowed to run it manually in any case.
        check.prevent_action = True
        return check


@action_function()
def refresh_access_keys(connection, **kwargs):
    """ Triggers a refresh of the 3 admin keys, previously run through the portal """
    action = ActionResult(connection, 'refresh_access_keys')
    admin_keys = [('4dndcic@gmail.com', 'access_key_admin'),  # fourfront admin
                  ('cgap.platform@gmail.com', 'access_key_admin'),  # cgap admin
                  ('tibanna.app@gmail.com', 'access_key_tibanna'),
                  ('foursight.app@gmail.com', 'access_key_foursight')]
    s3 = s3_utils.s3Utils(env=connection.ff_env)
    full_output = {
        'successfully_generated': []
    }
    # N.B. The ordering of the admin_keys (above) in this loop is actually VERY IMPORTANT,
    # the one for Foursight itself (access_key_foursight) being LAST. This is because unless
    # this is the case (i.e. access_key_foursight being last), we would loose access to the
    # very Portal calls we are making below, via the current Foursight access key which is
    # being refreshed, i.e. where this current Foursight access key is in the process of
    # being decommissioned (i.e. deleted). FYI this (ordering requirement) would not be
    # the case if we were to re-initialize the (given) connection (via init_connection)
    # on each iteration of the loop (but since that is passed it, and since we don't need
    # to do this, so long as we are careful about the ordering here, we don't do this).
    for email, kp_name in admin_keys:
        try:
            user = get_metadata(f'/users/{email}?datastore=database', key=connection.ff_keys)
        except Exception:
            continue  # user not found
        user_uuid = user['uuid']
        access_keys = search_metadata(f'/search/?type=AccessKey&description={kp_name}&user.uuid={user_uuid}'
                                      f'&sort=-date_created', key=connection.ff_keys)
        # generate new key
        access_key_req = {'user': user_uuid, 'description': kp_name}
        # 2020-06-13/dmichaels: The actual result returned by the portal for this POST is not what
        # seems to be expected; the access_key_id and secret_access_key are not within the @graph
        # array; but handle both cases just in case; maybe that as an older (or newer) API.
        # access_key_res = post_metadata(access_key_req, 'access-keys', key=connection.ff_keys)['@graph'][0]
        access_key_res = post_metadata(access_key_req, 'access-keys', key=connection.ff_keys)
        access_key_id = access_key_res.get('access_key_id')
        secret_access_key = access_key_res.get('secret_access_key')
        if not access_key_id or not secret_access_key:
            # We will say these must occur in pairs; both at the top level or both within the @graph array.
            graph_item = access_key_res.get('@graph', [{}])[0]
            access_key_id = graph_item.get('access_key_id')
            secret_access_key = graph_item.get('secret_access_key')
        s3_obj = {'secret': secret_access_key, 'key': access_key_id, 'server': s3.url}
        s3.s3_put_secret(json.dumps(s3_obj), kp_name)
        full_output['successfully_generated'].append(email)
        # clear out old keys after generating new one
        for access_key in access_keys:  # note this search result was computed before the new key was added
            if access_key['status'] != 'deleted':
                try:
                    patch_metadata(patch_item={'status': 'deleted'}, obj_id=access_key['uuid'], key=connection.ff_keys)
                except Exception as e:
                    print(f"Exception while trying to delete old access key ({access_key['uuid']})")
                    print(e)

    action.full_output = full_output
    action.status = 'DONE'
    return action
