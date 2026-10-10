const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
let currentQR = null;
let qrSock = null;

async function startQRGeneration(onQR, onConnect) {
  const dir = './qr_auth';
  if (fs.existsSync(dir)) fs.rmSync(dir,{recursive:true,force:true});
  fs.mkdirSync(dir,{recursive:true});
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  qrSock = makeWASocket({
    logger: pino({level:'silent'}),
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({level:'silent'})) },
    printQRInTerminal: false,
    browser: Browsers.macOS('Chrome')
  });
  qrSock.ev.on('creds.update', saveCreds);
  qrSock.ev.on('connection.update', async (u) => {
    if (u.qr) {
      currentQR = await QRCode.toDataURL(u.qr);
      if (onQR) onQR(currentQR);
    }
    if (u.connection === 'open') {
      currentQR = null;
      let creds = null;
      const p = dir + '/creds.json';
      if (fs.existsSync(p)) creds = fs.readFileSync(p,'utf8');
      if (onConnect) onConnect(creds);
      setTimeout(()=>{ try{ fs.rmSync(dir,{recursive:true,force:true}); qrSock.end(); }catch{} },2000);
    }
    if (u.connection === 'close') currentQR = null;
  });
  return qrSock;
}
function getCurrentQR(){ return currentQR; }
function stopQR(){
  currentQR = null;
  if(qrSock){ try{ qrSock.end(); }catch{} qrSock=null; }
  const dir='./qr_auth'; if(fs.existsSync(dir)) fs.rmSync(dir,{recursive:true,force:true});
}
module.exports = { startQRGeneration, getCurrentQR, stopQR };
