import copy
import jwt as jwtlib
from typing import Optional


def jwt_encode(value: dict, audience: str, secret: str) -> str:
    """
    JWT signs and encodes the given (dictionary) value and returns its string.
    Uses the given audience (aka Auth0 client ID) and associated secret.
    If an error occurs and exception will be raised.
    """
    if not value:
        raise Exception("Attempt to encode JWT for empty value.")
    elif not isinstance(value, dict):
        raise Exception("Attempt to encode JWT for non-dictionary value.")
    if audience:
        # Note: if an audience (aud) is NOT present in the value to sign/encode then
        # jwtlib will raise: Exception decoding JWT - Token is missing the "aud" claim.
        value_aud = value.get("aud")
        if value_aud != audience:
            # If given an audience and it doesn't match the audience in
            # the given value then make a copy (we don't want to change
            # the given value out from under the caller) and update it.
            value = copy.deepcopy(value)
            value["aud"] = audience
    try:
        encoded_value = jwtlib.encode(value, secret, algorithm="HS256")
        if isinstance(encoded_value, bytes):
            # Depending on version jwtlib.encode returns bytes or string :-(
            encoded_value = encoded_value.decode("utf-8")
        return encoded_value
    except Exception as e:
        raise Exception(f"Exception signing/encoding JWT: {str(e)}")


def jwt_decode(jwt: str, audience: str, secret: str) -> dict:
    """
    Verifies the signature (importantly) and decodes the given signed and encoded
    JWT and returns its (dictionary) value. If cannot be successfully verified
    and/or decoded then an exception will be raised. Uses the given audience,
    aka "aud", aka Auth0 client ID, and the given associated secret to verify and
    decode. This must match the values specified when the JWT was signed/encoded.
    """
    try:
        # The leeway accounts for a bit of clock drift between us and Auth0.
        # This decoding WITH signature verification is very fast;
        # on my (dmichaels) MacBook it generally takes less than 0.04ms;
        # very good since we do this on every (protected) React API call.
        return jwtlib.decode(jwt, secret,
                                  audience=audience,
                                  leeway=30,
                                  options={"verify_signature": True},
                                  algorithms=["HS256"])
    except Exception as e:
        raise Exception(f"Exception verifying/decoding JWT: {str(e)}")
