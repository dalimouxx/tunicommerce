"""Root-owned controller, invoked through a forced SSH command, never a shell.

Compose infrastructure is pinned by the operator. Only two image references vary.
Initial provisioning, schema restore and proxy changes are deliberately manual.
"""
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import time

from common import OperationError, atomic_json, health, private_json

ROOT = Path("/srv/platforms/tunicom")
STATE = Path("/var/lib/tunicom-deploy")
CONFIG = Path("/etc/tunicom/deploy.json")
REMOTE = "https://github.com/dalimouxx/tunicommerce.git"
ENV = {"PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
       "HOME": "/root", "DOCKER_HOST": "unix:///var/run/docker.sock",
       "GIT_TERMINAL_PROMPT": "0"}


def payload(data):
    if len(data) > 1024:
        raise OperationError("invalid_request")
    try:
        value = json.loads(data)
        if (set(value) != {"sha", "run_id"} or
                not isinstance(value["sha"], str) or
                not re.fullmatch(r"[0-9a-f]{40}", value["sha"]) or
                not isinstance(value["run_id"], str) or
                not re.fullmatch(r"[0-9]{1,20}", value["run_id"])):
            raise ValueError()
        return value
    except (ValueError, TypeError, KeyError):
        raise OperationError("invalid_request") from None


def execute(args, timeout=300, capture=False, output=None):
    try:
        result = subprocess.run(args, env=ENV, stdin=subprocess.DEVNULL,
                                stdout=output if output is not None else
                                (subprocess.PIPE if capture else subprocess.DEVNULL),
                                stderr=subprocess.DEVNULL, timeout=timeout, check=True)
        return result.stdout.decode().strip() if capture else None
    except (subprocess.SubprocessError, OSError):
        raise OperationError("command_failed") from None


def checked_config():
    config = private_json(CONFIG)
    if set(config) != {"base_compose", "network_compose", "health_url"}:
        raise OperationError("invalid_configuration")
    base = Path(config["base_compose"]).resolve(strict=True)
    network = Path(config["network_compose"]).resolve(strict=True)
    if (not base.is_relative_to(ROOT / "releases") or base.name != "compose.yaml" or
            network != ROOT / "compose.shared-edge.yaml" or
            config["health_url"] != "https://tunicom.shop/api/health"):
        raise OperationError("invalid_configuration")
    # These files and every ancestor must remain root-controlled.
    for path in (base, network, Path("/etc/tunicom/platform.env")):
        for entry in [path, *path.parents]:
            stat = entry.stat()
            if stat.st_uid != 0 or stat.st_mode & 0o022:
                raise OperationError("unsafe_configuration_permissions")
    if Path("/etc/tunicom/platform.env").stat().st_mode & 0o077:
        raise OperationError("unsafe_secret_permissions")
    return config


class Deployment:
    def __init__(self, config, request):
        self.config, self.request = config, request
        self.phase = "preflight"
        self.stopped = False
        self.migration_started = False
        self.active = STATE / "images.json"
        self.pending = STATE / "pending-images.json"

    def mark(self, phase):
        self.phase = phase
        atomic_json(STATE / "progress.json", {"phase": phase, "at": int(time.time()),
                    "sha": self.request["sha"], "run_id": self.request["run_id"]})

    def compose(self, *args, pending=False, **kwargs):
        return execute(["docker", "compose", "--project-name", "tunicom-production",
                        "--env-file", "/etc/tunicom/platform.env",
                        "-f", self.config["base_compose"],
                        "-f", self.config["network_compose"],
                        "-f", str(self.pending if pending else self.active), *args], **kwargs)

    def start(self, pending=False):
        self.compose("up", "-d", "--no-deps", "--no-build", "--wait", "--wait-timeout", "180",
                     "web", "worker", pending=pending, timeout=240)

    def healthy(self):
        for service in ("db", "web", "worker"):
            container = self.compose("ps", "-q", service, capture=True)
            if not re.fullmatch(r"[0-9a-f]{12,64}", container or ""):
                return False
            status = execute(["docker", "inspect", "--format",
                              "{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{end}}",
                              container], capture=True)
            if status != "running/healthy":
                return False
        return health(self.config["health_url"], {"server": "ok", "database": "ok"})

    def backup(self):
        """DB-backed media only; no silent partial backup for filesystem media."""
        configuration = json.loads(self.compose("config", "--format", "json", capture=True))
        if configuration["services"]["web"]["environment"].get("MEDIA_STORAGE_MODE") != "database":
            raise OperationError("filesystem_media_backup_required")
        size = int(self.compose("exec", "-T", "db", "psql", "-U", "tunicom_admin", "-d", "tunicom",
                               "-Atc", "SELECT pg_database_size(current_database())", capture=True))
        folder = Path("/var/backups/tunicom")
        folder.mkdir(mode=0o700, parents=True, exist_ok=True)
        if shutil.disk_usage(folder).free < size * 2 + 4 * 1024**3:
            raise OperationError("insufficient_backup_space")
        name = str(int(time.time())) + "-" + self.request["run_id"] + ".dump"
        temporary = folder / (name + ".partial")
        # pg_dump --file on host is impossible; stream directly into a private file.
        # RLIMIT_FSIZE bounds an unexpectedly expanding database during the dump.
        import resource
        previous_limit = resource.getrlimit(resource.RLIMIT_FSIZE)
        limit = min(previous_limit[1], size * 2 + 1024**3) if previous_limit[1] != resource.RLIM_INFINITY else size * 2 + 1024**3
        try:
            resource.setrlimit(resource.RLIMIT_FSIZE, (limit, previous_limit[1]))
            with temporary.open("xb") as stream:
                os.chmod(temporary, 0o600)
                self.compose("exec", "-T", "db", "pg_dump", "-U", "tunicom_admin", "-d", "tunicom",
                             "-Fc", "--no-owner", "--no-acl", output=stream, timeout=900)
                stream.flush()
                os.fsync(stream.fileno())
            # Validate the archive using PostgreSQL 18 tools in the existing DB container.
            with temporary.open("rb") as stream:
                args = ["docker", "compose", "--project-name", "tunicom-production",
                        "--env-file", "/etc/tunicom/platform.env", "-f", self.config["base_compose"],
                        "-f", self.config["network_compose"], "-f", str(self.active),
                        "exec", "-T", "db", "pg_restore", "--list"]
                subprocess.run(args, env=ENV, stdin=stream, stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL, timeout=120, check=True)
            temporary.replace(folder / name)
            atomic_json(STATE / "backup.json", {"ok": True, "at": int(time.time())})
        except Exception:
            atomic_json(STATE / "backup.json", {"ok": False, "at": int(time.time())})
            raise OperationError("backup_failed") from None
        finally:
            resource.setrlimit(resource.RLIMIT_FSIZE, previous_limit)
            temporary.unlink(missing_ok=True)

    def run(self):
        previous = private_json(STATE / "current.json")
        if not self.active.exists() or not re.fullmatch(r"[a-f0-9]{40}", previous.get("sha", "")):
            raise OperationError("initial_installation_required")
        if shutil.disk_usage(ROOT).free < 8 * 1024**3:
            raise OperationError("insufficient_build_space")
        memory = Path("/proc/meminfo")
        if memory.exists():
            available = re.search(r"^MemAvailable:\s+(\d+) kB$", memory.read_text(), re.MULTILINE)
            if not available or int(available[1]) < 3 * 1024**2:
                raise OperationError("insufficient_build_memory")
        mirror = ROOT / "source.git"
        if not mirror.exists():
            execute(["git", "init", "--bare", str(mirror)])
        git = ["git", "--git-dir=" + str(mirror), "-c", "core.hooksPath=/dev/null"]
        self.mark("fetch")
        execute([*git, "fetch", "--depth=1", REMOTE, "refs/heads/main"], timeout=180)
        if execute([*git, "rev-parse", "FETCH_HEAD"], capture=True) != self.request["sha"]:
            return {"status": "superseded"}
        if previous["sha"] == self.request["sha"]:
            if not self.healthy():
                raise OperationError("current_release_unhealthy")
            return {"status": "already_current"}
        if not self.healthy():
            raise OperationError("initial_health_failed")
        release = ROOT / "releases" / self.request["sha"]
        if release.exists():
            # Retry only a clean checkout of the exact requested revision.
            if (execute(["git", "-C", str(release), "rev-parse", "HEAD"], capture=True) != self.request["sha"] or
                    execute(["git", "-C", str(release), "status", "--porcelain"], capture=True)):
                raise OperationError("release_directory_not_clean")
        else:
            execute([*git, "worktree", "add", "--detach", str(release), self.request["sha"]])
        tag = "deploy-" + self.request["sha"]
        self.mark("build")
        for target, image in (("runtime", "tunicom-runtime"), ("migrator", "tunicom-migrator")):
            execute(["docker", "build", "--pull", "--target", target,
                     "--label", "org.opencontainers.image.revision=" + self.request["sha"],
                     "-t", image + ":" + tag, str(release)], timeout=1200)
        # A newer commit arriving during the build must not be replaced by this one.
        execute([*git, "fetch", "--depth=1", REMOTE, "refs/heads/main"], timeout=180)
        if execute([*git, "rev-parse", "FETCH_HEAD"], capture=True) != self.request["sha"]:
            return {"status": "superseded"}
        atomic_json(self.pending, image_override(tag))
        self.mark("maintenance")
        self.stopped = True
        self.compose("stop", "worker", "web", timeout=180)
        self.mark("backup")
        self.backup()
        self.mark("migrate")
        self.migration_started = True
        self.compose("up", "--no-deps", "--no-build", "--force-recreate", "--abort-on-container-exit",
                     "--exit-code-from", "migrate", "migrate", pending=True, timeout=600)
        self.mark("start")
        self.start(pending=True)
        self.mark("health")
        if not self.healthy():
            raise OperationError("release_health_failed")
        os.replace(self.pending, self.active)
        atomic_json(STATE / "current.json", {"sha": self.request["sha"], "at": int(time.time())})
        return {"status": "deployed"}

    def recover_before_migration(self):
        if self.stopped and not self.migration_started:
            self.start()


def image_override(tag):
    if not re.fullmatch(r"(?:deploy-[a-f0-9]{40}|[a-f0-9]{12,40})", tag):
        raise OperationError("invalid_image_tag")
    return {"services": {service: {"image": image + ":" + tag, "user": "1000:1000"}
                         for service, image in (("web", "tunicom-runtime"), ("worker", "tunicom-runtime"),
                                                ("migrate", "tunicom-migrator"))}}


def main():
    import fcntl
    if os.geteuid() != 0 or len(sys.argv) != 1:
        return 2
    os.umask(0o077)
    signal.signal(signal.SIGHUP, signal.SIG_IGN)
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (STATE / "lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('{"status":"failed","code":"deployment_locked"}')
            return 1
        deployment = None
        try:
            request = payload(sys.stdin.buffer.read(1025))
            deployment = Deployment(checked_config(), request)
            result = deployment.run()
            deployment.mark(result["status"])
        except Exception as error:
            result = {"status": "failed", "code": str(error) if isinstance(error, OperationError) else "operation_failed"}
            if deployment:
                result["phase"] = deployment.phase
                try:
                    deployment.recover_before_migration()
                except Exception:
                    result["recovery"] = "manual_intervention_required"
                if deployment.migration_started:
                    result["recovery"] = "manual_intervention_required"
                deployment.mark("failed")
        print(json.dumps(result))
        return int(result["status"] == "failed")


if __name__ == "__main__":
    sys.exit(main())
