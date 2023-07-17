import builtins
from collections import namedtuple
from contextlib import contextmanager
import io
import sys
from typing import Optional

_original_print = builtins.print
_original_stdout = sys.stdout
_original_stderr = sys.stderr

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

    save_print = _original_print
    save_stdout = _original_stdout
    save_stderr = _original_stderr
    captured_output = io.StringIO()

    def captured_print(*args, **kwargs) -> None:
        captured_output.write(*args)
        captured_output.write("\n")

    def uncaptured_print(*args, **kwargs) -> None:
        builtins.print = save_print
        sys.stdout = save_stdout
        sys.stderr = save_stderr
        print(*args, **kwargs)
        if capture:
            builtins.print = captured_print
            sys.stdout = captured_output
            sys.stderr = captured_output

    def uncaptured_input(message: str) -> str:
        builtins.print = save_print
        sys.stdout = save_stdout
        sys.stderr = save_stderr
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
        builtins.print = save_print
        sys.stdout = save_stdout
        sys.stderr = save_stderr


@contextmanager
def uncaptured_output():
    save_print = builtins.print
    save_stdout = sys.stdout
    save_stderr = sys.stderr
    builtins.print = _original_print
    sys.stdout = _original_stdout
    sys.stderr = _original_stderr
    try:
        yield
    finally:
        builtins.print = save_print
        sys.stdout = save_stdout
        sys.stderr = save_stderr