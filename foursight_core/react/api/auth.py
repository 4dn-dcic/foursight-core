from chalice import Response, __version__ as chalice_version
import jwt as jwtlib
import boto3
import json
import time
import urllib.parse
from ...cookie_utils import create_set_cookie_string, read_cookie
from .envs import Envs


class Auth():

    def __init__(self, auth0_client_id: str, auth0_secret: str, envs: Envs):
        self.auth0_client_id = auth0_client_id
        self.auth0_secret = auth0_secret
        self.envs = envs

    class Cache:
        aws_credentials = {}

    def create_authtoken(self, jwt: str, env: str, domain: str) -> str:
        """
        Augments the given JWT with the list of known environments; the default environments;
        and the list of allowed (authorized) environments for the user associated with the
        given JWT; and the first/last name of the user associated with the JWT. The allowed
        environments and first/last name are obtained via the users store (in ElasticSearch).
        The first/last name FYI is just or informational/display purposes in the client.
        Returns the JWT-signed-encoded authtoken value as a string.
        """
        jwt_decoded = self.decode_jwt(jwt)
        email = jwt_decoded.get("email")
        email_verified = jwt_decoded.get("email_verified")
        known_envs, allowed_envs, first_name, last_name = self.envs.get_envs_for_user(email)
        authtoken_decoded = {
            "authenticated": True,
            "authenticated_at": jwt_decoded.get("iat"),
            "authenticated_until": jwt_decoded.get("exp"),
            "authorized": True,
            "user": email,
            "user_verified": email_verified,
            "first_name": first_name,
            "last_name": last_name,
            "allowed_envs": allowed_envs,
            "known_envs": known_envs,
            "default_env": self.envs.get_default_env(),
            "initial_env": env,
            "domain": domain,
            "aud": self.auth0_client_id # The "aud" (Auth0 client ID) required Auth0 to decode JWT.
        }
        # JWT-sign-encode authtoken using our Auth0 secret.
        authtoken = jwtlib.encode(authtoken_decoded, self.auth0_secret, algorithm="HS256")
        if isinstance(authtoken, bytes):
            # Depending on version jwtlib.encode returns bytes or string :-(
            authtoken = authtoken.decode("utf-8")

        return authtoken

    def decode_authtoken(self, authtoken: str) -> dict:
        """
        Fully decode AND verify the given JWT-signed-encoded authtoken (cookie).
        If not verified (by the decode_jwt function) then None will be returned.
        This authtoken is a JWT-signed-encoded token containing the list of
        environments the authenticated user is allowed to access.
        Returns this info in a dictionary.
        """
        return self.decode_jwt(authtoken)

    def create_not_authorized_response(self, request: dict, status: str, authtoken_decoded: dict, authenticated: bool = True) -> dict:
        if authtoken_decoded:
            response = authtoken_decoded
        else:
            response = {
                "known_envs": self.envs.get_known_envs(),
                "default_env": self.envs.get_default_env(),
                "domain": self.get_domain(request),
                "aud": self.auth0_client_id # Needed for Auth0 login box.
            }
        response["authenticated"] = authenticated
        response["authorized"] = False
        response["status"] = status
        return response

    def create_not_authenticated_response(self, request: dict, status: str, authtoken_decoded: dict = None) -> dict:
        return self.create_not_authorized_response(request, status, authtoken_decoded, False)

    def authorization_callback(self, request: dict, env: str, domain: str, jwt: str, expires: int):
        react_redir_url = read_cookie("reactredir", request)
        if react_redir_url:
            # Not certain if by design but the React library (universal-cookie) used to
            # write cookies URL-encodes them; rolling with it for now and URL-decoding here.
            react_redir_url = urllib.parse.unquote(react_redir_url)
            response_headers = {"Location": react_redir_url}
        authtoken = self.create_authtoken(jwt, env, domain)
        authtoken_cookie = create_set_cookie_string(request, name="authtoken",
                                                    value=authtoken,
                                                    domain=domain,
                                                    expires=expires, http_only=False)
        response_headers["set-cookie"] = authtoken_cookie
        return Response(status_code=302, body=json.dumps(response_headers), headers=response_headers)

    def authorize(self, request: dict, env: str) -> dict:
        try:

            # Read the authtoken cookie.

            authtoken = read_cookie("authtoken", request)
            if not authtoken:
                return self.create_not_authenticated_response(request, "no-authtoken")

            # Decode the authtoken cookie.

            authtoken_decoded = self.decode_authtoken(authtoken)
            if not authtoken_decoded:
                return self.create_not_authenticated_response(request, "invalid-authtoken")

            # Sanity check the decoded authtoken.

            if self.auth0_client_id != authtoken_decoded["aud"]:
                return self.create_not_authenticated_response(request, "invalid-authtoken-aud", authtoken_decoded)

            domain = self.get_domain(request)
            if domain != authtoken_decoded["domain"]:
                return self.create_not_authenticated_response(request, "invalid-authtoken-domain", authtoken_decoded)

            # Check the authtoken expiration time (it expiration time must be in the future).

            authtoken_expires_time_t = authtoken_decoded["authenticated_until"]
            current_time_t = int(time.time())
            if authtoken_expires_time_t <= current_time_t:
                return self.create_not_authenticated_response(request, "authtoken-expired", authtoken_decoded)

            # Check that the specified environment is allowed.

            allowed_envs = authtoken_decoded["allowed_envs"]
            if not self.envs.is_allowed_env(env, allowed_envs):
                status = "not-authorized-env" if self.envs.is_known_env(env) else "not-authorized-unknown-env"
                return self.create_not_authorized_response(request, status, authtoken_decoded)

            return authtoken_decoded

        except Exception as e:
            print("Authorize exception: " + str(e))
            return self.create_not_authenticated_response(request, "exception: " + str(e))

    def decode_jwt(self, jwt: str) -> dict:
        try:
            if not jwt:
                return None
            # The leeway accounts for a bit of clock drift between us and Auth0.
            # This decoding WITH signature verification is very fast;
            # on my (dmichaels) MacBook it generally takes less than 0.04ms;
            # very good since we do this on every (protected) React API call.
            return jwtlib.decode(jwt, self.auth0_secret,
                                      audience=self.auth0_client_id,
                                      leeway=30,
                                      options={"verify_signature": True},
                                      algorithms=["HS256"])
        except Exception as e:
            print("Decode JWT exception: " + str(e))
            return None

    def get_domain(self, request: dict) -> str:
        if request:
            try:
                return request.get("headers", {}).get("host")
            except:
                pass
        return ""

    def get_aws_credentials(self, env: str) -> dict:
        aws_credentials = Auth.Cache.aws_credentials.get(env)
        if not aws_credentials:
            try:
                session = boto3.session.Session()
                credentials = session.get_credentials()
                access_key_id = credentials.access_key
                region_name = session.region_name
                caller_identity = boto3.client("sts").get_caller_identity()
                user_arn = caller_identity["Arn"]
                account_number = caller_identity["Account"]
                aws_credentials = {
                    "aws_account_number": account_number,
                    "aws_user_arn": user_arn,
                    "aws_access_key_id": access_key_id,
                    "aws_region": region_name,
                    "auth0_client_id": self.auth0_client_id
                }
                Auth.Cache.aws_credentials[env] = aws_credentials
            except Exception as e:
                return {}
        return aws_credentials
