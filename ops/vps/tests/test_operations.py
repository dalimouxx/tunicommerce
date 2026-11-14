import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ci
import common
import deploy
import monitor

SHA = "a" * 40
OLD = "b" * 40
TOKEN = "12345:" + "secret" * 6


class RequestTests(unittest.TestCase):
    def test_only_exact_revision_and_numeric_run_are_accepted(self):
        self.assertEqual(deploy.payload(json.dumps({"sha": SHA, "run_id": "123"})), {"sha": SHA, "run_id": "123"})
        invalid = [None, [], {}, {"sha": SHA, "run_id": "1", "command": "id"},
                   {"sha": "main;id", "run_id": "1"}, {"sha": SHA, "run_id": 1},
                   {"sha": SHA, "run_id": "$(id)"}, {"sha": 7, "run_id": "1"}]
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(common.OperationError):
                deploy.payload(json.dumps(value))
        with self.assertRaises(common.OperationError):
            deploy.payload("x" * 1025)

    def test_image_changes_are_limited_to_tunicom_services(self):
        override = deploy.image_override("deploy-" + SHA)
        self.assertEqual(set(override["services"]), {"web", "worker", "migrate"})
        for service in override["services"].values():
            self.assertEqual(service["user"], "1000:1000")
            self.assertEqual(set(service), {"image", "user"})
        for tag in ("latest", "../../fixi", "x;id"):
            with self.assertRaises(common.OperationError):
                deploy.image_override(tag)


class TelegramTests(unittest.TestCase):
    def test_delivery_requires_telegram_acknowledgement(self):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = b'{"ok":true}'
        with patch("urllib.request.urlopen", return_value=response) as send:
            self.assertTrue(common.telegram(TOKEN, "-123", "ALERTE | Tunicom"))
            request = send.call_args.args[0]
            self.assertEqual(json.loads(request.data)["text"], "ALERTE | Tunicom")
            self.assertNotIn("parse_mode", json.loads(request.data))
            response.read.return_value = b'{"ok":false}'
            self.assertFalse(common.telegram(TOKEN, "-123", "x"))

    def test_errors_never_print_token_urls(self):
        output = io.StringIO()
        with patch("urllib.request.urlopen", side_effect=RuntimeError(TOKEN)), contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            self.assertFalse(common.telegram(TOKEN, "123", "x"))
        self.assertEqual(output.getvalue(), "")

    def test_invalid_credentials_do_not_attempt_network(self):
        with patch("urllib.request.urlopen") as send:
            self.assertFalse(common.telegram("missing", "123", "x"))
            self.assertFalse(common.telegram(TOKEN, "@unknown", "x"))
            send.assert_not_called()

    def test_health_checks_database_and_rejects_wrong_payload(self):
        response = Mock(status=200)
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        opener = Mock()
        opener.open.return_value = response
        with patch("urllib.request.build_opener", return_value=opener):
            for body, expected in ((b'{"server":"ok","database":"ok"}', True),
                                   (b'{"server":"ok","database":"unavailable"}', False),
                                   (b'<html>login</html>', False), (b'x' * 16385, False)):
                response.read.return_value = body
                self.assertEqual(common.health("https://tunicom.shop/api/health", {"server": "ok", "database": "ok"}), expected)


class IncidentTests(unittest.TestCase):
    def test_two_failures_and_two_successes_with_hourly_reminders(self):
        state, event = monitor.transition({}, False, 100)
        self.assertIsNone(event)
        state, event = monitor.transition(state, False, 160)
        self.assertEqual(event, "incident")
        state.update(announced=True, sent_at=160)
        state, event = monitor.transition(state, False, 200)
        self.assertIsNone(event)
        state, event = monitor.transition(state, False, 3760)
        self.assertEqual(event, "reminder")
        state, event = monitor.transition(state, True, 3800)
        self.assertIsNone(event)
        state, event = monitor.transition(state, True, 3860)
        self.assertEqual(event, "recovered")

    def test_failed_delivery_retries_and_does_not_create_false_recovery(self):
        config = {}
        send = Mock(return_value=False)
        with patch.object(monitor, "observations", return_value={"Tunicom": False}):
            state = monitor.cycle(config, {}, 100, send)
            state = monitor.cycle(config, state, 160, send)
            state = monitor.cycle(config, state, 220, send)
        self.assertEqual(send.call_count, 2)
        self.assertNotIn("announced", state["Tunicom"])
        send.reset_mock()
        with patch.object(monitor, "observations", return_value={"Tunicom": True}):
            state = monitor.cycle(config, state, 280, send)
            monitor.cycle(config, state, 340, send)
        send.assert_not_called()

    def test_missing_and_failed_backups_are_incidents(self):
        with patch.object(monitor, "private_json", side_effect=FileNotFoundError()):
            checks = monitor.observations({"tunicom_backup": True}, 100)
        self.assertFalse(checks["Tunicom : sauvegarde locale"])
        for backup in ({"ok": False, "at": 100}, {"ok": True, "at": 0}):
            with patch.object(monitor, "private_json", return_value=backup):
                self.assertFalse(monitor.observations({"tunicom_backup": True}, 200000)["Tunicom : sauvegarde locale"])

    def test_disabled_domains_are_never_probed(self):
        with patch.object(monitor, "health") as probe:
            monitor.observations({"sites": [{"name": "Studyinworld", "enabled": False}]}, 100)
            probe.assert_not_called()


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.state = self.root / "state"
        self.state.mkdir()
        common.atomic_json(self.state / "current.json", {"sha": OLD})
        common.atomic_json(self.state / "images.json", deploy.image_override(OLD[:12]))
        self.addCleanup(patch.stopall)
        patch.object(deploy, "ROOT", self.root).start()
        patch.object(deploy, "STATE", self.state).start()
        patch.object(deploy.shutil, "disk_usage", return_value=Mock(free=100 * 1024**3)).start()
        self.commands = []
        self.refs = [SHA, SHA]
        def execute(args, **kwargs):
            self.commands.append(args)
            if "rev-parse" in args:
                return self.refs.pop(0)
            return ""
        patch.object(deploy, "execute", side_effect=execute).start()
        self.deployment = deploy.Deployment({"base_compose": "/reviewed/compose.yaml", "network_compose": "/reviewed/network.yaml", "health_url": "https://tunicom.shop/api/health"}, {"sha": SHA, "run_id": "123"})
        self.backup = patch.object(self.deployment, "backup").start()
        self.healthy = patch.object(self.deployment, "healthy", return_value=True).start()

    def test_success_builds_before_stopping_and_never_restarts_database_or_proxy(self):
        self.assertEqual(self.deployment.run(), {"status": "deployed"})
        stop = next(i for i, args in enumerate(self.commands) if "stop" in args)
        builds = [i for i, args in enumerate(self.commands) if args[:2] == ["docker", "build"]]
        self.assertEqual(len(builds), 2)
        self.assertLess(max(builds), stop)
        mutations = [args for args in self.commands if "compose" in args and ("up" in args or "stop" in args)]
        self.assertEqual(len(mutations), 3)
        for args in mutations:
            self.assertEqual(args[args.index("--project-name") + 1], "tunicom-production")
            self.assertNotIn("db", args)
            self.assertNotIn("edge", args)
            self.assertNotIn("--build", args)
        self.assertEqual(json.loads((self.state / "current.json").read_text())["sha"], SHA)
        self.backup.assert_called_once()

    def test_newer_commit_during_build_is_never_replaced(self):
        self.refs = [SHA, "c" * 40]
        self.assertEqual(self.deployment.run(), {"status": "superseded"})
        self.assertFalse(any("stop" in args for args in self.commands))
        self.backup.assert_not_called()

    def test_backup_failure_prevents_migration_and_restarts_previous_images(self):
        self.backup.side_effect = common.OperationError("backup_failed")
        with self.assertRaises(common.OperationError):
            self.deployment.run()
        self.deployment.recover_before_migration()
        self.assertFalse(self.deployment.migration_started)
        self.assertFalse(any("--exit-code-from" in args for args in self.commands))
        self.assertEqual(self.commands[-1][-2:], ["web", "worker"])
        self.assertIn(str(self.state / "images.json"), self.commands[-1])

    def test_post_migration_failure_never_reverts_database_or_images(self):
        self.healthy.side_effect = [True, False]
        with self.assertRaisesRegex(common.OperationError, "release_health_failed"):
            self.deployment.run()
        count = len(self.commands)
        self.deployment.recover_before_migration()
        self.assertEqual(len(self.commands), count)
        self.assertTrue(self.deployment.migration_started)
        self.assertEqual(json.loads((self.state / "current.json").read_text())["sha"], OLD)

    def test_unhealthy_initial_installation_is_not_mutated(self):
        self.healthy.return_value = False
        with self.assertRaisesRegex(common.OperationError, "initial_health_failed"):
            self.deployment.run()
        self.assertFalse(any("build" in args or "stop" in args for args in self.commands))

    def test_noop_requires_real_health(self):
        common.atomic_json(self.state / "current.json", {"sha": SHA})
        self.healthy.return_value = False
        with self.assertRaisesRegex(common.OperationError, "current_release_unhealthy"):
            self.deployment.run()


class CoordinationTests(unittest.TestCase):
    def test_all_checks_must_pass_for_same_commit(self):
        def response(path):
            return {"workflow_runs": [{"head_sha": SHA, "head_branch": "main", "event": "push",
                "repository": {"full_name": ci.REPO}, "status": "completed", "conclusion": "failure" if "vps-containers" in path else "success",
                "run_number": 1}]}
        with patch.object(ci, "api", side_effect=response):
            self.assertFalse(ci.tested(SHA))

    def test_pull_request_or_other_revision_is_never_a_passing_check(self):
        run = {"head_sha": OLD, "head_branch": "main", "event": "pull_request", "repository": {"full_name": ci.REPO}}
        with patch.object(ci, "api", return_value={"workflow_runs": [run]}), patch.object(ci.time, "sleep"):
            self.assertFalse(ci.tested(SHA))

    def test_ssh_uses_host_verification_and_no_remote_command(self):
        with tempfile.TemporaryDirectory() as directory:
            event = Path(directory) / "event.json"
            event.write_text("{}")
            env = {"GITHUB_EVENT_PATH": str(event), "GITHUB_RUN_ID": "123", "GITHUB_REPOSITORY": ci.REPO,
                   "GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_REF": "refs/heads/main", "GITHUB_SHA": SHA,
                   "VPS_HOST": "187.126.31.110", "VPS_SSH_PRIVATE_KEY": "fake-key", "VPS_SSH_KNOWN_HOSTS": "fake-host"}
            with patch.dict(os.environ, env), patch.object(ci, "api", return_value={"object": {"sha": SHA}}), patch.object(ci, "tested", return_value=True), patch.object(ci, "notify") as notify, patch.object(ci.subprocess, "run", return_value=Mock(returncode=0, stdout=b'{"status":"deployed"}')) as ssh:
                self.assertEqual(ci.main(), 0)
                args = ssh.call_args.args[0]
                self.assertIn("StrictHostKeyChecking=yes", args)
                self.assertEqual(args[-1], "tunicom-deploy@187.126.31.110")
                self.assertEqual(json.loads(ssh.call_args.kwargs["input"]), {"sha": SHA, "run_id": "123"})
                notify.assert_called_once_with("deployed", SHA, "123")


if __name__ == "__main__":
    unittest.main()
