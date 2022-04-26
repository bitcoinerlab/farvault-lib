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
  NATIVE_SEGWIT
} from './walletConstants';

//import { P2PKH, P2WPKH, P2SH_P2WPKH } from './accounts';

import { networks, address as bjsAddress } from 'bitcoinjs-lib';
/**
 * Throws an error if the network not valid.
 * @param {Object} network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * @param {boolean} includeRegtest Include regtest in the pool of possible networks. Default is true.
 * @returns {boolean} If the function does not throw, then it always returns true.
 */
export function checkNetwork(network, includeRegtest = true) {
  if (includeRegtest) {
    if (
      network !== networks.bitcoin &&
      network !== networks.testnet &&
      network !== networks.regtest
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

export function checkExtendedPubType(extendedPubType) {
  if (
    extendedPubType !== XPUB &&
    extendedPubType !== YPUB &&
    extendedPubType !== ZPUB &&
    extendedPubType !== TPUB &&
    extendedPubType !== UPUB &&
    extendedPubType !== VPUB
  )
    throw new Error('Pub type must be x/y/z/t/u/vpub: ' + extendedPubType);
  return true;
}
export function checkCoinTypeExtendedPubType(coinType, extendedPubType) {
  if (!Object.values(EXTENDEDPUBTYPES[coinType]).includes(extendedPubType))
    throw new Error('ExtendedPubType does not belong to this coinType');
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

///**
// * Throws an error if the accountType is not valid.
// * @param {string} accountType P2PKH, P2WPKH or P2SH_P2WPKH as defined in accounts.js
// * @returns {boolean} If the function does not throw, then it always returns true.
// */
//export function checkAccountType(accountType) {
//  if (
//    typeof accountType !== 'string' ||
//    (accountType !== P2WPKH &&
//      accountType !== P2SH_P2WPKH &&
//      accountType !== P2PKH)
//  )
//    throw new Error('Invalid account type!');
//  return true;
//}
//
///**
// * Throws an error if the account not valid.
// * @param {object} account
// * @param {string} account.accountType See {@link module:check.checkAccountType checkAccountType}
// * @param {number} account.accountNumber An integer >= 0
// * @param {object} account.network See {@link module:check.checkNetwork checkNetwork}
// * @returns {boolean} If the function does not throw, then it always returns true.
// */
//export function checkAccount(account) {
//  if (
//    typeof account !== 'object' ||
//    checkAccountType(account.accountType) !== true ||
//    !Number.isSafeInteger(account.accountNumber) ||
//    account.accountNumber < 0 ||
//    checkNetwork(account.network) !== true
//  )
//    throw new Error('Invalid account!');
//
//  return true;
//}
