import datetime
import time
import logging
from dateutil import tz
from abc import abstractmethod
import json
# from foursight_core.s3_connection import S3Connection
from foursight_core.exceptions import (
  BadCheckOrAction,
  MissingFoursightPrefixException
)


logging.basicConfig()
logger = logging.getLogger(__name__)


class RunResult(object):
    """
    Generic class for CheckResult and ActionResult. Contains methods common
    to both.
    """
    def __init__(self, connections, name):
        self.fs_conn = connections
        self.connections = connections.connections
        self.es = True
        if self.connections['es'] is None:
            self.es = False
        self.name = name
        self.extension = ".json"
        self.kwargs = {}

    @staticmethod
    def dumps_json(d):
        """ Dumps JSON in a central method, so we can clear issues like datetime serialization by passing
            the default parameter globally
        """
        return json.dumps(d, default=str)

    def set_prefix(self, foursight_prefix):
        self.prefix = foursight_prefix

    def get_s3_object(self, key):
        """
        Returns None if not present, otherwise returns a JSON parsed res.
        """
        return self.connections['s3'].get_object(key)

    def get_es_object(self, key):
        """
        Grabs an object from ES. Returns none if not present, json otherwise
        """
        if not self.es:
            return None
        return self.connections['es'].get_object(key)

    def get_object(self, key):
        """
        Gets an object given a key from the data store.
        """
        return self.fs_conn.get_object(key)

    def put_object(self, key, value):
        """
        Puts an object into the data stores
        """
        return self.fs_conn.put_object(key, value)

    def get_latest_result(self):
        """
        Returns the latest result (the last check run)
        """
        latest_key = ''.join([self.name, '/latest', self.extension])
        return self.get_object(latest_key)

    def get_primary_result(self):
        """
        Returns the most recent primary result run (with 'primary'=True in kwargs)
        """
        primary_key = ''.join([self.name, '/primary', self.extension])
        return self.get_object(primary_key)

    def get_result_by_uuid(self, uuid):
        """
        Returns result if it can be found by its uuid, otherwise None.
        """
        result_key = ''.join([self.name, '/', uuid, self.extension])
        return self.get_object(result_key)

    def get_all_results(self):
        """
        Return all results for this check. Should use with care
        """
        all_results = []
        relevant_checks = self.list_keys(records_only=True, prefix=self.name)
        for n in range(len(relevant_checks)):
            check = relevant_checks[n]
            if check.startswith(self.name) and check.endswith(self.extension):
                result = self.get_object(check)
                all_results.append(result)
        return all_results

    def get_closest_result(self, diff_hours=0, diff_mins=0, override_date=None):
        """
        Returns check result that is closest to the current time minus
        diff_hours and diff_mins (both integers).

        If override_date is provided, ignore other arguments and use the given
        date as the metric for finding the check. This MUST be a datetime obj.

        TODO: Add some way to control which results are returned by kwargs?
        For example, you might only want primary results.
        """
        # check_tuples is a list of items of form (s3key, datetime uuid)
        check_tuples = []
        relevant_checks = self.list_keys(records_only=True, prefix=self.name)
        if not relevant_checks:
            raise Exception('Could not find any results for prefix: %s' % self.name)
        # now use only s3 objects with a valid uuid
        for check in relevant_checks:
            if check.startswith(self.name) and check.endswith(self.extension):
                time_str = check[len(self.name) + 1:-len(self.extension)]
                try:
                    check_time = datetime.datetime.strptime(time_str, "%Y-%m-%dT%H:%M:%S.%f")
                except ValueError:
                    continue
                check_time = check_time.replace(tzinfo=tz.tzutc())  # always UTC
                check_tuples.append((check, check_time))
        if override_date:
            desired_time = override_date.replace(tzinfo=tz.tzutc())
        else:
            desired_time = (
                    datetime.datetime.utcnow() - datetime.timedelta(hours=diff_hours, minutes=diff_mins)
            ).replace(tzinfo=tz.tzutc())
        best_match = get_closest(check_tuples, desired_time)
        # ensure that the does not have status 'ERROR'
        match_res = None
        tries = 0  # keep track of number of times we've found an ERROR response
        while not match_res:
            if not best_match or tries > 999:
                raise Exception('Could not find closest non-ERROR result for prefix: %s. Attempted'
                                ' with %s diff hours and %s diff mins.' % (self.name, diff_hours, diff_mins))
            possible_res = self.get_object(best_match[0])
            if possible_res and possible_res.get('status', 'ERROR') != 'ERROR':
                match_res = possible_res
            else:
                check_tuples.remove(best_match)
                if check_tuples:
                    best_match = get_closest(check_tuples, desired_time)
                else:
                    best_match = None
                tries += 1
        return match_res

    def list_keys(self, records_only=True, prefix=None):
        """
        Lists all keys. If given a prefix only keys with that prefix will be
        returned.
        """
        if self.es:
            if prefix:
                return self.connections['es'].list_all_keys_w_prefix(prefix)
            else:
                return self.connections['es'].list_all_keys()
        else:
            if prefix:
                return self.connections['s3'].list_all_keys_w_prefix(prefix, records_only=records_only)
            else:
                return self.connections['s3'].list_all_keys()

    def record_run_info(self):
        """
        Add a record of the completed check to the runs bucket with name
        equal to the dependency id. The object itself is only the status of the run.
        Returns True on success, False otherwise

        NOTE: This functionality is sort of useless I'd say - we don't create a special bucket
        for it anyway, so I am disabling it and replacing the run info with log statement that will
        propagate in the check runner - so you can always search for record_run_info to find these. - Will Nov 15 2022
        """
        run_id = self.kwargs['_run_info']['run_id']
        if not hasattr(self, 'prefix'):
            raise MissingFoursightPrefixException("foursight prefix must be defined using set_prefix")
        # s3_connection = S3Connection(self.prefix + '-runs')
        record_key = '/'.join([run_id, self.name])
        # resp = s3_connection.put_object(record_key, json.dumps(self.status))
        logger.error(f'Skipping record_run_info call to s3: {record_key} -> {run_id}')
        return True  # always returning True now

    def delete_results(self, prior_date=None, primary=True, custom_filter=None, timeout=None, es_only=False):
        """
        Goes through all check files deleting by default all non-primary
        checks. If a prior_date (datetime) is given then all results prior to the
        given time will be delete (including primaries). If primary is False then
        primary results will be cleaned as well.
        If a custom filter is given, that filter will be applied as well, prior
        to the above filters. Note that this argument can be a function or a lambda
        If es_only is specified, only delete the check from ES
        Returns a pair of the number of results deleted from s3 and es respectively
        """

        # since we fall back to s3 get the keys to delete from here
        keys_to_delete = self.connections['s3'].list_all_keys_w_prefix(self.name, records_only=True)

        # if given a custom filter, apply it
        if custom_filter is not None:
            try:
                keys_to_delete = list(filter(custom_filter, keys_to_delete))
            except Exception as e:
                raise Exception('delete_results encountered an error when applying'
                                ' a custom filter. Error message: %s', e)

        # if given a prior date, remove all keys after that date so long as they aren't primary
        if prior_date is not None:
            keys_to_delete = list(filter(lambda k: self.filename_to_datetime(k) <= prior_date, keys_to_delete))

        # if primary is true, filter out primary results (so they arent deleted)
        if primary:
            def is_not_primary(key):
                obj = self.get_s3_object(key)
                return not obj['kwargs'].get('primary')
            keys_to_delete = list(filter(is_not_primary, keys_to_delete))

        # if there is nothing to delete return 0 instead of throwing an Exception
        # in botocore
        if len(keys_to_delete) == 0:
            return 0, 0

        # batch delete calls at aws maximum of 1000 if necessary
        # if timeout is given and reached, return how many we did
        num_deleted_s3, num_deleted_es = 0, 0
        t0 = time.time()
        for i in range(0, len(keys_to_delete), 1000):
            if timeout and round(time.time() - t0, 2) > timeout:
                return num_deleted_s3, num_deleted_es
            if self.es:
                num_deleted_es += self.connections['es'].delete_keys(keys_to_delete[i:i+1000])
            if not es_only:
                s3_resp = self.connections['s3'].delete_keys(keys_to_delete[i:i+1000])
                num_deleted_s3 += len(s3_resp['Deleted'])

        return num_deleted_s3, num_deleted_es

    def get_result_history(self, start, limit, sort='timestamp.desc', after_date=None) -> [list, int]:
        """
        Used to get the uuid, status, and kwargs for a specific check.
        Results are ordered by uuid (timestamped) and sliced from start to limit.
        Probably only called from app_utils.get_foursight_history.
        after_date is an optional datetime object, if provided only the history
        results after that point will be returned.
        Returns a list of lists (inner lists: [status, kwargs])
        """
        if self.es:
            history, total = self.connections['es'].get_result_history(self.name, start, limit, sort)

            def wrapper(obj):
                filename = obj.get('_id')
                if filename is None:
                    filename = obj.get('name') + '/' + obj.get('kwargs').get('uuid') + '.json'
                return self.filename_to_datetime(filename), total

            if after_date is not None:
                history = list(filter(lambda k: wrapper(k)[0] >= after_date, history))
        else:
            all_keys = self.connections['s3'].list_all_keys_w_prefix(self.name, records_only=True)
            total = len(all_keys)
            all_keys.sort(key=self.filename_to_datetime, reverse=True)
            if after_date is not None:
                all_keys = list(filter(lambda k: self.filename_to_datetime(k) >= after_date, all_keys))
            history = all_keys[start:start+limit]
            for idx, key in enumerate(history):
                history[idx] = self.get_s3_object(key)

        results = []
        for n in range(len(history)):
            obj = history[n]
            # order: status <str>, summary <str>, kwargs <dict>, is check? (boolean)
            # handle records that might be malformed
            res_val = [
                obj.get('status', 'Not found'),
                obj.get('summary', None),
                obj.get('kwargs', {}),
                obj.get('type') == 'check' or 'full_output' in obj
            ]
            # kwargs to remove from the history results. these will not be displayed
            for remove_key in ['_run_info']:
                res_val[2].pop(remove_key, None)
            results.append(res_val)
        return results, total

    def store_formatted_result(self, uuid, formatted, primary):
        """
        Store the result in s3/ES. Always makes an entry with key equal to the
        uuid timestamp. Will also store under (i.e. overwrite)the 'latest' key.
        If is_primary, will also overwrite the 'primary' key.

        NOTE: id_alias is an alias of the _id field, which is not searchable in ES >5, which breaks the main page.
        """
        time_key = ''.join([self.name, '/', uuid, self.extension])
        latest_key = ''.join([self.name, '/latest', self.extension])
        primary_key = ''.join([self.name, '/primary', self.extension])

        # store the timestamped result
        formatted['id_alias'] = time_key
        self.put_object(time_key, self.dumps_json(formatted))

        # put result as 'latest' key
        formatted['id_alias'] = latest_key
        self.put_object(latest_key, self.dumps_json(formatted))

        # if primary, store as the primary result
        if primary:
            formatted['id_alias'] = primary_key
            self.put_object(primary_key, self.dumps_json(formatted))
        # return stored data in case we're interested
        return formatted

    def filename_to_datetime(self, key):
        """
        Utility function.
        Key might look like `sync_google_analytics_data/2018-10-15T19:08:32.734656.json`
        We presume that timezone info is not important to allow us to use strptime.
        """
        prefixlen = len(self.name) + 1
        keydatestr = key[prefixlen:-5]  # Remove prefix and .json from key.
        return datetime.datetime.strptime(keydatestr, '%Y-%m-%dT%H:%M:%S.%f')

    @abstractmethod
    def validate(self):
        """
        Validation method that must be implemented by the subclass
        """
        raise NotImplementedError


class CheckResult(RunResult):
    """
    Inherits from RunResult and is meant to be used with checks.

    Usage:
    check = CheckResult(connection, <name>)
    check.status = ...
    check.descritpion = ...
    check.store_result()
    """
    def __init__(self, connections, name, init_uuid=None):
        super().__init__(connections, name)
        # init_uuid arg used if you want to initialize using an existing check
        # init_uuid is in the stringified datetime format
        if init_uuid:
            # maybe make this '.json' dynamic with parent's self.extension?
            ts_key = ''.join([name, '/', init_uuid, '.json'])
            stamp_res = self.get_object(ts_key)
            if stamp_res:
                for key, val in stamp_res.items():
                    if key not in ['uuid', 'kwargs']:  # dont copy these
                        setattr(self, key, val)
                return
        # summary will be displayed next to title when set
        self.summary = ''
        self.description = ''
        # valid values are: 'PASS', 'WARN', 'FAIL', 'ERROR', 'IGNORE'
        # start with IGNORE as the default check status
        self.status = 'IGNORE'
        self.brief_output = None
        self.full_output = None
        # admin output is only seen by admins on the UI
        self.admin_output = None
        self.ff_link = ''
        # self.action_name is the function name of the action to link to check
        self.action = ''
        self.allow_action = False  # by default do not allow the action to be run
        # Added prevent_action to allow the allow_action flag to be True, so action *may* *always*
        # be run, but does not automatically run after check; this came up with the access_key_status
        # check, where we always want to allow the action to be manually run, but want to prevent it from
        # running after the check run, unless it is expiring soon; see: access_key_expiration_detection.
        self.prevent_action = False
        self.action_message = 'Are you sure you want to run this action?'

    def format_result(self, uuid):
        # use summary as description if descrip is missing
        if self.summary and not self.description:
            use_description = self.summary
        else:
            use_description = self.description
        return {
            'name': self.name,
            'summary': self.summary,
            'description': use_description,
            'status': self.status.upper(),
            'uuid': uuid,
            'brief_output': self.brief_output,
            'full_output': self.full_output,
            'admin_output': self.admin_output,
            'ff_link': self.ff_link,
            'action': self.action,
            'allow_action': self.allow_action,
            'prevent_action': self.prevent_action,
            'action_message': self.action_message,
            'kwargs': self.kwargs,
            'type': 'check'
        }

    def validate(self):
        """
        Validates this CheckResult against the elasticsearch mapping
        Multiple errors are possible - the 'latest' wrt when it is checked below
        is reported
        """
        error_msg = []
        store_method = getattr(self, 'store_result', None)
        if not callable(store_method):
            error_msg.append('Do not overwrite the store_result method.')

        def _validate(attr, t):
            if not isinstance(attr, t):
                error_msg.append('%s is not of type %s' % (str(attr), str(t)))

        _validate(self.name, str)
        _validate(self.summary, str)
        _validate(self.description, str)
        _validate(self.status, str)
        _validate(self.ff_link, str)
        _validate(self.action, str)
        _validate(self.allow_action, bool)
        _validate(self.kwargs, dict)
        if len(error_msg) > 0:
            raise BadCheckOrAction('\n'.join(error_msg))

    def store_result(self):
        # normalize status, probably not the optimal place to do this
        if self.status.upper() not in ['PASS', 'WARN', 'FAIL', 'ERROR', 'IGNORE']:
            self.status = 'ERROR'
            self.description = 'Malformed status; look at Foursight check definition.'
        # if there's a set uuid field, use that instead of curr utc time
        # kwargs should ALWAYS have uuid, primary, and queue_action
        if 'uuid' not in self.kwargs:
            self.kwargs['uuid'] = datetime.datetime.utcnow().isoformat()
        if 'primary' not in self.kwargs:
            self.kwargs['primary'] = False
        if 'queue_action' not in self.kwargs:
            self.kwargs['queue_action'] = 'Not queued'
        # if this was triggered from the check_runner, store record of the run
        if '_run_info' in self.kwargs and 'run_id' in self.kwargs['_run_info']:
            self.record_run_info()
        formatted = self.format_result(self.kwargs['uuid'])
        is_primary = self.kwargs.get('primary', False) is True
        # if do_not_store is set, just return result without storing in s3
        if self.kwargs.get('do_not_store', False) is True:
            return formatted
        return self.store_formatted_result(self.kwargs['uuid'], formatted, is_primary)


class ActionResult(RunResult):
    """
    Inherits from RunResult and is meant to be used with actions
    """
    def __init__(self, connections, name):
        self.description = ''
        # valid values are: 'DONE', 'FAIL', 'PEND'
        # start with PEND as the default status
        self.status = 'PEND'
        self.output = None
        super().__init__(connections, name)

    def format_result(self, uuid):
        return {
            'name': self.name,
            'description': self.description,
            'status': self.status.upper(),
            'uuid': uuid,
            'output': self.output,
            'kwargs': self.kwargs,
            'type': 'action'
        }

    def validate(self):
        """
        Validates this action result against the elasticsearch mapping
        Multiple errors are possible - the 'latest' wrt when it is checked below
        is reported
        """
        error_msg = []
        store_method = getattr(self, 'store_result', None)
        if not callable(store_method):
            error_msg.append('Do not overwrite the store_result method.')

        def _validate(attr, t):
            if not isinstance(attr, t):
                error_msg.append('%s is not of type %s' % (str(attr), str(t)))

        _validate(self.status, str)
        _validate(self.description, str)
        _validate(self.name, str)
        _validate(self.kwargs, dict)
        if len(error_msg) > 0:
            raise BadCheckOrAction('\n'.join(error_msg))

    def store_result(self):
        # normalize status, probably not the optimal place to do this
        if self.status.upper() not in ['DONE', 'FAIL', 'PEND']:
            self.status = 'FAIL'
            self.description = 'Malformed status; look at Foursight action definition.'
        # kwargs should **always** have uuid
        if 'uuid' not in self.kwargs:
            self.kwargs['uuid'] = datetime.datetime.utcnow().isoformat()
        # if this was triggered from the check_runner, store record of the run
        if '_run_info' in self.kwargs and 'run_id' in self.kwargs['_run_info']:
            self.record_run_info()
        formatted = self.format_result(self.kwargs['uuid'])
        # if do_not_store is set, just return result without storing in s3
        if self.kwargs.get('do_not_store', False) is True:
            return formatted
        # action results are always stored as 'primary' and 'latest' and can be
        # fetched with the get_latest_result method.
        return self.store_formatted_result(self.kwargs['uuid'], formatted, True)

    def get_associated_check_result(self, kwargs):
        """
        Leverage required 'check_name' and 'called_by' kwargs to return
        the check result from the associted check of this action.
        This will throw a KeyError if the kwargs are missing, but that's okay,
        since we want to enforce the new associated check/action model.
        Must pass in the dict kwargs
        """
        assc_name = kwargs['check_name']
        called_by = kwargs['called_by']
        check = CheckResult(self.fs_conn, assc_name)
        return check.get_result_by_uuid(called_by)


# ===== Utility functions for check_result =====

def get_closest(items, pivot):
    """
    Return the item in the list of items closest to the given pivot.
    Items should be given in tuple form (ID, value (to compare))
    Intended primarily for use with datetime objects.
    See: S.O. 32237862
    """
    return min(items, key=lambda x: abs(x[1] - pivot))
