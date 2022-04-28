import { digiSignMessage } from './digiSignMessage';
import { getDerivationPath } from './derivationPath';
import { payments } from 'bitcoinjs-lib';
import bitcoinMessage from 'bitcoinjs-message';
import randomBytes from 'randombytes';
import { mnemonicToSeed } from 'bip39';
import BIP32Factory from 'bip32';
import ECPairFactory from 'ecpair';

//ecpair use it like this:
//https://github.com/bitcoinjs/ecpair
//webassembly used in tiny-secp256k1 is downloaded asynchornously and thus,
//this package is returned as a promise. Make example a variable and not an
//object so that we can do stuff like this: example.setCnonce();
let fromSeed, fromWIF;
import('tiny-secp256k1').then(ecc => {
  fromSeed = BIP32Factory(ecc).fromSeed;
  fromWIF = ECPairFactory(ecc).fromWIF;
});

async function getBip32Root(mnemonic) {
  const seed = await mnemonicToSeed(mnemonic);
  const root = fromSeed(seed);
  return root;
}

export async function deriveAddressAndSign({
  mnemonic,
  realm,
  userIndex = 0,
  nonce,
  cnonce,
  body
}) {
  const bip32root = await getBip32Root(mnemonic);
  const message = digiSignMessage({ realm, nonce, cnonce, body });
  const derivationPath = getDerivationPath(realm);

  const keyPair = bip32root.derivePath(derivationPath);
  //BECH32 Segwit address bc1q
  const { address } = payments.p2wpkh({ pubkey: keyPair.publicKey });
  const signature = bitcoinMessage.sign(
    message,
    keyPair.privateKey,
    keyPair.compressed, //This is a public key compressed.
    { extraEntropy: randomBytes(32) } //for non deterministic signatures
  );
  return { address, signature: signature.toString('base64') };
}
