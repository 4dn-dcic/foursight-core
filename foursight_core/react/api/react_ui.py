import os
import io


class ReactUi():

    def __init__(self, react_api):
        self.react_api = react_api

    class Cache:
        static_files = {}

    def serve_static_file(self, environ, domain="", context="/", **kwargs):

        whitelisted_file_path_suffixes = [
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

        environ = environ.replace("{environ}", environ)

        BASE_DIR = os.path.dirname(__file__)
        REACT_BASE_DIR = "../../react/ui"
        REACT_DEFAULT_FILE = "index.html"

        if environ == "static":
            # If the environ is 'static' then we take this to mean the 'static'
            # sub-directory; this is the directory where the static (js, css, etc)
            # React files live. Note that this means a real 'environ' may not be 'static'.
            file = os.path.join(BASE_DIR, REACT_BASE_DIR, "static")
        else:
            file = os.path.join(BASE_DIR, REACT_BASE_DIR)
        args = kwargs.values()
        if not args:
            # TODO: png (et.al.) not downloading right!
            # Running chalice local it works though.
            # Actually it also works in cgap-supertest:
            # https://810xasmho0.execute-api.us-east-1.amazonaws.com/api/react/logo192.png
            # But not in 4dn/foursight-development:
            # https://cm3dqx36s7.execute-api.us-east-1.amazonaws.com/api/react/logo192.png
            # Anyways for now the React UI references images at external sites not from here.
            if (environ.endswith(".js") or environ.endswith(".html") or environ.endswith(".json")
               or environ.endswith(".jpg") or environ.endswith(".jpeg")
               or environ.endswith(".png") or environ.endswith(".ico")):
                # If the 'environ' appears to refer to a file then we take this
                # to mean the file in the main React directory. Note that this
                # means 'environ' may NOT be a value ending in the above suffixes.
                args = [environ]
        for path in args:
            file = os.path.join(file, path)
        if file.endswith(".html"):
            content_type = "text/html"
            open_mode = "r"
        elif file.endswith(".js"):
            content_type = "text/javascript"
            open_mode = "r"
        elif file.endswith(".css"):
            content_type = "application/css"
            open_mode = "r"
        elif file.endswith(".json"):
            content_type = "application/json"
            open_mode = "r"
        elif file.endswith(".png"):
            content_type = "image/png"
            open_mode = "rb"
        elif file.endswith(".jpeg") or file.endswith(".jpg"):
            content_type = "image/jpeg"
            open_mode = "rb"
        elif file.endswith(".ico"):
            content_type = "image/x-icon"
            open_mode = "rb"
        else:
            file = os.path.join(BASE_DIR, REACT_BASE_DIR, REACT_DEFAULT_FILE)
            content_type = "text/html"
            open_mode = "r"
            # Be as restrictive as possible. ONLY allow above files.

        may_serve_file = False
        for whitelisted_file_path_suffix in whitelisted_file_path_suffixes:
            if file.endswith(whitelisted_file_path_suffix):
                may_serve_file = True
                break
        if not may_serve_file:
            return self.react_api.forbidden_response()

        response = ReactUi.Cache.static_files.get(file)
        if not response:
            response = self.react_api.create_standard_response("ReactUi.serve_static_file", content_type)
            with io.open(file, open_mode) as f:
                try:
                    response.body = f.read()
                except Exception as e:
                    print(f"ERROR: Exception on serving React file: {file} (content-type: {content_type}).")
                    print(e)
            response = self.react_api.process_response(response)
            ReactUi.Cache.static_files[file] = response
        return response
