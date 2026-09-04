#!/usr/bin/env bash
#
# spark.fun — one-shot setup on a fresh Ubuntu/Debian server.
# Idempotent: safe to re-run to redeploy.
#
#   curl -fsSL <raw-url>/deploy/install.sh | bash
# or, after cloning:
#   sudo bash deploy/install.sh
#
# It installs Docker if missing, writes deploy/.env on the first run, builds
# the images and starts the stack. It does not touch anything already
# listening on 80/443.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/PSJR/MagWatchWeb-Project.git}"
BRANCH="${BRANCH:-claude/sparkfun-design-system-89hs11}"
APP_DIR="${APP_DIR:-/opt/sparkfun}"
WEB_PORT="${WEB_PORT:-8080}"

log()  { printf '\n\033[1;33m==>\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31mx\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Run as root (or with sudo)."

log "Installing prerequisites"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates >/dev/null

if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker"
  curl -fsSL https://get.docker.com | sh
else
  log "Docker already present: $(docker --version)"
fi

docker compose version >/dev/null 2>&1 || fail "docker compose v2 is required."

log "Fetching the code into $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
else
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

if [ ! -f deploy/.env ]; then
  log "Writing deploy/.env"
  cp deploy/.env.example deploy/.env
  # A generated secret beats a placeholder someone forgets to change.
  SECRET="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  sed -i "s|^SECRET_KEY=.*|SECRET_KEY=$SECRET|" deploy/.env
  sed -i "s|^WEB_PORT=.*|WEB_PORT=$WEB_PORT|" deploy/.env
  echo "    a SECRET_KEY was generated for you"
  echo "    set SPARK_FACTORY_ADDRESS and WALLETCONNECT_PROJECT_ID when you have them"
else
  log "Keeping the existing deploy/.env"
fi

log "Building and starting (first build takes a few minutes)"
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build

log "Waiting for the API"
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${WEB_PORT}/api/sf/chain" >/dev/null 2>&1; then
    break
  fi
  sleep 2
  [ "$i" -eq 60 ] && fail "API did not come up. Check: docker compose -f deploy/docker-compose.yml logs api"
done

echo
docker compose -f deploy/docker-compose.yml ps
echo
log "Up on http://$(hostname -I 2>/dev/null | awk '{print $1}'):${WEB_PORT}"
echo "   chain status: curl -s localhost:${WEB_PORT}/api/sf/chain | python3 -m json.tool"
echo "   logs:         docker compose -f deploy/docker-compose.yml logs -f"
echo "   redeploy:     sudo bash deploy/install.sh"
echo
echo "To serve it on the domain over HTTPS, add a reverse proxy in CyberPanel"
echo "for srv1505182.hstgr.cloud pointing at 127.0.0.1:${WEB_PORT} — see deploy/README.md."
