/**
 * @module networks
 */

import { networks as bjsNetworks } from 'bitcoinjs-lib';
import { BITCOIN, TESTNET, SIGNET, REGTEST, COINTYPE } from './constants';
//Do not use bitcoinjs network, but our network object that can map
//into bitcoinjs networks
//Read this issue here: https://github.com/bitcoinjs/bitcoinjs-lib/issues/1820

const bitcoin = bjsNetworks.bitcoin;
const regtest = bjsNetworks.regtest;
const testnet = bjsNetworks.testnet;
const signet = { ...bjsNetworks.testnet }; //So that signet !== testnet

/**
 * The `networks` object contains the following supported network objects:
 * * `bitcoin`
 * * `regtest`
 * * `testnet`
 * * `signet`
 *
 * And is defined as follows:
 *
 * `const networks = { bitcoin, regtest, testnet, signet }`
 *
 * Usage example:
 * ```
 * import {networks} from 'networks';
 * getDerivationPathAddress({extPubGetter, path, network: networks.bitcoin});
 * ```
 * @type {object}
 */
export const networks = { bitcoin, regtest, testnet, signet };

/**
 * Returns an id from a network
 * @param {object} One of these {@link module:networks.networks networks}.
 * @returns {number} A network id.
 */
export const getNetworkId = network => {
  if (network === bitcoin) return BITCOIN;
  if (network === regtest) return REGTEST;
  if (network === testnet) return TESTNET;
  if (network === signet) return SIGNET;
  throw new Error('Unknown network');
};

/**
 * Returns a network from an id.
 * @param {number} A network id.
 * @returns {object} One of these {@link module:networks.networks networks}.
 */
export const getNetwork = networkId => {
  if (networkId === BITCOIN) return bitcoin;
  if (networkId === REGTEST) return regtest;
  if (networkId === TESTNET) return testnet;
  if (networkId === SIGNET) return signet;
  throw new Error('Unknown network');
};

/**
 * Gives back the coin type used in a network.
 *
 * It assumes BIP44, BIP49 and BIP84 account-structures.
 *
 * It returns 0 for the Bitcoin mainnet and 1 for regtest and testnet networks.
 * @param {object} [network=networks.bitcoin] A {@link module:networks.networks network}.
 * @returns {number} 0 for the Bitcoin mainnet and 1 for regtest, signet and testnet
 * networks.
 */
export function getNetworkCoinType(network = networks.bitcoin) {
  if (typeof COINTYPE[getNetworkId(network)] === 'number') {
    return COINTYPE[getNetworkId(network)];
  }
  throw new Error('Unknown network');
}
