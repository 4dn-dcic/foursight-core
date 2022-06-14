import os
from chalice import Chalice
from foursight_core.deploy import Deploy


# Minimal app.py; used to verify foursight-core packaging scripts
# also now used for testing the core facilities - Will June 14 2022
app = Chalice(app_name='foursight_core')
app.debug = True
STAGE = os.environ.get('chalice_stage', 'dev')
DEFAULT_ENV = 'simulated'


@app.route('/')
def index():
    return {'minimal': 'foursight_core'}


######### MISC UTILITY FUNCTIONS #########


def set_stage(stage):
    if stage != 'test' and stage not in Deploy.CONFIG_BASE['stages']:
        print('ERROR! Input stage is not valid. Must be one of: %s' % str(list(Deploy.CONFIG_BASE['stages'].keys()).extend('test')))
    os.environ['chalice_stage'] = stage
