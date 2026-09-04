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

# ---------------------------------------------------------------------------
# Preflight. The React build peaks at ~2 GB RSS (measured, not guessed) and
# CyberPanel is already holding memory here. Without swap the build is
# OOM-killed halfway and Docker reports a bare exit 137.
# ---------------------------------------------------------------------------
log "Preflight"

MEM_KB=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
SWAP_KB=$(awk '/SwapTotal/ {print $2}' /proc/meminfo)
TOTAL_MB=$(( (MEM_KB + SWAP_KB) / 1024 ))
DISK_MB=$(df -Pm /var/lib 2>/dev/null | awk 'NR==2 {print $4}')
echo "    RAM+swap: ${TOTAL_MB} MB    free disk: ${DISK_MB:-?} MB"

if [ "${DISK_MB:-0}" -lt 6000 ]; then
  fail "About 6 GB free is needed for the images and the build; found ${DISK_MB} MB."
fi

if [ "$TOTAL_MB" -lt 3000 ]; then
  if [ -f /swapfile ]; then
    log "Enabling the existing /swapfile"
    swapon /swapfile 2>/dev/null || true
  else
    log "Only ${TOTAL_MB} MB of RAM+swap — adding a 2 GB swapfile"
    fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "    swap added, and made permanent in /etc/fstab"
  fi
  NEW_MB=$(( ( $(awk '/MemTotal/ {print $2}' /proc/meminfo) + $(awk '/SwapTotal/ {print $2}' /proc/meminfo) ) / 1024 ))
  [ "$NEW_MB" -lt 2600 ] && fail "Still only ${NEW_MB} MB of RAM+swap. Build the images on a bigger machine and push them instead."
fi

if command -v ss >/dev/null 2>&1 && ss -ltn "( sport = :$WEB_PORT )" 2>/dev/null | grep -q LISTEN; then
  fail "Port $WEB_PORT is already in use. Re-run with: WEB_PORT=8081 sudo -E bash deploy/install.sh"
fi

# ---------------------------------------------------------------------------
# Packages. Hostinger's CyberPanel image is AlmaLinux, so dnf — but Ubuntu
# CyberPanel installs exist too, and assuming apt-get made this script fail on
# the very server it was written for.
# ---------------------------------------------------------------------------
log "Installing prerequisites"
if command -v dnf >/dev/null 2>&1; then
  dnf install -y -q git curl ca-certificates >/dev/null
elif command -v yum >/dev/null 2>&1; then
  yum install -y -q git curl ca-certificates >/dev/null
elif command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq git curl ca-certificates >/dev/null
else
  fail "No supported package manager found (looked for dnf, yum, apt-get)."
fi

if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker"
  curl -fsSL https://get.docker.com | sh
else
  log "Docker already present: $(docker --version)"
fi

docker compose version >/dev/null 2>&1 || fail "docker compose v2 is required."

# ---------------------------------------------------------------------------
# The code. The repository is private, so an anonymous clone gets a 404 — the
# same 404 that a raw.githubusercontent.com URL returns. Either run this from
# an existing checkout, or pass a token:
#
#   GH_TOKEN=ghp_... sudo -E bash deploy/install.sh
# ---------------------------------------------------------------------------
if [ -f "$(dirname "$0")/docker-compose.yml" ]; then
  APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
  log "Using the checkout this script came from: $APP_DIR"
elif [ -d "$APP_DIR/.git" ]; then
  log "Updating $APP_DIR"
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
elif [ -n "${GH_TOKEN:-}" ]; then
  log "Cloning into $APP_DIR with the supplied token"
  git clone --depth 1 --branch "$BRANCH" \
    "https://${GH_TOKEN}@github.com/PSJR/MagWatchWeb-Project.git" "$APP_DIR"
else
  fail "No checkout found and no GH_TOKEN set. The repository is private, so:
    GH_TOKEN=<token> sudo -E bash deploy/install.sh
  or clone it yourself first and run this script from inside the clone."
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

log "Building and starting (the first build takes a few minutes)"
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build || {
  echo
  echo "A web build that dies with exit 137 ran out of memory. Check: free -h"
  exit 1
}

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
