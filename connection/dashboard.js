const fs = require('fs');
const path = './connection/dashboard.json';

function load(){
  try{ if(fs.existsSync(path)) return JSON.parse(fs.readFileSync(path,'utf8')); }catch{}
  return { pairs: [], sessions: [] };
}
function save(data){
  try{ fs.writeFileSync(path, JSON.stringify(data,null,2)); }catch(e){ console.log(e.message); }
}
function addPair(entry){
  const data = load();
  data.pairs.unshift({ ...entry, time: new Date().toISOString() });
  if(data.pairs.length>50) data.pairs = data.pairs.slice(0,50);
  save(data);
}
function addSession(entry){
  const data = load();
  data.sessions.unshift({ ...entry, time: new Date().toISOString() });
  if(data.sessions.length>50) data.sessions = data.sessions.slice(0,50);
  save(data);
}
function getData(){ return load(); }

module.exports = { addPair, addSession, getData };
