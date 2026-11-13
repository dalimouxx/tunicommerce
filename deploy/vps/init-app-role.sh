#!/usr/bin/env bash
(set -euo pipefail
if [[ ! ${APP_DATABASE_PASSWORD:-} =~ ^[a-f0-9]{64}$ ]]; then
  echo 'APP_DATABASE_PASSWORD must contain exactly 64 lowercase hexadecimal characters.' >&2
  exit 1
fi
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\set ECHO none
\getenv app_password APP_DATABASE_PASSWORD
SELECT format('CREATE ROLE tunicom_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L', :'app_password') \gexec
REVOKE ALL ON DATABASE tunicom FROM PUBLIC;
GRANT CONNECT ON DATABASE tunicom TO tunicom_app;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO tunicom_app;
ALTER DEFAULT PRIVILEGES FOR ROLE tunicom_admin IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tunicom_app;
ALTER DEFAULT PRIVILEGES FOR ROLE tunicom_admin IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO tunicom_app;
SQL
)
