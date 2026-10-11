const fs = require('fs');
const path = require('path');

const PREFIX = 'dark-eye-official:~';
const CREDS_DIR = './auth_info_baileys';

// ========== CORE FUNCTIONS ==========

/**
 * SPACE-MD => dark-eye-official => index.js => 101 => pair.js => sessions.js
 * All sessions are prefixed with dark-eye-official:~
 */

function encodeSession(credsJson) {
  // credsJson is stringified JSON from creds.json
  const b64 = Buffer.from(credsJson).toString('base64');
  return `${PREFIX}${b64}`;
}

function decodeSession(sessionString) {
  if (!sessionString) throw new Error('No session string');
  if (!sessionString.startsWith(PREFIX)) {
    throw new Error(`Invalid prefix! Must start with ${PREFIX}. Got: ${sessionString.slice(0,30)}`);
  }
  const b64 = sessionString.replace(PREFIX, '').trim();
  const json = Buffer.from(b64, 'base64').toString('utf-8');
  try {
    JSON.parse(json); // validate JSON
    return json;
  } catch {
    throw new Error('Invalid base64 session data');
  }
}

function saveSessionFromBase64(sessionString, customDir = CREDS_DIR) {
  console.log(`[sessions.js] Decoding ${PREFIX} session...`);
  const credsJson = decodeSession(sessionString);
  
  if (!fs.existsSync(customDir)) {
    fs.mkdirSync(customDir, { recursive: true });
  }
  
  const credsPath = path.join(customDir, 'creds.json');
  fs.writeFileSync(credsPath, credsJson);
  console.log(`[sessions.js] Session saved to ${credsPath}`);
  return credsPath;
}

function getSessionFromDir(dir = CREDS_DIR) {
  const credsPath = path.join(dir, 'creds.json');
  if (!fs.existsSync(credsPath)) return null;
  
  const credsJson = fs.readFileSync(credsPath, 'utf8');
  return encodeSession(credsJson);
}

function saveSessionFromCredsFile(credsPath) {
  if (!fs.existsSync(credsPath)) return null;
  const credsJson = fs.readFileSync(credsPath, 'utf8');
  const session = encodeSession(credsJson);
  console.log(`[sessions.js] Generated session: ${session.slice(0, 50)}...`);
  return session;
}

// For index.js live capture
function isValidSession(sessionString) {
  return sessionString && sessionString.startsWith(PREFIX);
}

module.exports = {
  PREFIX,
  encodeSession,
  decodeSession,
  saveSessionFromBase64,
  getSessionFromDir,
  saveSessionFromCredsFile,
  isValidSession
};
