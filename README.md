# DARK-EYE OFFICIAL - Central Pairing Server

Structure:
- connection/pair.js -> Auto pairing code
- connection/qr.js -> Auto QR code
- connection/sessions.js -> Session handling for any bot (AWESOME-MD, SKYPER-MD etc)

Endpoints:
- / -> Panel
- /qr -> QR
- /pair?number=263xxxx -> Pair code
- /sessions -> Returns DARK-EYE~ base64 session
- /creds -> Raw creds.json

Usage by other bots:
const { saveSessionFromBase64 } = require('dark-eye-official/connection/sessions')
saveSessionFromBase64(process.env.SESSION_ID)
