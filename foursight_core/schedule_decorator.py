from chalice import Cron
import os
from typing import Tuple
from dcicutils.misc_utils import PRINT
from .app import app  # Chalice object

SCHEDULE_FOR_NEVER = Cron("0", "0", "31", "2", "?", "*")
DEFAULT_STAGE = os.environ.get("chalice_stage", "dev")


def schedule(*args, **kwargs):
    """
    Decorator to wrap the Chalice schedule decorator to do any customization.
    The FIRST argument should either be a Chalice Cron object; OR a dictionary
    indexed by the name of the function name being scheduled where each value is
    the Chalice Cron object; OR a dictionary indexed by stage name AND within that
    dictionary, by the name of the function being scheduled where each value is the
    Chalice Cron object; i.e. a dictionary that looks something like EITHER of these:

      schedules = {
        "ten_min_checks":     Cron("0/10", "*", "*", "*", "?", "*"),
        "fifteen_min_checks": Cron("0/15", "*", "*", "*", "?", "*"),
      }

      schedules = {
        "prod": {
          "ten_min_checks":     Cron("0/10", "*", "*", "*", "?", "*"),
          "fifteen_min_checks": Cron("0/15", "*", "*", "*", "?", "*"),
        "dev": {
          "ten_min_checks":     Cron("5/10", "*", "*", "*", "?", "*"),
          "fifteen_min_checks": Cron("0/15", "*", "*", "*", "?", "*"),
          }
      }

    The function key names above for the Cron objects are ASSUMED
    be the EXACT names of the function being scheduled. For example:

      @schedule(schedules, stage=STAGE, disabled_stages=["dev"])
      def ten_min_checks():
         do_the_scheduled_function_work()

    If this scheme is not used, i.e. if passing just a Cron object as the FIRST decorator
    argument, rather than a dictionary as above, then the function name does not matter.

    The stage name is either from a given 'stage' decorator argument, or if not
    specified there, then from the 'chalice_stage' environment variable (defaulting to 'dev').

    If a 'disabled_stage' (string) or 'disabled_stages' (list) argument is given then
    the specified stage/s is/are assumed to be disabled and a special cron schedule
    for NEVER will be used if the stage matches specified disabled stage/s.

    N.B. This decorator ASSUMES this presence of a Chalice 'app' object;
    in this case it is coming from foursight_core.app.
    """
    if not isinstance(args, Tuple) or len(args) == 0:
        raise Exception("No arguments found for schedule configuration!")

    cron = args[0]
    if not isinstance(cron, Cron) and not isinstance(cron, dict):
        raise Exception("First schedule argument must be a Chalice Cron object!")

    stage = DEFAULT_STAGE
    if "stage" in kwargs:
        stage = kwargs["stage"]
        del kwargs["stage"]

    if "disabled_stages" in kwargs:
        disabled_stages = kwargs["disabled_stages"]
        if isinstance(disabled_stages, list):
            if stage in disabled_stages:
                cron = SCHEDULE_FOR_NEVER
        del kwargs["disabled_stages"]

    if "disabled_stage" in kwargs:
        disabled_stage = kwargs["disabled_stage"]
        if isinstance(disabled_stage, str):
            if stage == disabled_stage:
                cron = SCHEDULE_FOR_NEVER
        del kwargs["disabled_stage"]

    def schedule_registration(wrapped_schedule_function):
        """
        This function is called once for each defined schedule (at app startup).
        """
        def cron_string(cron: Cron) -> str:
            if cron == SCHEDULE_FOR_NEVER:
                return "NEVER"
            cron_string = cron.to_string()
            if cron_string.startswith("cron("):
                cron_string = cron_string[len("cron("):]
            if cron_string.endswith(")"):
                cron_string = cron_string[:-1]
            return cron_string
        using_stage = False
        if isinstance(cron, dict):
            cron_object = cron.get(wrapped_schedule_function.__name__)
            if not isinstance(cron_object, Cron):
                stage_schedules = cron.get(stage)
                if not isinstance(stage_schedules, dict):
                    raise Exception(f"Chalice schedule dictionary stage ({stage}) not found: {wrapped_schedule_function.__name__}")
                cron_object = stage_schedules.get(wrapped_schedule_function.__name__)
                if not isinstance(cron_object, Cron):
                    raise Exception(f"Chalice schedule dictionary has no Cron object for stage ({stage}):"
                                    f" {wrapped_schedule_function.__name__}")
                using_stage = True
        elif not isinstance(cron, Cron):
            raise Exception(f"Cron schedule argument must be a Chalice Cront object of a dictionary:"
                            f" {wrapped_schedule_function.__name__}")
        else:
            cron_object = cron
        if using_stage:
            PRINT(f"Registering Chalice schedule ({cron_string(cron_object)}) for (stage: {stage}):"
                  f" {wrapped_schedule_function.__name__}")
        else:
            PRINT(f"Registering Chalice schedule ({cron_string(cron_object)}) for:"
                  f" {wrapped_schedule_function.__name__}")
        return app.schedule(cron_object, **kwargs)(wrapped_schedule_function)
    return schedule_registration
