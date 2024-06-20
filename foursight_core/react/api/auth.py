import os
import boto3
import logging
import time
import redis
from typing import Optional, Tuple
from dcicutils.env_utils import full_env_name
from dcicutils.function_cache_decorator import function_cache
from dcicutils.misc_utils import ignored, PRINT
from dcicutils.redis_tools import RedisBase, RedisSessionToken, SESSION_TOKEN_COOKIE
from dcicutils.redis_utils import create_redis_client
from ...app import app
from .cookie_utils import read_cookie, read_cookie_bool
from .envs import Envs
from .jwt_utils import JWT_AUDIENCE_PROPERTY_NAME, JWT_SUBJECT_PROPERTY_NAME, jwt_decode, jwt_encode
from .misc_utils import get_request_domain

logging.basicConfig()
logger = logging.getLogger(__name__)


# Constant for authtoken derived from JWT to give info about the user to
# the front-end
AUTH_TOKEN_COOKIE = 'authtoken'


class Auth:

    def __init__(self, auth0_client: str, auth0_secret: str, envs: Envs):
        self._auth0_client = auth0_client
        self._auth0_secret = auth0_secret
        self._envs = envs
        self._redis = None

    def get_redis_handler(self):
        """
        Returns a handler to Redis or None if not in use
        """
        if not self._redis:
            # 2023-09-21: Moved this from __init__ to here;
            # it speeds up provision/deploy from 4dn-cloud-infra.
            try:
                if (redis_url := os.environ.get('REDIS_HOST')) and ("redis://" in redis_url or "rediss://" in redis_url):
                    self._redis = RedisBase(create_redis_client(url=redis_url))
            except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError):
                PRINT('Cannot connect to Redis')
                PRINT('This error is expected when deploying with remote (ElastiCache) Redis')
        return self._redis

    @classmethod
    def get_redis_namespace(cls, env: str) -> str:
        ignored(env)
        # As of April 2023 simply use a static non-per-environment namespace for the Redis
        # auth token; this is so we can switch among different environments in Foursight
        # with the same login session, as it was working before the Redis auth work;
        return "foursight"

    def authorize(self, request: dict, env: Optional[str] = None) -> dict:
        """
        Verifies that the given request is authenticated AND authorized, based on the authtoken
        cookie (a JWT-signed-encoded value) in the given request. If so, returns the verified and
        decoded authtoken as a dictionary. If not, returns a dictionary indicating not authorized
        and/or not authenticated, and containing the basic info from the authtoken.
        """
        try:
            # Read the c4_st token (new Redis session token if Redis is in use)
            if self._redis:
                c4_st = read_cookie(request, SESSION_TOKEN_COOKIE)
                redis_session_token = RedisSessionToken.from_redis(
                    redis_handler=self._redis,
                    namespace=self.get_redis_namespace(env),
                    token=c4_st
                )
                # if this session token is not valid, nothing else is to be trusted, so bail here
                if (not redis_session_token or
                        not redis_session_token.validate_session_token(redis_handler=self._redis)):
                    return self._create_unauthenticated_response(request, "missing-or-invalid-session-token")

            # Read the authtoken cookie (will always be present).

            authtoken = read_cookie(request, AUTH_TOKEN_COOKIE)
            if not authtoken:
                return self._create_unauthenticated_response(request, "no-authtoken")

            # Decode the authtoken cookie.

            authtoken_decoded = self.decode_authtoken(authtoken)
            if not authtoken_decoded:
                return self._create_unauthenticated_response(request, "invalid-authtoken")

            # Sanity check the decoded authtoken.

            if authtoken_decoded["authenticated"] is not True:
                return self._create_unauthenticated_response(request, "invalid-authtoken-auth", authtoken_decoded)

            if self._auth0_client != authtoken_decoded[JWT_AUDIENCE_PROPERTY_NAME]:
                return self._create_unauthenticated_response(request, "invalid-authtoken-aud", authtoken_decoded)

            domain = get_request_domain(request)
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
            # the UI acts differently for these two cases. These HTTP statuses are actually
            # set via the @route decorator in react_route_decorator.

            if env:
                allowed_envs = authtoken_decoded["allowed_envs"]
                if not self._envs.is_allowed_env(env, allowed_envs):
                    status = "not-authorized-env" if self._envs.is_known_env(env) else "not-authorized-unknown-env"
                    return self._create_unauthorized_response(request, status, authtoken_decoded, is_authenticated=True)

            return {**authtoken_decoded, "authorized": True}

        except Exception as e:
            logger.error(f"Authorization exception: {e}")
            return self._create_unauthenticated_response(request, "exception: " + str(e))

    def create_authtoken(self, jwt: str, jwt_expires_at: int, domain: str, request: Optional[dict] = None) -> Tuple[str, str]:
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
        Returns the JWT-signed-encoded authtoken value as a string and the email in a tuple.
        """
        jwt_decoded = jwt_decode(jwt, self._auth0_client, self._auth0_secret)
        email = jwt_decoded.get("email")
        # Just FYI for UI, communicate how the user logged in, i.e. currently via either
        # Google or GitHub. For the former the "sub" property of the JWT looks something
        # like "google-oauth2|117300206013007398924", and for the latter "github|105234079".
        authenticator = jwt_decoded.get(JWT_SUBJECT_PROPERTY_NAME)
        if authenticator:
            authenticator = authenticator.casefold()
            if "google" in authenticator:
                authenticator = "google"
            elif "github" in authenticator:
                authenticator = "github"
        try:
            if request:
                # Note that these "test_mode_xyz" cookies are for testing only
                # and if used must be manually set, e.g. via Chrome Developer Tools.
                test_mode_access_key_simulate_error = read_cookie_bool(request, "test_mode_access_key_simulate_error")
                if test_mode_access_key_simulate_error:
                    # For testing only, we simulate a portal access key error (e.g. due to expiration),
                    # which would manifest itself, primarily and most importantly, here, on login.
                    raise Exception("test_mode_access_key_simulate_error")
            allowed_envs, first_name, last_name = self._envs.get_user_auth_info(email)
            user_exception = False
        except Exception as e:
            #
            # Here there was a problem getting the user info via Portal (e.g. due to expired or otherwise bad
            # Portal acesss key); this will NOT prevent the user from being logged in BUT it WILL prevent the
            # user from doing anything because there will be no allowed environments. We note this particular
            # error with a flag (user_exception) in the authtoken JWT cookie; we catch this case in the /header
            # endpoint to send back information about the portal access key (via get_portal_access_key_info) in
            # its response, so an appropriate error can be shown in the UI. We do NOT want to ALWAYS get this
            # information (via get_portal_access_key_info) in the /header endpoint (like in the normal case
            # where there is no error) because it would impact performance (the /header endpoint should be as
            # fast as possible), so we only do it if looks like there is a problem, i.e. as there is here.
            #
            # There is also a separate /portal_access_key endpoint to be called asynchronously by the UI to
            # display any error (e.g. acesss key expired) or warning (e.g. access key expiring soon), but
            # the UI does not use that to redirect to an error page (on error) because, being asynchronous,
            # it could be a jarring UX (i.e. to all of a sudden be redirected to an error page after the
            # current page looks like it is stable), so the UI uses this /portal_access_key endpoint to
            # just display a (red) bar across the top of the page indicating that the accesss key is
            # invalid (e.g. expired) or will expire soon.
            #
            # This is in contrast the the analogous behavior of the Portal SSL certicifcate checking.
            # In that case, since the /header endpoint indirectly and synchronously calls the Portal
            # health endpoint ANYWAYS, we will know at that point if the certificate is problematic,
            # and in that case we can return from the /header endpoint information about the certificate,
            # which the UI can use to redirect to an error, without a jarring UX, i.e. since this the
            # /header endpoint is the first and primary API called by the UI before it can do anything.
            #
            allowed_envs = []
            first_name = None
            last_name = None
            user_exception = True

        authtoken_decoded = {
            "authentication": "auth0",
            "authenticator": authenticator,
            "authenticated_at": jwt_decoded.get("iat"),
            "authenticated_until": jwt_expires_at,
            "authenticated": True,
            "user": email,
            "user_verified": jwt_decoded.get("email_verified"),
            "first_name": first_name,
            "last_name": last_name,
            "allowed_envs": allowed_envs,
            "known_envs": self._envs.get_known_envs(),
            "default_env": self._envs.get_default_env(),
            "domain": domain,
            "site": app.core.get_site_name()
        }
        if user_exception:
            authtoken_decoded["user_exception"] = True
        # JWT-sign-encode the authtoken using our Auth0 client ID (aka audience aka "aud") and
        # secret. This *required* audience is added to the JWT before encoding (done in the
        # jwt_encode function), set to the value we pass here, namely, self._auth0_client;
        # it was also in the given JWT (i.e. jwt_decoded["aud"]), and these should match (no
        # need to check); it came from the original Auth0 invocation on the client-side (in the
        # Auth0Lock box); we communicate it to the client-side via the non-protected /header endpoint.
        return jwt_encode(authtoken_decoded, audience=self._auth0_client, secret=self._auth0_secret), email

    def decode_authtoken(self, authtoken: str) -> dict:
        """
        Fully verifies AND decodes and returns the given JWT-signed-encoded authtoken (cookie).
        If not verified (by the jwt_decode function) then None will be returned.
        See create_authtoken (above) for an enumeration of the contents of the authtoken.
        Returns the verified/decoded JWT as a dictionary.
        """
        return jwt_decode(authtoken, self._auth0_client, self._auth0_secret)

    def _create_unauthorized_response(self, request: dict, status: str,
                                      authtoken_decoded: dict, is_authenticated: bool) -> dict:
        """
        Creates a response suitable for a request which is NOT authorized, or NOT authenticated,
        depending on the is_authenticated argument. Note that we still want to return some
        basic info, i.e. the default environment, domain, and aud (Auth0 client ID) is required
        for the Auth0 login box (Auth0Lock) on the client-side (i.e. React UI). This info is
        gotten from the given decoded authtoken or if not set then sets this info explicitly.
        """
        if authtoken_decoded:
            response = authtoken_decoded
        else:
            response = {
                # 2022-10-18
                # No longer including known-envs in unauthorized responses.
                # "known_envs": self._envs.get_known_envs(),
                "default_env": self._envs.get_default_env(),
                "domain": get_request_domain(request),
                "site": "foursight-cgap" if app.core.APP_PACKAGE_NAME == "foursight-cgap" else "foursight-fourfront",
                JWT_AUDIENCE_PROPERTY_NAME: self._auth0_client  # Needed for Auth0Lock login box on client-side.
            }
        response["authenticated"] = is_authenticated
        response["authorized"] = False
        response["status"] = status
        return response

    def _create_unauthenticated_response(self, request: dict, status: str, authtoken_decoded: dict = None) -> dict:
        """
        Creates a response suitable for a request which is NOT authenticated.
        """
        return self._create_unauthorized_response(request, status, authtoken_decoded, is_authenticated=False)

    @function_cache(nocache=None)
    def get_aws_credentials(self, env: str) -> dict:
        """
        Returns basic AWS credentials info (NOT the secret).
        This is just for informational/display purposes in the UI.
        This has nothing to do with the rest of the authentication
        and authorization stuff here but vaguely related so here seems fine.
        """
        aws_credentials = None
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
                "auth0_client_id": self._auth0_client
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
        except Exception as e:
            logger.warning(f"Exception (not fatal) getting AWS account info: {e}")
            return None
        return aws_credentials
