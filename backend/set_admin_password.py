import getpass
import hashlib
import secrets


ITERATIONS = 600_000


def main() -> None:
    password = getpass.getpass("New Admin password: ")
    confirmation = getpass.getpass("Confirm Admin password: ")
    if not password or password != confirmation:
        raise SystemExit("Passwords must be non-empty and match.")

    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    print(
        "PAIMANA_ADMIN_PASSWORD_HASH="
        f"pbkdf2_sha256${ITERATIONS}${salt.hex()}${digest.hex()}"
    )


if __name__ == "__main__":
    main()
