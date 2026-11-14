"""Send an explicitly requested, fixed test message using the private VPS secret."""
import os
from pathlib import Path

from common import private_json, telegram


def main():
    if os.geteuid() != 0:
        return 2
    try:
        path = Path("/etc/platforms/telegram.json")
        if path.stat().st_mode & 0o077:
            return 1
        secret = private_json(path)
        ok = telegram(secret["token"], secret["chat_id"], "Tunicom | Test des notifications VPS reussi.")
        print("Test Telegram : " + ("envoye" if ok else "echec, verifier le bot et la conversation"))
        return 0 if ok else 1
    except Exception:
        print("Test Telegram : configuration privee invalide")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
