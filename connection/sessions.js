

const fs = require('fs');

const PREFIX = 'dark-eye-official';

function saveSessionFromCredsFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(data);

    if (!json || !json.creds || !json.keys) {
      throw new Error('Credentials file is incomplete');
    }

    const encoded = Buffer
      .from(JSON.stringify(json))
      .toString('base64');

    return `${PREFIX}:~${encoded}`;
  } catch (error) {
    console.error('Session generation failed:', error.message);
    return null;
  }
}

module.exports = { saveSessionFromCredsFile, PREFIX };

