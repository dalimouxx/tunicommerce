"""Operator-only enrollment of an already healthy initial installation."""
import os
from pathlib import Path
import re
import sys
import time

from common import atomic_json
from deploy import Deployment, STATE, checked_config, execute, image_override


def main():
    import fcntl
    if os.geteuid() != 0 or len(sys.argv) != 3:
        print("Usage (root): python3 bootstrap.py INITIAL_COMMIT INITIAL_IMAGE_TAG")
        return 2
    sha, tag = sys.argv[1:]
    if not re.fullmatch(r"[a-f0-9]{40}", sha):
        return 2
    override = image_override(tag)
    os.umask(0o077)
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (STATE / "lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if (STATE / "current.json").exists() or (STATE / "images.json").exists():
            print("Already enrolled; operator review required.")
            return 1
        config = checked_config()
        revision = execute(["git", "-C", str(Path(config["base_compose"]).parent),
                            "rev-parse", "HEAD"], capture=True)
        if revision != sha:
            return 1
        atomic_json(STATE / "images.json", override)
        enrolled = False
        try:
            deployment = Deployment(config, {"sha": sha, "run_id": "0"})
            if not deployment.healthy():
                return 1
            for service in ("web", "worker"):
                container = deployment.compose("ps", "-q", service, capture=True)
                actual = execute(["docker", "inspect", "--format", "{{.Config.Image}}", container], capture=True)
                if actual != override["services"][service]["image"]:
                    return 1
            atomic_json(STATE / "current.json", {"sha": sha, "at": int(time.time())})
            deployment.mark("bootstrapped")
            enrolled = True
            print("Existing healthy installation enrolled. No service changed.")
            return 0
        finally:
            if not enrolled:
                (STATE / "images.json").unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        print("Bootstrap failed. No application service changed.")
        raise SystemExit(1)
