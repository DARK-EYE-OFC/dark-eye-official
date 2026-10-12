

const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const fs = require('fs');
const path = require('path');
const { saveSessionFromCredsFile, PREFIX } = require('./sessions');

function getDayMood() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning 🌅';
  if (h < 15) return 'Good Afternoon ☀️';
  if (h < 18) return 'Good Evening 🌇';
  return 'Good Night 🌙';
}

function formatDate() {
  const d = new Date();
  return {
    date: d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }),
    day: d.toLocaleDateString('en-GB', { weekday: 'long' }),
    time: d.toLocaleTimeString('en-GB'),
    browser: 'Chrome (Linux)',
    watermark: 'DARK-EYE-OFC'
  };
}

async function sendStylishMessages(sock, jid, session, botName = 'DARK-EYE-OFFICIAL') {
  const { date, day, time, browser, watermark } = formatDate();
  const username = jid.split('@')[0];

  try {
    const msg1 =
      `${getDayMood()} @${username} 👋\n\n` +
      `✅ YOUR BOT IS CONNECTED\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🤖 Bot: ${botName}\n` +
      `🌐 Running on: ${browser}\n` +
      `📅 Date: ${date}\n` +
      `📆 Day: ${day}\n` +
      `⏰ Time: ${time}\n` +
      `💧 Powered by: ${watermark}`;

    await sock.sendMessage(jid, {
      text: msg1,
      mentions: [jid]
    });

    await delay(1000);
    const sent = await sock.sendMessage(jid, { text: session });

    await delay(800);
    await sock.sendMessage(
      jid,
      {
        text:
          `🔐 YOUR SESSION\n━━━━━━━━━━━━━━━━━━\n` +
          `Keep your session private. Never share it with anyone.`
      },
      sent?.key ? { quoted: sent } : {}
    );

    await delay(1200);
    await sock.sendMessage(jid, {
      text:
        `${botName} Successfully Active & Running 🚀\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📡 Status: Alive ✅\n` +
        `👑 Owner: @${username}\n` +
        `💧 Developer: DARK-EYE-OFC`,
      mentions: [jid]
    });
  } catch (e) {
    console.log('[PAIR] Message error:', e.message);
  }
}

async function createSessionViaPair(number, onCode, onSession, onStatus) {
  number = String(number).replace(/\D/g, '');

  if (!number || number.length < 10 || number.length > 15) {
    throw new Error('Enter a valid international phone number.');
  }

  const dir = path.join(
    __dirname,
    '..',
    'temp',
    `PAIR_${number}_${Date.now()}`
  );

  fs.mkdirSync(dir, { recursive: true });

  let sock;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(dir);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['DARK-EYE-OFFICIAL', 'Chrome', '122.0.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false
    });

    sock.ev.on('creds.update', saveCreds);

    // Register the connection listener before requesting the code.
sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        console.log(`[PAIR] ${number} CONNECTED`);

        try {
          const credsPath = path.join(dir, 'creds.json');

          // Allow credentials to be written before reading them.
          await delay(1000);

          if (!fs.existsSync(credsPath)) {
            console.error('[PAIR] Credentials file not found.');
            if (onStatus) onStatus('failed');
            return;
          }

          const session = saveSessionFromCredsFile(credsPath);

          if (!session) {
            console.error('[PAIR] Session generation failed.');
            if (onStatus) onStatus('failed');
            return;
          }

          const jid = sock.user?.id || `${number}@s.whatsapp.net`;

          await sendStylishMessages(
            sock,
            jid,
            session,
            'DARK-EYE-OFFICIAL'
          );

          if (onSession) onSession(session, credsPath, jid);
          if (onStatus) onStatus('connected');

          // Keep the temporary credentials until the session is saved.
          setTimeout(() => {
            try {
              fs.rmSync(dir, { recursive: true, force: true });
              sock.end();
            } catch {}
          }, 10000);
        } catch (e) {
          console.error('[PAIR] Session handling error:', e.message);
          if (onStatus) onStatus('failed');
        }
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log(`[PAIR] Connection closed. Reason: ${reason}`);

        if (reason === DisconnectReason.loggedOut) {
          if (onStatus) onStatus('failed');
        }
      }
    });

    if (sock.authState.creds.registered) {
      throw new Error('This temporary session is already registered. Start a fresh pairing attempt.');
    }

    await delay(2000);

    // This requests the code from Baileys; it does not fabricate one.
    console.log('[PAIR] Requesting WhatsApp code...');
    console.log('[PAIR] Socket user:', sock.user?.id || 'not assigned yet');
    console.log('[PAIR] Registered:', sock.authState.creds.registered);

    const code = await sock.requestPairingCode(number);

    if (!code || typeof code !== 'string') {
      throw new Error('WhatsApp did not return a pairing code.');
    }

    console.log(`[PAIR] WhatsApp pairing code received for ${number}.`);

    if (onCode) onCode(code);

    return sock;
  } catch (e) {
    console.error('[PAIR] Pairing request failed:', e.stack || e);

    if (onStatus) onStatus('failed');

    if (sock) {
      try {
        sock.end();
      } catch {}
    }

    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}

    throw e;
  }
}

module.exports = { createSessionViaPair, PREFIX };

