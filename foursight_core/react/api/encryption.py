# Encryption utility class.

import os
from pyDes import triple_des
import uuid
from .encoding_utils import base64_decode_to_bytes, base64_encode, bytes_to_string

# TODO:
# Note that triple_des not secure really.
# Try (from Will): https://github.com/wbond/oscrypto (AES 256)
# Note however that we are NO LONGER USING THIS as we're using a
# JWT-signed-encodde authtoken rather than server-side encrypted.
class Encryption:

    def __init__(self, encryption_password = None):
        self.encryption_password = encryption_password

    # We use encryption for the React 'authToken' cookie, which is a JSON object containing
    # the JWT token in the 'jwtToken' field and a 'authEnvs' field which is the Base-64
    # encoded JSON list of names of allowed environments for the authenticated user.
    # The authToken JSON is encrypted and cookied at login/authorization;
    # and it is decrypted and checked on each protected API call.
    #
    # We are using pyDes for this, which is pure Python to avoid portability issues,
    # and is SUPER slow, but OK for now for our purposes of just decrypting the authToken
    # on each protected API call. I.e. it takes nearly 100ms to decrypt 500 characters!

    def get_encryption_password(self) -> str:
        if not self.encryption_password:
            encryption_password = os.environ.get("S3_AWS_SECRET_ACCESS_KEY")
            if not encryption_password:
                encryption_password = os.environ.get("ENCODED_AUTH0_SECRET")
                if not encryption_password:
                    #
                    # If we cannot find a password to use from the GAC we will
                    # use a random one (a UUID) which just means that when
                    # this server restarts (or this app reloads) it will
                    # not be able to decrypt any authTokens existing out
                    # there, meaning users will have to login again.
                    #
                    encryption_password = str(uuid.uuid4()).replace('-','')
            if not encryption_password:
                encryption_password = str(uuid.uuid4()).replace('-','')[0:24]
            elif len(encryption_password) < 24:
                encryption_password = encryption_password.ljust(24, 'x')
            elif len(encryption_password) > 24:
                encryption_password = encryption_password[0:24]
            self.encryption_password = encryption_password
        return self.encryption_password

    def encrypt(self, plaintext_value: str) -> str:
        try:
            if isinstance(plaintext_value, dict) or isinstance(plaintext_value, list):
                plaintext_value = json.dumps(plaintext_value)
            password = self.get_encryption_password()
            encryption = triple_des(password)
            encrypted_value_bytes = encryption.encrypt(plaintext_value, padmode=2)
            encoded_encrypted_value = base64_encode(encrypted_value_bytes)
            return encoded_encrypted_value
        except Exception as e:
            print('Encryption error: ' + str(e))
            return ""

    def decrypt(self, encrypted_value: str) -> str:
        try:
            password = self.get_encryption_password()
            encryption = triple_des(password)
            decoded_encrypted_value_bytes = base64_decode_to_bytes(encrypted_value)
            decrypted_value_bytes = encryption.decrypt(decoded_encrypted_value_bytes, padmode=2)
            decrypted_value = bytes_to_string(decrypted_value_bytes)
            return decrypted_value
        except Exception as e:
            print('Decryption error: ' + str(e))
            return ""
