const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { saveSessionFromCredsFile } = require('./sessions');

let currentQR = null;
let currentSession = null;

async function createSessionViaQR(onQR, onSession){
  const dir = path.join('./temp', `QR_${Date.now()}`);
  fs.mkdirSync(dir,{recursive:true});
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const sock = makeWASocket({ auth: state, printQRInTerminal:false, browser:['dark-eye-official','Chrome','122.0'] });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u)=>{
    const { qr, connection } = u;
    if(qr){
      try{
        const dataUrl = await QRCode.toDataURL(qr, { width: 400, margin: 1 });
        currentQR = dataUrl;
        if(onQR) onQR(dataUrl);
        console.log('[QR] Real QR generated');
      }catch(e){ console.log('qr error', e.message); }
    }
    if(connection==='open'){
      const p = path.join(dir,'creds.json');
      if(fs.existsSync(p)){
        const session = saveSessionFromCredsFile(p);
        currentSession = session;
        const jid = sock.user?.id;
        if(jid){
          const { sendStylish } = require('./pair_helper') || {};
          // reuse send logic
          try{
            const { default: makeHelper } = require('./pair');
            // quick send
            await sock.sendMessage(jid, { text: session });
          }catch{}
        }
        if(onSession) onSession(session);
        console.log('[QR] Connected, session created');
        setTimeout(()=>{ try{ fs.rmSync(dir,{recursive:true,force:true}); sock.end(); currentQR=null; }catch{} }, 10000);
      }
    }
  });
  return sock;
}

function getCurrentQR(){ return currentQR; }
function getCurrentSession(){ return currentSession; }
function clearQR(){ currentQR=null; currentSession=null; }

module.exports = { createSessionViaQR, getCurrentQR, getCurrentSession, clearQR };
