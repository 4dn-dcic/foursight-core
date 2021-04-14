from chalice import Chalice

# Minimal app.py; used to verify foursight-core packaging scripts
app = Chalice(app_name='foursight_core')


@app.route('/')
def index():
    return {'minimal': 'foursight_core'}
