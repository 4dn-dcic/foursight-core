from .helpers.confchecks import (
    check_function, CheckResult, action_function, ActionResult
)
from datetime import datetime, timedelta
from dcicutils import s3_utils
from dcicutils.ff_utils import get_metadata, search_metadata, patch_metadata, post_metadata


@check_function()
def access_key_status(connection, **kwargs):
    """ Checks the creation date of the admin access keys and if expiration is soon
        emit warning and error eventually as it gets closer. Once these keys expire
        (every 90 days), foursight and tibanna will no longer function.
    """
    check = CheckResult(connection, 'access_key_status')
    check.action = 'refresh_access_keys'
    check.allow_action = True  # always allow refresh
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
    now = datetime.utcnow()
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
        return check
    else:
        check.status = 'PASS'
        check.summary = (f'Application access keys expiration is more than 3 weeks away. All good.'
                         f' Expiration date: {expiration_date}')
        return check


@action_function()
def refresh_access_keys(connection, **kwargs):
    """ Triggers a refresh of the 3 admin keys, previously run through the portal """
    action = ActionResult(connection, 'refresh_access_keys')
    admin_keys = [('4dndcic@gmail.com', 'access_key_admin'),
                  ('tibanna.app@gmail.com', 'access_key_tibanna'),
                  ('foursight.app@gmail.com', 'access_key_foursight')]
    s3 = s3_utils.s3Utils()
    full_output = {
        'successfully_generated': []
    }
    for email, kp_name in admin_keys:
        user = get_metadata(f'/users/{email}?datastore=database', key=connection.ff_keys)
        user_uuid = user['uuid']
        access_keys = search_metadata(f'/search/?type=AccessKey&description={kp_name}&user.uuid={user_uuid}'
                                      f'&sort=-date_created', key=connection.ff_keys)
        for access_key in access_keys:
            if access_key['status'] != 'deleted':
                patch_metadata(patch_item={'status': 'deleted'}, obj_id=access_key['uuid'], key=connection.ff_keys)

        # generate new key
        access_key_req = {'user': user_uuid, 'description': kp_name}
        access_key_res = post_metadata('/access_key', access_key_req, key=connection.ff_keys)
        s3_obj = {'secret': access_key_res['secret_access_key'],
                  'key': access_key_res['access_key_id'],
                  'server': s3.url}
        s3.s3_put_secret(s3_obj, kp_name)
        full_output['successfully_generated'].append(email)
    action.full_output = full_output
    action.status = 'DONE'
    return action



