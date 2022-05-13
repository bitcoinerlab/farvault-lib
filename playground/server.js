//Nice react app example
//https://github.com/bitcoinjs/tiny-secp256k1/tree/master/examples/react-app
//
//The nonce is not correctly handled. if requesting /nonce I can be hijacking the nonce of future sessions

const express = require('express');
const path = require('path');

const session = require('express-session');

const https = require('https');
const app = express();
const fs = require('fs');

const key = fs.readFileSync('./localhost-key.pem');
const cert = fs.readFileSync('./localhost.pem');

const server = https.createServer({ key: key, cert: cert }, app);
const randomBytes = require('randombytes');
const bodyParser = require('body-parser');

//We transpiled the functions from examples/server/app.js to examples/dist/app.js using webpack for maximum compatibility calling the same functions in the browser & node (be able to use import/export and so on
const serverApp = require('../dist/playgroundTranspiledServer/index.js');
const handleProtected = serverApp.handleProtected;
const handleNonce = serverApp.handleNonce;
const handleLogout = serverApp.handleLogout;

app.use('/dist', express.static(path.join(__dirname, '../dist')));

//It uses memory sessions. This is probably not very good. Not super bad either depending on the use.
//Since we use memory sessions then it is not a big deal to change the secret on each reboot.
app.use(
  session({
    secret: randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }
  })
);

app.post(
  '/protected',
  //attach the raw body so that we can build the message to sign
  bodyParser.raw({ type: '*/*' }),
  (req, res) => {
    handleProtected(req, res);
  }
);

app.get('/nonce', (req, res) => {
  handleNonce(req, res);
});

app.get('/logout', (req, res) => {
  handleLogout(req, res);
});

app.get('/', (req, res) => {
  res.send(
    `
<!DOCTYPE html>
<html>
    <head>
      <script src="/dist/bundle.js" defer></script>
    </head>
    <body>
      You might want to add a CSRF-JWT token on the forms/buttons to avoid these type of attacks.<br/>
      <p>
      <button onclick="playgroundLib.requestNonce()">
        Request nonce (if CORS) - not needed
      </button>
      </p>
      <p>
      <button onclick="playgroundLib.requestProtectedContent()">
        Request protected content
      </button>
      </p>
      <p>
      <button onclick="playgroundLib.requestLogout()">
        Logout
      </button>
      </p>
      <p>
      <button onclick="playgroundLib.softwareBalanceTestnet()">
        Test softwareBalanceTestnet
      </button>
      </p>
      <p>
      <button onclick="playgroundLib.ledgerBalanceTestnet()">
        Test ledgerBalanceTestnet
      </button>
      </p>
    <p id="protectedContentDisplay"/>
    </body>
</html>
    `
  );
});

server.listen(3443, () => {
  console.log('listening on 3443');
});
