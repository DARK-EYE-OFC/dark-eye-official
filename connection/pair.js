const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { saveSessionFromCredsFile, PREFIX } = require('./sessions');

async function getPairCode(number, log = console.log) {
  const dir = './temp/' + number + '_' + Date.now();
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['SPACE-MD via DARK-EYE', 'Chrome', '1.0']
  });

  sock.ev.on('creds.update', saveCreds);

  if (!sock.authState.creds.registered) {
    await delay(2000);
    const code = await sock.requestPairingCode(number);
    log(`[pair.js] Code for ${number}: ${code} | Prefix: ${PREFIX}`);
    return { code, sock, dir, credsPath: path.join(dir, 'creds.json') };
  }
}

module.exports = { getPairCode, PREFIX };
