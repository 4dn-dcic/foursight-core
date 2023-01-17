import jwt as jwtlib
from jwt import PyJWKClient
import requests
from foursight_core.react.api.encoding_utils import base64_encode, string_to_bytes

def get_cognito_oauth_config(include_secret: bool = False) -> object:
    """
    Returns all necessary configuration info for our AWS Coginito authorization server.
    """
    #
    # TODO: Get this info from safe place.
    # Need to figure our which pieces go where and if they are per Foursight instance or what et cetera.
    # I guess it's just the use pool ID, client ID, and domain. 
    # Do we use one user pool (and associaetd client) for all or one per Foursight instance(s)?
    # Simpler but probably not technically ideal.
    #
    response = {
        "client_id": "5d586se3r976435167nk8k8s4h",
        "user_pool_id": "us-east-1_h6I5IqQSs",
        "domain": "foursightc.auth.us-east-1.amazoncognito.com",
        # "scope": "openid email",
        "scope": "openid email profile",
        "connections": [ "Google" ],
        "callback": "http://localhost:8000/api/react/oauth/callback" # TODO: /api/react/oauth/cognito/callback
    }
    if include_secret:
        #
        # This is a temporary test account - no harm in checking in.
        #
        response["client_secret"] = "8caa9mn0f696ic1utvrg1ni5j48e5kap9l5rm5c785d7c7bdnjn"
    return response

def get_cognito_oauth_token(request_dict: dict) -> dict:
    response = call_cognito_oauth_token_endpoint(request_dict)
    token = response.get("id_token")
    decoded_token = decode_cognito_oauth_token_jwt(token)
    return decoded_token

def call_cognito_oauth_token_endpoint(request_dict: dict) -> dict:
    args = request_dict.get("query_params") or {}
    args_code = args.get("code")
    args_state = args.get("state")
    args_oauth_state = args.get("oauth_state")
    args_ouath_pkce_key = args.get("ouath_pkce_key") # sic wrt ouath spelling
    data = _get_cognito_oauth_token_endpoint_data(code=args_code, code_verifier=args_ouath_pkce_key)
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {_get_cognito_oauth_token_endpoint_authorization()}"
    }
    url = _get_cognito_oauth_token_endpoint_url()
    cognito_auth_token_response = requests.post(url, headers=headers, data=data)
    cognito_auth_token_response_json = cognito_auth_token_response.json()
    print('xyzzy/cognito_auth_token_response_json/a')
    print(cognito_auth_token_response_json)
    return cognito_auth_token_response_json

def _get_cognito_oauth_token_endpoint_url() -> str:
    """
    Returns the URL for the POST to the /oauth2/token endpoint.
    """
    config = get_cognito_oauth_config()
    domain = config["domain"]
    return f"https://{domain}/oauth2/token"

def _get_cognito_oauth_token_endpoint_authorization() -> dict:
    """
    Returns the value for basic authorization suitable as the header
    for a POST to the /oauth2/token endpoint,
    """
    config = get_cognito_oauth_config(include_secret=True)
    client_id = config["client_id"]
    client_secret = config["client_secret"]
    return base64_encode(f"{client_id}:{client_secret}")

def _get_cognito_oauth_token_endpoint_data(code: str, code_verifier: str) -> dict:
    """
    Returns data suitable as the payload for a POST to the /oauth2/token endpoint,
    given an authetication code and associated code_verifier passed (from the
    /oauth2/authorize endpoint) to our authentication callback.
    """
    config = get_cognito_oauth_config(include_secret=True)
    return {
        "grant_type": "authorization_code",
        "client_id": config["client_id"],
        "client_secret": config["client_secret"],
        "code": code,
        "code_verifier": code_verifier,
        "redirect_uri": config["callback"]
    }

def decode_cognito_oauth_token_jwt(jwt: str, verify_signature: bool = True, verify_expiration = True) -> dict:
    """
    Decodes and returns the dictionary for the given JWT.
    """
    #
    # Example decoded (id_tokn) JWT:
    # {
    #     "at_hash": "C9sA39psH6zoRKXuLfQVGw",
    #     "sub": "7dca9b92-746b-4406-9f7d-3e58cd7b247f",
    #     "cognito:groups": [
    #         "us-east-1_h6I5IqQSs_Google"
    #     ],
    #     "email_verified": false,
    #     "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_h6I5IqQSs",
    #     "cognito:username": "google_117300206013007398924",
    #     "given_name": "David",
    #     "nonce": "Mm9KTFynPpG7J64FA9XxTBYnjmve5S0qjXPLQmGRE-Q_6W5SeT1At9AJBw5nWkZcdX5vPlqNdvhyKDppSDmT_cQYQA_cm--DJWLIW33N4yhY6T7I8FzeKNiP-MKglmeNsvocfIeU2dTwzZmt_5OySwwy4DU0BsHcTZOgKT0ZGtk",
    #     "origin_jti": "04ee7dcf-a2ca-4df5-8790-604456609d69",
    #     "aud": "5d586se3r976435167nk8k8s4h",
    #     "identities": [
    #         {
    #             "userId": "117300206013007398924",
    #             "providerName": "Google",
    #             "providerType": "Google",
    #             "issuer": null,
    #             "primary": "true",
    #             "dateCreated": "1673913190125"
    #         }
    #     ],
    #     "token_use": "id",
    #     "auth_time": 1673913192,
    #     "exp": 1673916792,
    #     "iat": 1673913192,
    #     "family_name": "Michaels",
    #     "jti": "c2061278-c0cd-4bf6-ad77-1ffaeed2f626",
    #     "email": "david_michaels@hms.harvard.edu"
    # }
    #
    config = get_cognito_oauth_config()
    client_id = config["client_id"]
    signing_key = get_cognito_oauth_signing_key(jwt)
    options = {
        "verify_signature": verify_signature,
        "verify_exp": verify_expiration
    }
    return jwtlib.decode(jwt, signing_key, audience=client_id, algorithms=["RS256"], options=options)

def get_cognito_oauth_signing_key(jwt: str) -> object:
    """
    Returns the signing key from the given JWT.
    """
    jwt = string_to_bytes(jwt)
    signing_key_client = get_cognito_oauth_signing_key_client()
    signing_key = signing_key_client.get_signing_key_from_jwt(jwt)
    return signing_key.key

def get_cognito_oauth_signing_key_client() -> object:
    """
    Returns an object which can be used to extract a signing key from a JWT.
    Hits the jwsks.json (JSON Web Key Sets) API for the Cognito authentication server.
    """
    config = get_cognito_oauth_config()
    user_pool_id = config["user_pool_id"]
    cognito_jwks_url = f"https://cognito-idp.us-east-1.amazonaws.com/{user_pool_id}/.well-known/jwks.json"
    return PyJWKClient(cognito_jwks_url)

# TESTING ...

id_token = "eyJraWQiOiJ1Z1JBUEtXMkNzdk9pUFgyUEtvRFwvZTNVN1BCQUYyTXAzMHp1NGprUG05bz0iLCJhbGciOiJSUzI1NiJ9.eyJhdF9oYXNoIjoiQzlzQTM5cHNINnpvUktYdUxmUVZHdyIsInN1YiI6IjdkY2E5YjkyLTc0NmItNDQwNi05ZjdkLTNlNThjZDdiMjQ3ZiIsImNvZ25pdG86Z3JvdXBzIjpbInVzLWVhc3QtMV9oNkk1SXFRU3NfR29vZ2xlIl0sImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLnVzLWVhc3QtMS5hbWF6b25hd3MuY29tXC91cy1lYXN0LTFfaDZJNUlxUVNzIiwiY29nbml0bzp1c2VybmFtZSI6Imdvb2dsZV8xMTczMDAyMDYwMTMwMDczOTg5MjQiLCJnaXZlbl9uYW1lIjoiRGF2aWQiLCJub25jZSI6Ik1tOUtURnluUHBHN0o2NEZBOVh4VEJZbmptdmU1UzBxalhQTFFtR1JFLVFfNlc1U2VUMUF0OUFKQnc1bldrWmNkWDV2UGxxTmR2aHlLRHBwU0RtVF9jUVlRQV9jbS0tREpXTElXMzNONHloWTZUN0k4RnplS05pUC1NS2dsbWVOc3ZvY2ZJZVUyZFR3elptdF81T3lTd3d5NERVMEJzSGNUWk9nS1QwWkd0ayIsIm9yaWdpbl9qdGkiOiIwNGVlN2RjZi1hMmNhLTRkZjUtODc5MC02MDQ0NTY2MDlkNjkiLCJhdWQiOiI1ZDU4NnNlM3I5NzY0MzUxNjduazhrOHM0aCIsImlkZW50aXRpZXMiOlt7InVzZXJJZCI6IjExNzMwMDIwNjAxMzAwNzM5ODkyNCIsInByb3ZpZGVyTmFtZSI6Ikdvb2dsZSIsInByb3ZpZGVyVHlwZSI6Ikdvb2dsZSIsImlzc3VlciI6bnVsbCwicHJpbWFyeSI6InRydWUiLCJkYXRlQ3JlYXRlZCI6IjE2NzM5MTMxOTAxMjUifV0sInRva2VuX3VzZSI6ImlkIiwiYXV0aF90aW1lIjoxNjczOTEzMTkyLCJleHAiOjE2NzM5MTY3OTIsImlhdCI6MTY3MzkxMzE5MiwiZmFtaWx5X25hbWUiOiJNaWNoYWVscyIsImp0aSI6ImMyMDYxMjc4LWMwY2QtNGJmNi1hZDc3LTFmZmFlZWQyZjYyNiIsImVtYWlsIjoiZGF2aWRfbWljaGFlbHNAaG1zLmhhcnZhcmQuZWR1In0.kHbm6oz5bWhH4sJzy8YjrVnBIu3_PT2H1xlnKzm5c3lFs2V-FfieC3AV-MUYZa_CJRfdFsajh8mW4JDA7QMfOSHVoF47Fo3uoD0Yt9gk8WrmxQz_R5R_ko-pApg3fw4eaKqwcQpdLe5n0s0-Ee67M4QdLdbfIwyFd-rSaexeII0RMu2M5x0wrPyl7mq_J92fYJXK1hExalVZkyuHTYaddqF4p2LE-TmIhrt-7bZhAPbDBCKZGR3msM90h1K2yLXNZ2XrQN4gVmz-HrgBkP-ctHoYOucqpXq04kcS-HTI_quT1WgMwAeO-hZrvfpVoHpFsWnlRbTuGEZubkYQL9fBxg"
id_token_decoded = decode_cognito_oauth_token_jwt(id_token)
print('ID_TOKEN_DECODED')
print(id_token_decoded)

access_token = "eyJraWQiOiJnK3RNYkRUZitORXI3aUNSb0NMUDNvNzNXTFZjaFwveFZ0XC90NmZOZkg3VWc9IiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiI3ZGNhOWI5Mi03NDZiLTQ0MDYtOWY3ZC0zZTU4Y2Q3YjI0N2YiLCJjb2duaXRvOmdyb3VwcyI6WyJ1cy1lYXN0LTFfaDZJNUlxUVNzX0dvb2dsZSJdLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV9oNkk1SXFRU3MiLCJ2ZXJzaW9uIjoyLCJjbGllbnRfaWQiOiI1ZDU4NnNlM3I5NzY0MzUxNjduazhrOHM0aCIsIm9yaWdpbl9qdGkiOiIwNGVlN2RjZi1hMmNhLTRkZjUtODc5MC02MDQ0NTY2MDlkNjkiLCJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIiwiYXV0aF90aW1lIjoxNjczOTEzMTkyLCJleHAiOjE2NzM5MTY3OTIsImlhdCI6MTY3MzkxMzE5MiwianRpIjoiNTg5ZmY4NTMtOGY4YS00ODFkLTk3YWQtMWVmOTY2NWE2MjVmIiwidXNlcm5hbWUiOiJnb29nbGVfMTE3MzAwMjA2MDEzMDA3Mzk4OTI0In0.r7dv1uHjIv4qso5O_0WfJs2VD-Ysf5yif2LVX3hbaZDDY0r5bWDR-sKYgcK7B6-QLRhWNnNXWBKIsibY2bBw3fDu-AHgdvV9yJliE6FJpIqwbwNrfi8w6DLz8h-r2VEldqpm0notRHYBIkKJWSufbSboI9eMnDYLphPVvxLq_oG-suK3sOWfrID7Ilctonvq6i1SMhJZqVL9Jas0FJM3gZPHqwIePfTqOxGiuCotwV8vwUYxsknhrFHIfZbdmJHmOPO-PwSjWgjVO3mYUgbBzsRpfzkxJL_Bo5KAn4kXRi3RdcqX0vqut0ddNG2SZRfiloVBVxDwkcNhmKvJREUJyQ"
# Set verify_signature to False no 'aud' field in the JWT; do not know why.
access_token_decoded = decode_cognito_oauth_token_jwt(access_token, verify_signature=False)
print('ACCESS_TOKEN_DECODED')
print(access_token_decoded)

refresh_token = "eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ.nYIF_3232ZFcfX9rgXp9K8RMxiT-PcgVQWKkyMMcRz-ggAq8uCGM2R5KEYedEdlhGtdCGPNXSTViIfMFpBcQl83Ik5rndrSZnjtzZJHYO4j2CMfDt6d9kuBoS4rDjPmce_cP4ui1uE5F5nI6BiZyJ8f6cKi4DUgfDFgRHUy97U7r59hw7krw_bY4vOZwqoh8vyVQCFVogetlWsbyx4ueUTo2mLK-6Ze5yQijxWt7XsEqEncPhiNA3rbCbWPmqHBL-pOD2fqjGmw2PMsvl4_wmC0RZpyYZkFxammLDT27w2hxXDnvSO73N028QJ3szuiOof4MaWZ4Wyt9GUtFZTXwuQ.Nw_EZ48uCyxmSxi3.MxUeWodSD6fjCGDCaZzu7XIlG_8KX3_p9mBhJZ_EHSkpioItR2j8tOdlG97dpyryg9M4a9UFqukUe29h9TUN7gL0xCjaLLgB84ho7Nvxchf3ncZTHLH85lgOetR-Zbtj7E9f3jKbn0zwjfCa1H6wKyEfDHJayEqpoPgej4z8tYGisCsDf0_yH290-tMsVKGJZNCb5RINwAuscjDB-x0jK1ZuVjW-CmrMKLxFE0qsQDn3nRSHe2uc70O0H-E6fwTCkMm_Yrrfbq9oU1KI9J28zKK8779Gh1yBDZZSKX-HrTAca0LczYQnAbHlAv8K822s2xK1lt6zK-y_sUnsIdO6bz1DH65e_J3EzQdJRJ_9Xb-KANAn8K7cIwzNF7rvUTMjk9Tv4SIRtBs-Gtkbzl8EOitIZxBNKv9yFQvWA-qIiHIgDivfCZbgw9tldtdHp4THmy4n-AC47LlQCYSojr_A2avcemfKhohmEPgPN8xRcEtXlTMoz7AFAMTeZO_zZ4q8kxLXd0mfN17ss7TxqLAtg4AB00tF6XpTnV1Ujvd-rRpmSmOjxKATpVipTtEk4Gomj00DhGcAnXiVLrOtPPVXGXB-kODHTZnZM2UzILb3cIxMMtAKkdl0LYT74w3szKqTfBOOVd9ZOTP8R0xbWl3XJLQmZKksQK0-liUF1jCcFO7xiSc5M7Fdo4tiXg4TfJxC7_LkfNg2FeWpHqPgtdhgSLLbry_B8dAqx5exQiK6C3me4ZtyBCMFKgRJchXmnf99g-sgtE79QgdhYhLGK65GjksN0SP3mnZSz3YRW6yV7CwD69J1VSnuSkt_KLrx8Mq2QjK1zIzCcJehO8VVVKuQ_2wro9EEKkj-9e3NP-qFBA2Uvapar_xbOvEkR4KtuMTznr4KWKkNqApnOYZx_uBEmzpoUpHkrpT1gDMLuSMIhrexP2mOfEULWCVbWZLGWDR9GWgMhw0k79Y6u3ujhHnS9DmN7aSfXrMMYvP24qgx4BY7y_4lAqXmeW5rzqTz9QABNEGjqspPm_ZtqdWmmZXFxaNwHJkw4pzwicR2IrPwRLHx18FANJplDnssLz_X--8y2Z5bLktuCemgv_hU7QfF3eCTpcqtaNYcCEcWF5r6Bn9srutPD5CBSF8pNOX05evjhwD6VdO3CCHYyF7Y4tHdSwyLMmmIXZLlJkzPsOIMVNIOQnC8deBlEriGp4jTogjeIvdmcRupDES0Q4L33Bo-OI6C.bDL05PXt-bjgHqicvuQq1A"
# jwt.exceptions.DecodeError: Invalid payload padding
#refresh_token_decoded = decode_cognito_oauth_token_jwt(refresh_token, verify_signature=False)
#print('REFRESH_TOKEN_DECODED')
#print(refresh_token_decoded)
