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
export function validateNetwork(network, includeRegtest = true) {
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
export function validatePubType(pubType) {
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

export function validateCoinTypePubType(coinType, pubType) {
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
export function validateAddress(address, network) {
  validateNetwork(network);
  try {
    bjsAddress.toOutputScript(address, network);
    return true;
  } catch (e) {
    throw new Error('Invalid address');
  }
}
