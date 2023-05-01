from typing import Optional
from foursight_core.react.api.auth import Auth
from foursight_core.react.api.react_api import ReactApi


class _MockReactApi:
    def __init__(self, auth: Auth):
        self.react_authorize = auth.authorize
        self.create_success_response = ReactApi.create_success_response
        self.create_response = ReactApi.create_response
        self.get_site_name = lambda: "some-site-name"
        self.APP_PACKAGE_NAME = "foursight"


class _MockChaliceRequest:
    def __init__(self, request: dict) -> None:
        self._request = request

    def to_dict(self) -> dict:
        return self._request


class MockChaliceApp:

    def __init__(self, auth: Auth = None, current_request: Optional[dict] = None):
        self._auth = auth
        self._current_request = _MockChaliceRequest(current_request)

    @property
    def current_request(self) -> _MockChaliceRequest:
        return self._current_request

    @property
    def core(self) -> _MockReactApi:
        return _MockReactApi(self._auth)

    def route(self, path: str, **kwargs):
        def route_registration(wrapped_route_function):
            return wrapped_route_function
        return route_registration
