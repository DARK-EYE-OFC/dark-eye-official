const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { saveSessionFromCredsFile, PREFIX } = require('./sessions');

function getDayMood(){
  const h = new Date().getHours();
  if(h < 12) return 'Good Morning 🌅';
  if(h < 15) return 'Good Afternoon ☀️';
  if(h < 18) return 'Good Evening 🌇';
  return 'Good Night 🌙';
}
function formatDate(){
  const d = new Date();
  return {
    date: d.toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' }),
    day: d.toLocaleDateString('en-GB', { weekday:'long' }),
    time: d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
    browser: 'Chrome (Linux)',
    watermark: 'dark-eye-official tech'
  };
}

async function sendStylishMessages(sock, jid, session, botName='SPACE-MD'){
  const { date, day, time, browser, watermark } = formatDate();
  const dayMood = getDayMood();
  const username = jid.split('@')[0];

  try{
    // 1. CONNECTED MESSAGE
    const msg1 = `${dayMood} @${username} 👋\n\n✅ YOUR BOT IS CONNECTED\n━━━━━━━━━━━━━━━━━━\n🤖 Bot: ${botName}\n🌐 Running on: ${browser}\n📅 Date: ${date}\n📆 Day: ${day}\n⏰ Time: ${time}\n💧 Powered by: ${watermark}`;

    await sock.sendMessage(jid, { text: msg1, mentions: [jid] });
    await delay(1200);

    // 2. SESSION ALONE WITH ONLY COPY BUTTON
    // This is the important one - session alone so user can long-press if button fails
    let sessionSent;
    try{
      // Try native copy button (new Baileys)
      sessionSent = await sock.sendMessage(jid, {
        text: session,
        footer: 'Tap COPY button or hold to copy',
        templateButtons: [
          {
            index: 1,
            copyButton: {
              displayText: '📋 COPY',
              copyCode: session
            }
          }
        ]
      });
    }catch(e){
      // Fallback - session alone without buttons, still copyable by long press
      console.log('Copy button not supported, sending raw session:', e.message);
      sessionSent = await sock.sendMessage(jid, { text: session });
    }

    await delay(1000);

    // 3. REPLY TO SESSION WITH WARNING
    const msg3 = `🔐 YOUR SESSION\n━━━━━━━━━━━━━━━━━━\nCopy this session easily:\n\n_Tap copy button or hold to copy_\n\n> *_Keep your session-id privately. Don't share it with anyone Please. Cuz we are not responsible if your account got hacked._*`;

    if(sessionSent && sessionSent.key){
      await sock.sendMessage(jid, { text: msg3 }, { quoted: sessionSent });
    } else {
      await sock.sendMessage(jid, { text: msg3 });
    }

    await delay(1500);

    // 4. FINAL FORWARDED ACTIVE MESSAGE
    const finalMsg = `${botName} Successfully Active & Running 🚀\n━━━━━━━━━━━━━━━━━━\n🌐 Running on: ${browser}\n📡 Status: Alive ✅\n👑 Owner: @${username}\n\nForwarding from Official Channel\n\nJoin: https://whatsapp.com/channel/0029Vb6zh00FcowG8euO480M\n\n${botName} | Please join our official community for more information and updates.`;

    await sock.sendMessage(jid, {
      text: finalMsg,
      mentions: [jid],
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363395467876104@newsletter',
          newsletterName: `${botName} Official`,
          serverMessageId: 1
        },
        externalAdReply: {
          title: `${botName} Successfully Active`,
          body: `Running on ${browser} | Status Alive`,
          thumbnailUrl: 'https://i.ibb.co/4pDNDk1/space-md.jpg',
          sourceUrl: 'https://whatsapp.com/channel/0029Vb6zh00FcowG8euO480M',
          mediaType: 1
        }
      }
    });

    console.log(`[pair.js] Stylish flow sent to ${username}`);
  }catch(e){ console.log('Send error:', e.message); }
}

async function createSessionViaPair(number, onCode, onSession){
  const dir = path.join('./temp', `PAIR_${number}_${Date.now()}`);
  fs.mkdirSync(dir,{recursive:true});
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const sock = makeWASocket({ auth: state, printQRInTerminal:false, browser:['dark-eye-official','Chrome','122.0'] });
  sock.ev.on('creds.update', saveCreds);
  if(!sock.authState.creds.registered){
    await delay(1500);
    const code = await sock.requestPairingCode(number);
    if(onCode) onCode(code);
    sock.ev.on('connection.update', async (u)=>{
      if(u.connection==='open'){
        const p = path.join(dir,'creds.json');
        if(fs.existsSync(p)){
          const session = saveSessionFromCredsFile(p);
          const jid = sock.user?.id || `${number}@s.whatsapp.net`;
          await sendStylishMessages(sock, jid, session, 'SPACE-MD');
          if(onSession) onSession(session, p, jid);
          setTimeout(()=>{ try{ fs.rmSync(dir,{recursive:true,force:true}); sock.end(); }catch{} }, 8000);
        }
      }
    });
    return { code, sock, dir };
  }
}
module.exports = { createSessionViaPair, PREFIX };
