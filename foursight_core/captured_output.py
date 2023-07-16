import builtins
from collections import namedtuple
from contextlib import contextmanager
import io
import sys
from typing import Optional

@contextmanager
def captured_output(capture: bool = True):
    """
    Context manager to capture any/all output to stdout or stderr, and not actually output it to stdout
    or stderr. Yields and object with a get_captured_output() method to get the output captured thus far,
    and another uncaptured_print() method to actually print the given output to stdout, even though output
    to stdout is being captured. Can be useful, for example, in creating command-line scripts which invoke
    code which outputs a lot of info, warning, error, etc to stdout or stderr, and we want to suprress that
    output; but with the yielded uncaptured_print() method output specific to the script can actually be
    output (to stdout); and/or can also optionally output any/all captured output, e.g. for debugging or
    troubleshooting purposes. Disable this capture, without having to restructure your code WRT the usage
    of the with-clause with this context manager, pass False as an argument to this context manager. 
    """

    original_print = builtins.print
    original_stdout = sys.stdout
    original_stderr = sys.stderr
    captured_output = io.StringIO()

    def captured_print(*args, **kwargs) -> None:
        captured_output.write(*args)
        captured_output.write("\n")

    def uncaptured_print(*args, **kwargs) -> None:
        builtins.print = original_print
        sys.stdout = original_stdout
        sys.stderr = original_stderr
        print(*args, **kwargs)
        if capture:
            builtins.print = captured_print
            sys.stdout = captured_output
            sys.stderr = captured_output

    def uncaptured_input(message: str) -> str:
        builtins.print = original_print
        sys.stdout = original_stdout
        sys.stderr = original_stderr
        value = input(message)
        if capture:
            builtins.print = captured_print
            sys.stdout = captured_output
            sys.stderr = captured_output
        return value

    def get_captured_output() -> Optional[str]:
        return captured_output.getvalue() if capture else None

    if capture:
        builtins.print = captured_print
        sys.stdout = captured_output
        sys.stderr = captured_output

    Result = namedtuple("Result", ["get_captured_output", "uncaptured_print", "uncaptured_input"])

    try:
        yield Result(get_captured_output, uncaptured_print, uncaptured_input)
    finally:
        sys.stdout = original_stdout
        sys.stderr = original_stderr
        builtins.print = original_print
