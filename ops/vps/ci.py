"""GitHub-hosted coordinator. Only trusted main push events receive VPS secrets."""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.request

from common import telegram

REPO = "dalimouxx/tunicommerce"
REQUIRED = ("ci.yml", "vps-containers.yml", "vps-operations.yml")


def api(path):
    request = urllib.request.Request("https://api.github.com/repos/" + REPO + "/" + path,
        headers={"Authorization": "Bearer " + os.environ["GH_TOKEN"],
                 "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def tested(sha):
    for attempt in range(60):
        pending = False
        for workflow in REQUIRED:
            runs = api("actions/workflows/" + workflow + "/runs?event=push&branch=main&head_sha=" + sha + "&per_page=20")["workflow_runs"]
            matching = [run for run in runs if run["head_sha"] == sha and run["head_branch"] == "main"
                        and run["repository"]["full_name"] == REPO and run["event"] == "push"]
            if not matching:
                pending = True
                continue
            run = max(matching, key=lambda item: (item["run_number"], item.get("run_attempt", 1)))
            if run["status"] != "completed":
                pending = True
            elif run["conclusion"] != "success":
                return False
        if not pending:
            return True
        time.sleep(10)
    return False


def notify(status, sha, run_id):
    labels = {"deployed": "Tunicom : deploiement reussi, sante verifiee",
              "failed": "Tunicom : deploiement automatique en echec, verifier le journal GitHub",
              "checks_failed": "Tunicom : tests non valides, deploiement bloque"}
    message = labels[status] + "\nCommit " + sha[:12] + "\nhttps://github.com/" + REPO + "/actions/runs/" + run_id
    if not telegram(os.environ.get("TELEGRAM_BOT_TOKEN", ""), os.environ.get("TELEGRAM_CHAT_ID", ""), message):
        print("::warning::Telegram notification could not be delivered. Check bot secrets and chat permissions.")


def main():
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    run_id = os.environ["GITHUB_RUN_ID"]
    if os.environ.get("GITHUB_REPOSITORY") != REPO or not re.fullmatch(r"[0-9]{1,20}", run_id):
        return 1
    if os.environ.get("GITHUB_EVENT_NAME") == "workflow_run":
        run = event["workflow_run"]
        if (run["event"] != "push" or run["head_branch"] != "main" or
                run["head_repository"]["full_name"] != REPO):
            return 1
        sha = run["head_sha"]
    else:
        if os.environ.get("GITHUB_REF") != "refs/heads/main":
            return 1
        sha = os.environ["GITHUB_SHA"]
    if not re.fullmatch(r"[a-f0-9]{40}", sha):
        return 1
    status = "failed"
    try:
        if api("git/ref/heads/main")["object"]["sha"] != sha:
            print("Superseded commit: no deployment.")
            return 0
        if not tested(sha):
            status = "checks_failed"
            return 1
        host = os.environ["VPS_HOST"]
        port = os.environ.get("VPS_PORT") or "22"
        if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}", host) or not port.isdigit() or not 1 <= int(port) <= 65535:
            raise ValueError("invalid_ssh_target")
        with tempfile.TemporaryDirectory() as directory:
            key, known = Path(directory) / "key", Path(directory) / "known_hosts"
            key.write_text(os.environ["VPS_SSH_PRIVATE_KEY"] + "\n")
            known.write_text(os.environ["VPS_SSH_KNOWN_HOSTS"] + "\n")
            key.chmod(0o600)
            known.chmod(0o600)
            result = subprocess.run(["ssh", "-T", "-i", str(key), "-p", port,
                "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes",
                "-o", "UserKnownHostsFile=" + str(known), "-o", "ConnectTimeout=15",
                "-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=4", "tunicom-deploy@" + host],
                input=json.dumps({"sha": sha, "run_id": run_id}).encode(),
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=3000)
            if len(result.stdout) > 4096:
                raise ValueError("invalid_deployment_response")
            response = json.loads(result.stdout)
            if result.returncode != 0 or response.get("status") not in ("deployed", "already_current", "superseded"):
                raise ValueError("deployment_failed")
            status = response["status"]
            print("Deployment result: " + status)
            return 0
    except Exception:
        # Do not emit SSH stderr, credentials, HTTP exception URLs or app logs.
        print("::error::Automatic deployment failed. Inspect the private VPS progress marker.")
        return 1
    finally:
        if status in ("deployed", "failed", "checks_failed"):
            notify(status, sha, run_id)


if __name__ == "__main__":
    raise SystemExit(main())
