import {
  checkPurpose,
  checkNetwork,
  checkExtendedPubType,
  checkCoinTypeExtendedPubType
} from './check';
import b58 from 'bs58check';
import {
  PURPOSES,
  PUBVERSIONSIZE,
  PUBVERSIONS,
  LEGACY,
  NESTED_SEGWIT,
  NATIVE_SEGWIT,
  BITCOIN_COINTYPE,
  TESTNET_COINTYPE,
  REGTEST_COINTYPE
} from './walletConstants';
import { networks } from 'bitcoinjs-lib';

import BIP32Factory from 'bip32';
let bjsBip32;
import('tiny-secp256k1').then(ecc => (bjsBip32 = BIP32Factory(ecc)));

export async function fromSeed(seed) {
  return await bjsBip32.fromSeed(seed);
}

export function setExtendedPubPrefix(extendedPub, purpose, network) {
  checkPurpose(purpose);
  checkNetwork(network);
  let data = b58.decode(extendedPub);
  data = data.slice(4);
  data = Buffer.concat([
    Buffer.from(
      PUBVERSIONS[getNetworkCoinType(network)][purpose]
        .toString(16)
        .padStart(PUBVERSIONSIZE, 0),
      'hex'
    ),
    data
  ]);
  return b58.encode(data);
}

//NOTE on the implementation: There's a limitation on bitcoinjs. It forces the
//prefix to be xpub even for Segwit (BIP84) or Nested Segwit (BIP49)
//Input must be an X or T extendedPub, even when trying to derive segwit addresses
//fromBase58(inString, network) checks that the network byte matches with xpub
//or tpub
//https://github.com/bitcoinjs/bip32/blob/master/src/bip32.js
//Note there's a difference between BIP32 and SLIP132. SLIP132 defined vpub,zpub
//But these are not part of BIP32. And here we're gonna call BIP32 functions
export function deriveExtendedPub(
  extendedPub,
  index,
  isChange,
  network = networks.bitcoin
) {
  return bjsBip32
    .fromBase58(setExtendedPubPrefix(extendedPub, LEGACY, network), network)
    .derive(isChange ? 1 : 0)
    .derive(index).publicKey;
}

export function getExtendedPubAccountNumber(
  extendedPub,
  network = networks.testnet
) {
  checkNetwork(network);
  const decoded = bjsBip32.fromBase58(
    setExtendedPubPrefix(extendedPub, LEGACY, network),
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

export function getNetworkCoinType(network = network.testnet) {
  if (network === networks.bitcoin) {
    return BITCOIN_COINTYPE;
  } else if (network === networks.testnet) {
    return TESTNET_COINTYPE;
  } else if (network === networks.regtest) {
    return REGTEST_COINTYPE;
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
    path[1] !== `${getNetworkCoinType(networks.bitcoin)}'` &&
    path[1] !== `${getNetworkCoinType(networks.testnet)}'` &&
    path[1] !== `${getNetworkCoinType(networks.regtest)}'`
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

/** Extracts the purpose from an extended pub.
 * It assumes that the extended pub will have xpub, ypub, zpub, tpub, upub vpub
 * prefixes as defined in BIP44, BIP49 and BIP84.
 *
 * Note that the network is not needed to extract the purpose. It's optional.
 * Pass it if you want to make an additional check and make sure that the prefix
 * matches with the network
 * @param {string} extendedPub An extended pub key string
 * @param {Object} network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js). This is an optional parameter. Use it only to make an additional check and make sure that the extendedPub format matches this `network`
 * @returns {string} The purpose. Can be LEGACY, NESTED_SEGWIT or NATIVE_SEGWIT
 */
export function getExtendedPubPurpose(extendedPub, network) {
  //throw new Error(extendedPub);
  if (typeof extendedPub !== 'string') {
    throw new Error('Incorrect extendedPub: ' + extendedPub);
  }
  const extendedPubType = extendedPub.slice(0, 4);
  checkExtendedPubType(extendedPubType);
  if (typeof network !== undefined) {
    checkNetwork(network);
    checkCoinTypeExtendedPubType(getNetworkCoinType(network), extendedPubType);
  }
  return PURPOSES[extendedPubType];
}
