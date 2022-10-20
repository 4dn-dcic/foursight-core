import boto3
import logging
import time
from typing import Optional
from .cookie_utils import read_cookie
from .envs import Envs
from .jwt_utils import JWT_AUDIENCE_PROPERTY_NAME, jwt_decode, jwt_encode

logging.basicConfig()
logger = logging.getLogger(__name__)


class Auth:

    def __init__(self, auth0_client_id: str, auth0_secret: str, envs: Envs):
        self._auth0_client_id = auth0_client_id
        self._auth0_secret = auth0_secret
        self._envs = envs

    _cached_aws_credentials = {}

    def authorize(self, request: dict, env: Optional[str] = None) -> dict:
        """
        Verifies that the given request is authenticated AND authorized, based on the authtoken
        cookie (a JWT-signed-encoded value) in the given request. If so, returns the verified and
        decoded authtoken as a dictionary. If not, returns a dictionary indicating not authorized
        and/or not authenticated, and containing the basic info from the authtoken.
        """
        try:

            # Read the authtoken cookie.

            authtoken = read_cookie(request, "authtoken")
            if not authtoken:
                return self._create_unauthenticated_response(request, "no-authtoken")

            # Decode the authtoken cookie.

            authtoken_decoded = self.decode_authtoken(authtoken)
            if not authtoken_decoded:
                return self._create_unauthenticated_response(request, "invalid-authtoken")

            # Sanity check the decoded authtoken.

            if authtoken_decoded["authenticated"] is not True:
                return self._create_unauthenticated_response(request, "invalid-authtoken-auth", authtoken_decoded)

            if self._auth0_client_id != authtoken_decoded[JWT_AUDIENCE_PROPERTY_NAME]:
                return self._create_unauthenticated_response(request, "invalid-authtoken-aud", authtoken_decoded)

            domain = self._get_domain(request)
            if domain != authtoken_decoded["domain"]:
                return self._create_unauthenticated_response(request, "invalid-authtoken-domain", authtoken_decoded)

            # Check the authtoken expiration time (its expiration time must be in the future i.e. greater than now).

            authtoken_expires_time_t = authtoken_decoded["authenticated_until"]
            current_time_t = int(time.time())
            if authtoken_expires_time_t <= current_time_t:
                return self._create_unauthenticated_response(request, "authtoken-expired", authtoken_decoded)

            # If given an env, then check that the specified environment is allowed, i.e. that
            # the request is AUTHORIZED. If not, return HTTP 403 (not authorized); we do NOT,
            # in this case, return 401 (not authenticated), as (above) if not authenticated;
            # the UI acts differently for these two cases. These HTTP status are actually
            # set in via the decorator in react_route_utils.

            if env:
                allowed_envs = authtoken_decoded["allowed_envs"]
                if not self._envs.is_allowed_env(env, allowed_envs):
                    status = "not-authorized-env" if self._envs.is_known_env(env) else "not-authorized-unknown-env"
                    return self._create_unauthorized_response(request, status, authtoken_decoded, but_is_authenticated=True)

            return {**authtoken_decoded, "authorized": True}

        except Exception as e:
            logger.error(f"Authorization exception: {e}")
            return self._create_unauthenticated_response(request, "exception: " + str(e))

    def create_authtoken(self, jwt: str, jwt_expires_at: int, env: str, domain: str) -> str:
        """
        Creates and returns a new signed JWT, to be used as the login authtoken (cookie), from
        the given AUTHENTICATED and signed and encoded JWT, which will contain the following:
        - Booleans indicating authenticated AND authorized.
        - The user name (from the "email" field of the given JWT).
        - The list of known environments.
        - The default environment.
        - The initial environment (i.e. the environment in which the user was first authenticated).
        - The list of allowed (authorized) environments for the user associated with the given JWT.
        - The first/last name of the user associated with the given JWT.
        - The timestamp of when the given JWT was issued (UTC time_t/epoch format).
        - The timestamp of when the given JWT expires issued (UTC time_t/epoch format).
        - The audience (aka "aud" aka Auth0 client ID).
        The allowed environments and first/last name are obtained via the users ElasticSearch store;
        the first/last names are just for informational/display purposes in the client.
        Returns the JWT-signed-encoded authtoken value as a string.
        """
        jwt_decoded = jwt_decode(jwt, self._auth0_client_id, self._auth0_secret)
        email = jwt_decoded.get("email")
        allowed_envs, first_name, last_name = self._envs.get_user_auth_info(email)
        authtoken_decoded = {
            "authenticated": True,
            "authenticated_at": jwt_decoded.get("iat"),
            "authenticated_until": jwt_expires_at,
            "user": email,
            "user_verified": jwt_decoded.get("email_verified"),
            "first_name": first_name,
            "last_name": last_name,
            "allowed_envs": allowed_envs,
            "known_envs": self._envs.get_known_envs(),
            "default_env": self._envs.get_default_env(),
            "initial_env": env,
            "domain": domain
        }
        # JWT-sign-encode the authtoken using our Auth0 client ID (aka audience aka "aud") and
        # secret. This *required* audience is added to the JWT before encoding (done in the
        # jwt_encode function), set to the value we pass here, namely, self._auth0_client_id;
        # it was also in the given JWT (i.e. jwt_decoded["aud"]), and these should match (no
        # need to check); it came from the original Auth0 invocation on the client-side (in the
        # Auth0Lock box); we communicate it to the client-side via the non-protected /header endpoint.
        return jwt_encode(authtoken_decoded, audience=self._auth0_client_id, secret=self._auth0_secret)

    def decode_authtoken(self, authtoken: str) -> dict:
        """
        Fully verifies AND decodes and returns the given JWT-signed-encoded authtoken (cookie).
        If not verified (by the jwt_decode function) then None will be returned.
        See create_authtoken (above) for an enumeration of the contents of the authtoken.
        Returns the verified/decoded JWT as a dictionary.
        """
        return jwt_decode(authtoken, self._auth0_client_id, self._auth0_secret)

    def _create_unauthorized_response(self, request: dict, status: str,
                                      authtoken_decoded: dict, but_is_authenticated: bool) -> dict:
        """
        Creates a response suitable for a request which is NOT authorized, or NOT authenticated,
        depending on authenticated argument. Note that we still want to return some basic info,
        i.e. list of known environments, default environment, domain, and aud (Auth0 client ID)
        is required for the Auth0 login box (Auth0Lock) on the client-side (i.e. React UI). This
        info is gotten from the given decoded authtoken or if not set then sets this info explicitly.
        """
        if authtoken_decoded:
            response = authtoken_decoded
        else:
            response = {
                # 2022-10-18
                # No longer including known-envs in unauthorized responses.
                # "known_envs": self._envs.get_known_envs(),
                "default_env": self._envs.get_default_env(),
                "domain": self._get_domain(request),
                JWT_AUDIENCE_PROPERTY_NAME: self._auth0_client_id  # Needed for Auth0Lock login box on client-side.
            }
        response["authenticated"] = but_is_authenticated
        response["authorized"] = False
        response["status"] = status
        return response

    def _create_unauthenticated_response(self, request: dict, status: str, authtoken_decoded: dict = None) -> dict:
        """
        Creates a response suitable for a request which is NOT authenticated.
        """
        return self._create_unauthorized_response(request, status, authtoken_decoded, but_is_authenticated=False)

    @staticmethod
    def _get_domain(request: dict) -> str:
        return request.get("headers", {}).get("host")

    def get_aws_credentials(self, env: str) -> dict:
        """
        Returns basic AWS credentials info (NOT the secret).
        This is just for informational/display purposes in the UI.
        This has nothing to do with the rest of the authentication
        and authorization stuff here but vaguely related so here seems fine.
        """
        aws_credentials = Auth._cached_aws_credentials.get(env)
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
                    "auth0_client_id": self._auth0_client_id
                }
                # Try getting the account name though probably no permission at the moment.
                aws_account_name = None
                try:
                    aws_credentials["aws_account_name"] = (
                        boto3.client('iam').list_account_aliases()['AccountAliases'][0])
                except Exception as e:
                    logger.warning(f"Exception (not fatal) getting AWS account alias: {e}")
                if not aws_account_name:
                    try:
                        aws_credentials["aws_account_name"] = (
                            boto3.client('organizations').
                            describe_account(AccountId=account_number).get('Account').get('Name')
                        )
                    except Exception as e:
                        logger.warning(f"Exception (not fatal) getting AWS account name: {e}")
                Auth._cached_aws_credentials[env] = aws_credentials
            except Exception as e:
                logger.warning(f"Exception (not fatal) getting AWS account info: {e}")
                return {}
        return aws_credentials

    def cache_clear(self) -> None:
        self._cached_aws_credentials = {}
