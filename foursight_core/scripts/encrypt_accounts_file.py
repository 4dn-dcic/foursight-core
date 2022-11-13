import io
from foursight_core.react.api.encryption import Encryption

ACCOUNTS_FILE = "foursight_core/accounts.json"
ENCODED_AUTH0_SECRET = "SYEDex90e1lwNZzq9D9PkGpo0xMTkxWgtjD6dIz_ty8YbzRWWK7lWMWeAAXmDSUh"
ENCRYPTION_PASSWORD = ENCODED_AUTH0_SECRET

def encrypt_accounts_file(accounts_file = ACCOUNTS_FILE):

    encryption = Encryption(ENCRYPTION_PASSWORD)

    with io.open(accounts_file) as accounts_f:
        accounts_content = accounts_f.read()
        if not accounts_content.startswith("["):
            print(f"File seems to already be encrypted: {accounts_file}")
            exit(1)
        accounts_content_encrypted = encryption.encrypt(accounts_content)

    with io.open(accounts_file, "w") as accounts_f:
        accounts_f.write(accounts_content_encrypted)


def main():
    encrypt_accounts_file()


if __name__ == "__main__":
    main()
