import argparse
import json
import os
from typing import Optional
import yaml
from foursight_core.captured_output import captured_output, uncaptured_output
# This captured_output thing is to suppress the mass of (stdout and stderr) output from
# running Foursight; we'd prefer not to have this come out of this command-line utility.
with captured_output():
    import app
    from dcicutils.command_utils import yes_or_no


def local_check_runner(app_utils):

    args = parse_args()

    if args.list:
        list_checks(app_utils, args.list)
        return

    run_check_and_or_action(app_utils, args)

    # es_checks/elasticsearch_s3_count_diff
    # ecs_checks/update_ecs_application_versions
    # access_key_expiration_detection/access_key_status
    # lifecycle_checks/check_file_lifecycle_status
    # system_checks/elastic_search_space


def parse_args():
    args_parser = argparse.ArgumentParser('local_check_runner')
    args_parser.add_argument("check_or_action", nargs="?", type=str,
                             help="Name of check or action to run.")
    args_parser.add_argument("--env", type=str)
    args_parser.add_argument("--stage", type=str, choices=["dev", "prod"], default="dev", help="Chalice deployment stage (dev or prod)")
    args_parser.add_argument("--timeout", type=int, default=0)
    args_parser.add_argument("--notimeout", action="store_true")
    args_parser.add_argument("--primary", action="store_true")
    args_parser.add_argument("--action", action="store_true")
    args_parser.add_argument("--list", nargs="?", const="all")
    args_parser.add_argument("--verbose", action="store_true")
    args_parser.add_argument("--quiet", action="store_true")
    args_parser.add_argument("--debug", action="store_true")
    args = args_parser.parse_args()
    if args.notimeout:
        args.timeout = 0

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
        app.set_timeout(args.timeout)
        connection = app_utils.init_connection(args.env)

        # Run the check.
        handler = app_utils.check_handler
        check_info = handler.get_check_info(args.check_or_action)
        if not check_info:
            raise Exception(f"Check not found: {args.check_or_action}")
        check_args = {"primary": True} if args.primary else None
        check_args = collect_args(check_info, initial_args=check_args, verbose=args.verbose)
        confirm_interactively(f"Run check {args.check_or_action}?", exit_if_no=True)
        check_result = handler.run_check_or_action(connection, args.check_or_action, check_args)
        PRINT(json.dumps(check_result, indent=4))

        # Run any associated action if desired (i.e. if --action option given).
        if args.action:
            if check_info.associated_action:
                uuid = check_result["kwargs"]["uuid"]
                # If there is an action, you can run it on the check you run above.
                action_info = handler.get_action_info(check_info.associated_action)
                if not action_info:
                    raise Exception(f"Action not found: {check_info.associated_action}")
                action_args = {"check_name": check_info.name, "called_by": uuid}
                action_args = collect_args(check_info, initial_args=action_args, verbose=args.verbose)
                action_result = handler.run_check_or_action(connection, action_info.qualified_name, action_args)
                PRINT(json.dumps(action_result, indent=4))


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

def exit_with_no_action():
    print("Exiting with no action.")
    exit(0)
