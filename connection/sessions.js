const fs = require('fs');
const path = require('path');

function ensureDir(dir){ if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); }

function saveSessionFromBase64(sessionStr, targetDir='./auth_info_baileys'){
  ensureDir(targetDir);
  try{
    let data = sessionStr.trim();
    if(data.includes('~')) data = data.split('~')[1];
    if(data.includes('#')) data = data.split('#')[1];
    const buff = Buffer.from(data,'base64');
    let json = JSON.parse(buff.toString('utf8'));
    if(json.creds) json = json.creds;
    fs.writeFileSync(path.join(targetDir,'creds.json'), JSON.stringify(json,null,2));
    console.log('[SESSION] Restored to', targetDir);
    return true;
  }catch(e){ console.error('[SESSION] Restore failed:',e.message); return false; }
}

function saveSessionFromCredsJson(credsJson, targetDir='./auth_info_baileys'){
  ensureDir(targetDir);
  try{
    const creds = typeof credsJson==='string'? JSON.parse(credsJson) : credsJson;
    fs.writeFileSync(path.join(targetDir,'creds.json'), JSON.stringify(creds,null,2));
    return true;
  }catch(e){ console.error(e.message); return false; }
}

function generateSessionString(targetDir='./auth_info_baileys'){
  try{
    const p = path.join(targetDir,'creds.json');
    if(!fs.existsSync(p)) return null;
    const creds = fs.readFileSync(p,'utf8');
    return 'DARK-EYE~' + Buffer.from(creds).toString('base64');
  }catch{ return null; }
}

function loadSessionDir(targetDir='./auth_info_baileys'){
  return fs.existsSync(path.join(targetDir,'creds.json'));
}
function clearSession(targetDir='./auth_info_baileys'){
  if(fs.existsSync(targetDir)) fs.rmSync(targetDir,{recursive:true,force:true});
}
module.exports = { saveSessionFromBase64, saveSessionFromCredsJson, generateSessionString, loadSessionDir, clearSession, ensureDir };
