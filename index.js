const express = require('express');
const fs = require('fs');
const cors = require('cors');
const { getPairCode } = require('./connection/pair');
const { startQRGeneration, getCurrentQR } = require('./connection/qr');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3000;

let lastSession = null;
let lastCreds = null;

// Load panel from 101 file (as you requested)
function getPanelHtml(){
  try{
    if(fs.existsSync('./101')) return fs.readFileSync('./101','utf8');
    else return '<h1>101 file not found</h1>';
  }catch(e){ return 'Error loading 101: '+e.message; }
}

app.get('/', (req,res)=>{ res.send(getPanelHtml()); });

app.get('/qr', async (req,res)=>{
  const qr = getCurrentQR();
  if(qr){
    res.send(`
    <html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="7">
    <style>body{background:#000;color:#0f0;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:monospace;flex-direction:column;text-align:center}
    img{width:320px;max-width:92vw;border:4px solid #0f0;border-radius:20px;box-shadow:0 0 35px #0f0;margin:20px 0}
    a{color:#000;background:#0f0;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:800}</style></head>
    <body><h2>SCAN QR</h2><img src="${qr}"><p>WhatsApp > Linked Devices > Link a Device</p><br><a href="/">BACK TO PANEL</a></body></html>
    `);
  } else {
    res.send(`
    <html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="3">
    <style>body{background:#000;color:#0f0;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:monospace;text-align:center}</style></head>
    <body><h3>Generating QR...</h3><p>Please refresh in 3 seconds</p></body></html>
    `);
    startQRGeneration(()=>{}, (creds)=>{
      if(creds){
        lastCreds=creds;
        lastSession='DARK-EYE~'+Buffer.from(creds).toString('base64');
      }
    });
  }
});

app.get('/pair', async (req,res)=>{
  let number = (req.query.number||'').replace(/[^0-9]/g,'');
  if(!number) return res.json({error:'Use ?number=26378xxxxxxx'});
  try{
    const result = await getPairCode(number, console.log);
    res.json({ code: result.code, number });
    if(result.sock){
      result.sock.ev.on('connection.update', async (u)=>{
        if(u.connection==='open'){
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
  if(lastSession) res.json({ session: lastSession });
  else res.json({ error:'No session yet, connect first via /qr or /pair' });
});

app.get('/creds', (req,res)=>{
  if(lastCreds) res.json(JSON.parse(lastCreds));
  else res.json({error:'No creds yet'});
});

app.listen(PORT, ()=>console.log('Panel from 101 running on '+PORT));
