# Deploying spark.fun to a test server

Verified on a Hostinger VPS running AlmaLinux with CyberPanel and
OpenLiteSpeed on 80/443. The stack runs in Docker on its own port and does not
touch the existing CyberPanel setup.

## Getting the code onto the server

**This repository is private.** An anonymous `curl` of a raw URL returns 404,
and so does an anonymous `git clone` — GitHub answers 404 rather than 403 for
private paths, which makes it look like a broken link.

So pass a token. Create one at **github.com/settings/tokens** with `repo`
scope (a fine-grained token with read access to this repository also works):

```bash
export GH_TOKEN=github_pat_...
git clone -b claude/sparkfun-design-system-89hs11 \
  "https://$GH_TOKEN@github.com/PSJR/MagWatchWeb-Project.git" /opt/sparkfun
cd /opt/sparkfun
less deploy/install.sh        # worth reading before running it as root
sudo bash deploy/install.sh
```

The installer also accepts the token directly, if you would rather it did the
clone:

```bash
GH_TOKEN=github_pat_... sudo -E bash deploy/install.sh
```

`sudo -E` matters — without it the token does not survive into the sudo
environment.

> Do not pipe this into `sudo bash` from a URL. It runs as root on your
> server; read it first. The convenience is not worth the habit.

## What the installer does

Before touching anything it checks free disk, checks that the port is free,
and — because the React build peaks at about **2 GB of RSS** — adds a 2 GB
swapfile when RAM plus swap is under 3 GB. On a 1 or 2 GB VPS with CyberPanel
already resident, the build is otherwise OOM-killed and Docker reports a bare
`exit 137`.

It detects the package manager (`dnf`, `yum` or `apt-get`), installs Docker if
missing, writes `deploy/.env` with a generated `SECRET_KEY`, builds the images
and starts three containers:

| service | what it is | published |
|---|---|---|
| `web` | the React build behind nginx, which also proxies `/api` | `:8080` |
| `api` | FastAPI + the chain indexer | internal only |
| `mongo` | MongoDB, on a named volume | internal only |

Then open `http://<your-server-ip>:8080`.

## Putting the domain in front of it

The app is on 8080 so it can coexist with CyberPanel. To serve it on
your domain over HTTPS, add a reverse proxy for it in
**CyberPanel → Websites → Manage → Rewrite Rules**:

```
RewriteEngine On
RewriteRule ^(.*)$ http://127.0.0.1:8080/$1 [P,L]
```

Or, in the vhost config (**Manage → vHost Conf**), a proper proxy is cleaner:

```
extprocessor sparkfun {
  type                    proxy
  address                 127.0.0.1:8080
  maxConns                100
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

context / {
  type                    proxy
  handler                 sparkfun
  addDefaultCharset       off
}
```

WebSockets matter here — the live feed uses one. OpenLiteSpeed's proxy
handles upgrades, but if the feed never connects, check that first: the app
still works without it, it just stops updating on its own.

Once the domain is fixed, tighten CORS in `deploy/.env`:

```
CORS_ORIGINS=https://your-domain.example
```

and re-run `sudo bash deploy/install.sh`.

## Configuring it

Edit `/opt/sparkfun/deploy/.env`, then re-run the installer. The frontend
reads its config **at build time** (Create React App inlines it), so changing
a `SPARK_*` value requires the rebuild that the installer does anyway.

The two values that matter:

- `SPARK_FACTORY_ADDRESS` — from `npm run deploy:mainnet`. Empty means the
  app runs read-only and says so on the Create page instead of pretending.
Nothing else is needed to connect a wallet: the app uses whatever wallet the
browser provides, and creates one in the browser for people who sign in with
an email.

Set `SPARK_DEPLOY_BLOCK` too, or the indexer scans from block 0 on a chain
that is already past 53 million.

## Checking it

```bash
curl -s localhost:8080/api/sf/chain | python3 -m json.tool
```

`indexer_running` and `indexed_block` tell you whether the chain is being
read. `deployed: false` means no factory is configured yet.

```bash
cd /opt/sparkfun
docker compose -f deploy/docker-compose.yml logs -f api      # follow the API
docker compose -f deploy/docker-compose.yml ps               # what is up
docker compose -f deploy/docker-compose.yml down             # stop
docker compose -f deploy/docker-compose.yml down -v          # stop and wipe the database
```

## What was verified before you run it

Built and booted here, not just written: both images build, nginx serves the
app and falls back to the SPA shell on deep links, `/api/*` proxies to the
API, hashed assets come back `immutable` and gzipped while `index.html` is
`no-store`, and MongoDB connects and creates its indexes.

Two bugs came out of actually running it rather than reading it:

- `requirements-local.txt` was missing `email-validator`. Pydantic's
  `EmailStr` resolves it lazily at model-build time, so grepping imports
  missed it and the API crashed on startup. It affected local development
  too, not just Docker.
- `COPY backend/ ./` baked `backend/.env` into the image — `SECRET_KEY`, the
  dev RPC and a stale factory address. python-dotenv then filled any variable
  compose had not set, so a development contract address silently won. Fixed
  by `.dockerignore`, and confirmed gone from the rebuilt image.

## Notes

- One uvicorn worker on purpose: the WebSocket fan-out is in-process. More
  workers need a Redis pub/sub behind the same interface first.
- No HTTPS inside the stack. Terminate TLS at CyberPanel, which already has
  a valid certificate for the domain.
- MongoDB is not published to the host and has no password. It is reachable
  only from the `api` container on the compose network. If you ever publish
  the port, add credentials first.
