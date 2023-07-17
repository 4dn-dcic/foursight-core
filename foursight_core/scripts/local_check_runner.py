import argparse
import json
from typing import Optional
import yaml
from foursight_core.captured_output import captured_output, uncaptured_output


def main():
    args_parser = argparse.ArgumentParser('local_check_runner')
    args_parser.add_argument("check_or_action", nargs="?", type=str)
    args_parser.add_argument("--env", type=str, default="cgap-supertest")
    args_parser.add_argument("--stage", type=str, choices=["dev", "prod"],
                             default="dev",
                             help="Chalice deployment stage (dev or prod)")
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
    if not args.list and not args.check_or_action:
        print("A check or action name is required unless the --list option is given.")
        exit(1)

    # es_checks/elasticsearch_s3_count_diff
    # ecs_checks/update_ecs_application_versions
    # access_key_expiration_detection/access_key_status
    # lifecycle_checks/check_file_lifecycle_status
    # system_checks/elastic_search_space

    run(args)


def run(args):

    # This captured_output thing is just to suppress the mass of (stdout
    # and stderr) output from running Foursight; we'd prefer not to have
    # this come out of this command-line utility.
    with captured_output() as captured:

        PRINT = captured.uncaptured_print

        import app
        from chalicelib_cgap.app_utils import app_utils_obj as app_utils

        handler = app_utils.check_handler

        if args.list:
            checks = handler.get_checks_info(args.list if args.list != "all" else None)
            for check in checks:
                PRINT(check.qualified_name)
            return

        # Setup.
        app.set_stage(args.stage)
        app.set_timeout(args.timeout)
        connection = app_utils.init_connection(args.env)

        # Run the check.
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
            print(f"{kind.title()} arguments for {name}:")
            for arg in args:
                print(f"=> {arg}: {args[arg]}")
    return args


def confirm_interactively(message: str, exit_if_no: bool = False) -> bool:
    with uncaptured_output():
        while True:
            yes_or_no = input(f"{message} [yes/no] ").lower()
            if yes_or_no == "yes":
                return True
            elif yes_or_no == "no":
                if exit_if_no:
                    print("Exiting with no action.")
                    exit(0)
                return False


if __name__ == "__main__":
    main()
