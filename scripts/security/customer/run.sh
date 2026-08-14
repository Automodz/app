#!/usr/bin/env bash
# THE POLLUTION CERTIFICATE'S DOORS, PROVEN.
#
# `npx jest` reads `firestore.rules` as text. This runs the REAL rules engine
# in the Firestore emulator and asks it every question the design depends on:
# an owner reads their own papers, nobody reads anybody else's, and no browser
# - customer, technician or owner - can write a declaration or a protection.
#
#   ./scripts/security/customer/run.sh
#
# It then boots a throwaway dev server against the same emulators and runs the
# API matrix - the half `npx jest` cannot reach: the session cookie, the CSRF
# guard on it, staff authorisation read from a real profile, and the Admin SDK
# writing against real Firestore semantics.
#
# Nothing touches the real project - the id is `demo-automodz`, and
# firebase-tools refuses to reach live services for a `demo-` id.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
WORK="${TMPDIR:-/tmp}/automodz-customer-emu"
PORT_FS=8085 PORT_AUTH=9099 PORT_APP=3199

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
export FIREBASE_ADMIN_PROJECT_ID=demo-automodz
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-automodz
export FIREBASE_ADMIN_CLIENT_EMAIL=test@demo-automodz.iam.gserviceaccount.com
export FIREBASE_ADMIN_PRIVATE_KEY="$(sed 's/$/\\n/' "$WORK/fake.pem" | tr -d '\n')"
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$PORT_FS
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$PORT_AUTH
# Cloudinary signing is pure local crypto - these let /api/media/* answer
# without ever reaching Cloudinary.
export CLOUDINARY_CLOUD_NAME=demo-cloud
export CLOUDINARY_API_KEY=000000000000000
export CLOUDINARY_API_SECRET=not-a-real-secret

cleanup() { kill $EMU_PID $APP_PID 2>/dev/null || true; }
trap cleanup EXIT

firebase emulators:start --only auth,firestore --project demo-automodz \
  --config "$WORK/firebase.json" >"$WORK/emu.log" 2>&1 &
EMU_PID=$!
until curl -sfo /dev/null "http://127.0.0.1:$PORT_FS/" && curl -sfo /dev/null "http://127.0.0.1:$PORT_AUTH/"; do sleep 1; done

node "$WORK/seed.js"
node "$WORK/rules.js"

( cd "$ROOT" && npx next dev -p $PORT_APP >"$WORK/app.log" 2>&1 ) &
APP_PID=$!
until curl -sfo /dev/null "http://127.0.0.1:$PORT_APP/"; do sleep 1; done

API_ORIGIN="http://127.0.0.1:$PORT_APP" node "$WORK/api.js"
