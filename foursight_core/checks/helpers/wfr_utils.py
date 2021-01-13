from datetime import datetime
from dcicutils import ff_utils
lambda_limit = 800


def get_wfr_out(emb_file, wfr_name, workflow_details, key=None, all_wfrs=None, versions=None, md_qc=False, run=None):
    """For a given file, fetches the status of last wfr (of wfr_name type)
    If there is a successful run, it will return the output files as a dictionary of
    argument_name:file_id, else, will return the status. Some runs, like qc and md5,
    does not have any file_format output, so they will simply return 'complete'
    args:
     emb_file: embedded frame file info
     wfr_name: base name without version
     workflow_details: dictionary containing workflow names and specifications
     key: authorization
     all_wfrs : all releated wfrs in embedded frame
     versions: acceptable versions for wfr
     md_qc: if no output file is excepted, set to True
     run: if run is still running beyond this hour limit, assume problem
    """
    # tag as problematic if problematic runs are this many
    # if there are n failed runs, don't proceed
    error_at_failed_runs = 2
    # you should provide key or all_wfrs
    assert key or all_wfrs
    if wfr_name not in workflow_details:
        assert wfr_name in workflow_details
    # get default accepted versions if not provided
    if not versions:
        versions = workflow_details[wfr_name]['accepted_versions']
    # get default run out time
    if not run:
        run = workflow_details[wfr_name]['run_time']

    workflows = emb_file.get('workflow_run_inputs')
    wfr = {}
    run_status = 'did not run'
    if not workflows:
        return {'status': "no workflow on file"}
    my_workflows = [i for i in workflows if i['display_title'].startswith(wfr_name)]
    if not my_workflows:
        return {'status': "no workflow on file"}

    for a_wfr in my_workflows:
        wfr_type, time_info = a_wfr['display_title'].split(' run ')
        wfr_type_base, wfr_version = wfr_type.strip().split(' ')
        # user submitted ones use run on insteand of run
        time_info = time_info.strip('on').strip()
        try:
            wfr_time = datetime.strptime(time_info, '%Y-%m-%d %H:%M:%S.%f')
        except ValueError:
            wfr_time = datetime.strptime(time_info, '%Y-%m-%d %H:%M:%S')
        a_wfr['run_hours'] = (datetime.utcnow() - wfr_time).total_seconds() / 3600
        a_wfr['run_type'] = wfr_type_base.strip()
        a_wfr['run_version'] = wfr_version.strip()
    my_workflows = [i for i in my_workflows if i['run_version'] in versions]
    if not my_workflows:
        return {'status': "no workflow in file with accepted version"}
    my_workflows = sorted(my_workflows, key=lambda k: k['run_hours'])
    same_type_wfrs = [i for i in my_workflows if i['run_type'] == wfr_name]

    if not same_type_wfrs:
        return {'status': "no workflow on file"}
    last_wfr = same_type_wfrs[0]

    # get metadata for the last wfr
    if all_wfrs:
        wfr = [i for i in all_wfrs if i['uuid'] == last_wfr['uuid']][0]
    else:
        wfr = ff_utils.get_metadata(last_wfr['uuid'], key)
    run_duration = last_wfr['run_hours']
    run_status = wfr['run_status']

    if run_status == 'complete':
        outputs = wfr.get('output_files')
        # some runs, like qc, don't have a real file output
        if md_qc:
            return {'status': 'complete'}
        # if expected output files, return a dictionary of argname:file_id
        else:
            out_files = {}
            for output in outputs:
                if output.get('format'):
                    # get the arg name
                    arg_name = output['workflow_argument_name']
                    try:
                        out_files[arg_name] = output['value']['@id']
                    except KeyError:
                        out_files[arg_name] = None
            if out_files:
                out_files['status'] = 'complete'
                return out_files
            else:
                return {'status': "no file found"}
    # if status is error
    elif run_status == 'error':
        # are there too many failed runs
        if len(same_type_wfrs) >= error_at_failed_runs:
            return {'status': "no complete run, too many errors"}

        return {'status': "no complete run, errrored"}
    # if other statuses, started running
    elif run_duration < run:
        return {'status': "running"}
    # this should be the timeout case
    else:
        if len(same_type_wfrs) >= error_at_failed_runs:
            return {'status': "no complete run, too many time-outs"}
        else:
            return {'status': "no completed run, time-out"}


def check_runs_without_output(res, check, run_name, workflow_details, my_auth, start):
    """Common processing for checks that are running on files and not producing output files
    like qcs ones producing extra files"""
    # no successful run
    missing_run = []
    # successful run but no expected metadata change (qc or extra file)
    missing_meta_changes = []
    # still running
    running = []
    # multiple failed runs
    problems = []

    for a_file in res:
        # lambda has a time limit (300sec), kill before it is reached so we get some results
        now = datetime.utcnow()
        if (now-start).seconds > lambda_limit:
            check.brief_output.append('did not complete checking all')
            break
        file_id = a_file['accession']
        report = get_wfr_out(a_file, run_name, workflow_details, key=my_auth, md_qc=True)
        if report['status'] == 'running':
            running.append(file_id)
        elif report['status'].startswith("no complete run, too many"):
            problems.append(file_id)
        elif report['status'] != 'complete':
            missing_run.append(file_id)
        # There is a successful run, but no extra_file
        elif report['status'] == 'complete':
            missing_meta_changes.append(file_id)
    if running:
        check.summary = 'Some files are running'
        check.brief_output.append(str(len(running)) + ' files are still running.')
        check.full_output['running'] = running
    if problems:
        check.summary = 'Some files have problems'
        check.brief_output.append(str(len(problems)) + ' files have multiple failed runs')
        check.full_output['problems'] = problems
        check.status = 'WARN'
    if missing_run:
        check.allow_action = True
        check.summary = 'Some files are missing runs'
        check.brief_output.append(str(len(missing_run)) + ' files lack a successful run')
        check.full_output['files_without_run'] = missing_run
        check.status = 'WARN'
    if missing_meta_changes:
        check.allow_action = True
        check.summary = 'Some files are missing runs'
        check.brief_output.append(str(len(missing_meta_changes)) + ' files have successful run but no qc/extra file')
        check.full_output['files_without_changes'] = missing_meta_changes
        check.status = 'WARN'
    check.summary = check.summary.strip()
    if not check.brief_output:
        check.brief_output = ['All Good!']
    return check
