# Script to publish the Python package in the current git repo to PyPi.
# Does the following checks before allowing a publish:
#
# - The git repo must contain no uncommitted (unstaged) changes.
# - The git repo must contain no staged but uncommitted changes.
# - The git repo must contain no uncommitted but unpushed changes.
# - The git repo package directories must contain no untracked files,
#   or if they do you must confirm that this is okay.

import os
import subprocess
import toml


def main() -> None:

    if not verify_uncommitted_changes():
        exit_with_no_action()

    if not verify_uncommitted_staged_changes():
        exit_with_no_action()

    if not verify_committed_unpushed_changes():
        exit_with_no_action()

    if not verify_tagged():
        exit_with_no_action()

    if not verify_untracked_files():
        exit_with_no_action()

    publish_package()


def publish_package(pypi_username: str = None, pypi_password: str = None):
    if not pypi_username:
        pypi_username = os.environ.get("PYPI_USER")
    if not pypi_password:
        pypi_password = os.environ.get("PYPI_PASSWORD")
    poetry_publish_command = [
        "poetry", "publish",
        "--no-interaction",
        "--build",
        f"--username={pypi_username}", f"--password={pypi_password}"
    ]
    verbose = True
    if verbose:
        print(" ".join(poetry_publish_command))
    #os.execv("poetry", poetry_publish_command)
    poetry_publish_results = execute_command(poetry_publish_command)
    lines = subprocess.run(poetry_publish_command, stdout=subprocess.PIPE, text=True)
    print(lines.stdout)
    #print(poetry_publish_results)
    #return poetry_publish_results


def verify_untracked_files() -> bool:
    """
    If the current git repo has no untracked files then returns True,
    otherwise prints a warning, and with the list of untraced files,
    and prompts the user for a yes/no confirmation on whether or to
    continue, and returns True for a yes response, otherwise returns False.
    """
    untracked_files = get_untracked_files()
    if untracked_files:
        print(f"WARNING: You are about to PUBLISH the following {len(untracked_files)}"
              f" UNTRACKED file{'' if len(untracked_files) == 1 else 's' } -> SECURITY risk:")
        for untracked_file in untracked_files:
            print(f"-- {untracked_file}")
        print("DO NOT continue UNLESS you KNOW what you are doing!")
        if answered_yes_to_confirmation("Do you really want to continue?"):
            return True
        else:
            return False


def verify_uncommitted_changes() ->  bool:
    """
    If the current git repo has no uncommitted changes then returns True,
    otherwise prints a warning and returns False.
    """
    git_diff_results = execute_command(["git", "diff"])
    if git_diff_results:
        print("You have made changes to this branch that you have not committed.")
        return False
    return True


def verify_uncommitted_staged_changes() ->  bool:
    """
    If the current git repo has no staged but uncommitted changes then returns True,
    otherwise prints a warning and returns False.
    """
    git_diff_staged_results = execute_command(["git", "diff", "--staged"])
    if git_diff_staged_results:
        print("You have staged changes to this branch that you have not committed.")
        return False
    return True


def verify_committed_unpushed_changes() -> bool:
    """
    If the current git repo committed but unpushed changes then returns True,
    otherwise prints a warning and returns False.
    """
    git_uno_results = execute_command(["git", "status", "-uno"], lines_containing="is ahead of")
    if git_uno_results:
        print("You have committed but unpushed changes.")
        return False
    return True


def verify_tagged() -> bool:
    """
    If the current git repo has a tag as its most recent commit then returns True,
    otherwise prints a warning and returns False.
    """
    git_most_recent_commit = execute_command(["git", "log", "-1", "--decorate"], lines_containing="tag:")
    if not git_most_recent_commit:
        print("You can only publish a tagged commit.")
        return False
    return True


def get_untracked_files() -> list:
    """
    Returns a list of untracked files for the current git repo; empty list of no untracked changes.
    """
    package_directories = get_package_directories()
    untracked_files = []
    for package_directory in package_directories:
        git_status_results = execute_command(["git", "status", "-s", package_directory])
        for git_status_result in git_status_results:
            if git_status_result and git_status_result.startswith("??"):
                untracked_file = git_status_result[2:].strip()
                if untracked_file:
                    untracked_files.append(untracked_file)
    return untracked_files


def get_package_directories() -> list:
    """
    Returns a list of directories constituting the Python package of the current repo,
    according to the pyproject.toml file.
    """
    package_directories = []
    with open("pyproject.toml", "r") as f:
        pyproject_toml = toml.load(f)
    pyproject_package_directories = pyproject_toml["tool"]["poetry"]["packages"]
    for pyproject_package_directory in pyproject_package_directories:
        package_directory = pyproject_package_directory.get("include")
        if package_directory:
            package_directory_from = pyproject_package_directory.get("from")
            if package_directory_from:
                package_directory = os.path.join(package_directory_from, package_directory)
            package_directories.append(package_directory)
    return package_directories


def execute_command(command_argv: list, lines_containing: str = None) -> list:
    """
    Executes the given command as a command-line subprocess, and returns the
    result as a list of lines from the output of the command.
    """
    lines = subprocess.run(command_argv, stdout=subprocess.PIPE).stdout.decode("utf-8").split("\n")
    if lines_containing:
        lines = [line for line in lines if lines_containing in line]
    return [line.strip() for line in lines if line]


def answered_yes_to_confirmation(message: str) -> bool:
    """
    Prompts the user with the given message and asks for a yes or no answer,
    and if yes is the user response then returns True, otherwise returns False.
    """
    response = input(f"{message} [yes | no]: ").lower()
    if response == "yes":
        return True
    return False


def exit_with_no_action() -> None:
    """
    Exits this process immediately, but first printing a message saying no action was taken. 
    """
    print("Exiting without taking action.")
    exit(1)


if __name__ == "__main__":
    main()
