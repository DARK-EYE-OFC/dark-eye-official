const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay, Browsers, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// --- MAIN PANEL HTML ---
app.get('/', (req, res) => {
res.send(`
<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DARK-EYE Pair</title>
<style>
*{box-sizing:border-box;font-family:monospace}body{background:#000;color:#0f0;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}
.box{border:2px solid #0f0;border-radius:20px;padding:30px;width:95%;max-width:400px;box-shadow:0 0 30px #0f0;background:rgba(0,255,0,.05);text-align:center}
h1{margin:0 0 10px}input{width:100%;padding:14px;border-radius:10px;border:1px solid #0f0;background:#000;color:#0f0;margin:10px 0;font-size:16px}
button{width:100%;padding:14px;background:#0f0;color:#000;border:none;border-radius:10px;font-weight:700;cursor:pointer;margin-top:10px}
button.outline{background:#000;color:#0f0;border:1px solid #0f0}
#code{font-size:28px;letter-spacing:4px;margin:15px 0;font-weight:bold;display:none}
.qr img{width:250px;border:5px solid #0f0;border-radius:10px}
a{color:#0f0;text-decoration:none;font-size:12px}
</style></head>
<body>
<div class="box">
<h1>DARK-EYE</h1><p>OFFICIAL PAIRING SERVER</p>
<div style="margin:20px 0">
<button onclick="location.href='/qr'">GET QR CODE</button>
</div>
<hr style="border:0;border-top:1px solid #0f0;margin:20px 0;opacity:.3">
<p>Enter WhatsApp Number with country code</p>
<input id="num" placeholder="26378xxxxxxx">
<button onclick="getPair()">GET PAIR CODE</button>
<div id="code"></div>
<p id="msg" style="font-size:12px;opacity:.7"></p>
<button class="outline" onclick="location.href='https://github.com/DARK-EYE-OFC/AWESOME-MD'">BOT REPO</button>
<p style="margin-top:15px;font-size:10px;opacity:.5">© 2026 DARK-EYE-OFC</p>
</div>
<script>
async function getPair(){
 const n=document.getElementById('num').value.trim();
 if(!n) return alert('Enter number');
 document.getElementById('msg').innerText='Generating...';
 const res=await fetch('/pair?number='+n);
 const data=await res.json();
 if(data.code){
   document.getElementById('code').style.display='block';
   document.getElementById('code').innerText=data.code;
   document.getElementById('msg').innerText='Go to WhatsApp > Linked Devices > Link with phone number > Enter code';
 } else { document.getElementById('msg').innerText=data.error||'Failed'; }
}
</script>
</body></html>
`);
});

// --- QR ENDPOINT ---
let qrData = null;
app.get('/qr', async (req, res) => {
res.send(`
<html><head><meta http-equiv="refresh" content="15"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{background:#000;color:#0f0;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:monospace;flex-direction:column}
img{width:300px;border:4px solid #0f0;border-radius:15px;box-shadow:0 0 30px #0f0}
a{color:#0f0;margin-top:20px;display:inline-block;border:1px solid #0f0;padding:10px 20px;border-radius:10px;text-decoration:none}
</style></head><body>
<h2>SCAN QR</h2>
${qrData ? `<img src="${qrData}">` : `<p>Generating QR... refresh</p><p>Check server logs</p>`}
<p>WhatsApp > Linked Devices > Link a Device</p>
<a href="/">BACK</a>
</body></html>
`);
startQR();
});

async function startQR(){
 if(qrData) return;
 const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
 const sock = makeWASocket({
   logger: pino({ level: 'silent' }),
   printQRInTerminal: true,
   auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
   browser: Browsers.ubuntu('Chrome')
 });
 sock.ev.on('creds.update', saveCreds);
 sock.ev.on('connection.update', async (update) => {
   const { qr, connection } = update;
   if(qr){
     qrData = await QRCode.toDataURL(qr);
     console.log('QR Generated');
   }
   if(connection === 'open'){
     console.log('QR CONNECTED - Session saved to auth_info_baileys');
     // Here you can upload session to Mega and give user SESSION_ID
     const sessionFolder = fs.readFileSync('./auth_info_baileys/creds.json');
     // For now just log
     console.log('Copy creds.json as SESSION_ID');
   }
 });
}

// --- PAIR CODE ENDPOINT ---
app.get('/pair', async (req, res) => {
 let number = req.query.number;
 if(!number) return res.json({ error: 'Missing number ?number=263...' });
 number = number.replace(/[^0-9]/g,'');
 if(!number.startsWith('263') && number.length < 10) return res.json({ error: 'Use full number with country code' });
 
 try {
   const dir = './temp_'+number;
   if(fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
   fs.mkdirSync(dir);
   const { state, saveCreds } = await useMultiFileAuthState(dir);
   const sock = makeWASocket({
     logger: pino({ level: 'silent' }),
     printQRInTerminal: false,
     auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
     browser: Browsers.ubuntu('Chrome')
   });
   sock.ev.on('creds.update', saveCreds);
   await delay(2000);
   const code = await sock.requestPairingCode(number);
   console.log(`Pair code for ${number}: ${code}`);
   // Auto cleanup after 2 mins
   setTimeout(()=>{ if(fs.existsSync(dir)) fs.rmSync(dir, { recursive: true }); }, 120000);
   res.json({ code, number });
 } catch(e){
   console.log(e);
   res.json({ error: 'Failed to get code. Try again. Make sure number is not already linked. '+ e.message });
 }
});

app.listen(PORT, () => console.log('DARK-EYE Pairing running on '+PORT));
