let pairs = [];
let sessions = [];
module.exports = {
  addPair: (d)=>{ pairs.unshift({...d, time: Date.now()}); if(pairs.length>50) pairs.pop(); },
  addSession: (d)=>{ sessions.unshift({...d, time: Date.now()}); if(sessions.length>100) sessions.pop(); },
  getData: ()=>({ pairs, sessions }),
  getStats: ()=>({ connected: sessions.length, alive: sessions.length, offline: 0, total: pairs.length + sessions.length })
};
