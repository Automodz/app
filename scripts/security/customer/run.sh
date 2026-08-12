#!/usr/bin/env bash
# THE POLLUTION CERTIFICATE'S DOORS, PROVEN.
#
# `npx jest` reads `firestore.rules` as text. This runs the REAL rules engine
# in the Firestore emulator and asks it every question the design depends on:
# an owner reads their own papers, nobody reads anybody else's, and no browser
# — customer, technician or owner — can write a declaration or a protection.
#
#   ./scripts/security/customer/run.sh
#
# No dev server is needed: this is about the rules, not about the routes (the
# service's own decisions are covered by __tests__/protection/service.test.ts).
# Nothing touches the real project — the id is `demo-automodz`, and
# firebase-tools refuses to reach live services for a `demo-` id.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
WORK="${TMPDIR:-/tmp}/automodz-customer-emu"
PORT_FS=8085 PORT_AUTH=9099

# firebase-tools 15 needs a JDK 21+; the repo's default may be older
if ! java -version 2>&1 | grep -qE '"(2[1-9]|[3-9][0-9])'; then
  for c in /opt/homebrew/opt/openjdk@21 /usr/local/opt/openjdk@21; do
    [ -x "$c/bin/java" ] && export JAVA_HOME="$c" PATH="$c/bin:$PATH" && break
  done
fi

mkdir -p "$WORK"
ln -sfn "$ROOT/node_modules" "$WORK/node_modules"
cp "$HERE"/*.js "$WORK/"
[ -f "$WORK/fake.pem" ] || openssl genrsa -out "$WORK/fake.pem" 2048 2>/dev/null

cat > "$WORK/firebase.json" <<JSON
{
  "firestore": { "rules": "$ROOT/firestore.rules" },
  "emulators": {
    "firestore": { "host": "127.0.0.1", "port": $PORT_FS },
    "auth":      { "host": "127.0.0.1", "port": $PORT_AUTH },
    "ui":        { "enabled": false },
    "singleProjectMode": true
  }
}
JSON

export GCLOUD_PROJECT=demo-automodz
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$PORT_FS
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$PORT_AUTH

cleanup() { kill $EMU_PID 2>/dev/null || true; }
trap cleanup EXIT

firebase emulators:start --only auth,firestore --project demo-automodz \
  --config "$WORK/firebase.json" >"$WORK/emu.log" 2>&1 &
EMU_PID=$!
until curl -sfo /dev/null "http://127.0.0.1:$PORT_FS/" && curl -sfo /dev/null "http://127.0.0.1:$PORT_AUTH/"; do sleep 1; done

node "$WORK/seed.js"
node "$WORK/rules.js"
