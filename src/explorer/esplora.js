/**
 * Implements the {@link Explorer} Interface for connecting to an Esplora
 * server.
 **/

import fetch from 'cross-fetch';
import { checkFeeEstimates } from '../check';

import { ESPLORA_BLOCKSTREAM_URL } from '../constants';

import { Explorer } from './interface';

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

function isValidHttpUrl(string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

/**
 * Implements an {@link Explorer} Interface for an Esplora server.
 */

export class EsploraExplorer extends Explorer {
  #url;

  /**
   * @param {object} params
   * @param {string} params.url Esplora's API url. Defaults to blockstream.info if `service = ESPLORA`.
   */
  constructor({ url } = { url: ESPLORA_BLOCKSTREAM_URL }) {
    super();
    if (!isValidHttpUrl(url)) {
      throw new Error(
        'Specify a valid URL for Esplora and nothing else. Note that the url can include the port: http://api.example.com:8080/api'
      );
    }
    this.#url = url;
  }

  /**
   * Implements {@link Explorer#connect}.
   */
  async connect() {}

  /**
   * Implements {@link Explorer#close}.
   */
  async close() {}

  /**
   * Implements {@link Explorer#fetchUtxos}.
   */
  async fetchUtxos(address) {
    const utxos = [];
    const fetchedUtxos = await esploraFetchJson(
      `${this.#url}/address/${address}/utxo`
    );

    for (const utxo of fetchedUtxos) {
      if (utxo.status.confirmed === true) {
        const tx = await esploraFetchText(`${this.#url}/tx/${utxo.txid}/hex`);
        utxos.push({ tx, n: parseInt(utxo.vout) });
      }
    }
    return utxos;
  }

  /**
   * Implements {@link Explorer#fetchAddress}.
   */
  async fetchAddress(address) {
    const chain_stats = (
      await esploraFetchJson(`${this.#url}/address/${address}`)
    )['chain_stats'];
    return {
      used: chain_stats['tx_count'] !== 0,
      balance: chain_stats['funded_txo_sum'] - chain_stats['spent_txo_sum']
    };
  }

  /**
   * Implements {@link Explorer#fetchFeeEstimates}.
   */
  async fetchFeeEstimates() {
    const feeEstimates = await esploraFetchJson(`${this.#url}/fee-estimates`);
    checkFeeEstimates(feeEstimates);
    return feeEstimates;
  }
}
