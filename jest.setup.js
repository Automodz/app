/* jsdom does not provide the web encoders that react-dom/server needs. */
const { TextEncoder, TextDecoder } = require('node:util');
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

/* Next injects `.env.local` into the build; jest does not. Load it here so a
   test can exercise the real Firebase client (the integration suite needs the
   API key to construct an auth instance at all). Values already in the
   environment win, so CI can override. */
const fs = require('node:fs');
const path = require('node:path');
for (const file of ['.env.local', '.env']) {
  const p = path.join(__dirname, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    if (process.env[key] !== undefined) continue;
    process.env[key] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
