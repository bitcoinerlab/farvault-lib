import { validatePubType } from './validation';
import b58 from 'bs58check';
import {
  PUBVERSIONSIZE,
  PUBVERSION,
  XPUB,
  TPUB,
  LEGACY,
  NESTED_SEGWIT,
  NATIVE_SEGWIT,
  BITCOIN_COINTYPE,
  TESTNET_COINTYPE
} from './walletConstants';
import { networks } from 'bitcoinjs-lib';

import BIP32Factory from 'bip32';
let bjsBip32;
import('tiny-secp256k1').then(ecc => (bjsBip32 = BIP32Factory(ecc)));

export async function fromSeed(seed) {
  return await bjsBip32.fromSeed(seed);
}

export function changePubType(pub, pubType) {
  validatePubType(pubType);
  let data = b58.decode(pub);
  data = data.slice(4);
  data = Buffer.concat([
    Buffer.from(
      PUBVERSION[pubType].toString(16).padStart(PUBVERSIONSIZE, 0),
      'hex'
    ),
    data
  ]);
  return b58.encode(data);
}

//Input must be an X or T pub, even when trying to derive segwit addresses
//fromBase58(inString, network) checks that the network byte matches with xpub
//or tpub
//https://github.com/bitcoinjs/bip32/blob/master/src/bip32.js
//Note there's a difference between BIP32 and SLIP132. SLIP132 defined vpub,zpub
//But these are not part of BIP32. And here we're gonna call BIP32 functions
export function derivePubKey(pub, index, isChange, network = networks.bitcoin) {
  let bip32PubType;
  if (network === networks.bitcoin) {
    bip32PubType = XPUB;
  } else if (network === networks.testnet || network === networks.regtest) {
    bip32PubType = TPUB;
  } else {
    throw new Error('Cannot find public bip32 version bytes for this network');
  }
  return bjsBip32
    .fromBase58(changePubType(pub, bip32PubType), network)
    .derive(isChange ? 1 : 0)
    .derive(index).publicKey;
}

export function pubAccountNumber(pub, network = networks.testnet) {
  let bip32PubType;
  if (network === networks.bitcoin) {
    bip32PubType = XPUB;
  } else if (network === networks.testnet || network === networks.regtest) {
    bip32PubType = TPUB;
  } else {
    throw new Error('Cannot find public bip32 version bytes for this network');
  }
  const decoded = bjsBip32.fromBase58(
    changePubType(pub, bip32PubType),
    network
  );
  if (decoded.depth !== 3) {
    throw new Error(
      'Cannot get account number if depth is not 3:' + decoded.depth
    );
  }
  const accountNumber = decoded.index & 0x7fffffff; //unharden
  return accountNumber;
}

export function networkCoinType(network = network.testnet) {
  if (network === networks.bitcoin) {
    return BITCOIN_COINTYPE;
  } else if (network === networks.testnet || network === networks.regtest) {
    return TESTNET_COINTYPE;
  } else {
    throw new Error('Unknown network');
  }
}

export function parseDerivationPath(derivationPath) {
  let purpose;
  let coinType;
  let index;
  let isChange;
  let accountNumber;
  //Remove initial m/ or M/ (if present)
  derivationPath = derivationPath.replace(/^(m\/)/i, '');
  //Sometimes hardened paths are writen with "h" or "H"
  derivationPath = derivationPath.replace(/H/gi, "'");
  const path = derivationPath.split('/');
  if (path.length !== 5) {
    throw new Error('Invalid number of elements: ' + path.length);
  }

  if (
    path[0] !== `${LEGACY}'` &&
    path[0] !== `${NESTED_SEGWIT}'` &&
    path[0] !== `${NATIVE_SEGWIT}'`
  ) {
    throw new Error('Invalid purpose: ' + path[0]);
  } else {
    purpose = parseInt(path[0].replace("'", ''));
  }

  if (
    path[1] !== `${networkCoinType(networks.bitcoin)}'` &&
    path[1] !== `${networkCoinType(networks.testnet)}'`
  ) {
    throw new Error('Invalid coin type: ' + path[1]);
  } else {
    coinType = parseInt(path[1]);
  }
  if (`${parseInt(path[2])}'` !== path[2]) {
    throw new Error('Invalid account: ' + path[2]);
  } else {
    accountNumber = parseInt(path[2]);
  }
  if (path[3] !== '0' && path[3] !== '1') {
    throw new Error('Invalid change type: ' + path[3]);
  } else {
    isChange = path[3] === '1';
  }
  if (`${parseInt(path[4])}` !== path[4]) {
    throw new Error('Invalid index: ' + path[4]);
  } else {
    index = parseInt(path[4]);
  }

  return { purpose, coinType, accountNumber, index, isChange };
}
