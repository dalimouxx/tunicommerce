"""Public HTTPS checks from GitHub, independent of the VPS power/network."""
import json
import os
from pathlib import Path
import time

from common import atomic_json, health, telegram
from monitor import transition

STATE = Path(".test-runtime/vps-public-health.json")


def cycle(states, now, sites, send):
    updated = {}
    for name, url, expected in sites:
        state, event = transition(states.get(name, {}), health(url, expected), now)
        if event:
            label = {"incident": "ALERTE", "reminder": "RAPPEL", "recovered": "RETABLI"}[event]
            if send("CONTROLE EXTERNE | " + label + " | " + name + " : HTTPS / base de donnees"):
                state.update(announced=event != "recovered", sent_at=now)
        updated[name] = state
    return updated


def main():
    if os.environ.get("GITHUB_REPOSITORY") != "dalimouxx/tunicommerce" or os.environ.get("GITHUB_REF") != "refs/heads/main":
        return 1
    sites = []
    if os.environ.get("MONITOR_TUNICOM") == "true":
        sites.append(("Tunicom", "https://tunicom.shop/api/health", {"server": "ok", "database": "ok"}))
    if os.environ.get("MONITOR_FIXI") == "true":
        sites.append(("Fixi", "https://fixiphone.io/api/health", None))
    if not sites:
        print("No public site enabled; no request sent.")
        return 0
    states = {}
    try:
        if STATE.exists() and STATE.stat().st_size <= 65536:
            states = json.loads(STATE.read_text())
            if not isinstance(states, dict):
                states = {}
    except (ValueError, OSError):
        pass
    delivery_failed = False

    def send(message):
        nonlocal delivery_failed
        ok = telegram(os.environ.get("TELEGRAM_BOT_TOKEN", ""), os.environ.get("TELEGRAM_CHAT_ID", ""), message)
        delivery_failed = delivery_failed or not ok
        return ok

    atomic_json(STATE, cycle(states, int(time.time()), sites, send))
    if delivery_failed:
        print("::warning::External health notification not delivered; will retry on next scheduled check.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
