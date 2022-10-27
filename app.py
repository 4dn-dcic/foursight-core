import os
from dcicutils.common import CHALICE_STAGE_DEV, ChaliceStage
from dcicutils.exceptions import InvalidParameterError
from chalice import Chalice
from foursight_core.deploy import Deploy


# Minimal app.py; used to verify foursight-core packaging scripts
# also now used for testing the core facilities - Will June 14 2022
app = Chalice(app_name='foursight_core')
app.debug = True
STAGE: ChaliceStage = os.environ.get('chalice_stage', CHALICE_STAGE_DEV)
DEFAULT_ENV = 'simulated'


@app.route('/')
def index():
    return {'minimal': 'foursight_core'}


######### MISC UTILITY FUNCTIONS #########


def set_stage(stage):
    if stage != 'test' and stage not in Deploy.CONFIG_BASE['stages']:
        raise InvalidParameterError(parameter='stage', value=stage,
                                    options=Deploy.CONFIG_BASE['stages'].keys().extend('test'))
    os.environ['chalice_stage'] = stage
