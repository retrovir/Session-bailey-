const { default: makeWASocket, useSingleFileAuthState, fetchLatestBaileysVersion } = require('@adiwajshing/baileys');
const qrcode = require('qrcode-terminal');
const { Boom } = require('@hapi/boom');

async function start() {
  const FILE = './auth_info.json';
  const { state, saveState } = useSingleFileAuthState(FILE);

  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 2204, 13] }));

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
      console.log('Scan the QR above from WhatsApp -> Linked Devices -> Link a device');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error && lastDisconnect.error.output) ? lastDisconnect.error.output.statusCode : null;
      console.log('Connection closed, status code:', statusCode);
      if (statusCode !== 401) {
        console.log('Reconnecting...');
        start().catch(console.error);
      } else {
        console.log('Logged out (401). Remove auth_info.json to re-authenticate from scratch.');
      }
    }

    if (connection === 'open') {
      console.log('Connection open — session created and saved to', FILE);
    }
  });

  sock.ev.on('creds.update', saveState);

  process.on('SIGINT', async () => {
    console.log('Interrupted, exiting...');
    process.exit(0);
  });
}

start().catch(err => {
  console.error('Failed to start socket:', err);
  if (err instanceof Boom) {
    console.error('Boom error output:', err.output);
  }
});