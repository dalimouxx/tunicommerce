#!/bin/sh
# Integration test in a disposable container: no host users or sudoers changed.
set -eu
workspace=$(mktemp -d)
container="tunicom-ssh-test-$$"
image="tunicom-ssh-test:$$"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker image rm "$image" >/dev/null 2>&1 || true
  # Only delete the exact mktemp directory created by this process.
  case "$workspace" in /tmp/tmp.*) rm -rf -- "$workspace" ;; esac
}
trap cleanup EXIT INT TERM
ssh-keygen -q -t ed25519 -N '' -f "$workspace/key"
cp -R ops/vps "$workspace/ops"
cp "$workspace/key.pub" "$workspace/ops/test.pub"
cat > "$workspace/Dockerfile" <<'DOCKERFILE'
FROM ubuntu:24.04
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends python3 sudo openssh-server && rm -rf /var/lib/apt/lists/*
COPY ops /src
# Installer dependencies only; never start Docker or systemd in this test container.
RUN printf '#!/bin/sh\nexit 0\n' > /usr/local/bin/docker && cp /usr/local/bin/docker /usr/local/bin/systemctl && chmod 755 /usr/local/bin/docker /usr/local/bin/systemctl && sh /src/install.sh /src/test.pub && mkdir -p /run/sshd && ssh-keygen -A
CMD ["/usr/sbin/sshd", "-D", "-e"]
DOCKERFILE
docker build -q -t "$image" "$workspace" > /dev/null
docker run -d --rm --name "$container" -p 127.0.0.1::22 "$image" > /dev/null
port=$(docker inspect --format '{{(index (index .NetworkSettings.Ports "22/tcp") 0).HostPort}}' "$container")
printf '[127.0.0.1]:%s ' "$port" > "$workspace/known_hosts"
docker exec "$container" cat /etc/ssh/ssh_host_ed25519_key.pub >> "$workspace/known_hosts"
ssh_test() {
  ssh -T -p "$port" -i "$workspace/key" -o BatchMode=yes -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$workspace/known_hosts" \
    -o ConnectTimeout=5 -o ConnectionAttempts=3 tunicom-deploy@127.0.0.1 "$@"
}
sleep 1
set +e
printf '{}\n' | ssh_test 'touch /tmp/escaped-command' > "$workspace/result" 2> "$workspace/error"
status=$?
set -e
test "$status" -eq 1 || { echo 'Restricted SSH login failed integration check.' >&2; cat "$workspace/error" >&2; exit 1; }
python3 -c 'import json,sys; assert json.load(open(sys.argv[1])) == {"status":"failed","code":"invalid_request"}' "$workspace/result"
docker exec "$container" test ! -e /tmp/escaped-command
if docker exec --user tunicom-deploy "$container" sudo -n id >/dev/null 2>&1; then
  echo 'Unexpected general sudo permission.' >&2; exit 1
fi
if docker exec --user tunicom-deploy "$container" sudo -n /usr/local/sbin/tunicom-deploy extra >/dev/null 2>&1; then
  echo 'Unexpected permission to pass controller arguments.' >&2; exit 1
fi
# Run ssh directly because timeout cannot invoke a shell function.
set +e
timeout 15 ssh -N -p "$port" -i "$workspace/key" -o BatchMode=yes -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$workspace/known_hosts" \
  -o ExitOnForwardFailure=yes -R 0:127.0.0.1:22 tunicom-deploy@127.0.0.1 \
  > "$workspace/forward-output" 2> "$workspace/forward-error"
status=$?
set -e
test "$status" -eq 255
grep -q 'remote port forwarding failed' "$workspace/forward-error"
echo 'SSH boundary verified: forced command, exact sudo allowlist, no arbitrary command or forwarding.'
