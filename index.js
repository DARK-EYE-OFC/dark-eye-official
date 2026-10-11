const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const cors = require('cors');
const { createSessionViaPair } = require('./connection/pair');
const { createSessionViaQR, getCurrentQR, getCurrentSession } = require('./connection/qr');
const { PREFIX } = require('./connection/sessions');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 10000;
const HOST_URL = process.env.RENDER_EXTERNAL_URL || 'https://dark-eye-official.onrender.com';

let dashboard;
try{ dashboard = require('./connection/dashboard'); }catch{ dashboard = { addPair:()=>{}, addSession:()=>{}, getData:()=>({pairs:[],sessions:[]}), getStats:()=>({connected:0,alive:0,offline:0}) }; }

let lastSessions = {};
let globalLastSession = null;
let stats = { connected: 0, alive: 0, offline: 0, total: 0 };
let startTime = Date.now();

// KEEP ALIVE FOREVER
function keepAlive(){
  setInterval(()=>{ http.get(`http://localhost:${PORT}/host`, ()=>{}).on('error', ()=>{}); }, 25000);
  if(HOST_URL.includes('onrender.com')){
    setInterval(()=>{ https.get(`${HOST_URL}/host`, ()=>{}).on('error', ()=>{}); }, 240000);
  }
}
keepAlive();

function getUptime(){
  const sec = Math.floor((Date.now()-startTime)/1000);
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  const s = sec%60;
  return `${h}h ${m}m ${s}s`;
}

function mainHTML(){
return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>DARK-EYE-OFC - Pairing</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif}
body{background:#0a0a0f;color:#fff;min-height:100vh;padding:0;display:flex;flex-direction:column;align-items:center}
.header{width:100%;max-width:500px;display:flex;justify-content:space-between;align-items:center;padding:18px 16px;background:#0e0e15;border-bottom:1px solid #1f1f2e}
.header-left{display:flex;align-items:center;gap:12px}
.logo{width:48px;height:48px;background:linear-gradient(135deg,#6a7bff,#3dd598);border-radius:14px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:22px;color:#000}
.h-title{font-weight:800;font-size:18px;letter-spacing:.5px}
.h-sub{font-size:12px;opacity:.6;margin-top:2px}
.status-pill{background:#14141f;border:1px solid #2a2a40;border-radius:30px;padding:8px 16px;display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:1px;font-family:'JetBrains Mono'}
.dot{width:10px;height:10px;background:#00ff88;border-radius:50%;box-shadow:0 0 12px #00ff88;animation:pulse 1.5s infinite}
@keyframes pulse{0%{opacity:1}50%{opacity:.5}100%{opacity:1}}
.container{width:100%;max-width:500px;padding:16px;display:flex;flex-direction:column;gap:14px}
.label{font-size:14px;font-weight:700;margin-bottom:6px;opacity:.9}
.input-wrap{position:relative;background:#15151f;border:1px solid #2a2a40;border-radius:14px;padding:4px;display:flex;align-items:center}
.input-wrap span{padding:0 12px;font-weight:700;color:#8b8ba7}
.input-wrap input{flex:1;background:#fff;color:#000;border:none;padding:12px 14px;border-radius:10px;font-size:16px;font-weight:600;outline:none;font-family:'JetBrains Mono'}
.tab-row{display:flex;gap:10px;margin-top:6px}
.tab{flex:1;padding:12px;border-radius:12px;border:1px solid #2a2a40;background:#15151f;color:#8b8ba7;font-weight:700;cursor:pointer;text-align:center;transition:.2s}
.tab.active{background:linear-gradient(135deg,#7b6cff,#3ec6f0);color:#000;border-color:transparent}
.btn-main{width:100%;padding:18px;border:none;border-radius:16px;background:linear-gradient(135deg,#7b6cff,#3ec6f0);color:#000;font-weight:900;font-size:16px;display:flex;align-items:center;justify-content:center;gap:12px;cursor:pointer;box-shadow:0 10px 30px rgba(123,108,255,.3)}
.btn-main:active{transform:scale(.98)}
.icon-circle{background:rgba(0,0,0,.15);width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.card{background:#12121b;border:1px solid #222236;border-radius:18px;padding:16px}
.card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.card-head span{font-size:13px;opacity:.8;display:flex;align-items:center;gap:8px}
.view-btn{background:#fff;color:#000;border:none;padding:6px 12px;border-radius:8px;font-weight:800;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:6px}
.code-box{background:#0a0a0f;border:1px solid #222236;border-radius:14px;padding:22px;text-align:center;font-family:'JetBrains Mono';font-size:26px;letter-spacing:4px;font-weight:800;margin-bottom:12px;cursor:pointer;user-select:all}
.tap-hint{text-align:center;font-size:13px;opacity:.6;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px}
.btn-copy{width:100%;padding:14px;border-radius:14px;border:1px solid #2aff9a;background:transparent;color:#2aff9a;font-weight:800;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer}
.btn-copy.filled{background:#00ff88;color:#000;border-color:#00ff88}
.session-box{font-size:9px;word-break:break-all;background:#0a0a0f;padding:12px;border-radius:12px;border:1px solid #222236;max-height:150px;overflow:auto;font-family:'JetBrains Mono'}
.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.stat{background:#12121b;border:1px solid #222236;border-radius:14px;padding:14px}
.stat small{opacity:.5;font-size:10px;letter-spacing:1px;text-transform:uppercase}
.stat b{display:block;margin-top:6px;font-size:18px;font-family:'JetBrains Mono'}
.stat.online b{color:#00ff88}
.stat.offline b{color:#ff5a5a}
.support-btn{width:100%;padding:14px;background:#15151f;border:1px solid #2a2a40;border-radius:14px;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;gap:10px;text-decoration:none;margin-top:8px}
.reset-btn{width:100%;padding:14px;background:transparent;border:1px solid #222236;border-radius:14px;color:#8b8ba7;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:4px;cursor:pointer}
.qr-box{display:flex;flex-direction:column;align-items:center;gap:12px}
.qr-box img{width:260px;border-radius:18px;border:3px solid #7b6cff}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#00ff88;color:#000;padding:12px 22px;border-radius:30px;font-weight:900;display:none;z-index:999;box-shadow:0 10px 30px rgba(0,255,136,.4)}
</style></head>
<body>

<div class="header">
  <div class="header-left">
    <div class="logo">DE</div>
    <div>
      <div class="h-title">DARK-EYE-OFC</div>
      <div class="h-sub">WhatsApp Pairing Portal</div>
    </div>
  </div>
  <div class="status-pill" id="serverStatus"><div class="dot"></div> SERVER <br>ONLINE</div>
</div>

<div class="container">
  <div>
    <div class="label">WhatsApp Number</div>
    <div class="input-wrap">
      <span>+</span>
      <input id="num" placeholder="263717400463" value="263717400463" inputmode="numeric">
    </div>
  </div>

  <div class="tab-row">
    <div class="tab active" id="tabPair" onclick="setMode('pair')">🔗 Pair Code</div>
    <div class="tab" id="tabQr" onclick="setMode('qr')">📷 QR Code</div>
  </div>

  <button class="btn-main" id="genBtn" onclick="gen()">
    <div class="icon-circle">🔗</div> Generate Pair Code
  </button>

  <div class="card" id="codeCard" style="display:none">
    <div class="card-head">
      <span>🔑 Pairing Code Generated</span>
      <button class="view-btn" onclick="toggleView()">👁️ View</button>
    </div>
    <div class="code-box" id="codeBox" onclick="copyCode()">---- ----</div>
    <div class="tap-hint">👆 Tap the code to copy</div>
    <button class="btn-copy" onclick="copyCode()">📋 Copy Code</button>
    <div id="sessArea" style="margin-top:14px;display:none">
      <div class="session-box" id="sessText"></div>
      <button class="btn-copy filled" style="margin-top:10px" onclick="copySess()">📋 Copy Session</button>
      <small style="display:block;text-align:center;margin-top:8px;opacity:.5">Session alone - long press to copy if button fails</small>
    </div>
  </div>

  <div class="card qr-box" id="qrCard" style="display:none">
    <div id="qrImg"></div>
    <small style="opacity:.6">Scan with WhatsApp > Linked Devices</small>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b>Server Stats</b><span id="uptime" style="font-size:11px;opacity:.5">Uptime: 0h 0m</span></div>
    <div class="stats-grid">
      <div class="stat online"><small>Server Status</small><b id="sStatus">ONLINE</b></div>
      <div class="stat"><small>Uptime</small><b id="sUptime">0s</b></div>
      <div class="stat"><small>Connected Bots</small><b id="sConn">0</b></div>
      <div class="stat online"><small>Alive Bots</small><b id="sAlive">0</b></div>
      <div class="stat offline"><small>Offline Bots</small><b id="sOff">0</b></div>
      <div class="stat"><small>Owner</small><b style="font-size:12px">dark-eye-ofc</b></div>
    </div>
    <a class="support-btn" href="https://support-black-eight.vercel.app" target="_blank">🛟 Support Center</a>
    <button class="reset-btn" onclick="resetAll()">🔄 Reset</button>
  </div>
</div>

<div id="toast" class="toast">Copied ✅</div>

<script>
let mode='pair';
let currentCode='';
let pollInterval=null;

function showToast(t){ const el=document.getElementById('toast'); el.innerText=t; el.style.display='block'; setTimeout(()=>el.style.display='none',2000); }
function setMode(m){
  mode=m;
  document.getElementById('tabPair').classList.toggle('active', m==='pair');
  document.getElementById('tabQr').classList.toggle('active', m==='qr');
  document.getElementById('genBtn').innerHTML = m==='pair'? '<div class="icon-circle">🔗</div> Generate Pair Code' : '<div class="icon-circle">📷</div> Generate QR Code';
  document.getElementById('codeCard').style.display='none';
  document.getElementById('qrCard').style.display='none';
}
function toggleView(){ document.getElementById('codeBox').style.filter = document.getElementById('codeBox').style.filter==='blur(6px)'? 'none' : 'blur(6px)'; }
function copyCode(){ if(!currentCode) return; navigator.clipboard.writeText(currentCode).then(()=>showToast('Code Copied: '+currentCode)); }
function copySess(){ const t=document.getElementById('sessText').innerText; navigator.clipboard.writeText(t).then(()=>showToast('Session Copied ✅')); }

async function gen(){
  const num=document.getElementById('num').value.replace(/[^0-9]/g,'');
  if(num.length<10){ showToast('Enter valid number'); return; }
  if(mode==='pair'){
    document.getElementById('codeCard').style.display='block';
    document.getElementById('codeBox').innerText='Generating...';
    const r=await fetch('/pair?number='+num); const j=await r.json();
    if(j.code){
      currentCode=j.code;
      document.getElementById('codeBox').innerText=j.code.slice(0,4)+'-'+j.code.slice(4);
      showToast('Pair code generated');
      // poll session
      if(pollInterval) clearInterval(pollInterval);
      pollInterval=setInterval(async()=>{
        const sr=await fetch('/sessions?number='+num); const sj=await sr.json();
        if(sj.session){
          document.getElementById('sessArea').style.display='block';
          document.getElementById('sessText').innerText=sj.session;
          clearInterval(pollInterval);
          loadStats();
        }
      },3000);
    } else {
      document.getElementById('codeBox').innerText='Error';
    }
  } else {
    window.location='/qr?number='+num;
  }
}

async function loadStats(){
  try{
    const r=await fetch('/host'); const j=await r.json();
    document.getElementById('sStatus').innerText=j.status.includes('forever')||j.status.includes('online')?'ONLINE':'OFFLINE';
    document.getElementById('sUptime').innerText=j.uptime || j.uptimeStr || '0s';
    document.getElementById('uptime').innerText='Uptime: '+(j.uptime||'0s');
    document.getElementById('sConn').innerText=j.sessions || j.total || '0';
    document.getElementById('sAlive').innerText=j.sessions || '0';
    document.getElementById('sOff').innerText='0';
    const pill=document.getElementById('serverStatus');
    if(j.status.includes('online')||j.status.includes('forever')){
      pill.innerHTML='<div class="dot"></div> SERVER<br>ONLINE';
    } else {
      pill.innerHTML='<div class="dot" style="background:#ff5a5a;box-shadow:0 0 12px #ff5a5a"></div> SERVER<br>OFFLINE';
    }
  }catch{}
}
function resetAll(){
  document.getElementById('codeCard').style.display='none';
  document.getElementById('qrCard').style.display='none';
  document.getElementById('num').value='';
  currentCode='';
  if(pollInterval) clearInterval(pollInterval);
  showToast('Reset done');
}
loadStats();
setInterval(loadStats, 5000);
</script>
</body></html>`;
}

app.get('/', (req,res)=>res.send(mainHTML()));

app.get('/pair', async (req,res)=>{
  let number = (req.query.number||'').replace(/[^0-9]/g,'');
  if(!number || number.length<10) return res.json({ status:'active forever', host:HOST_URL, prefix:PREFIX, uptime:getUptime() });
  try{
    stats.total++; stats.connected++;
    await createSessionViaPair(number,
      (code)=>{
        dashboard.addPair({ number, code });
        res.json({ status:'active forever', host:HOST_URL, number, code, prefix:PREFIX });
      },
      (session)=>{
        lastSessions[number]=session;
        globalLastSession=session;
        stats.alive++;
        dashboard.addSession({ number, session });
      }
    );
  }catch(e){ stats.offline++; res.json({ error:e.message }); }
});

app.get('/qr', async (req,res)=>{
  const qr = getCurrentQR(); const sess = getCurrentSession();
  if(sess){
    return res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0a0a0f;color:#fff;font-family:monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px;text-align:center}.box{background:#12121b;border:1px solid #222236;border-radius:18px;padding:20px;max-width:400px;width:100%}.sess{font-size:8px;word-break:break-all;background:#0a0a0f;padding:12px;border-radius:12px;text-align:left;max-height:200px;overflow:auto}button{background:#00ff88;color:#000;border:none;padding:12px 20px;border-radius:12px;font-weight:900;margin-top:12px;cursor:pointer}</style></head><body><div class="box"><h3>✅ Session Generated!</h3><p style="opacity:.6;font-size:12px">Stylish messages sent to WhatsApp</p><div class="sess" id="s">${sess}</div><button onclick="navigator.clipboard.writeText(document.getElementById('s').innerText).then(()=>alert('Copied!'))">📋 COPY SESSION</button><br><br><a href="/" style="color:#00ff88">← Back</a><br><br><a href="https://support-black-eight.vercel.app" target="_blank" style="color:#8b8ba7;text-decoration:none">🛟 Support</a></div></body></html>`);
  }
  if(qr){
    return res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0a0a0f;color:#fff;font-family:Inter;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center}.box{background:#12121b;border:1px solid #222236;border-radius:18px;padding:20px}img{width:280px;border-radius:16px;border:3px solid #7b6cff}</style><meta http-equiv="refresh" content="5"></head><body><div class="box"><h3>📷 Scan QR Code</h3><p style="opacity:.6">Prefix: ${PREFIX}</p><img src="${qr}"><p style="margin-top:12px;opacity:.6;font-size:12px">After scan, session auto-sent with copy button</p><a href="/" style="color:#00ff88;text-decoration:none">← Back</a></div></body></html>`);
  }
  res.send(`<html><meta http-equiv="refresh" content="2"><body style="background:#0a0a0f;color:#00ff88;font-family:monospace;display:flex;align-items:center;justify-content:center;min-height:100vh">Starting QR generator...<br><a href="/" style="color:#fff">Home</a></body></html>`);
  createSessionViaQR(()=>{}, (session)=>{ globalLastSession=session; lastSessions['QR']=session; stats.alive++; dashboard.addSession({ number:'QR', session, method:'QR' }); });
});

app.get('/sessions', (req,res)=>{
  const number = (req.query.number||'').replace(/[^0-9]/g,'');
  if(number && lastSessions[number]) return res.json({ status:'found', session:lastSessions[number], prefix:PREFIX });
  if(globalLastSession) return res.json({ status:'found', session:globalLastSession, prefix:PREFIX });
  res.json({ status:'waiting' });
});

app.get('/host', (req,res)=>res.json({
  status: 'online active forever',
  host: HOST_URL,
  prefix: PREFIX,
  uptime: getUptime(),
  uptimeStr: getUptime(),
  sessions: Object.keys(lastSessions).length,
  total: stats.total,
  connected: Object.keys(lastSessions).length,
  alive: Object.keys(lastSessions).length,
  offline: 0,
  owner: 'dark-eye-ofc',
  server: 'ONLINE',
  timestamp: new Date().toISOString()
}));

app.get('/stats', (req,res)=>res.json({ server: 'ONLINE', status: 'active', uptime: getUptime(), connected_bots: Object.keys(lastSessions).length, alive_bots: Object.keys(lastSessions).length, offline_bots: 0, owner: 'dark-eye-ofc', support: 'https://support-black-eight.vercel.app' }));

app.listen(PORT, '0.0.0.0', ()=>console.log(`DARK-EYE-OFC ONLINE on ${PORT}`));
