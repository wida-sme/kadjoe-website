#!/usr/bin/env bash
# Runs ON THE SERVER, as the finance app's deploy user. Called by .github/workflows/deploy.yml over SSH after it
# has loaded the image (`docker load`) and copied this folder's files to /srv/kadjoe/site/; also usable by hand
# with an image already on the server (rollback):
#
#   bash /srv/kadjoe/site/deploy.sh kadjoe-site:<git sha>
#
# Touches only the website: SITE_IMAGE in the shared .env, the `site` container and a Caddy reload.
set -euo pipefail

STACK="${KADJOE_STACK:-/srv/kadjoe}"
IMAGE="${1:?usage: deploy.sh kadjoe-site:<git sha>}"
# Tags kept on the server for a rollback, the running one included.
KEEP=3
log() { echo "[deploy-site] $*"; }

# Short tags too: a rollback may go back to an image built by hand (kadjoe-site:<short sha>).
[[ "$IMAGE" =~ ^kadjoe-site:[0-9a-f]{7,40}$ ]] || { log "refusing image '$IMAGE' (expected kadjoe-site:<git sha>)"; exit 1; }
docker image inspect "$IMAGE" >/dev/null 2>&1 || { log "image $IMAGE is not on this server (the workflow loads it first)"; exit 1; }
cd "$STACK"
[ -f .env ] || { log "no $STACK/.env"; exit 1; }
# Without the overlay in COMPOSE_FILE there is no `site` service, and the finance deploy's --remove-orphans
# would delete the container again.
grep -q '^COMPOSE_FILE=.*site/compose.site.yml' .env || { log "COMPOSE_FILE in .env lacks site/compose.site.yml (README, Deploy)"; exit 1; }

SITE_DOMAIN=$(sed -n 's/^SITE_DOMAIN=//p' .env | tail -1)
PREVIOUS=$(sed -n 's/^SITE_IMAGE=//p' .env | tail -1)
log "previous: ${PREVIOUS:-<none>}"
log "new:      $IMAGE"

# The new image migrates site.db on start; the old image may not read the new schema. Copy the database
# first, through the running container (it has better-sqlite3 and can read /data).
if [ -n "$(docker compose ps -q site 2>/dev/null)" ]; then
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  docker compose exec -T site node -e "
    const fs = require('node:fs'); fs.mkdirSync('/data/backups', { recursive: true });
    require('better-sqlite3')('/data/site.db', { readonly: true }).backup('/data/backups/pre-deploy-$stamp.db')
      .then(() => console.log('copied site.db'), (e) => { console.error(e); process.exit(1); });"
  docker compose exec -T site find /data/backups -name 'pre-deploy-*.db' -mtime +30 -delete
  log "database copy: /data/backups/pre-deploy-$stamp.db"
else
  log "no running site container: no database copy (first deploy)"
fi

cp .env ".env.bak-site-$(date -u +%Y%m%dT%H%M%SZ)"
if grep -q '^SITE_IMAGE=' .env; then
  sed -i "s|^SITE_IMAGE=.*|SITE_IMAGE=$IMAGE|" .env
else
  echo "SITE_IMAGE=$IMAGE" >>.env
fi
grep -q "^SITE_IMAGE=$IMAGE$" .env || { log "SITE_IMAGE not set in .env"; exit 1; }
# --no-deps: Caddy depends on the finance app, which this deploy must never recreate. Caddy itself is
# recreated only when the overlay's part of it changed.
docker compose up -d --no-deps caddy site
# Picks up a changed Caddyfile.site (the workflow writes it in place, so the bind mount sees it).
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

# The site migrates, then starts; give it up to ~3 minutes. The container's own healthcheck decides, so a
# deploy before SITE_DOMAIN's DNS points here (the first one) still passes; the public address is reported.
for _ in $(seq 1 60); do
  health=$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q site)" 2>/dev/null || true)
  if [ "$health" = healthy ]; then
    if body=$(curl -fsS --max-time 5 "https://$SITE_DOMAIN/api/health" 2>/dev/null) && grep -q '"ok":true' <<<"$body"; then
      log "health: container healthy, https://$SITE_DOMAIN: $body"
    else
      log "WARNING: container healthy, but https://$SITE_DOMAIN/api/health did not answer ok (DNS not here yet?)"
    fi
    docker image ls kadjoe-site --format '{{.CreatedAt}}\t{{.Repository}}:{{.Tag}}' | sort -r | cut -f2 \
      | grep -vxF "$IMAGE" | grep -vxF "${PREVIOUS:-none}" | tail -n +"$((KEEP - 1))" | xargs -r docker image rm >/dev/null || true
    find . -maxdepth 1 -name '.env.bak-site-*' -mtime +30 -delete
    exit 0
  fi
  sleep 3
done

log "health check failed; container: ${health:-<none>}"
docker compose logs --tail 80 site || true
log "rollback by hand: bash $STACK/site/deploy.sh ${PREVIOUS:-<previous tag>}; if a migration ran, restore the pre-deploy copy first"
exit 1
