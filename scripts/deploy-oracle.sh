#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${GITHUB_WORKSPACE:?GitHub Actions workspace is required}"
: "${GITHUB_SHA:?GitHub commit SHA is required}"
: "${GITHUB_RUN_ID:?GitHub run ID is required}"

service_file="/home/opc/.config/systemd/user/realtrading.service"
env_file="/home/opc/.config/realtrading/realtrading.env"
new_image="localhost/realtrading:candidate-${GITHUB_SHA}"
production_image="localhost/realtrading:production"
backup_image="localhost/realtrading:rollback"
runtime_dir="/run/user/$(id -u)"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-$runtime_dir}"

[[ -f "$service_file" ]] || { echo "Missing service unit: $service_file" >&2; exit 1; }
[[ -r "$env_file" ]] || { echo "Production env file is missing or unreadable: $env_file" >&2; exit 1; }
grep -Fq -- "--env-file $env_file" "$service_file" || {
  echo "Service unit does not reference the protected external env file; refusing deployment." >&2
  exit 1
}

if podman exec realtrading node -e '
const mysql = require("mysql2/promise");
(async () => {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await connection.query(
    "SELECT (SELECT COUNT(*) FROM bot_settings WHERE liveEnabled = 1) AS liveMarkets, " +
    "(SELECT COUNT(*) FROM positions WHERE status IN (?, ?, ?)) AS activePositions",
    ["pending", "open", "closing"]
  );
  await connection.end();
  const state = rows[0];
  console.log("Deployment preflight — live markets:", Number(state.liveMarkets),
    "active positions:", Number(state.activePositions));
  if (Number(state.liveMarkets) > 0 || Number(state.activePositions) > 0) {
    console.error("Deployment skipped: live trading is armed or a position is active.");
    process.exit(2);
  }
})().catch((error) => {
  console.error("Could not verify trading state; refusing deployment:", error.message);
  process.exit(3);
});
'; then
  echo "Trading state allows deployment."
else
  preflight_status=$?
  if (( preflight_status == 2 )); then
    echo "No restart performed. Disarm the bot and run this workflow manually to deploy."
    exit 0
  fi
  exit "$preflight_status"
fi

current_image="$(grep -oE 'localhost/realtrading:[^[:space:]]+' "$service_file" | head -n 1 || true)"
unit_backup="$(mktemp)"
cp -p "$service_file" "$unit_backup"
unit_changed=0
backup_created=0

rollback() {
  local status=$?
  trap - ERR
  if (( status != 0 && unit_changed == 1 )); then
    echo "Deployment failed; restoring the previous image and service unit." >&2
    if (( backup_created == 1 )); then
      podman tag "$backup_image" "$production_image" || true
    fi
    cp -p "$unit_backup" "$service_file"
    systemctl --user daemon-reload
    systemctl --user restart realtrading.service || true
  fi
  rm -f "$unit_backup"
  exit "$status"
}
trap rollback ERR

if [[ -n "$current_image" ]] && podman image exists "$current_image"; then
  podman image rm "$backup_image" >/dev/null 2>&1 || true
  podman tag "$current_image" "$backup_image"
  backup_created=1
fi

podman build --pull=always --tag "$new_image" "$GITHUB_WORKSPACE"
podman tag "$new_image" "$production_image"

sed -i -E 's#localhost/realtrading:[^[:space:]]+#localhost/realtrading:production#' "$service_file"
grep -Fq "$production_image" "$service_file" || {
  echo "Could not update the service image reference." >&2
  exit 1
}
unit_changed=1

systemctl --user daemon-reload
systemctl --user restart realtrading.service
systemctl --user is-active --quiet realtrading.service

for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:3000/ >/dev/null; then
    echo "Deployment healthy: $GITHUB_SHA"
    podman image rm "$new_image" >/dev/null
    unit_changed=0
    rm -f "$unit_backup"
    trap - ERR
    exit 0
  fi
  sleep 2
done

echo "Health check failed after deployment." >&2
exit 1
