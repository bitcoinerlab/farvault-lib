//Excelente artóculo de PSBT y como usar HWI y analizar los PSBT y como usar la Regtest
// https://estudiobitcoin.com/como-crear-una-cartera-watch-only-wallet-desde-el-nodo-de-bitcoin/
// Trezor quizá se queje por usar paths no estándares. Más ejemplos PSBT usando HWI: (también menciona algo de locktime):
// https://hwi.readthedocs.io/en/latest/examples/walkthrough/walkthrough.html
//
//Wallet de HD!!! Para buscar pasta!!! en la HD!!!
//https://github.com/bitcoinjs/bip32-utils
//con su GAP LIMIT y todo!!!!

import { parse as authParse } from 'auth-header';

import REALM from './realm';
const MNEMONIC =
  'nhale praise target steak garlic cricket paper better evil almost sadness crawl city banner amused fringe fox insect roast aunt prefer hollow basic ladder';

//import { deriveAddressAndSign } from '../src/softHDWallet';
import { deriveAddressAndSign } from './ledgerNanoHDWallet';

//Creates a nonce unique to this instance (client).
//It uses the format UNIXTIME_IN_SECS:SEQUENCE_NUMBER
const setCnonce = (function () {
  let sequence = 0;
  return function () {
    return Math.round(Date.now() / 1000) + '-' + sequence++;
  };
})();

//Sets a nonce. Returns the nonce. If nothing is passed it keeps the last nonce.
//setNonce('a') -> 'a' setNonce() -> 'a' setNonce('b') -> 'b' setNonce() -> 'b'
const setNonce = (function () {
  let lastNonce;
  return function (nonce) {
    if (typeof nonce !== 'undefined') lastNonce = nonce;
    return lastNonce;
  };
})();

//sets whether a session is alive or not
//call it without argumetns to get whether it is alive (true) or not (false)
//or unknown (undefined)
const setAliveSession = (function () {
  //undefined in first call (we make it explicit for readability).
  //We don't know whether the stored cookie is still valid on the server
  let isAlive = undefined;
  return function (_isAlive) {
    if (typeof _isAlive !== 'undefined') isAlive = _isAlive;
    return isAlive;
  };
})();

export async function requestNonce() {
  const response = await fetch('/nonce');
  const nonce = await response.json();
  return setNonce(nonce.nonce);
}

export async function requestLogout() {
  return await fetch('/logout');
}

export async function requestProtectedContent() {
  const nonce = setNonce();
  const body = 'test';
  let response;
  //If we don't know the nonce yet
  if (setAliveSession() !== true && typeof nonce !== 'undefined') {
    const cnonce = setCnonce();

    const { address, signature } = await deriveAddressAndSign({
      mnemonic: MNEMONIC,
      realm: REALM,
      nonce,
      cnonce,
      body
    });

    response = await fetch('/protected', {
      headers: {
        Authorization: `Digisign realm="${REALM}", nonce="${nonce}", cnonce="${cnonce}", signature="${signature}", address="${address}"`
      },
      method: 'POST',
      body
    });
  } else {
    //We either have an open session or we still don't know the nonce.
    //If we have an open session then we'll get a 200 response.
    //If not then we'll get a 401 and will start a login
    response = await fetch('/protected', { method: 'POST', body });
  }

  if (response.status < 400 || response.status >= 600) {
    setAliveSession(true);
    const content = await response.json();
    document.getElementById('protectedContentDisplay').innerHTML =
      content.message; //JSON.stringify(content);
  } else {
    setAliveSession(false);
    //This is how you get the nonce. If CORS, then you should request the token
    //using a custom API
    const auth = authParse(response.headers.get('WWW-Authenticate'));
    document.getElementById('protectedContentDisplay').innerHTML =
      'Network error: ' +
      response.status +
      '<br/>' +
      '<pre>' +
      JSON.stringify(auth, undefined, 2) +
      '</pre>';

    //we need to wait for 2 paint reflows (so we can see
    //what we set to innerHTML before the popup)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (
          window.confirm(
            'Auth required.\
            Do you want to send a new request with signed auth headers?'
          )
        ) {
          //Set the nonce
          setNonce(auth.params.nonce);
          requestProtectedContent();
        }
      });
    });
  }
}
