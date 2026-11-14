#!/bin/sh
# Run locally in the trusted Hostinger root console, after reviewing this release.
# This installs operations only: no application restart, proxy edit or timer start.
set -eu
test "$(id -u)" = 0 || { echo 'Root console required.' >&2; exit 1; }
test "$#" = 1 || { echo 'Usage: sh install.sh /root/tunicom-deploy.pub' >&2; exit 1; }
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
public_key=$(cat -- "$1")
printf '%s\n' "$public_key" | grep -Eq '^ssh-ed25519 [A-Za-z0-9+/=]+( .*)?$' || {
  echo 'A dedicated Ed25519 public key is required.' >&2; exit 1;
}
test "$(printf '%s\n' "$public_key" | wc -l)" -eq 1 || exit 1
command -v python3 >/dev/null
command -v docker >/dev/null
command -v visudo >/dev/null
if id tunicom-deploy >/dev/null 2>&1; then
  test "$(getent passwd tunicom-deploy | cut -d: -f6)" = /var/lib/tunicom-ssh || {
    echo 'Existing account requires operator review.' >&2; exit 1;
  }
  if id -nG tunicom-deploy | tr ' ' '\n' | grep -Eq '^(docker|sudo|adm|lxd)$'; then
    echo 'Deployment account must not have privileged groups.' >&2; exit 1
  fi
else
  useradd --system --home-dir /var/lib/tunicom-ssh --shell /bin/sh tunicom-deploy
fi
install -d -o root -g root -m 0755 /opt/tunicom-ops /var/lib/tunicom-ssh /var/lib/tunicom-ssh/.ssh
install -d -o root -g root -m 0700 /etc/tunicom /etc/platforms /var/lib/tunicom-deploy /var/lib/platforms-monitor /var/backups/tunicom
for file in common.py deploy.py ci.py monitor.py backup.py bootstrap.py telegram_test.py; do
  install -o root -g root -m 0644 "$source_dir/$file" "/opt/tunicom-ops/$file"
done
cat > /usr/local/sbin/tunicom-deploy <<'WRAPPER'
#!/bin/sh
test "$#" = 0 || exit 2
exec /usr/bin/env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/root PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 /opt/tunicom-ops/deploy.py
WRAPPER
chown root:root /usr/local/sbin/tunicom-deploy
chmod 0755 /usr/local/sbin/tunicom-deploy
printf 'tunicom-deploy ALL=(root) NOPASSWD: /usr/local/sbin/tunicom-deploy ""\n' > /etc/sudoers.d/tunicom-deploy
chmod 0440 /etc/sudoers.d/tunicom-deploy
visudo -cf /etc/sudoers.d/tunicom-deploy >/dev/null
printf 'restrict,command="sudo -n /usr/local/sbin/tunicom-deploy" %s\n' "$public_key" > /var/lib/tunicom-ssh/.ssh/authorized_keys
chown root:root /var/lib/tunicom-ssh/.ssh/authorized_keys
chmod 0644 /var/lib/tunicom-ssh/.ssh/authorized_keys
for unit in platforms-monitor.service platforms-monitor.timer tunicom-backup.service tunicom-backup.timer; do
  install -o root -g root -m 0644 "$source_dir/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload
echo 'Operations installed. Timers and GitHub deployment remain disabled until configured.'
