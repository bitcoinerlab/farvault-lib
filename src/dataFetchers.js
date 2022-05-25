/** @module dataFetchers */

import fetch from 'cross-fetch';
import {
  BLOCKSTREAM_EXPLORER_BASEURL,
  ESPLORA_BASEURL
} from './walletConstants';
import { networks } from 'bitcoinjs-lib';
import { checkNetwork, checkFeeEstimates } from './check';

async function esploraFetchJson(...args) {
  const response = await fetch(...args);
  if (response.status !== 200) {
    throw new Error('Service is down!');
  }
  try {
    const json = await response.json();
    return json;
  } catch (error) {
    throw new Error('Invalid json format!');
  }
}

async function esploraFetchText(...args) {
  const response = await fetch(...args);
  if (response.status !== 200) {
    throw new Error('Service is down!');
  }
  try {
    const text = await response.text();
    return text;
  } catch (error) {
    throw new Error('Invalid text format!');
  }
}

/**
 * Fetches [`/address/:address`](https://github.com/Blockstream/esplora/blob/master/API.md#get-addressaddress)
 * from an esplora service to get whether the address ever received some coins
 * and the current amount of sats that it holds (if any).
 *
 * @async
 * @param {string} address A Bitcoin address
 * @param {string} baseUrl The Base URL of the Esplora server. Defaults to
 * [http://127.0.0.1:3002](http://127.0.0.1:3002)
 * @returns {Promise<object>} return
 * @returns {boolean} return.used Whether that address ever received sats.
 * @returns {number} return.balance Number of sats currently controlled by that address.
 */
export async function esploraFetchAddress(address, baseUrl = ESPLORA_BASEURL) {
  const chain_stats = (await esploraFetchJson(`${baseUrl}/address/${address}`))[
    'chain_stats'
  ];
  return {
    used: chain_stats['tx_count'] !== 0,
    balance: chain_stats['funded_txo_sum'] - chain_stats['spent_txo_sum']
  };
}

/**
 * Recursively fetches [`/tx/:txid/hex`](https://github.com/Blockstream/esplora/blob/master/API.md#get-txtxidhex) in an esplora service for all the confirmed utxos of a certain address.
 *
 * It first fetches all the unspent outputs of an address with
 * ['/address/:address/utxo'](https://github.com/Blockstream/esplora/blob/master/API.md#get-addressaddressutxo)
 * and then loops over those utxos.
 *
 * @async
 * @param {string} address A Bitcoin address
 * @param {string} baseUrl The Base URL of the Esplora server. Defaults to
 * [http://127.0.0.1:3002](http://127.0.0.1:3002)
 * @returns {Promise<Array>} An array of utxos objects like this: `[{ tx, vout },...]`,
 * where `tx` is a string in hex format and `vout` is an integer >= 0.
 */
export async function esploraFetchUtxos(address, baseUrl = ESPLORA_BASEURL) {
  const utxos = [];
  const fetchedUtxos = await esploraFetchJson(
    `${baseUrl}/address/${address}/utxo`
  );

  for (const utxo of fetchedUtxos) {
    if (utxo.status.confirmed === true) {
      const tx = await esploraFetchText(`${baseUrl}/tx/${utxo.txid}/hex`);
      utxos.push({ tx, vout: parseInt(utxo.vout) });
    }
  }
  return utxos;
}

/**
 * Fetches [`/fee-estimates`](https://github.com/Blockstream/esplora/blob/master/API.md#get-fee-estimates)
 * from an esplora service.
 *
 * Get an object where the key is the confirmation target (in number of blocks)
 * and the value is the estimated feerate (in sat/vB).
 *
 * The available confirmation targets are `1-25, 144, 504` and `1008` blocks.
 * @async
 * @param {string} baseUrl The Base URL of the Esplora server. Defaults to
 * [http://127.0.0.1:3002](http://127.0.0.1:3002)
 * @returns {Promise<Object>} An object where the key is the confirmation target (in number of blocks).
 * For example:
 * ```
 * { "1": 87.882, "2": 87.882, "3": 87.882, "4": 87.882, "5": 81.129, "6": 68.285, ..., "144": 1.027, "504": 1.027, "1008": 1.027 }
 * ```
 */
export async function esploraFetchFeeEstimates(baseUrl = ESPLORA_BASEURL) {
  const feeEstimates = await esploraFetchJson(`${baseUrl}/fee-estimates`);
  checkFeeEstimates(feeEstimates);
  return feeEstimates;
}

function blockstreamBaseURL(network = networks.bitcoin) {
  checkNetwork(network, false);
  return `${BLOCKSTREAM_EXPLORER_BASEURL}/${
    network === networks.bitcoin ? '' : 'testnet/'
  }api`;
}
/**
 * Calls {@link module:dataFetchers.esploraFetchAddress esploraFetchAddress} particularized for blockstream's esplora
 * service.
 * @param {object} [network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * Only works for bitcoin and testnet.
 * @param {string} address A Bitcoin address
 * @returns {boolean} return.used Whether that address ever received sats.
 * @returns {number} return.balance Number of sats currently controlled by that
 * address.
 */
export function blockstreamFetchAddress(address, network = networks.bitcoin) {
  return esploraFetchAddress(address, blockstreamBaseURL(network));
}
/**
 * Calls {@link module:dataFetchers.esploraFetchUtxos esploraFetchUtxos} particularized for blockstream's esplora
 * service.
 * @param {object} [network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * Only works for bitcoin and testnet.
 * @param {string} address A Bitcoin address
 * @returns {Array} An array of utxos objects like this: `[{ tx, vout },...]`,
 * where `tx` is a string in hex format and `vout` is an integer >= 0.
 */
export function blockstreamFetchUtxos(address, network = networks.bitcoin) {
  return esploraFetchUtxos(address, blockstreamBaseURL(network));
}
/**
 * Calls {@link module:dataFetchers.esploraFetchFeeEstimates esploraFetchFeeEstimates} particularized for blockstream's
 * esplora service.
 * @param {object} [network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * Only works for bitcoin and testnet.
 * @returns {Object} An object where the key is the confirmation target
 * (in number of blocks).
 */
export function blockstreamFetchFeeEstimates(network = networks.bitcoin) {
  checkNetwork(network, false);
  return esploraFetchFeeEstimates(blockstreamBaseURL(network));
}
