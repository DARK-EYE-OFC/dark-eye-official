const express = require('express');
const fs = require('fs');
const cors = require('cors');
const { createSessionViaPair } = require('./connection/pair');
const { createSessionViaQR, getCurrentQR, getCurrentSession } = require('./connection/qr');
const { PREFIX } = require('./connection/sessions');
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 10000;
const HOST = 'https://dark-eye-official.onrender.com';
let dashboard;
try{ dashboard = require('./connection/dashboard'); }catch{ dashboard = { addPair:()=>{}, addSession:()=>{}, getData:()=>({pairs:[],sessions:[]}) }; }
let lastSessions = {};
let globalLastSession = null;

function htmlPage(){
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>SESSION</title>
<style>
*{font-family:monospace;box-sizing:border-box}body{background:#000;color:#0f0;margin:0;padding:14px;display:flex;flex-direction:column;align-items:center}
.box{border:2px solid #0f0;border-radius:16px;padding:18px;width:100%;max-width:430px;background:#080808;margin-top:18px}
input{width:100%;padding:12px;background:#000;color:#0f0;border:1px solid #0f0;border-radius:10px;margin:8px 0}
button{width:100%;padding:12px;background:#0f0;color:#000;border:none;border-radius:10px;font-weight:900;margin-top:8px;cursor:pointer}
.code{font-size:34px;letter-spacing:5px;text-align:center;background:#000;border:2px dashed #0f0;padding:14px;border-radius:14px;margin:14px 0;position:relative}
.copy-btn{position:absolute;top:6px;right:8px;background:#0f0;color:#000;border:none;border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer}
.session{font-size:8px;word-break:break-all;background:#000;padding:10px;border-radius:10px;border:1px solid rgba(0,255,0,.2);max-height:160px;overflow:auto;position:relative}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0f0;color:#000;padding:10px 18px;border-radius:20px;font-weight:900;display:none;z-index:999}
</style></head><body>
<h2>⚡ dark-eye-official</h2><small>${PREFIX}</small>
<div class="box">
<input id="num" placeholder="263783546271" value="263783546271">
<button onclick="gen()">GENERATE SESSION</button>
<div id="out"></div>
</div>
<div id="toast" class="toast">Copied ✅</div>
<script>
function showToast(t){ const el=document.getElementById('toast'); el.innerText=t; el.style.display='block'; setTimeout(()=>el.style.display='none',2000); }
function copyCode(c){ navigator.clipboard.writeText(c).then(()=>showToast('Pair Code Copied: '+c)); }
function copyText(id){ const el=document.getElementById(id); navigator.clipboard.writeText(el.innerText).then(()=>showToast('Session Copied ✅')); }
async function gen(){
  const num=document.getElementById('num').value.replace(/[^0-9]/g,'');
  const out=document.getElementById('out');
  out.innerHTML='⏳ Generating code...';
  const r=await fetch('/pair?number='+num); const j=await r.json();
  if(j.code){
    out.innerHTML=\`<div class="code">\${j.code}<button class="copy-btn" onclick="copyCode('\\''+j.code+'\\'')">📋 COPY</button></div><small>Enter in WhatsApp > Linked Devices > Link with phone number</small><div id="sessBox" style="margin-top:12px"></div>\`;
    const poll=setInterval(async()=>{
      const sr=await fetch('/sessions?number='+num); const sj=await sr.json();
      if(sj.session){
        document.getElementById('sessBox').innerHTML=\`<b>🔐 SESSION:</b><div class="session" id="sessText">\${sj.session}</div><button onclick="copyText('sessText')">📋 COPY SESSION</button>\`;
        clearInterval(poll);
      }
    },3000);
  }
}
</script>
</body></html>`;
}
app.get('/', (req,res)=>res.send(htmlPage()));
app.get('/pair', async (req,res)=>{
  let number = (req.query.number||'').replace(/[^0-9]/g,'');
  if(!number || number.length<10) return res.json({ status:'active', host:HOST, prefix:PREFIX });
  try{
    await createSessionViaPair(number,
      (code)=>{ dashboard.addPair({ number, code }); res.json({ status:'active', host:HOST, number, code, prefix:PREFIX, copy_button_panel:true }); },
      (session)=>{ lastSessions[number]=session; globalLastSession=session; dashboard.addSession({ number, session }); }
    );
  }catch(e){ res.json({ error:e.message }); }
});
app.get('/qr', async (req,res)=>{
  const qr = getCurrentQR(); const sess = getCurrentSession();
  if(sess) return res.send(`<html><body style="background:#000;color:#0f0;font-family:monospace;padding:20px;text-align:center"><h2>✅ Session</h2><div style="font-size:8px;word-break:break-all;background:#111;padding:12px;border-radius:12px" id="s">${sess}</div><br><button onclick="navigator.clipboard.writeText(document.getElementById('s').innerText)" style="background:#0f0;color:#000;padding:10px 20px;border:none;border-radius:10px;font-weight:900">📋 COPY</button></body></html>`);
  if(qr) return res.send(`<html><meta http-equiv="refresh" content="4"><body style="background:#000;color:#0f0;font-family:monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh"><h2>SCAN QR</h2><img src="${qr}" style="width:300px;border:4px solid #0f0;border-radius:16px"></body></html>`);
  res.send(`<html><meta http-equiv="refresh" content="2"><body style="background:#000;color:#0f0;display:flex;align-items:center;justify-content:center;min-height:100vh">Starting QR...</body></html>`);
  createSessionViaQR(()=>{}, (s)=>{ globalLastSession=s; lastSessions['QR']=s; });
});
app.get('/sessions', (req,res)=>{
  const number = (req.query.number||'').replace(/[^0-9]/g,'');
  if(number && lastSessions[number]) return res.json({ status:'found', session:lastSessions[number], prefix:PREFIX });
  if(globalLastSession) return res.json({ status:'found', session:globalLastSession, prefix:PREFIX });
  res.json({ status:'waiting' });
});
app.get('/host', (req,res)=>res.json({ status:'active forever', host:HOST, prefix:PREFIX }));
app.listen(PORT, ()=>console.log('SESSION API ACTIVE'));
