from chalice import Response
import io
import logging
import os
from typing import Optional
from ...app import app  # xyzzy

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

    _cached_static_files = {}

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

        print(f'xyzzy/serve_static_file: env=<{env}> paths=<{paths}>')
        print(f'xyzzy/serve_static_file/request:')
        print(app.current_request.to_dict())

        if env:
            paths.insert(0, env)

        file = "/".join(paths)
        if file.endswith("/main.css"):
            file = os.path.join(_REACT_BASE_DIR, "static", "css", "main.css")
            content_type = "application/css"
            open_mode = "r"
        elif file.endswith("/main.js"):
            file = os.path.join(_REACT_BASE_DIR, "static", "js", "main.js")
            content_type = "text/javascript"
            open_mode = "r"
        elif file.endswith("/manifest.json"):
            file = os.path.join(_REACT_BASE_DIR, "manifest.js")
            content_type = "application/json"
            open_mode = "r"
        elif file.endswith("/asset-manifest.json"):
            file = os.path.join(_REACT_BASE_DIR, "asset-manifest.js")
            content_type = "application/json"
            open_mode = "r"
        else:
            file = os.path.join(_REACT_BASE_DIR, "index.html")
            content_type = "text/html"
            open_mode = "r"

        print(f'xyzzy/serve_static_file/serving: file=<{file}> content_type=<{content_type}> open_mode=<{open_mode}>')
        response = ReactUi._cached_static_files.get(file)
        if not response:
            print(f'xyzzy/serve_static_file/not-cached: file=<{file}> content_type=<{content_type}> open_mode=<{open_mode}>')
            response = self._react_api.create_success_response(content_type=content_type)
            print(f'xyzzy/serve_static_file/response')
            print(response)
            try:
                with io.open(file, open_mode) as f:
                    print(f'xyzzy/serve_static_file/opened-file: file=<{file}> content_type=<{content_type}> open_mode=<{open_mode}>')
                    response.body = f.read()
            except Exception as e:
                print(f'xyzzy/serve_static_file/exception:')
                print(e)
                message = f"Exception serving static React file ({file} | {content_type}): {e}"
                logger.error(message)
                return self._react_api.create_error_response(message)
            print(f'xyzzy/serve_static_file/caching-response')
            ReactUi._cached_static_files[file] = response = self._react_api.process_response(response)
        print(f'xyzzy/serve_static_file/return: file=<{file}> content_type=<{content_type}> open_mode=<{open_mode}>')
        return response

    def serve_static_file_OLD(self, env: str, paths: list) -> Response:

        print(f'xyzzy/serve_static_file: env=<{env}> paths=<{paths}>')
        print(f'xyzzy/serve_static_file/request:')
        print(app.current_request.to_dict())
        # TODO WRT the domain name issue: I think env in this case might be 'api' 
        if env == "static":
            print(f'xyzzy/serve_static_file/env-is-static')
            # If the env is 'static' then we take this to mean the 'static' subdirectory;
            # this is the directory where the static (js, css, etc) React files reside.
            # Note this means that an environment name may not be the literal string 'static'.
            file = os.path.join(_REACT_BASE_DIR, "static")
            print(f'xyzzy/serve_static_file/env-is-static/file: file=<{file}>')
        elif env == "api" and paths and paths[0] == "static":
            file = os.path.join(_REACT_BASE_DIR, "static")
            paths = paths[1:]
            print(f'xyzzy/serve_static_file/env-is-api-followed-by-static/file: file=<{file}> paths=<{paths}>')
        else:
            file = _REACT_BASE_DIR
            print(f'xyzzy/serve_static_file/env-is-not-static/file: file=<{file}>')
        if not paths:
            print(f'xyzzy/serve_static_file/no-paths')
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
                print(f'xyzzy/serve_static_file/no-paths/known-suffix: paths=<{paths}>')
        print(f'xyzzy/serve_static_file/parsing-paths: paths=<{paths}>')
        for path in paths:
            file = os.path.join(file, path)
        print(f'xyzzy/serve_static_file/continuing/file: file=<{file}>')

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
            print(f'xyzzy/serve_static_file/file-not-whitelisted: file=<{file}>')
            return self._react_api.create_forbidden_response()

        print(f'xyzzy/serve_static_file/serving: file=<{file}>')
        response = ReactUi._cached_static_files.get(file)
        if not response:
            print(f'xyzzy/serve_static_file/not-cached: file=<{file}>')
            response = self._react_api.create_success_response(content_type=content_type)
            print(f'xyzzy/serve_static_file/response')
            print(response)
            try:
                with io.open(file, open_mode) as f:
                    print(f'xyzzy/serve_static_file/opened-file: file=<{file}>')
                    response.body = f.read()
            except Exception as e:
                print(f'xyzzy/serve_static_file/exception:')
                print(e)
                message = f"Exception serving static React file ({file} | {content_type}): {e}"
                logger.error(message)
                return self._react_api.create_error_response(message)
            print(f'xyzzy/serve_static_file/caching-response')
            ReactUi._cached_static_files[file] = response = self._react_api.process_response(response)
        print(f'xyzzy/serve_static_file/return-response')
        return response

    @staticmethod
    def cache_clear() -> None:
        ReactUi._cached_static_files = {}
