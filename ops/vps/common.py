"""VPS operations helpers. No application/customer data is sent to Telegram."""
import json
import os
from pathlib import Path
import re
import tempfile
import urllib.request


class OperationError(Exception):
    """Only fixed, non-secret error codes may cross the SSH boundary."""


def private_json(path):
    path = Path(path)
    stat = path.stat()
    if os.name == "posix" and (stat.st_uid != 0 or stat.st_mode & 0o022):
        raise OperationError("unsafe_configuration_permissions")
    return json.loads(path.read_text(encoding="utf-8"))


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=".pending-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def telegram(token, chat_id, message):
    if not re.fullmatch(r"[0-9]+:[A-Za-z0-9_-]{20,}", token or ""):
        return False
    if not re.fullmatch(r"-?[0-9]+", str(chat_id)):
        return False
    payload = json.dumps({"chat_id": str(chat_id), "text": message[:3500],
                          "disable_web_page_preview": True}).encode()
    request = urllib.request.Request(
        "https://api.telegram.org/bot" + token + "/sendMessage",
        data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            data = response.read(16385)
            return len(data) <= 16384 and json.loads(data).get("ok") is True
    except Exception:
        # Exception messages can contain the token-bearing URL. Never log them.
        return False


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def health(url, expected=None):
    try:
        opener = urllib.request.build_opener(NoRedirect)
        with opener.open(urllib.request.Request(url, headers={"User-Agent": "Tunicom-VPS-health"}),
                         timeout=8) as response:
            data = response.read(16385)
            if response.status != 200 or len(data) > 16384:
                return False
            if expected is not None:
                body = json.loads(data)
                return isinstance(body, dict) and all(body.get(k) == v for k, v in expected.items())
            return True
    except Exception:
        return False
