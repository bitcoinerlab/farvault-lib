/**
 * This module assumes BIP44, BIP49 and BIP84 account-structures in all the methods.
 * @module bip32
 */

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

export async function fromSeed(seed, network = networks.bitcoin) {
  //No need to memoize it
  return await bjsBip32.fromSeed(seed, network);
}

/**
 * Converts and returns an extended pub to use a new `purpose`. The `purpose`
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
 * Motivation: initially, BIP32 assumed that an extended pub would always start
 * with an "xpub" or "tpub" prefix for mainnet and test networks respectively.
 * This is achieved by serializing some hardcoded `XPUBVERSION` and
 * `TPUBVERSION` bytes that were choosen so that the serialization would produce
 * "xpub" or "tpub" as an artifact.
 *
 * Then BIP49 and BIP84 appeared and added different version bytes to generate
 * ypub, zpub, upub and vpub prefixes. ypub/upub were used to specify nested
 * segwit wallets and vpub/zpub to specify native segwit.
 *
 * Some libs never adapted to this. This is a handy tool to be able to interact with
 * these libs.
 *
 * For example Ledger's javascript libraries will always expect to be passed an
 * xpub even when dealing with native Segwit wallets.
 *
 * Also bitcoin-js and bip32 npm packages always assume xpub and tpub too.
 *
 * Internally, FarVault works assuming always different BIP44, BIP49 and BIP84
 * prefixes.
 *
 * @param {object} params
 * @param {string} params.extPub An extended pub
 * @param {number} params.purpose The purpose we want to transform to: LEGACY,
 * NATIVE_SEGWIT or NESTED_SEGWIT
 * @param {object} params.network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
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
 * @param {object} params
 * @param {string} params.extPub An extended pub key.
 * @param {number} params.index The index (an integer >= 0).
 * @param {boolean} params.isChange Whether it is a change address.
 * @param {object} [params.network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
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
 * It assumes BIP44, BIP49 and BIP84 account-structures.
 *
 * See BIP44 to understand how to extract it: {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki}.
 * @param {object} params
 * @param {string} params.extPub An extended pub key.
 * @param {object} [params.network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @returns {number} The account number extracted
 */
export function getExtPubAccountNumber({ extPub, network = networks.bitcoin }) {
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

/** Extracts the purpose from an extended pub.
 * It assumes that the extended pub will have xpub, ypub, zpub, tpub, upub vpub
 * prefixes as defined in BIP44, BIP49 and BIP84.
 *
 * Note that the network is not needed to extract the purpose. It's optional.
 * Pass it if you want to make an additional check and make sure that the prefix
 * matches with the network
 * @param {object} params
 * @param {string} params.extPub An extended pub key string
 * @param {object} params.network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js). This is an optional parameter. Use it only to make an additional check and make sure that the extPub format matches this `network`
 * @returns {string} The purpose. Can be LEGACY, NESTED_SEGWIT or NATIVE_SEGWIT
 */
export function getExtPubPurpose({ extPub, network }) {
  checkExtPub({ extPub, network });
  const extPubType = extPub.slice(0, 4);
  return PURPOSES[extPubType];
}

/**
 * Gives back the account number used in a network.
 *
 * It assumes BIP44, BIP49 and BIP84 account-structures.
 *
 * It returns 0 for the Bitcoin mainnet and 1 for regtest and testnet networks.
 * @param {object} [network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @returns {number} 0 for the Bitcoin mainnet and 1 for regtest and testnet
 * networks.
 */
export function getNetworkCoinType(network = networks.bitcoin) {
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
 * It assumes BIP44, BIP49 and BIP84 account-structures.
 *
 * @param {string} path F.ex.: "84’/0’/0’/0/0" or "m/44'/1H/1h/0/0").
 * Note that "m/" is optional and h, H or ' can be used indistinctably.
 * @returns {object} Returns the `path` elements: `{ purpose: number, coinType: number, accountNumber:number, index:number, isChange:boolean }`.
 * See {@link module:bip32.serializeDerivationPath serializeDerivationPath} for further description of the types of the returned object elements.
 */
export function parseDerivationPath(path) {
  //No need to memoize it
  let purpose;
  let coinType;
  let index;
  let isChange;
  let accountNumber;
  if (typeof path !== 'string') {
    throw new Error('Invalid path type');
  }
  //Remove initial m/ or M/ (if present)
  path = path.replace(/^(m\/)/i, '');
  //Sometimes hardened paths are writen with "h" or "H"
  path = path.replace(/H/gi, "'");
  const pathComponents = path.split('/');
  if (pathComponents.length !== 5) {
    throw new Error('Invalid number of elements in path');
  }

  if (
    pathComponents[0] !== `${LEGACY}'` &&
    pathComponents[0] !== `${NESTED_SEGWIT}'` &&
    pathComponents[0] !== `${NATIVE_SEGWIT}'`
  ) {
    throw new Error('Invalid purpose in path');
  } else {
    purpose = parseInt(pathComponents[0].replace("'", ''));
  }

  if (
    pathComponents[1] !== `${getNetworkCoinType(networks.bitcoin)}'` &&
    pathComponents[1] !== `${getNetworkCoinType(networks.testnet)}'` &&
    pathComponents[1] !== `${getNetworkCoinType(networks.regtest)}'`
  ) {
    throw new Error('Invalid coin type in path');
  } else {
    coinType = parseInt(pathComponents[1]);
  }
  if (`${Math.abs(parseInt(pathComponents[2]))}'` !== pathComponents[2]) {
    throw new Error('Invalid account number in path');
  } else {
    accountNumber = parseInt(pathComponents[2]);
  }
  if (pathComponents[3] !== '0' && pathComponents[3] !== '1') {
    throw new Error('Invalid change type in path');
  } else {
    isChange = pathComponents[3] === '1';
  }
  if (`${Math.abs(parseInt(pathComponents[4]))}` !== pathComponents[4]) {
    throw new Error('Invalid index in path');
  } else {
    index = parseInt(pathComponents[4]);
  }

  return { purpose, coinType, accountNumber, index, isChange };
}

/**
 * Serializes a derivation path.
 *
 * It assumes BIP44, BIP49 and BIP84 account-structures.
 *
 * @param {object} params
 * @param {number} params.purpose LEGACY, NESTED_SEGWIT, or NATIVE_SEGWIT.
 * @param {number} params.coinType 0 for Bitcoin mainnet, 1 for regtest or testnet.
 * @param {number} params.accountNumber The account number as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 * @param {boolean} params.isChange Whether this is a change address or not as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 * @param {number} params.index The addres index within the account as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 *
 * @returns {string} The serialized derivation path
 */
export function serializeDerivationPath({
  purpose,
  coinType,
  accountNumber,
  isChange,
  index
}) {
  //verify purpose, coinType and accountNumber:
  checkPurpose(purpose);
  if (
    (coinType === TESTNET_COINTYPE ||
      coinType === REGTEST_COINTYPE ||
      coinType === BITCOIN_COINTYPE) === false ||
    Number.isSafeInteger(accountNumber) === false ||
    accountNumber < 0
  ) {
    throw new Error('Incorrect parameters');
  }

  let path;
  if (typeof isChange === 'undefined') {
    if (typeof index !== 'undefined') {
      throw new Error('Incompatible parameters');
    }
    path = `${purpose}'/${coinType}'/${accountNumber}'`;
  } else {
    if (
      typeof isChange !== 'boolean' ||
      Number.isSafeInteger(index) === false ||
      index < 0
    ) {
      throw new Error('Incorrect parameters');
    }
    path = `${purpose}'/${coinType}'/${accountNumber}'/${
      isChange ? 1 : 0
    }/${index}`;
    //Further verification:
    const parsedDerivationPath = parseDerivationPath(path);
    Object.keys(parsedDerivationPath).map(key => {
      if (parsedDerivationPath[key] !== arguments[0][key]) {
        throw new Error('Error serializing a derivation path');
      }
    });
  }

  return path;
}
