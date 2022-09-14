import os
import base64
import uuid
from pyDes import triple_des

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

    def get_encryption_password(self):
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
            password = self.get_encryption_password()
            encryption = triple_des(password)
            encrypted_value_bytes = encryption.encrypt(plaintext_value, padmode=2)
            encoded_encrypted_value = self.encode(encrypted_value_bytes)
            return encoded_encrypted_value
        except Exception as e:
            print('xyzzy:foursight_core.Encryption.encrypt:error')
            print(e)
            return ""

    def decrypt(self, encrypted_value: str) -> str:
        try:
            password = self.get_encryption_password()
            encryption = triple_des(password)
            decoded_encrypted_value_bytes = self.decode_to_bytes(encrypted_value)
            print('xyzzy')
            decrypted_value_bytes = encryption.decrypt(decoded_encrypted_value_bytes, padmode=2)
            decrypted_value = self.bytes_to_string(decrypted_value_bytes)
            return decrypted_value
        except Exception as e:
            print('xyzzy:foursight_core.Encryption.decryp:error')
            print(e)
            return ""

    def encode(self, s: str) -> str:
        return self.encode_to_bytes(s).decode("utf-8")

    def decode(self, s: str) -> str:
        return self.decode_to_bytes(s).decode("utf-8")

    def encode_to_bytes(self, string_or_bytes) -> bytes:
        if isinstance(string_or_bytes, str):
            return base64.b64encode(self.string_to_bytes(string_or_bytes))
        elif isinstance(string_or_bytes, bytes):
            return base64.b64encode(string_or_bytes)
        else:
            return bytes("", "utf-8")

    def decode_to_bytes(self, string_or_bytes) -> bytes:
        if isinstance(string_or_bytes, str):
            return base64.b64decode(self.string_to_bytes(string_or_bytes))
        elif isinstance(string_or_bytes, bytes):
            return base64.b64decode(string_or_bytes)
        else:
            return bytes("", "utf-8")

    def string_to_bytes(self, value: str) -> bytes:
        return value.encode("utf-8") if isinstance(value, str) else "".encode("utf-8")

    def bytes_to_string(self, value: bytes) -> str:
        return value.decode("utf-8") if isinstance(value, bytes) else ""

