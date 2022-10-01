from .legacy_routes import LegacyRoutes
from .react.api.react_routes import ReactRoutes

class Routes(LegacyRoutes, ReactRoutes):
    pass
