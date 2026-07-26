#!/usr/bin/env bash
# THE BOOKING SERVICE, PROVEN.
#
# `npx jest` covers the pure pricing rules. It cannot cover the things that
# decide whether a visit can be stolen or under-paid: the transaction, the
# idempotency ledger, concurrent writers, and firestore.rules. This does,
# against real Firestore semantics in the emulators.
#
#   ./scripts/security/booking/run.sh
#
# It starts the Auth + Firestore emulators, boots a throwaway dev server wired
# to them, seeds a studio (customers, cars, catalogue, promos, memberships) and
# runs the adversarial matrix. Nothing touches the real project - the project id
# is `demo-automodz`, and firebase-tools refuses to reach live services for a
# `demo-` id.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
WORK="${TMPDIR:-/tmp}/automodz-booking-emu"
PORT_APP=3199 PORT_FS=8085 PORT_AUTH=9099

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
    "auth":      { "host": "127.0.0.1", "port": $PORT_AUTH },
    "firestore": { "host": "127.0.0.1", "port": $PORT_FS },
    "ui":        { "enabled": false },
    "singleProjectMode": true
  }
}
JSON

export FIREBASE_ADMIN_PROJECT_ID=demo-automodz
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-automodz
export GCLOUD_PROJECT=demo-automodz
export FIREBASE_ADMIN_CLIENT_EMAIL=test@demo-automodz.iam.gserviceaccount.com
export FIREBASE_ADMIN_PRIVATE_KEY="$(sed 's/$/\\n/' "$WORK/fake.pem" | tr -d '\n')"
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$PORT_FS
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$PORT_AUTH
export API="http://127.0.0.1:$PORT_APP/api/booking/create"

cleanup() { kill $EMU_PID $APP_PID 2>/dev/null || true; }
trap cleanup EXIT

firebase emulators:start --only auth,firestore --project demo-automodz \
  --config "$WORK/firebase.json" >"$WORK/emu.log" 2>&1 &
EMU_PID=$!
until curl -sfo /dev/null "http://127.0.0.1:$PORT_FS/" && curl -sfo /dev/null "http://127.0.0.1:$PORT_AUTH/"; do sleep 1; done

( cd "$ROOT" && npx next dev -p $PORT_APP >"$WORK/app.log" 2>&1 ) &
APP_PID=$!
until curl -sfo /dev/null "http://127.0.0.1:$PORT_APP/"; do sleep 1; done

node "$WORK/seed.js"
node "$WORK/attack.js"   # the service: authz, ownership, pricing, replay, races, atomicity
node "$WORK/rules.js"    # firestore.rules: no client may write a booking at all
