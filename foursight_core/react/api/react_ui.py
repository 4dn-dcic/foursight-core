from chalice import Response
import io
import logging
import os
from typing import Optional
from dcicutils.function_cache_decorator import function_cache

logging.basicConfig()
logger = logging.getLogger(__name__)

_REACT_BASE_DIR = os.path.join(os.path.dirname(__file__), "../../react/ui")
_REACT_DEFAULT_FILE = "index.html"
_REACT_STATIC_FILE_TYPES = [
    {"suffix":       ".html",
     "content_type": "text/html",
     "open_mode":    "r"},
    {"suffix":       ".js",
     "content_type": "text/javascript",
     "open_mode":    "r"},
    {"suffix":       ".css",
     "content_type": "application/css",
     "open_mode":    "r"},
    {"suffix":       ".json",
     "content_type": "application/json",
     "open_mode":    "r"},
    {"suffix":       ".png",
     "content_type": "image/png",
     "open_mode":    "rb"},
    {"suffix":       ".jpg",
     "content_type": "image/jpeg",
     "open_mode":    "rb"},
    {"suffix":       ".jpeg",
     "content_type": "image/jpeg",
     "open_mode":    "rb"},
    {"suffix":       ".ico",
     "content_type": "image/x-icon",
     "open_mode":    "rb"}
]
_REACT_WHITELISTED_FILE_PATH_SUFFIXES = [
    "/index.html",
    "/main.js",
    "/main.css",
    "/manifest.json",
    "/asset-manifest.json",
    ".jpeg",
    ".jpg",
    ".png",
    ".ico"
]


class ReactUi:

    def __init__(self, react_api):
        self._react_api = react_api

    @staticmethod
    def _is_known_file_suffix(file: str) -> bool:
        return any(file.endswith(file_info["suffix"]) for file_info in _REACT_STATIC_FILE_TYPES)

    @staticmethod
    def _get_file_info(file: str) -> Optional[dict]:
        for info in _REACT_STATIC_FILE_TYPES:
            if file.endswith(info["suffix"]):
                return info
        return None

    @staticmethod
    def _is_file_type_whitelisted(file: str) -> bool:
        """
        To be as restrictive as possible we ONLY allow the above whitelisted file types.
        """
        for suffix in _REACT_WHITELISTED_FILE_PATH_SUFFIXES:
            if file.endswith(suffix):
                return True
        return False

    def serve_static_file(self, env: str, paths: list) -> Response:

        if env == "static":
            # If the env is 'static' then we take this to mean the 'static' subdirectory;
            # this is the directory where the static (js, css, etc) React files reside.
            # Note this means that an environment name may not be the literal string 'static'.
            file = os.path.join(_REACT_BASE_DIR, "static")
        else:
            file = _REACT_BASE_DIR
        if not paths:
            # TODO: Not downloading png (et.al.) right! Works with chalice local!
            # Actually it also works in cgap-supertest:
            # https://810xasmho0.execute-api.us-east-1.amazonaws.com/api/react/logo192.png
            # But not in 4dn/foursight-development:
            # https://cm3dqx36s7.execute-api.us-east-1.amazonaws.com/api/react/logo192.png
            # Anyways for now the React UI references images at external sites not from here.
            if self._is_known_file_suffix(env):
                # If the env appears to refer to a file name then we take this
                # to mean a file in the main React directory. Note this means means
                # the environment name may NOT be a value ending in the above suffixes.
                paths = [env]
        for path in paths:
            file = os.path.join(file, path)

        file_info = self._get_file_info(file)
        if file_info:
            content_type = file_info["content_type"]
            open_mode = file_info["open_mode"]
        else:
            # If not recognized then serve the default (index.html) file;
            # this is actually the common case of getting any React UI path.
            file = os.path.join(_REACT_BASE_DIR, _REACT_DEFAULT_FILE)
            content_type = "text/html"
            open_mode = "r"
        file = os.path.normpath(file)

        # Restrict to known whitelisted files.
        if not self._is_file_type_whitelisted(file):
            return self._react_api.create_forbidden_response()

        try:
            return self._get_file_content_response(file, open_mode, content_type)
        except Exception as e:
            message = f"Exception serving static React file ({file} | {content_type}): {e}"
            logger.error(message)
            return self._react_api.create_error_response(message)

    @function_cache
    def _get_file_content_response(self, file: str, open_mode: str, content_type: str) -> str:
        with io.open(file, open_mode) as f:
            content = f.read()
            response = self._react_api.create_success_response(content_type=content_type)
            response.body = content
            return response
