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
export function validateNetwork(network) {
  if (
    network !== networks.bitcoin &&
    network !== networks.testnet &&
    network !== networks.regtest
  )
    throw new Error('Network must be mainnet, testnet or regtest');
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
 * @param {string} address Bitcion address
 * Based on: https://github.com/bitcoinjs/bitcoinjs-lib/issues/890
 */
export function validateAddress(address, network) {
  try {
    bjsAddress.toOutputScript(address, network);
    return true;
  } catch (e) {
    throw new Error('Invalid address');
  }
}
