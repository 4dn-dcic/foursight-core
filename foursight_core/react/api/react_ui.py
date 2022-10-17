from chalice import Response
import io
import logging
import os
from typing import Optional

logging.basicConfig()
logger = logging.getLogger(__name__)

REACT_BASE_DIR = os.path.join(os.path.dirname(__file__), "../../react/ui")
REACT_DEFAULT_FILE = "index.html"
REACT_STATIC_FILE_TYPES = [
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
REACT_WHITELISTED_FILE_PATH_SUFFIXES = [
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
        self.react_api = react_api

    cache_static_files = {}

    @staticmethod
    def is_file_whitelisted(file: str) -> bool:
        """
        To be as restrictive as possible we ONLY allow the above whitelistted files.
        """
        for suffix in REACT_WHITELISTED_FILE_PATH_SUFFIXES:
            if file.endswith(suffix):
                return True
        return False

    @staticmethod
    def get_file_info(file: str) -> Optional[dict]:
        for info in REACT_STATIC_FILE_TYPES:
            if file.endswith(info["suffix"]):
                return info
        return None

    def serve_static_file(self, env: str, **kwargs) -> Response:

        # TODO: Some commentary on this.
        env = env.replace("{environ}", env)

        if env == "static":
            # If the env is 'static' then we take this to mean the 'static' subdirectory;
            # this is the directory where the static (js, css, etc) React files reside.
            # Note that this means a real 'environ' may not be the literal string 'static'.
            file = os.path.join(REACT_BASE_DIR, "static")
        else:
            file = REACT_BASE_DIR
        args = kwargs.values()
        if not args:
            # TODO: png (et.al.) not downloading right!
            # Running chalice local it works though.
            # Actually it also works in cgap-supertest:
            # https://810xasmho0.execute-api.us-east-1.amazonaws.com/api/react/logo192.png
            # But not in 4dn/foursight-development:
            # https://cm3dqx36s7.execute-api.us-east-1.amazonaws.com/api/react/logo192.png
            # Anyways for now the React UI references images at external sites not from here.
            if any(env.endswith(file["suffix"]) for file in REACT_FILE_TYPES):
                # If the 'environ' appears to refer to a file then we take this
                # to mean the file in the main React directory. Note that this
                # means 'environ' may NOT be a value ending in the above suffixes.
                args = [env]
        for path in args:
            file = os.path.join(file, path)

        if not self.is_file_whitelisted(file):
            return self.react_api.create_forbidden_response()

        file_info = self.get_file_info(file)
        if not file_info:
            return self.react_api.create_forbidden_response()

        content_type = file_info["content_type"]
        open_mode = file_info["open_mode"]

        response = ReactUi.cache_static_files.get(file)
        if not response:
            response = self.react_api.create_success_response("react_serve_static_file", content_type)
            try:
                with io.open(file, open_mode) as f:
                    response.body = f.read()
            except Exception as e:
                message = f"Exception serving static React file ({file} | {content_type}): {e}"
                logger.error(message)
                return self.react_api.create_error_response(message)
            response = self.react_api.process_response(response)
            ReactUi.cache_static_files[file] = response
        return response
