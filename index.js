const express = require('express');
const cors = require('cors');
const { getPairCode } = require('./connection/pair');
const { startQRGeneration, getCurrentQR } = require('./connection/qr');
const { generateSessionString, saveSessionFromCredsJson } = require('./connection/sessions');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3000;

// Store last session for /sessions endpoint
let lastSession = null;
let lastCreds = null;

app.get('/', (req,res)=>{
res.send(`
<!DOCTYPE html><html><head><title>DARK-EYE Pair</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box;font-family:monospace}body{background:#0a0a0a;color:#0f0;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:15px}
.panel{border:2px solid #0f0;border-radius:22px;padding:28px;width:100%;max-width:420px;box-shadow:0 0 35px rgba(0,255,0,.4);background:rgba(0,255,0,.04);text-align:center}
h1{letter-spacing:3px;font-size:28px;margin:0}p.sub{opacity:.6;font-size:12px;margin:5px 0 20px}
input{width:100%;padding:14px;border-radius:12px;border:1px solid #0f0;background:#000;color:#0f0;font-size:16px;margin:10px 0}
button{width:100%;padding:14px;border-radius:12px;background:#0f0;color:#000;border:none;font-weight:800;cursor:pointer;margin-top:10px}
#codeBox{display:none;margin-top:15px;padding:15px;border:1px dashed #0f0;border-radius:12px;background:#000}
#code{font-size:32px;letter-spacing:6px;font-weight:900}
</style></head>
<body><div class="panel">
<h1>DARK-EYE</h1><p class="sub">OFFICIAL PAIRING SERVER</p>
<button onclick="location.href='/qr'">SCAN QR CODE</button>
<hr style="margin:22px 0;border:0;border-top:1px solid rgba(0,255,0,.2)">
<input id="num" placeholder="26378xxxxxxx" type="number">
<button onclick="getPair()">GET PAIR CODE</button>
<div id="codeBox"><div id="code"></div><p id="msg" style="font-size:11px;margin-top:8px"></p>
<div id="sess" style="display:none;margin-top:15px;word-break:break-all;font-size:9px;background:#111;padding:10px;border-radius:8px"></div>
</div>
<button style="margin-top:15px;background:#000;color:#0f0;border:1px solid #0f0" onclick="location.href='/sessions'">VIEW SESSION</button>
</div>
<script>
async function getPair(){
 const n=document.getElementById('num').value.trim(); if(!n)return alert('Enter number');
 document.getElementById('codeBox').style.display='block'; document.getElementById('code').innerText='...'; document.getElementById('msg').innerText='Generating...';
 try{
  const r=await fetch('/pair?number='+n); const d=await r.json();
  if(d.code){document.getElementById('code').innerText=d.code; document.getElementById('msg').innerText='Link with phone number > Enter '+d.code;
   const check=setInterval(async()=>{
    const s=await fetch('/sessions'); const j=await s.json();
    if(j.session){ document.getElementById('sess').style.display='block'; document.getElementById('sess').innerText=j.session; clearInterval(check); }
   },3000);
  }else{document.getElementById('code').innerText='ERROR'; document.getElementById('msg').innerText=d.error}
 }catch(e){document.getElementById('msg').innerText='Error'}
}
</script></body></html>
`);
});

app.get('/qr', async (req,res)=>{
 const qr = getCurrentQR();
 res.send(`
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="8">
<style>body{background:#000;color:#0f0;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:monospace;flex-direction:column;text-align:center}
img{width:300px;max-width:90vw;border:4px solid #0f0;border-radius:18px;box-shadow:0 0 30px #0f0;margin:20px 0}
a{color:#000;background:#0f0;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:700}</style></head><body>
<h2>SCAN QR</h2>
${qr?`<img src="${qr}"><p>WhatsApp > Linked Devices > Link Device</p>`:`<p>Starting... refresh in 3s</p>`}
<br><a href="/">BACK</a> | <a href="/sessions">SESSION</a>
</body></html>`);
 if(!qr) startQRGeneration(()=>{}, (creds)=>{
   lastCreds = creds;
   if(creds){
     const b64 = Buffer.from(creds).toString('base64');
     lastSession = 'DARK-EYE~' + b64;
     console.log('Session generated');
   }
 });
});

app.get('/pair', async (req,res)=>{
 let number = (req.query.number||'').replace(/[^0-9]/g,'');
 if(!number) return res.json({error:'?number=26378xxxxxxx'});
 try{
   const result = await getPairCode(number, console.log);
   res.json({ code: result.code, number });
   // If it connects later, capture session
   if(result.sock){
     result.sock.ev.on('connection.update', async (u)=>{
       if(u.connection==='open'){
         const fs=require('fs');
         const p=result.dir+'/creds.json';
         if(fs.existsSync(p)){
           const creds=fs.readFileSync(p,'utf8');
           lastCreds=creds;
           lastSession='DARK-EYE~'+Buffer.from(creds).toString('base64');
         }
       }
     });
   }
 }catch(e){ res.json({error:e.message}); }
});

app.get('/sessions', (req,res)=>{
 if(lastSession){
   res.json({ session: lastSession, creds: lastCreds? JSON.parse(lastCreds) : null });
 }else{
   res.send('<body style="background:#000;color:#0f0;font-family:monospace;text-align:center;padding:30px"><h3>No session yet</h3><p>Connect via /qr or /pair first</p><a href="/" style="color:#000;background:#0f0;padding:10px 20px;border-radius:10px;text-decoration:none">HOME</a></body>');
 }
});

app.get('/creds', (req,res)=>{
 if(lastCreds) res.json(JSON.parse(lastCreds));
 else res.json({error:'No creds'});
});

app.listen(PORT, ()=>console.log('DARK-EYE pairing running on '+PORT));
