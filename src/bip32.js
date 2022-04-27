/** @module bip32 */

import { checkPurpose, checkNetwork, checkExtPub } from './check';
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

/**
 * Returns a new extPub with a new purpose. The `purpose`
 * specifies whether the extended pub corresponds to a legacy, nested or native
 * segwit wallet.
 *
 * Use this function as an interface to any bip32 library that
 * assumes that the purpose corresponds always to a legacy wallet even if the
 * wallet is being used to represent segwit addresses.
 *
 * In other words, use this tool to convert extended pubs that start with "xpub"
 * or "tpub" prefixes to the correct: "ypub", "zpub", or "upub" and "vpub".
 *
 * Rationale: initially, BIP32 assumed that an extended pub would always start
 * with an "xpub" or "tpub" prefix for mainnet and test networks respectively.
 * This is achieved by serializing some hardcoded `XPUBVERSION` and
 * `TPUBVERSION` bytes that were choosen so that the serialization would produce
 * "xpub" or "tpub" as an artifact.
 *
 * Then BIP49 and BIP84 appeared and added different version bytes to generate
 * ypub, zpub, upub and vpub prefixes. ypub/upub were used to specify nested
 * segwit wallets and vpub/zpub to specify native segwit.
 *
 * Some libs never adapted to this. This is a handy tool to be able to use these
 * libs.
 *
 * For example Ledger's javascript libraries will always return xpub even when
 * dealing with native Segwit wallets.
 *
 * Also bitcoin-js and bip32 npm packages assume always xpub and tpub too.
 *
 * FarVault will always use more modern BIP49 and BIP84 prefixes.
 *
 * @param {string} extPub An extended pub
 * @param {number} purpose The purpose we want to transform to: LEGACY,
 * NATIVE_SEGWIT or NESTED_SEGWIT
 * @param {Object} network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @returns {string} extPub An extended pub converted to `purpose`
 */
export function setExtPubPrefix({ extPub, purpose, network }) {
  checkNetwork(network);
  checkPurpose(purpose);
  let data = b58.decode(extPub);
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
  const newExtPub = b58.encode(data);
  checkExtPub({ extPub: newExtPub, network });
  return newExtPub;
}

/**
 * Derives an extended pub key for a particular index and isChange option.
 * See BIP44 to understand the isChange and index parameters: {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki}.
 *
 * Returns a pubkey (of type Buffer)
 *
 * @param {string} extPub An extended pub key.
 * @param {number} index The index (an integer >= 0).
 * @param {bool} isChange Whether it is a change address.
 * @param {Object} network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @returns {Buffer} a pubkey
 */
export function deriveExtPub({
  extPub,
  index,
  isChange,
  network = networks.bitcoin
}) {
  checkExtPub({ extPub, network });
  //Read setExtPubPrefix to understand why we pass to LEGACY. This is is done
  //because bjsBip32 assumes that the extPub starts with "xpub" or "tpub" even
  //when dealing with Segwit addresses.
  return bjsBip32
    .fromBase58(setExtPubPrefix({ extPub, purpose: LEGACY, network }), network)
    .derive(isChange ? 1 : 0)
    .derive(index).publicKey;
}

/**
 * Takes an extended pub key and extracts its account number
 *
 * See BIP44 to understand how to extract it: {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki}.
 * @param {string} extPub An extended pub key.
 * @param {Object} network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @returns {number} The account number extracted
 */
export function getExtPubAccountNumber({ extPub, network = networks.testnet }) {
  checkExtPub({ extPub, network });
  const decoded = bjsBip32.fromBase58(
    setExtPubPrefix({ extPub, purpose: LEGACY, network }),
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

/**
 * Gives back the account number used in a network.
 *
 * It returns 0 for the Bitcoin mainnet and 1 for regtest and testnet networks.
 * @param {Object} network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @returns {number} 0 for the Bitcoin mainnet and 1 for regtest and testnet
 * networks.
 */
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

/**
 * Takes a string representation of a derivation path and returns the elements
 * that form it.
 *
 * @param {string} derivationPath F.ex.: "84’/0’/0’/0/0" or "m/44'/1H/1h/0/0").
 * Note that "m/" is optional and h, H or ' can be used indistinctably.
 * @returns {object} Returns the `derivationPath` elements: `{ purpose, coinType, accountNumber, index, isChange }`.
 * See {@link module:bip32.serializeDerivationPath serializeDerivationPath} for further description of the types of the returned object elements.
 */
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

/**
 * Serialized a derivationPath.
 *
 * @param {number} purpose LEGACY, NESTED_SEGWIT, or NATIVE_SEGWIT.
 * @param {number} coinType 0 for Bitcoin mainnet, 1 for regtest or testnet.
 * @param {number} accountNumber The account number as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 * @param {bool} isChange Whether this is a change address or not as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 * @param {number} index The addres index within the account as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 *
 * @returns {string} The serialized derivationPath
 */
export function serializeDerivationPath({
  purpose,
  coinType,
  accountNumber,
  isChange,
  index
}) {
  if (
    typeof purpose === 'undefined' ||
    typeof coinType === 'undefined' ||
    typeof accountNumber === 'undefined'
  )
    throw new Error('Incorrect parameters');
  if (typeof isChange === 'undefined') {
    if (typeof index !== 'undefined') {
      throw new Error('Incompatible parameters');
    }
    return `${purpose}'/${coinType}'/${accountNumber}'`;
  } else {
    return `${purpose}'/${coinType}'/${accountNumber}'/${
      isChange ? 1 : 0
    }/${index}`;
  }
}

/** Extracts the purpose from an extended pub.
 * It assumes that the extended pub will have xpub, ypub, zpub, tpub, upub vpub
 * prefixes as defined in BIP44, BIP49 and BIP84.
 *
 * Note that the network is not needed to extract the purpose. It's optional.
 * Pass it if you want to make an additional check and make sure that the prefix
 * matches with the network
 * @param {string} extPub An extended pub key string
 * @param {Object} network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js). This is an optional parameter. Use it only to make an additional check and make sure that the extPub format matches this `network`
 * @returns {string} The purpose. Can be LEGACY, NESTED_SEGWIT or NATIVE_SEGWIT
 */
export function getExtPubPurpose({ extPub, network }) {
  checkExtPub({ extPub, network });
  const extPubType = extPub.slice(0, 4);
  return PURPOSES[extPubType];
}
