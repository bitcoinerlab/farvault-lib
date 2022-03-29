const authorization = require('auth-header');
import { verify } from 'bitcoinjs-message';
import { digiSignMessage } from './digiSignMessage';
import REALM from './realm';

export function handleLogout(req, res) {
  req.session.destroy();
  res.json({ success: true, message: 'logout success!' });
}

export function handleProtected(req, res) {
  if (req.session.address) {
    res.statusCode = 200;
    res.json({
      success: true,
      message: 'Here comes the secret (from open session)!'
    });
    return;
  }
  if (typeof req.get('authorization') !== 'undefined') {
    const auth = authorization.parse(req.get('authorization'));
    if (
      auth &&
      auth.scheme === 'Digisign' &&
      auth.params &&
      auth.params.nonce === req.session.id &&
      auth.params.realm === REALM
    ) {
      const message = digiSignMessage({ ...auth.params, body: req.body });
      //here I need the address, the signature and the message:
      //Check if the address type is supported. If not return supported address: bitcoin types
      if (
        verify(message, auth.params.address, auth.params.signature, null, true)
      ) {
        req.session.address = auth.params.address;
        //Assume it's ok.
        res.statusCode = 200;
        res.json({ success: true, message: 'Here comes the secret' });
        return;
      }
    }
  }

  //Default
  //https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication
  //Create a new ression on each 401 response
  req.session.regenerate(() => {
    res.statusCode = 401;
    res.set(
      'WWW-Authenticate',
      `Digisign realm="${REALM}", nonce="${req.session.id}"`
    );
    res.end('Unauthorized');
  });
}

export function handleNonce(req, res) {
  res.json({ nonce: req.session.id });
}
