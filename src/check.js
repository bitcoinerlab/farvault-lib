/** @module check */

import {
  XPUB,
  YPUB,
  ZPUB,
  TPUB,
  UPUB,
  VPUB,
  EXTENDEDPUBTYPES,
  LEGACY,
  NESTED_SEGWIT,
  NATIVE_SEGWIT,
  PUBVERSIONSIZE,
  PUBVERSIONS,
  BITCOIN_COINTYPE,
  TESTNET_COINTYPE,
  REGTEST_COINTYPE
} from './walletConstants';

//import { P2PKH, P2WPKH, P2SH_P2WPKH } from './accounts';

import { networks, address as bjsAddress } from 'bitcoinjs-lib';
import BIP32Factory from 'bip32';
let bjsBip32;
import('tiny-secp256k1').then(ecc => (bjsBip32 = BIP32Factory(ecc)));
import b58 from 'bs58check';

/**
 * Throws an error if the network not valid.
 * @param {Object} network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * @param {boolean} [includeRegtest=true] Include regtest in the pool of possible networks. Default is true.
 * @returns {boolean} If the function does not throw, then it always returns true.
 */
export function checkNetwork(network, includeRegtest = true) {
  if (includeRegtest) {
    if (
      typeof network !== 'object' ||
      (network !== networks.bitcoin &&
        network !== networks.testnet &&
        network !== networks.regtest)
    )
      throw new Error('Network must be mainnet, testnet or regtest');
  } else {
    if (network !== networks.bitcoin && network !== networks.testnet)
      throw new Error('Network must be mainnet or testnet');
  }
  return true;
}
/**
 * Throws an error if the purpose not valid.
 * @param {srting} purpose LEGACY, NATIVE_SEGWIT or NESTED_SEGWIT
 * @returns {boolean} If the function does not throw, then it always returns true.
 */
export function checkPurpose(purpose) {
  if (
    typeof purpose !== 'number' ||
    (purpose === LEGACY ||
      purpose === NESTED_SEGWIT ||
      purpose === NATIVE_SEGWIT) === false
  )
    throw new Error('Invalid purpose!');
  return true;
}

/**
 * Throws an error if any of the following checks are not fulfilled:
 *
 * * Makes sure the extPub corresponds to the network.
 * * Makes sure it can be correctly decoded (using npm's bip32.fromBase58).
 * * Makes sure it has depth: 3 (conforms to BIP44, BIP49 & BIP84).
 * * It checks whether its coin type meets one of the supported networks:
 * Bitcoin mainnet, testnet or regtest.
 * * Optionally pass an accountNumber to check it's the one encoded in the extPub.
 * * Optionally pass a coinType (0 Bitcoin, 1 Testnet &  Regtest, ...) and checks
 * whether it belongs to the network (if passed) and it matches the prefix.
 *
 * @param {object} params
 * @param {string} params.extPub serialized extended pub
 * @param {number} params.coinType 44, 49 or 84 depending on the BIP used.
 * Optional if you don't want to check it.
 * @param {number} params.accountNumber Integer >= 0 corresponding to the account
 * number serialized in the extPub. Optional if you don't want to check it.
 * @param {Object} params.network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 */
export function checkExtPub({ extPub, coinType, accountNumber, network }) {
  if (
    typeof extPub !== 'string' ||
    (extPub.length === 111 || extPub.length === 112) === false
  )
    throw new Error('Invalid extPub!');
  const extPubType = extPub.slice(0, 4);
  if (
    extPubType !== XPUB &&
    extPubType !== YPUB &&
    extPubType !== ZPUB &&
    extPubType !== TPUB &&
    extPubType !== UPUB &&
    extPubType !== VPUB
  )
    throw new Error('Invalid extPub. Pub type must be x/y/z/t/u/vpub!');

  checkNetwork(network);

  let _coinType;
  if (network === networks.bitcoin) {
    _coinType = BITCOIN_COINTYPE;
  } else if (network === networks.testnet) {
    _coinType = TESTNET_COINTYPE;
  } else if (network === networks.regtest) {
    _coinType = REGTEST_COINTYPE;
  } else {
    throw new Error(
      'Invalid extPub. This wallet assumes Bitcoin mainnet, testnet or regtest only!'
    );
  }
  if (!Object.values(EXTENDEDPUBTYPES[_coinType]).includes(extPubType))
    throw new Error(
      'Invalid extPub. The prefix of the extPub does not match with the network!' +
        ':' +
        extPubType +
        ':' +
        network.bip32.public
    );
  if (typeof coinType !== 'undefined')
    if (coinType !== _coinType)
      throw new Error('Invalid extPub. coinType does not match!');
  coinType = _coinType;

  //Convert the extPub to "xpub" prefixed. This is the way bip32 nodejs module
  //internally works
  let data = b58.decode(extPub);
  data = data.slice(4);
  data = Buffer.concat([
    Buffer.from(
      PUBVERSIONS[coinType][LEGACY].toString(16).padStart(PUBVERSIONSIZE, 0),
      'hex'
    ),
    data
  ]);
  const xpubPrefixedExtPub = b58.encode(data);

  //Do the slice thing.
  //check network
  //do a setExtPubPrefix and then do a fromBase58
  //fromBase58 does already a series of checks and throws if it fails.
  const hd = bjsBip32.fromBase58(xpubPrefixedExtPub, network);
  if (hd.depth !== 3) {
    throw new Error('Invalid extPub. This wallet assumes extPub with depth 3!');
  }
  if (typeof accountNumber !== 'undefined') {
    if ((hd.index & 0x7fffffff) /*unharden*/ !== accountNumber)
      throw new Error('Invalid extPub. accountNumber mismatch!');
  }
  return true;
}

/**
 * Throws an error if the address or the network is not valid.
 *
 * Based on: [https://github.com/bitcoinjs/bitcoinjs-lib/issues/890](https://github.com/bitcoinjs/bitcoinjs-lib/issues/890)
 * @param {string} address Bitcoin address
 * @param {Object} network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * @returns {boolean} If the function does not throw, then it always returns true.
 */
export function checkAddress(address, network) {
  checkNetwork(network);
  try {
    bjsAddress.toOutputScript(address, network);
    return true;
  } catch (e) {
    throw new Error('Invalid address');
  }
}

/**
 * Throws an error if feeEstimates do not respect Esplora format.
 *
 * See [`/fee-estimates`](https://github.com/Blockstream/esplora/blob/master/API.md#get-fee-estimates).
 *
 * @param {Object} feeEstimates An object where the key is the confirmation target (in number of blocks - an integer)
 * and the value is the estimated feerate (in sat/vB).
 * For example:
 * ```
 * { "1": 87.882, "2": 87.882, "3": 87.882, "4": 87.882, "5": 81.129, "6": 68.285, ..., "144": 1.027, "504": 1.027, "1008": 1.027 }
 * ```
 * @returns {boolean} If the function does not throw, then it always returns true.
 */
export function checkFeeEstimates(feeEstimates) {
  const error = 'Invalid esplora fee estimates!';
  if (
    typeof feeEstimates !== 'object' ||
    Object.keys(feeEstimates).length === 0
  ) {
    throw new Error(error);
  }
  Object.keys(feeEstimates).map(key => {
    if (
      typeof key !== 'string' ||
      !Number.isInteger(Number(key)) ||
      Number(key) <= 0 ||
      typeof feeEstimates[key] !== 'number' ||
      feeEstimates[key] < 0
    ) {
      throw new Error(error);
    }
  });
  return true;
}
