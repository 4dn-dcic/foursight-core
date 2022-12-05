from dcicutils.codebuild_utils import CodeBuildUtils
from .helpers.confchecks import *


@check_function()
def codebuild_status(connection, **kwargs):
    """ Returns list of available CodeBuild projects """
    check = CheckResult(connection, 'codebuild_status')
    client = CodeBuildUtils()
    projects = client.list_projects()
    check.status = 'PASS'
    check.summary = 'See full output for info on valid build names'
    check.full_output = projects
    return check


@check_function(build_name=None)
def trigger_codebuild_run(connection, **kwargs):
    """ This checks triggers a run of the CodeBuild pipeline
        Usually, there is only 1 CodeBuild pipeline per account - this function
        will work out of the box where there is only 1, and will require kwarg
        if there are multiple.
    """
    check = CheckResult(connection, 'trigger_codebuild_run')
    client = CodeBuildUtils()
    projects = client.list_projects()
    build_name = kwargs.get('build_name', None)
    if len(projects) == 1:
        resp = client.run_project_build(project_name=projects[0])
        check.full_output = resp
        check.status = 'PASS'
        check.summary = f'Triggered build {projects[0]}'
    elif build_name:
        resp = client.run_project_build(project_name=build_name)
        check.full_output = resp
        check.status = 'PASS'
        check.summary = f'Triggered build {build_name}'
    else:
        check.status = 'FAIL'
        check.summary = f'Cannot resolve which build you want: {projects}'
    return check


@check_function(build_name=None, branch=None, image_tag=None, build_path=None)
def trigger_codebuild_run_with_overrides(connection, **kwargs):
    """ Very similar to the above function but takes some additional arguments it can work with to change
        the branch, image tag and build path if needed.

        You MUST pass a branch to this at a minimum, but other arguments are not necessary
    """
    check = CheckResult(connection, 'trigger_codebuild_run')
    client = CodeBuildUtils()
    projects = client.list_projects()
    project = kwargs.get('build_name', None)
    branch = kwargs.get('branch', None)
    image_tag = kwargs.get('image_tag', None)
    build_path = kwargs.get('build_path', None)
    env_overrides = {}
    if image_tag:
        env_overrides['IMAGE_TAG'] = image_tag
    if build_path:
        env_overrides['BUILD_PATH'] = build_path
    if len(projects) == 1 and not project:
        project = projects[0]
    else:
        check.status = 'FAIL'
        check.summary = f'Cannot resolve which build you want: {projects}'
        return check
    resp = client.run_project_build_with_overrides(project_name=project, branch=branch, env_overrides=env_overrides)
    check.full_output = resp
    check.status = 'PASS'
    check.summary = f'Triggered build {project} from branch {branch} with overrides {env_overrides}'
    return check
