const express = require('express');
const fs = require('fs');
const cors = require('cors');
const { getPairCode } = require('./connection/pair');
const { startQRGeneration, getCurrentQR } = require('./connection/qr');
const { PREFIX, encodeSession, addSession } = (() => {
  try { return require('./connection/sessions'); } catch { return { PREFIX: 'dark-eye-official:~', encodeSession: (c) => 'dark-eye-official:~'+Buffer.from(c).toString('base64') }; }
})();
let dashboard;
try { dashboard = require('./connection/dashboard'); } catch { dashboard = { addPair:()=>{}, addSession:()=>{}, getData:()=>({pairs:[],sessions:[]}) }; }

const app = express();
app.use(cors());
const PORT = process.env.PORT || 10000;

let lastSession = null;
let lastCreds = null;

function load101(){ try{ return fs.readFileSync('./101','utf8'); }catch{ return '101 missing'; } }

app.get('/', (req,res)=>res.send(load101()));

app.get('/pair', async (req,res)=>{
  let number = (req.query.number||'').replace(/[^0-9]/g,'');
  let bot = req.query.bot || 'SPACE-MD';
  if(!number || number.length < 10) return res.json({ error: 'Use full number: 2637xxxxxxx', prefix: PREFIX });

  try{
    const result = await getPairCode(number, ()=>{});
    dashboard.addPair({ bot, number, code: result.code });
    res.json({ bot, number, code: result.code, prefix: PREFIX, note: `After linking, session will start with ${PREFIX}` });

    if(result.sock && result.dir){
      result.sock.ev.on('connection.update', async (u)=>{
        if(u.connection==='open'){
          const p = result.dir + '/creds.json';
          if(fs.existsSync(p)){
            const creds = fs.readFileSync(p,'utf8');
            lastCreds = creds;
            lastSession = `${PREFIX}${Buffer.from(creds).toString('base64')}`;
            dashboard.addSession({ bot, number, session: lastSession });
          }
        }
      });
    }
  }catch(e){ res.json({ error: e.message, prefix: PREFIX }); }
});

app.get('/qr', (req,res)=>{
  const qr = getCurrentQR();
  if(qr){
    res.send(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="7"><body style="background:#000;color:#0f0;font-family:monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center"><h2>QR - Prefix ${PREFIX}</h2><img src="${qr}" style="width:320px;border:4px solid #0f0;border-radius:18px"><br><br><a href="/dashboard">DASHBOARD</a></body></html>`);
  } else {
    res.send(`<html><meta http-equiv="refresh" content="3"><body style="background:#000;color:#0f0;font-family:monospace;display:flex;align-items:center;justify-content:center;min-height:100vh">Generating QR with prefix ${PREFIX}...</body></html>`);
    startQRGeneration(()=>{}, (creds, session)=>{
      if(creds){
        lastCreds=creds;
        lastSession=session || `${PREFIX}${Buffer.from(creds).toString('base64')}`;
        dashboard.addSession({ bot: 'QR', number: 'QR', session: lastSession });
      }
    });
  }
});

app.get('/sessions', (req,res)=>{
  if(lastSession && lastSession.startsWith(PREFIX)) res.json({ session: lastSession, prefix: PREFIX });
  else if(lastSession) res.json({ session: `${PREFIX}${lastSession.replace(/^.*~/,'')}`, prefix: PREFIX });
  else res.json({ error: 'No session yet', prefix: PREFIX });
});

app.get('/dashboard', (req,res)=>{
  const data = dashboard.getData();
  res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>DASHBOARD ${PREFIX}</title><style>*{font-family:monospace;box-sizing:border-box}body{background:#080808;color:#0f0;margin:0;padding:16px}.card{border:1px solid #0f0;border-radius:14px;padding:14px;margin-bottom:12px;background:rgba(0,255,0,.03);word-break:break-all} a{color:#000;background:#0f0;padding:8px 14px;border-radius:8px;text-decoration:none}</style></head><body><h2>DASHBOARD - Prefix: ${PREFIX}</h2><div class="card">Current: ${lastSession||'None'}</div><div class="card"><b>Pairs:</b><br>${JSON.stringify(data.pairs.slice(0,10))}</div><div class="card"><b>Sessions:</b><br>${data.sessions.map(s=>s.session?.slice(0,80)).join('<br><br>')}</div><br><a href="/">HOME</a> <a href="/pair?number=263783546271&bot=SPACE-MD">TEST PAIR</a></body></html>`);
});

app.listen(PORT, ()=>console.log(`Running with prefix ${PREFIX} on ${PORT}`));
