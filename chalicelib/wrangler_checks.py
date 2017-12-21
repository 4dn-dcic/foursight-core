from __future__ import print_function, unicode_literals
from .utils import check_function, init_check_res
from .wrangler_utils import *
from dcicutils import ff_utils
import requests
import sys
import json
import datetime
import boto3


@check_function()
def item_counts_by_type(connection, **kwargs):
    def process_counts(count_str):
        # specifically formatted for FF health page
        ret = {}
        split_str = count_str.split()
        ret[split_str[0].strip(':')] = int(split_str[1])
        ret[split_str[2].strip(':')] = int(split_str[3])
        return ret

    check = init_check_res(connection, 'item_counts_by_type', runnable=True)
    # run the check
    item_counts = {}
    warn_item_counts = {}
    server = connection.ff
    try:
        counts_res = requests.get(''.join([server,'counts?format=json']))
    except:
        check.status = 'ERROR'
        return check.store_result()
    if counts_res.status_code != 200:
        check.status = 'ERROR'
        return check.store_result()
    counts_json = json.loads(counts_res.text)
    for index in counts_json['db_es_compare']:
        counts = process_counts(counts_json['db_es_compare'][index])
        item_counts[index] = counts
        if counts['DB'] != counts['ES']:
            warn_item_counts[index] = counts
    # add ALL for total counts
    total_counts = process_counts(counts_json['db_es_total'])
    item_counts['ALL'] = total_counts
    # set fields, store result
    if not item_counts:
        check.status = 'FAIL'
        check.description = 'Error on fourfront health page.'
    elif warn_item_counts:
        check.status = 'WARN'
        check.description = 'DB and ES counts are not equal.'
        check.brief_output = warn_item_counts
    else:
        check.status = 'PASS'
    check.full_output = item_counts
    return check.store_result()


@check_function()
def change_in_item_counts(connection, **kwargs):
    # use this check to get the comparison
    check = init_check_res(connection, 'change_in_item_counts', runnable=True)
    counts_check = init_check_res(connection, 'item_counts_by_type')
    latest = counts_check.get_latest_check()
    # get_item_counts run closest to 24 hours ago
    prior = counts_check.get_closest_check(24)
    if not latest.get('full_output') or not prior.get('full_output'):
        check.status = 'ERROR'
        check.description = 'There are no counts_check results to run this check with.'
        return check.store_result()
    diff_counts = {}
    # drill into full_output
    latest = latest['full_output']
    prior = prior['full_output']
    # get any keys that are in prior but not latest
    prior_unique = list(set(prior.keys()) - set(latest.keys()))
    for index in latest:
        if index == 'ALL':
            continue
        if index not in prior:
            diff_counts[index] = latest[index]['DB']
        else:
            diff_DB = latest[index]['DB'] - prior[index]['DB']
            if diff_DB != 0:
                diff_counts[index] = diff_DB
    for index in prior_unique:
        diff_counts[index] = -1 * prior[index]['DB']
    if diff_counts:
        check.status = 'WARN'
        check.full_output = diff_counts
        check.description = 'DB counts have changed in past day; positive numbers represent an increase in current counts.'
    else:
        check.status = 'PASS'
    return check.store_result()


@check_function(item_type='Item')
def items_created_in_the_past_day(connection, **kwargs):
    item_type = kwargs.get('item_type')
    ts_uuid = kwargs.get('uuid')
    check = init_check_res(connection, 'items_created_in_the_past_day', uuid=ts_uuid, runnable=True)
    fdn_conn = get_FDN_Connection(connection)
    if not (fdn_conn and fdn_conn.check):
        check.status = 'ERROR'
        check.description = ''.join(['Could not establish a FDN_Connection using the FF env: ', connection.ff_env])
        return check.store_result()
    # date string of approx. one day ago in form YYYY-MM-DD
    date_str = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).strftime('%Y-%m-%d')
    search_query = ''.join(['/search/?type=', item_type, '&limit=all&q=date_created:>=', date_str])
    search_res = ff_utils.get_metadata(search_query, connection=fdn_conn, frame='object')
    results = search_res.get('@graph', [])
    full_output = check.full_output if check.full_output else {}
    item_output = []
    for res in results:
        item_output.append({
            'uuid': res.get('uuid'),
            '@id': res.get('@id'),
            'date_created': res.get('date_created')
        })
    if item_output:
        full_output[item_type] = item_output
    check.full_output = full_output
    if full_output:
        check.status = 'WARN'
        check.description = 'Items have been created in the past day.'
        # create a ff_link
        check.ff_link = ''.join([connection.ff, 'search/?type=Item&limit=all&q=date_created:>=', date_str])
        # test admin output
        check.admin_output = check.ff_link
    else:
        check.status = 'PASS'
        check.description = 'No items have been created in the past day.'
    return check.store_result()


@check_function()
def files_associated_with_replicates(connection, **kwargs):
    def extract_file_info(res, **kwargs):
        extracted = kwargs
        acc = None
        for field in ['status', 'md5sum', 'accession']:
            extracted[field] = res.get(field)
            if field == 'accession':
                acc = extracted[field]
        return acc, extracted

    check = init_check_res(connection, 'files_associated_with_replicates')
    # this check should probably always have status=IGNORE, but display for now
    fdn_conn = get_FDN_Connection(connection)
    if not (fdn_conn and fdn_conn.check):
        check.status = 'ERROR'
        check.description = ''.join(['Could not establish a FDN_Connection using the FF env: ', connection.ff_env])
        return check.store_result()
    total_replicates = None
    curr_from = 0
    limit = 10
    set_files = {}
    while not total_replicates or curr_from < total_replicates:
        # sort by acession and grab 10 at a time to keep memory usage down
        search_query = ''.join(['/browse/?type=ExperimentSetReplicate&experimentset_type=replicate&from=', str(curr_from), '&limit=', str(limit), '&sort=accession'])
        search_res = ff_utils.get_metadata(search_query, connection=fdn_conn, frame='embedded')
        if not total_replicates:
            total_replicates = search_res.get('total')
        results = search_res.get('@graph', [])
        for res in results:
            set_acc = res.get('accession')
            files = {}
            # do exp_set level files first
            for file_meta in res.get('processed_files', []):
                acc, extracted = extract_file_info(file_meta, exp_set_accession=set_acc)
                files[acc] = extracted
            for exp in res.get('experiments_in_set', []):
                exp_acc = exp.get('accession')
                file_fields = ['files', 'processed_files']
                for file_field in file_fields:
                    for file_meta in exp.get(file_field, []):
                        acc, extracted = extract_file_info(file_meta, exp_set_accession=set_acc, exp_accession=exp_acc)
                        files[acc] = extracted
            set_files[set_acc] = files
        curr_from += limit
    check.full_output = set_files
    if set_files:
        check.status = 'PASS'
        check.description = 'File information was found for experiment set replicates.'
    else:
        check.status = 'WARN'
        check.description = 'No file information was found for experiment set replicates.'
    return check.store_result()


@check_function(delta_hours=24)
def replicate_file_reporting(connection, **kwargs):
    """
    Meta check on files_associated_with_replicates. delta_hours is the diff
    between the results for the aforementioned checks that we compare
    """

    def build_report_string(latest_file, prior_file):
        should_report = False
        file_acc = latest_file.get('accession')
        set_acc = latest_file.get('exp_set_accession')
        exp_acc = latest_file.get('exp_accession')
        latest_md5 = latest_file.get('md5sum')
        prior_md5 = prior_file.get('md5sum')
        latest_stat = latest_file.get('status')
        prior_stat = prior_file.get('md5sum')
        if exp_acc:
            file_str = ''.join(['File ', file_acc, ' of experiment ', exp_acc, ' in experiment set ', set_acc, ' has changed.'])
        else:
            file_str = ''.join(['File ', file_acc, ' of experiment set ', set_acc, ' has changed.'])
        if latest_stat and prior_stat and latest_stat != prior_stat and latest_stat in ['released', 'released to project']:
            file_str = ''.join([file_str, ' The status has changed from ', prior_stat, ' to ', latest_stat, '.'])
            should_report = True
        if latest_md5 and prior_md5 and latest_md5 != prior_md5:
            file_str = ''.join([file_str, ' The md5sum is different.'])
            should_report = True
        return file_str if should_report else None

    delta_hours = kwargs.get('delta_hours')
    check = init_check_res(connection, 'replicate_file_reporting')
    files_check = init_check_res(connection, 'files_associated_with_replicates')
    latest_results = files_check.get_latest_check().get('full_output')
    prior_results = files_check.get_closest_check(delta_hours).get('full_output')
    if not isinstance(latest_results, dict) or not isinstance(prior_results, dict):
        check.status = 'ERROR'
        check.description = 'Could not generate report due to missing output of files checks.'
        return check.store_result()
    report = []
    # new experiment sets
    new_sets = list(set(latest_results.keys()) - set(prior_results.keys()))
    for new in new_sets:
        for new_file_acc in new_sets[new]:
            new_file = new_sets[new][new_file_acc]
            new_acc = new_file.get('accession')
            new_set_acc = new_file.get('exp_set_accession')
            new_exp_acc = new_file.get('exp_accession')
            new_stat = new_file.get('status')
            if new_stat in ['released', 'released to project']:
                if new_exp_acc:
                    file_str = ''.join(['File ', new_acc, ' of experiment ', new_exp_acc, ' in new experiment set ', new_set_acc, ' has been added with status ', new_stat, '.'])
                else:
                    file_str = ''.join(['File ', new_acc, ' of new experiment set ', new_set_acc, ' has been added with status ', new_stat, '.'])
                report.append(file_str)
    for existing in prior_results:
        if existing not in latest_results:
            continue # this shouldn't happen
        for set_file_acc in latest_results[existing]:
            latest_file = latest_results[existing][set_file_acc]
            prior_file = prior_results[existing][set_file_acc]
            file_str = build_report_string(latest_file, prior_file)
            if file_str:
                report.append(file_str)
    check.full_output = report
    if report:
        check.status = 'WARN'
        check.description = ''.join(['Significant file changes to one or more experiment sets have occured in the last ', str(delta_hours), ' hours.'])
    else:
        check.status = 'PASS'
        check.description = ''.join(['No significant file changes to one or more experiment sets have occured in the last ', str(delta_hours), ' hours.'])
    return check.store_result()
