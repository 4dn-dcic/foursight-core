print("This may take a minute ...")
# A local-check-runner command-line utility to run checks from local development machine.
# The real entry points are poetry scripts in foursight-cgap and foursight, so the
# app_utils from those local repos can be passed in properly.
# See: https://hms-dbmi.atlassian.net/wiki/spaces/FOURDNDCIC/pages/3004891144/Running+Foursight+Locally

# import cron_descriptor
# (Pdb) cron_descriptor.get_description(' '.join(["0/10", "*", "*", "*", "?", "*"]))

import argparse
import boto3
import io
import json
import os
import sys
from typing import Callable, List, Optional, Tuple
import yaml
from foursight_core.captured_output import captured_output, uncaptured_output
with captured_output():
    import requests
    from dcicutils.command_utils import yes_or_no

app = None


def local_check_execution(app_utils):

    args = process_args()
    app_utils_environments = None

    if not args.list:
        if args.env and isinstance(app_utils_environments := app_utils.init_environments(args.env), dict):
            es_url = app_utils_environments.get(args.env, {}).get("es")
        else:
            es_url = None
        sanity_check_elasticsearch_accessibility(app_utils.host, es_url)

    if not os.environ.get("IDENTITY"):
        exit_with_no_action(
            "Your IDENTITY environment variable must be set to an AWS Secrets Manager name; or use --identity.")

    with captured_output():
        global app
        import app as app

    if args.list:
        list_checks(app_utils, args.list,
                    with_action=args.action,
                    verbose=args.verbose)
    else:
        run_check_and_or_action(app_utils, app_utils_environments, args)


def process_args():

    args = parse_args()

    if args.stage:
        os.environ["chalice_stage"] = args.stage

    if args.list:
        if args.check_or_action:
            print("A check or action name is not allowed if the --list option is given.")
            exit(1)

    elif not args.check_or_action:
        print("A check or action name is required unless the --list option is given.")
        exit(1)

    if not args.list:
        if not args.env:
            env = guess_env()
            if env:
                os.environ["ENV_NAME"] = env
                print(f"An AWS environment name is required via the --env option; guessing it is: {env}")
                confirm_interactively(f"Do you want to use this AWS environment name: {env}?", exit_if_no=True)
                args.env = env
            else:
                print("An AWS environment name is required; use the --env option.")
                exit_with_no_action()
        else:
            # os.environ["ENV_NAME"] = args.env
            if args.verbose:
                print(f"Using AWS environment name: {args.env}")

    return args


def parse_args():
    args_parser = argparse.ArgumentParser('local_check_execution')
    args_parser.add_argument("check_or_action", nargs="?", type=str,
                             help="Name of check or action to run.")
    args_parser.add_argument("--env", type=str,
                             help="AWS environment name.")
    args_parser.add_argument("--stage", type=str, choices=["dev", "prod"], default="dev",
                             help="Chalice deployment stage (dev or prod)")
    args_parser.add_argument("--primary", action="store_true",
                             help="True if primary result should be stored (TODO).")
    args_parser.add_argument("--action", action="store_true",
                             help="Any associated action should also be run; will prompt first.")
    args_parser.add_argument("--identity", type=str,  # This is handled above.
                             help="Value to use for the IDENTITY environment variable for this run.")
    args_parser.add_argument("--check-setup", type=str,  # This is handled above.
                             help="The check_setup.json to look at for guidance/verification.")  # TODO
    args_parser.add_argument("--list", nargs="?", const="all",
                             help="List checks, containing given value if any.")
    args_parser.add_argument("--es",
                             help="Set to your ElasticSearch host.")
    args_parser.add_argument("--yaml", action="store_true",
                             help="Output result in YAML rather than JSON.")
    args_parser.add_argument("--verbose", action="store_true",
                             help="Verbose output.")
    args_parser.add_argument("--debug", action="store_true",
                             help="Debugging output.")
    args = args_parser.parse_args()
    if args.check_or_action == "list":
        args.check_or_action = None
        args.list = "all"
    if args.check_setup:
        try:
            with io.open(args.check_setup, "r") as f:
                args.check_setup_data = json.load(f)
        except Exception:
            exit_with_no_action(f"Cannot open specified check_setup.json file: {args.check_setup}")
        if args.verbose:
            print(f"Using check_setup.json file: {args.check_setup}")
    else:
        args.check_setup_data = None
    return args


def list_checks(app_utils, text: str, with_action: bool = False, verbose: bool = False) -> None:
    if verbose:
        print("Foursight checks/actions listed below:")
    with captured_output() as captured:
        checks = app_utils.check_handler.get_checks_info(text if text != "all" else None)
        for check in checks:
            if with_action and not check.associated_action:
                continue
            captured.uncaptured_print(f"- {check.qualified_name}")
            if verbose:
                if check.kwargs:
                    for arg_name in check.kwargs:
                        arg_value_default = check.kwargs.get(arg_name)
                        if arg_value_default:
                            captured.uncaptured_print(f"  - argument: {arg_name} [default: {arg_value_default}]")
                        else:
                            captured.uncaptured_print(f"  - argument: {arg_name}")
                if check.associated_action:
                    captured.uncaptured_print(f"  - action: {check.associated_action}")


def run_check_and_or_action(app_utils, app_utils_environments, args) -> None:

    with captured_output() as captured:

        # Setup.
        app.set_stage(args.stage)
        app.set_timeout(0)

        connection = app_utils.init_connection(args.env, _environments=app_utils_environments)
        handler = app_utils.check_handler
        if (connection_s3 := connection.connections.get("s3")) and (results_bucket := connection_s3.bucket):
            captured.uncaptured_print(f"Check/action results S3 bucket: {results_bucket}")


        check_info, action_info = find_check_or_action(app_utils, args.check_or_action)

        if check_info:

            if args.check_setup_data:
                has_queue_action, has_no_queue_action = (
                    check_setup_has_queue_action(args.check_setup_data, check_info.name))
            else:
                has_queue_action = has_no_queue_action = None

            check_args = {"primary": True} if args.primary else None
            check_args = collect_args(check_info, initial_args=check_args, verbose=args.verbose)
            confirm_interactively(f"Run check {check_info.qualified_name}?", exit_if_no=True)
            if args.verbose:
                captured.uncaptured_print(f"Running check: {check_info.qualified_name} ...")
            check_result = handler.run_check_or_action(connection, check_info.qualified_name, check_args)
            if args.verbose:
                captured.uncaptured_print(f"Check run complete (result below): {check_info.qualified_name}")
            print_result(check_result, args.yaml)
            allow_action = check_result.get("allow_action") is True
            prevent_action = check_result.get("prevent_action") is True
            if args.verbose and check_info.associated_action:
                message = ""
                if has_queue_action is True:
                    message = "This check action will NOT be run automatically by Foursight because the queue_action property is not set in the check_setup.json ({args.check_setup})."
                elif has_queue_action is False:
                    message = "This check action may be run automatically by Foursight because the queue_action property IS set in the check_setup.json ({args.check_setup})."
                if allow_action:
                    if prevent_action:
                        print_boxed([
                            "---",
                            f"This check result indicates the associated action as allowed to run but will NOT run AUTOMATICALLY",
                            "---"], print=captured.uncaptured_print)
                    else:
                        captured.uncaptured_print(f"This check result indicated TODO")
                elif prevent_action:
                    captured.uncaptured_print(f"This check result indicated TODO")
                else:
                    print_boxed([
                        "---",
                        f"This check result indicates the associated action should not run.",
                        "---",
                        ],
                        print=captured.uncaptured_print)

        # Run any associated action if desired (i.e. if --action option given).
        if (args.action and check_info.associated_action) or action_info:
            uuid = check_result["kwargs"]["uuid"] if check_info else None
            if not action_info:
                action_info = handler.get_action_info(check_info.associated_action)
                if not action_info:
                    exit_with_no_action(f"Action not found: {check_info.associated_action}")
            action_args = {"check_name": check_info.name, "called_by": uuid} if check_info else {}
            action_args = collect_args(action_info, initial_args=action_args, verbose=args.verbose)
            confirm_interactively(f"Run action {action_info.qualified_name}?", exit_if_no=True)
            action_result = handler.run_check_or_action(connection, action_info.qualified_name, action_args)
            print_result(action_result, args.yaml)


def collect_args(check_or_action_info, initial_args: Optional[dict] = None, verbose: bool = False) -> dict:
    args = initial_args or {}
    kind = check_or_action_info.kind
    name = check_or_action_info.qualified_name
    with uncaptured_output():
        if check_or_action_info.kwargs:
            print(f"Prompting for {kind} arguments for {name}:")
            for arg_name in check_or_action_info.kwargs:
                arg_value_default = check_or_action_info.kwargs[arg_name]
                arg_value = input(f"Enter {kind} argument => {arg_name} [default: {arg_value_default}]: ")
                args[arg_name] = arg_value if arg_value != "" else arg_value_default
        if verbose:
            if args:
                print(f"{kind.title()} arguments for {name}:")
                for arg in args:
                    print(f"=> {arg}: {args[arg]}")
    return args


def find_check_or_action(app_utils, check_or_action) -> Tuple[Optional[object], Optional[object]]:
    """
    Given a check or action name return the "info" object for one or the other depending
    on whether a check or action name was specified. These names are meant to be fully
    qualfied, e.g. "access_key_expiration_detection/access_key_status". First tries
    to match check and then action exactly, and then if not found then tries an
    approximate match (if given name is part of the full check/action name),
    first trying the check name and then the action name.
    """
    check_info = app_utils.check_handler.get_check_info(check_or_action)
    action_info = None
    if not check_info:
        # Maybe they specified an action instead.
        action_info = app_utils.check_handler.get_action_info(check_or_action)
        if not action_info:
            checks_info = app_utils.check_handler.get_checks_info(check_or_action)
            if checks_info and len(checks_info) == 1:
                message = f"Did you mean to specify this check: {checks_info[0].qualified_name}?"
                if confirm_interactively(message):
                    check_info = checks_info[0]
            if not check_info:
                actions_info = app_utils.check_handler.get_actions_info(check_or_action)
                if actions_info and len(actions_info) == 1:
                    message = f"Did you mean to specify this action: {actions_info[0].qualified_name}?"
                    if confirm_interactively(message):
                        action_info = actions_info[0]
        if not check_info and not action_info:
            exit_with_no_action(f"No check or action found: {check_or_action}")
    return check_info, action_info


def get_check_setup_info(check_setup: dict, check_name: str) -> Optional[dict]:
    if isinstance(check_setup, dict) and isinstance(check_name, str):
        return check_setup.get(check_name)


def check_setup_has_queue_action(check_setup: dict, check_name: str) -> Tuple[bool, bool]:
    has_queue_action = False
    has_no_queue_action = False
    if check_setup_info := get_check_setup_info(check_setup, check_name):
        if isinstance(check_setup_info, dict):
            if isinstance(schedule := check_setup_info.get("schedule"), dict) and schedule:
                for schedule_name in schedule:
                    for schedule_env_name in schedule[schedule_name]:
                        if schedule_kwargs := schedule[schedule_name][schedule_env_name].get("kwargs"):
                            if schedule_kwargs.get("queue_action"):
                                has_queue_action = True
                            else:
                                has_no_queue_action = True
                        else:
                            has_no_queue_action = True
    return has_queue_action, has_no_queue_action


def guess_env() -> Optional[str]:
    if aws_credentials_name := os.environ.get("AWS_PROFILE"):
        return aws_credentials_name
    aws_test_dir_name = ".aws_test"
    aws_test_dir_prefix = f"{aws_test_dir_name}."
    aws_test_dir = os.path.expanduser(f"~/{aws_test_dir_name}")
    if os.path.islink(aws_test_dir):
        aws_test_target_dir = os.readlink(aws_test_dir)
        if os.path.exists(aws_test_target_dir):
            aws_test_target_dir = os.path.basename(aws_test_target_dir)
            if aws_test_target_dir.startswith(aws_test_dir_prefix):
                aws_credentials_name = aws_test_target_dir[len(aws_test_dir_prefix):]
                return aws_credentials_name


def sanity_check_aws_accessibility(verbose: bool = False) -> None:
    aws_account_number = None
    aws_account_alias = None
    error = False
    try:
        if caller_identity := boto3.client("sts").get_caller_identity():
            aws_account_number = caller_identity.get("Account")
        if aws_account_aliases := boto3.client("iam").list_account_aliases():
            if aws_account_aliases := aws_account_aliases.get("AccountAliases"):
                aws_account_alias = aws_account_aliases[0]
    except Exception:
        error = True
    if verbose:
        access_key_id = None
        try:
            boto_session = boto3.Session()
            credentials = boto_session.get_credentials()
            access_key_id = credentials.access_key
        except Exception:
            pass
        if not error:
            print(f"Using AWS access key ID: {access_key_id} -> OK")
        if aws_account_alias:
            print(f"Using AWS account name (alias): {aws_account_alias}")
        if aws_account_number:
            print(f"Using AWS account (number): {aws_account_number}")
    if error:
        exit_with_no_action(f"Cannot access AWS. Your AWS credentials do not appear to be setup property")


def sanity_check_elasticsearch_accessibility(host: str, es_url: Optional[str] = None, timeout: int = 3) -> None:
    if host:
        es_host_local = (host == os.environ.get("ES_HOST_LOCAL"))
        es_tunnel = (host.lower().startswith("http://localhost:") or host.lower().startswith("http://127.0.0.1:"))
        # TODO: Figure out why at this point host could be wrong (if no SSH tunnel via ES_HOST_LOCAL);
        # but the passed in es_url (from app_utils.init_environments) is right. This came up (2024-04-25)
        # in foursight-fourfront when if running with --env data the host is:
        # https://vpc-os-fourfront-mastertest-yj7mmysd67f5qav3cuzxb2jzwu.us-east-1.es.amazonaws.com:443
        # but should be (and es_url is):
        # https://vpc-os-fourfront-prod-green-jelxdmbspbii4uafopglgdvvsa.us-east-1.es.amazonaws.com:443
        # It gets straightened out later but this accounts for the odd code below on what to display.
        if not check_quickly_if_url_accessable(host, timeout=1):
            print_boxed([
                "---",
                f"WARNING: {host if es_tunnel or not es_url else es_url}"
                f"{' (from ES_HOST_LOCAL environment variable)' if es_host_local else ''}",
                "---",
                f"The above {'AWS ' if 'aws' in host.lower() else ''}ElasticSearch"
                f" host appears to be inaccessible.",
                "You may need to be running a local SSH tunnel to access this." if not es_tunnel else None,
                "You appear to already be referring to an SSH tunnel. Make sure it is running." if es_tunnel else None,
                "And make sure your ES_HOST_LOCAL environment variable is set to it." if not es_host_local else None,
                "And it should be referring to this ElasticSearch instance:" if es_host_local else None,
                f"{es_url or host}" if es_host_local else None,
                "---",
                "https://hms-dbmi.atlassian.net/wiki/spaces/FOURDNDCIC/pages/3004891144/Running+Foursight+Locally",
                "---"])
            if not yes_or_no("Continue anyways?"):
                exit_with_no_action()
        else:
            if es_tunnel and es_url:
                print(f"Using ElasticSearch host via SSH tunnel: {host}"
                      f"{' (from ES_HOST_LOCAL environment variable)' if es_host_local else ''}")
                # Now sanity check that the actual ES referred to by the SSH tunnel is the right one.
                try:
                    if es_cluster_name := requests.get(host).json().get("cluster_name"):
                        if len(es_cluster_name_parts := es_cluster_name.split(":")) == 2:
                            if es_cluster_name_parts[1] not in es_url:
                                print_boxed([
                                    "---",
                                    f"WARNING: {host}",
                                    "---",
                                    "Your SSH tunnel (above) may not be referring to the correct ElasticSearch.",
                                    "It should be referring to this ElasticSearch instance:",
                                    f"{es_url}",
                                    f"The cluster name of the one you are referring to is: {es_cluster_name}",
                                    "---"
                                ])
                                if not yes_or_no("Continue anyways?"):
                                    exit_with_no_action()
                        print(f"SSH tunnel refers to ElasticSearch cluster: {es_cluster_name}")
                        print(f"Actual ElasticSearch server likely: {es_url}")
                except Exception:
                    print("ERROR: Cannot access ElasticSearch: {host}")
            else:
                print(f"Using ElasticSearch host: {host}"
                      f"{' (from ES_HOST_LOCAL environment variable)' if es_host_local else ''}")


def check_quickly_if_url_accessable(url: str, timeout: int = 3) -> bool:
    if not url.lower().startswith("https://") and not url.lower().startswith("http://"):
        try:
            requests.get(f"https://{url}", timeout=timeout)
            return True
        except Exception:
            try:
                requests.get(f"http://{url}", timeout=timeout)
                return True
            except Exception:
                return False
    else:
        try:
            requests.get(url, timeout=timeout)
            return True
        except Exception:
            return False


def print_result(result: dict, format_yaml: bool = False) -> None:
    with uncaptured_output():
        if format_yaml:
            yaml.dump(result, sys.stdout)
        else:
            print(json.dumps(result, indent=4))


def print_boxed(lines: List[str],
                right_justified_macro: Optional[Tuple[str, Callable]] = None,
                print: Callable = print) -> None:
    length = max(len(line) for line in lines if line is not None)
    for line in lines:
        if line is None:
            continue
        if line == "---":
            print(f"+{'-' * (length - len(line) + 5)}+")
        elif right_justified_macro and (len(right_justified_macro) == 2) and line.endswith(right_justified_macro[0]):
            line = line.replace(right_justified_macro[0], len(right_justified_macro[0]) * " ")
            version = right_justified_macro[1]()
            print(f"| {line}{' ' * (length - len(line) - len(version) - 1)} {version} |")
        else:
            print(f"| {line}{' ' * (length - len(line))} |")


def confirm_interactively(message: str, exit_if_no: bool = False) -> bool:
    with uncaptured_output():
        if yes_or_no(message):
            return True
        if exit_if_no:
            exit_with_no_action()
        return False


def exit_with_no_action(message: Optional[str] = None):
    with uncaptured_output():
        if message:
            print(message)
        print("Exiting with no action.")
    exit(0)


# The below must execute before exiting (the import of) this module which
# is imported from chalicelib_{smaht,cgap,fourfront}.local_check_execution,
# where we import foursight_core.app_utils which depends on this stuff being setup.

if "--help" in sys.argv:
    parse_args().print_help()
    exit(0)
if ("--identity" in sys.argv) and (_index := sys.argv.index("--identity")) and ((_index := _index + 1) < len(sys.argv)):
    os.environ["IDENTITY"] = sys.argv[_index]
if ("--es" in sys.argv) and (_index := sys.argv.index("--es")) and ((_index := _index + 1) < len(sys.argv)):
    os.environ["ES_HOST_LOCAL"] = sys.argv[_index]

os.environ["CHALICE_LOCAL"] = "true"

# This captured_output thing is to suppress the mass of (stdout and stderr) output from
# running Foursight; we'd prefer not to have this come out of this command-line utility.
sanity_check_aws_accessibility(verbose="--verbose" in sys.argv)
with captured_output():
    if not os.environ.get("IDENTITY"):
        exit_with_no_action(
            "Your IDENTITY environment variable must be set to an AWS Secrets Manager name; or use --identity.")
