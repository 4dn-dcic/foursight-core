import mock
import pytest
import uuid
from foursight_core.react.api.jwt_utils import jwt_decode, jwt_encode

def test_jwt_basic():
    auth0_client_id = str(uuid.uuid4());
    auth0_secret = str(uuid.uuid4());
    jwt_plaintext = {"some-property": "some-value"}
    jwt = jwt_encode(jwt_plaintext, auth0_client_id, auth0_secret)
    jwt_decoded = jwt_decode(jwt, auth0_client_id, auth0_secret)
    assert jwt_decoded["some-property"] == jwt_plaintext["some-property"]
    assert jwt_decoded["aud"] == auth0_client_id
    assert jwt_decoded == {**jwt_plaintext, "aud": auth0_client_id}

def test_jwt_with_aud_property():
    auth0_client_id = str(uuid.uuid4());
    auth0_secret = str(uuid.uuid4());
    jwt_plaintext = {"some-property": "some-value", "aud": auth0_client_id}
    jwt = jwt_encode(jwt_plaintext, None, auth0_secret)
    jwt_decoded = jwt_decode(jwt, auth0_client_id, auth0_secret)
    assert jwt_decoded["some-property"] == jwt_plaintext["some-property"]
    assert jwt_decoded["aud"] == auth0_client_id
    assert jwt_decoded == {**jwt_plaintext, "aud": auth0_client_id}

def test_jwt_with_overidden_aud_property():
    auth0_client_id = str(uuid.uuid4());
    auth0_secret = str(uuid.uuid4());
    jwt_plaintext = {"some-property": "some-value", "aud": "should-be-overidden"}
    jwt = jwt_encode(jwt_plaintext, auth0_client_id, auth0_secret)
    jwt_decoded = jwt_decode(jwt, auth0_client_id, auth0_secret)
    assert jwt_decoded["some-property"] == jwt_plaintext["some-property"]
    assert jwt_decoded["aud"] == auth0_client_id
    assert jwt_decoded == {**jwt_plaintext, "aud": auth0_client_id}

def test_jwt_with_failures():
    auth0_client_id = str(uuid.uuid4());
    auth0_secret = str(uuid.uuid4());
    # Creating a JWT for an object with no "aud" property and without
    # passing an audience argument to jwt_encode raises an exception; need on of those.
    with pytest.raises(Exception):
        jwt_plaintext = {"some-property": "some-value"}
        jwt = jwt_encode(jwt_plaintext, None, auth0_secret)
    jwt_plaintext = {"some-property": "some-value", "aud": "should-be-overidden"}
    jwt = jwt_encode(jwt_plaintext, auth0_client_id, auth0_secret)
    # Decoding a JWT with the wrong secret (different
    # than the one it was created with), raises in exception.
    with pytest.raises(Exception):
        jwt_decoded = jwt_decode(jwt, auth0_client_id, "not-the-right-secret")
