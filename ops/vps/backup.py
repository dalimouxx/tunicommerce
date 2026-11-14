"""Daily local DB backup. Shares the deployment lock; never stops the application."""
import os
import time

from common import atomic_json
from deploy import Deployment, STATE, checked_config


def main():
    import fcntl
    if os.geteuid() != 0:
        return 2
    os.umask(0o077)
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (STATE / "lock").open("a") as lock:
        # Skip an overlapping deployment; its own pre-migration backup takes over.
        # A backup older than 30h is independently reported by the monitor.
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 0
        try:
            deployment = Deployment(checked_config(), {"run_id": "0", "sha": "0" * 40})
            deployment.backup()
            return 0
        except Exception:
            atomic_json(STATE / "backup.json", {"ok": False, "at": int(time.time())})
            print("local_backup_failed")
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
