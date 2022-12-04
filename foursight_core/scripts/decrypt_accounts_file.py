import io
import sys
from foursight_core.react.api.encryption import Encryption

ACCOUNTS_FILE = "foursight_core/accounts.json"


def decrypt_accounts_file(accounts_file = ACCOUNTS_FILE, password = None):

    encryption = Encryption(password)

    with io.open(accounts_file) as accounts_f:
        accounts_content = accounts_f.read()
        if accounts_file.endswith("accounts.json") and accounts_content.startswith("["):
            print(f"File seems to already be decrypted: {accounts_file}")
            exit(1)
        accounts_content_decrypted = encryption.decrypt(accounts_content)

    with io.open(accounts_file, "w") as accounts_f:
        accounts_f.write(accounts_content_decrypted)


def main(args: list = None):
    # TODO: Use argsparse library.
    if not args:
        args = sys.argv
    file = ACCOUNTS_FILE
    password = None
    for i in range(len(args)): 
        arg = args[i]
        if arg == "--password":
            i += 1
            if i >= len(args):
                usage()
            password = args[i]
        elif arg == "--file":
            i += 1
            if i >= len(args):
                usage()
            file = args[i]
    if not password:
        usage()
    decrypt_accounts_file(file, password)
    return 0


def usage():
    print("decrypt-accounts-file --password password [--file file]")
    exit(1)


if __name__ == "__main__":
    main()
