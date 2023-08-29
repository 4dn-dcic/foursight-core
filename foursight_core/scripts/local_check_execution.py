# A local-check-runner command-line utility to run checks from local development machine.
# The real entry points are poetry scripts in foursight-cgap and foursight, so the
# app_utils from those local repos can be passed in properly.
# See: https://hms-dbmi.atlassian.net/wiki/spaces/FOURDNDCIC/pages/3004891144/Running+Foursight+Locally

import argparse
import json
import os
import sys
from typing import Optional, Tuple
import yaml
from foursight_core.captured_output import captured_output, uncaptured_output
# This captured_output thing is to suppress the mass of (stdout and stderr) output from
# running Foursight; we'd prefer not to have this come out of this command-line utility.
with captured_output():
    import app
    from dcicutils.command_utils import yes_or_no


def local_check_execution(app_utils):

    args = parse_args()

    if args.list:
        list_checks(app_utils, args.list)
    else:
        run_check_and_or_action(app_utils, args)


def parse_args():
    args_parser = argparse.ArgumentParser('local_check_execution')
    args_parser.add_argument("check_or_action", nargs="?", type=str,
                             help="Name of check or action to run.")
    args_parser.add_argument("--env", type=str,
                             help="AWS environment name.")
    args_parser.add_argument("--stage", type=str, choices=["dev", "prod"], default="dev",
                             help="Chalice deployment stage (dev or prod)")
    args_parser.add_argument("--primary", action="store_true",
                             help="True if result should be stored (TODO).")
    args_parser.add_argument("--action", action="store_true",
                             help="Any associated action should also be run.")
    args_parser.add_argument("--list", nargs="?", const="all",
                             help="List checks, containing given value if any.")
    args_parser.add_argument("--yaml", action="store_true",
                             help="Output result in YAML rather than JSON.")
    args_parser.add_argument("--verbose", action="store_true",
                             help="Verbose output.")
    args_parser.add_argument("--debug", action="store_true",
                             help="Debugging output.")
    args = args_parser.parse_args()

    if args.list:
        if args.check_or_action:
            print("A check or action name is not allowed if the --list option is given.")
            exit(1)

    elif not args.check_or_action:
        print("A check or action name is required unless the --list option is given.")
        exit(1)

    if not args.env:
        print("An AWS environment name is required; use the --env option.")
        env = guess_env()
        if env:
            confirm_interactively(f"Do you want to use this AWS environment name: {env}?", exit_if_no=True)
            args.env = env
        else:
            exit_with_no_action()

    return args


def list_checks(app_utils, text: str) -> None:
    with captured_output() as captured:
        checks = app_utils.check_handler.get_checks_info(text if text != "all" else None)
        for check in checks:
            captured.uncaptured_print(check.qualified_name)


def run_check_and_or_action(app_utils, args) -> None:

    with captured_output() as captured:

        PRINT = captured.uncaptured_print

        # Setup.
        app.set_stage(args.stage)
        app.set_timeout(0)
        connection = app_utils.init_connection(args.env)
        handler = app_utils.check_handler


        check_info, action_info = find_check_or_action(app_utils, args.check_or_action)
        if check_info:
            check_args = {"primary": True} if args.primary else None
            check_args = collect_args(check_info, initial_args=check_args, verbose=args.verbose)
            confirm_interactively(f"Run check {check_info.qualified_name}?", exit_if_no=True)
            check_result = handler.run_check_or_action(connection, check_info.qualified_name, check_args)
            output_result(check_result, args.yaml)

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
            output_result(action_result, args.yaml)


def collect_args(check_or_action_info, initial_args: Optional[dict] = None, verbose: bool = False) -> dict:
    args = initial_args or {}
    kind = check_or_action_info.kind
    name = check_or_action_info.qualified_name
    with uncaptured_output():
        if check_or_action_info.kwargs:
            print(f"Prompting for {kind} arguments for {name}:")
            for arg_name in check_or_action_info.kwargs:
                arg_default = check_or_action_info.kwargs[arg_name]
                value = input(f"Enter {kind} argument => "
                              f"{arg_name} [default: {arg_default}]: ")
                args[arg_name] = value
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


def guess_env() -> Optional[str]:
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


def confirm_interactively(message: str, exit_if_no: bool = False) -> bool:
    with uncaptured_output():
        if yes_or_no(message):
            return True
        if exit_if_no:
            exit_with_no_action()
        return False


def output_result(result: dict, format_yaml: bool = False) -> None:
    with uncaptured_output():
        if format_yaml:
            yaml.dump(result, sys.stdout)
        else:
            print(json.dumps(result, indent=4))


def exit_with_no_action(message: Optional[str] = None):
    with uncaptured_output():
        if message:
            print(message)
        print("Exiting with no action.")
    exit(0)
