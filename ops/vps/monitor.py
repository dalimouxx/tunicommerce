"""One-shot common VPS monitor; run every minute via the supplied systemd timer."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time

from common import atomic_json, health, private_json, telegram

STATE = Path("/var/lib/platforms-monitor/state.json")
DEPLOY = Path("/var/lib/tunicom-deploy")


def transition(previous, healthy, now):
    """Two consecutive observations; failed delivery is retried on the next cycle."""
    state = dict(previous)
    state["good"] = min(2, state.get("good", 0) + 1) if healthy else 0
    state["bad"] = min(2, state.get("bad", 0) + 1) if not healthy else 0
    announced = state.get("announced", False)
    event = None
    if state["bad"] == 2:
        if not announced:
            event = "incident"
        elif now - state.get("sent_at", 0) >= 3600:
            event = "reminder"
    elif state["good"] == 2 and announced:
        event = "recovered"
    return state, event


def observations(config, now):
    checks = {}
    for site in config.get("sites", []):
        name = site["name"]
        if not re.fullmatch(r"[A-Za-z0-9 -]{1,40}", name):
            raise ValueError("invalid_site_name")
        if not site.get("enabled", False):
            continue
        if not re.fullmatch(r"https://[a-z0-9.-]+/api/health", site["url"]):
            raise ValueError("invalid_health_url")
        checks[name + " : disponibilite"] = health(site["url"], site.get("expected"))
    usage = shutil.disk_usage("/")
    checks["VPS : espace disque"] = usage.free >= max(8 * 1024**3, usage.total * 0.1)
    for name in config.get("containers", []):
        if not re.fullmatch(r"(?:fixi|tunicom-production|platforms-edge|studyinworld-production)-[a-z0-9-]{1,50}", name):
            raise ValueError("invalid_container_name")
        try:
            result = subprocess.run(["docker", "inspect", "--format",
                                     "{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{end}}", name],
                                    capture_output=True, timeout=10, check=True)
            checks[name + " : conteneur"] = result.stdout.strip() in (b"running/healthy", b"running/")
        except Exception:
            checks[name + " : conteneur"] = False
    if config.get("tunicom_deploy", False):
        try:
            progress = private_json(DEPLOY / "progress.json")
            checks["Tunicom : deploiement"] = progress["phase"] in (
                "deployed", "already_current", "superseded", "bootstrapped") or (
                progress["phase"] != "failed" and now - progress["at"] < 3600)
        except Exception:
            checks["Tunicom : deploiement"] = False
    if config.get("tunicom_backup", False):
        try:
            backup = private_json(DEPLOY / "backup.json")
            checks["Tunicom : sauvegarde locale"] = backup["ok"] is True and 0 <= now - backup["at"] < 30 * 3600
        except Exception:
            checks["Tunicom : sauvegarde locale"] = False
    return checks


def cycle(config, states, now, send):
    updated = {}
    labels = {"incident": "ALERTE", "reminder": "RAPPEL", "recovered": "RETABLI"}
    for name, healthy in observations(config, now).items():
        state, event = transition(states.get(name, {}), healthy, now)
        if event and send(labels[event] + " | " + name):
            state["announced"] = event != "recovered"
            state["sent_at"] = now
        updated[name] = state
    return updated


def main():
    import fcntl
    if os.geteuid() != 0:
        return 2
    os.umask(0o077)
    STATE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (STATE.parent / "lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 0
        try:
            config = private_json("/etc/platforms/monitor.json")
            secret = Path("/etc/platforms/telegram.json")
            if secret.stat().st_mode & 0o077:
                return 1
            credentials = private_json(secret)
            states = private_json(STATE) if STATE.exists() else {}
            updated = cycle(config, states, int(time.time()),
                            lambda message: telegram(credentials["token"], credentials["chat_id"], message))
            atomic_json(STATE, updated)
            return 0
        except Exception:
            # No raw exception output: it could include configuration or tokens.
            print("monitor_configuration_or_execution_failed")
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
