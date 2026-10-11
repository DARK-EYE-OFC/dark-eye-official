const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const qrcode = require('qrcode');
const { saveSessionFromCredsFile, PREFIX } = require('./sessions');

let currentQR = null;

async function startQRGeneration(log, onConnect) {
  const dir = './temp/qr_' + Date.now();
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['SPACE-MD-QR', 'Chrome', '1.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { qr, connection } = update;
    if (qr) {
      currentQR = await qrcode.toDataURL(qr);
      log('[qr.js] QR Generated');
    }
    if (connection === 'open') {
      const credsPath = dir + '/creds.json';
      if (fs.existsSync(credsPath)) {
        const creds = fs.readFileSync(credsPath, 'utf8');
        const session = saveSessionFromCredsFile(credsPath);
        log(`[qr.js] Session: ${session.slice(0,60)}...`);
        if (onConnect) onConnect(creds, session);
      }
      currentQR = null;
    }
  });

  return sock;
}

function getCurrentQR() {
  return currentQR;
}

module.exports = { startQRGeneration, getCurrentQR, PREFIX };
