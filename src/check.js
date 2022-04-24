/** @module check */

import {
  XPUB,
  YPUB,
  ZPUB,
  TPUB,
  UPUB,
  VPUB,
  PUBTYPES
} from './walletConstants';
import { networks, address as bjsAddress } from 'bitcoinjs-lib';
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
}
export function checkPubType(pubType) {
  if (
    pubType !== XPUB &&
    pubType !== YPUB &&
    pubType !== ZPUB &&
    pubType !== TPUB &&
    pubType !== UPUB &&
    pubType !== VPUB
  )
    throw new Error('Pub type must be x/y/z/t/u/vpub: ' + pubType);
  return true;
}

export function checkCoinTypePubType(coinType, pubType) {
  if (!Object.values(PUBTYPES[coinType]).includes(pubType))
    throw new Error('PubType does not belong to this coinType');
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
