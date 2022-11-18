# Encryption utility class.
# --------------------------------------------------------------------------------------------------
# N.B. RESURRECTING this (used before we went to JWT-signed authtoken) perhaps TEMPORARILY for
# the /accounts page functionality, where we have an account.json file, and want to check it
# in for availability, but don't want it be plaintext as it has URLs internal to Harvard.
# If this goes beyond the experimental phase will need to sort this out. dmichaels/2022-11-12.
# --------------------------------------------------------------------------------------------------

import json
import os
from pyDes import triple_des
from typing import Optional, Union
from .encoding_utils import base64_decode_to_bytes, base64_encode_to_bytes, bytes_to_string


# Encryption utility class, to encrypt/decrypt with given password.
# If no password given then we use the value of CLIENT_SECRET environment
# variable which should be ENCODED_AUTH0_SECRET from the GAC.
#
# We are using pyDes for this, which is pure Python to avoid portability issues,
# and is SUPER slow, but OK for now for our purposes of just decrypting the authToken
# on each protected API call. I.e. it takes nearly 100ms to decrypt 500 characters!
#
# TODO
# From Will: Note that triple_des is not really all that secure.
# Try maybe this: https://github.com/wbond/oscrypto (AES 256)
class Encryption:

    def __init__(self, password: Optional[str] = None) -> None:
        """
        Initializes this Encryption object with the given (optional) password.
        If no password this will use the value of CLIENT_SECRET environment
        variable which should be ENCODED_AUTH0_SECRET from the GAC.
        """
        if not password:
            password = os.environ.get("CLIENT_SECRET", None)
            if not password:
                password = os.environ.get("ENCODED_AUTH0_SECRET", None)
                if not password:
                    raise Exception(f"Encryption error: No password found for the Encryption class.")
        # Encryption password must be of length 8, 16, or 24.
        if len(password) < 24:
            password = password.ljust(24, '_')
        elif len(password) > 24:
            password = password[0:24]
        self._encryptor = triple_des(password)

    def encrypt(self, plaintext_value: Union[str, dict, list]) -> str:
        """
        Encrypts the given plaintext value using the password specified
        at class construction time, and returns the encrypted value as a string.
        The given value may be a string, a dictionary, or a list; if either of
        the latter two then first stringizes that value using json.dumps.
        Raises an Exception on error.
        """
        try:
            if isinstance(plaintext_value, dict) or isinstance(plaintext_value, list):
                plaintext_value = json.dumps(plaintext_value)
            return bytes_to_string(base64_encode_to_bytes(self._encryptor.encrypt(plaintext_value, padmode=2)))
        except Exception as e:
            raise Exception(f"Encryption error: {str(e)}")

    def decrypt(self, encrypted_value: str) -> str:
        """
        Decrypts the given encrypted string value (assumed to have been returned be
        the above encrypt method) using the password specified at class construction
        time, and returns the decrypted value as a string.
        Raises an Exception on error.
        """
        try:
            return bytes_to_string(self._encryptor.decrypt(base64_decode_to_bytes(encrypted_value), padmode=2))
        except Exception as e:
            raise Exception(f"Decryption error: {str(e)}")
