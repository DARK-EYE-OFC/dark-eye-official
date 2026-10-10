const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, Browsers, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

async function getPairCode(number, onStatus = () => {}) {
  number = number.replace(/[^0-9]/g,'');
  const dir = './temp_pair_' + number + '_' + Date.now();
  fs.mkdirSync(dir, {recursive:true});
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const sock = makeWASocket({
    logger: pino({level:'silent'}),
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({level:'silent'})) },
    printQRInTerminal: false,
    browser: Browsers.macOS('Chrome')
  });
  sock.ev.on('creds.update', saveCreds);
  try {
    await delay(3000);
    if (sock.authState.creds.registered) throw new Error('Number already registered');
    onStatus('Requesting pairing code...');
    const code = await sock.requestPairingCode(number);
    onStatus('Code: ' + code);
    return new Promise((resolve) => {
      let done = false;
      sock.ev.on('connection.update', async (u) => {
        if (u.connection === 'open' &&!done) {
          done = true;
          await delay(1000);
          let creds = null;
          const p = dir + '/creds.json';
          if (fs.existsSync(p)) creds = fs.readFileSync(p,'utf8');
          setTimeout(()=>{ try{ fs.rmSync(dir,{recursive:true,force:true}); sock.end(); }catch{} },2000);
          resolve({ code, connected:true, creds });
        }
      });
      setTimeout(()=>{ if(!done){ done=true; resolve({ code, connected:false, dir, sock }); } },2000);
    });
  } catch(e){
    try{ fs.rmSync(dir,{recursive:true,force:true}); }catch{}
    try{ sock.end(); }catch{}
    throw e;
  }
}
module.exports = { getPairCode };
