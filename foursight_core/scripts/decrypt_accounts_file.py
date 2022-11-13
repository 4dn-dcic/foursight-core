import io
from foursight_core.react.api.encryption import Encryption

ACCOUNTS_FILE = "foursight_core/accounts.json"
ENCODED_AUTH0_SECRET = "SYEDex90e1lwNZzq9D9PkGpo0xMTkxWgtjD6dIz_ty8YbzRWWK7lWMWeAAXmDSUh"
ENCRYPTION_PASSWORD = ENCODED_AUTH0_SECRET

def decrypt_accounts_file(accounts_file = ACCOUNTS_FILE):

    encryption = Encryption(ENCRYPTION_PASSWORD)

    with io.open(accounts_file) as accounts_f:
        accounts_content = accounts_f.read()
        if accounts_content.startswith("["):
            print(f"File seems to already be decrypted: {accounts_file}")
            exit(1)
        accounts_content_decrypted = encryption.decrypt(accounts_content)

    with io.open(accounts_file, "w") as accounts_f:
        accounts_f.write(accounts_content_decrypted)


def main():
    decrypt_accounts_file()


if __name__ == "__main__":
    main()
