const fs = require('fs');
const PREFIX = 'dark-eye-official';

function saveSessionFromCredsFile(filePath){
  try{
    const data = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(data);
    const b64 = Buffer.from(JSON.stringify(json)).toString('base64');
    return `${PREFIX}:~${b64}`;
  }catch(e){
    console.log('session encode error', e.message);
    return `${PREFIX}:~${Date.now()}`;
  }
}

module.exports = { saveSessionFromCredsFile, PREFIX };
