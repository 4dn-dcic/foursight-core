import copy
import jwt as jwtlib
from dcicutils.misc_utils import get_error_message

JWT_AUDIENCE_PROPERTY_NAME = "aud"
JWT_SUBJECT_PROPERTY_NAME = "sub"


def jwt_encode(value: dict, audience: str, secret: str) -> str:
    """
    JWT signs and encodes the given (dictionary) value and returns its string.
    Uses the given audience (aka Auth0 client ID) and associated secret for signing.
    If the given value does NOT already have an "aud" property, then we add it,
    setting it to the given audience value; or if it is present and a non-empty
    audience is given then it is used as the "aud" property. If no "aud" property
    is present and no audience is given, or ie any other error occurs, then an
    exception will be raised.

    Note that strictly speaking, a JWT may be created (signed/encoded) WITHOUT
    an "aud" property, but an exception will be raised when attempting
    to verify/decode such a JWT; so best to disallow that case here.
    The exception we'd get verifying/decoding such a JWT looks like this FYI:
    Exception verifying/decoding JWT: Token is missing the "aud" claim
    """
    if not value:
        raise ValueError("Attempt to encode JWT for empty value.")
    elif not isinstance(value, dict):
        raise ValueError("Attempt to encode JWT for non-dictionary value.")
    if audience:
        # Note: if an audience (aud) is NOT present in the value to sign/encode then
        # jwtlib will raise: Exception decoding JWT - Token is missing the "aud" claim.
        value_aud = value.get(JWT_AUDIENCE_PROPERTY_NAME)
        if value_aud != audience:
            # If given an audience, and it doesn't match the audience in
            # the given value, then make a copy (as we don't want to change
            # the given value out from under the caller), and update it.
            value = copy.deepcopy(value)
            value[JWT_AUDIENCE_PROPERTY_NAME] = audience
    if not value.get(JWT_AUDIENCE_PROPERTY_NAME):
        raise Exception("Cannot encode object as JWT without an 'aud' property")
    try:
        encoded_value = jwtlib.encode(value, secret, algorithm="HS256")
        if isinstance(encoded_value, bytes):
            # Depending on version jwtlib.encode returns bytes or string :-(
            encoded_value = encoded_value.decode("utf-8")
        return encoded_value
    except Exception as e:
        raise Exception(f"Exception signing/encoding JWT: {get_error_message(e)}")


def jwt_decode(jwt: str, audience: str, secret: str) -> dict:
    """
    Verifies (importantly) the signature and decodes the given signed and encoded
    JWT and returns its (dictionary) value. If it cannot be successfully verified
    and/or decoded then an exception will be raised. Uses the given audience,
    aka "aud", aka Auth0 client ID, and the given associated secret to verify and
    decode. This must match the values specified when the JWT was signed/encoded.
    """
    try:
        # The leeway accounts for a bit of clock drift between us and Auth0.
        # This decoding WITH signature verification is very fast;
        # on my (dmichaels) MacBook it generally takes less than 0.04ms;
        # very good since we do this on every (protected) React API call.
        kwargs = {"leeway": 30, "options": {"verify_signature": True}, "algorithms": ["HS256"]}
        return jwtlib.decode(jwt, secret, audience=audience, **kwargs)
    except Exception as e:
        raise Exception(f"Exception verifying/decoding JWT: {get_error_message(e)}")
