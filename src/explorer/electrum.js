import net from 'net';
import tls from 'tls';
import ElectrumClient from 'electrum-client';

import { networks } from '../networks';
import { checkNetwork, checkFeeEstimates } from '../check';
import {
  BLOCKSTREAM_ELECTRUM_HOST,
  BLOCKSTREAM_ELECTRUM_PORT,
  BLOCKSTREAM_ELECTRUM_PROTOCOL,
  BLOCKSTREAM_TESTNET_ELECTRUM_HOST,
  BLOCKSTREAM_TESTNET_ELECTRUM_PORT,
  BLOCKSTREAM_TESTNET_ELECTRUM_PROTOCOL
} from '../constants';
import { address as bjsAddress, crypto } from 'bitcoinjs-lib';

function addressToScriptHash(address, network = networks.bitcoin) {
  const script = bjsAddress.toOutputScript(address, network);
  const scriptHash = Buffer.from(crypto.sha256(script))
    .reverse()
    .toString('hex');
  return scriptHash;
}

/**
 * This class is encapsulated in {@link Explorer}.
 *
 * There is no need to use it directly.
 */
export class Electrum {
  #client;
  #height;
  #blockTime;

  #host;
  #port;
  #protocol;
  #network;

  #assertConnect() {
    if (typeof this.#client === 'undefined') {
      throw new Error('Client not connected.');
    }
  }

  /**
   * @param {object} params
   * @param {string} params.host Elecrum's host.
   * @param {number} params.port Elecrum's port.
   * @param {protocol} params.protocol Elecrum's protocol. Either 'ssl' or 'tcp'.
   * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
   */
  constructor({ host, port, protocol, network = networks.bitcoin }) {
    if (
      typeof host !== 'string' ||
      !Number.isInteger(port) ||
      port <= 0 ||
      (protocol !== 'ssl' && protocol !== 'tcp')
    ) {
      throw new Error(
        "Specify a host (string), port (integer), and protocol ('ssl' or 'tcp') for Electrum."
      );
    }
    this.#host = host;
    this.#port = port;
    this.#protocol = protocol;
    checkNetwork(network);
    this.#network = network;
  }
  #updateHeight(header) {
    if (
      header &&
      header.height &&
      (typeof this.#height === 'undefined' || header.height > this.#height)
    ) {
      this.#height = header.height;
      this.#blockTime = Math.floor(+new Date() / 1000);
    }
  }

  /**
   * Connect the socket. See {@link Explorer#connect}.
   */
  async connect() {
    if (this.#client) {
      throw new Error('Client already connected.');
    }
    this.#client = new ElectrumClient(
      net,
      this.#protocol === 'ssl' ? tls : false,
      this.#port,
      this.#host,
      this.#protocol
    );
    this.#assertConnect();
    await this.#client.initElectrum({
      client: 'farvault',
      version: '1.4'
    });
    this.#client.subscribe.on('blockchain.headers.subscribe', headers => {
      if (Array.isArray(headers)) {
        for (const header of headers) {
          this.#updateHeight(header);
        }
      }
    });
    const header = await this.#client.blockchainHeaders_subscribe();
    this.#updateHeight(header);
  }

  /**
   * Close the socket. See {@link Explorer#close}.
   */
  async close() {
    this.#assertConnect();
    const ret = await this.#client.close();
    this.#client = undefined;
    //await new Promise(r => setTimeout(r, 9000)); //give some tome so that timeouts are closed
    return ret;
  }

  /**
   * See {@link Explorer#fetchAddress}
   * */
  async fetchAddress(address) {
    this.#assertConnect();
    let used = false;
    const scriptHash = addressToScriptHash(address, this.#network);
    const balance = await this.#client.blockchainScripthash_getBalance(
      scriptHash
    );
    if (balance.confirmed === 0) {
      const history = await this.#client.blockchainScripthash_getHistory(
        scriptHash
      );
      if (history.length) {
        used = true;
      }
    } else {
      used = true;
    }
    return { balance: balance.confirmed, used };
  }

  /**
   * See {@link Explorer#fetchUtxos}
   * */
  async fetchUtxos(address) {
    this.#assertConnect();
    const utxos = [];
    const unspents = await this.#client.blockchainScripthash_listunspent(
      addressToScriptHash(address, this.#network)
    );
    for (const unspent of unspents) {
      if (this.#height - unspent.height >= 5) {
        const tx = await this.#client.blockchainTransaction_get(
          unspent.tx_hash
        );
        utxos.push({ tx, n: unspent.tx_pos });
      }
    }
    return utxos;
  }

  /**
   * See {@link Explorer#fetchFeeEstimates}
   * */
  async fetchFeeEstimates() {
    this.#assertConnect();
    //Same as in https://github.com/Blockstream/esplora/blob/master/API.md#get-fee-estimates
    //The available confirmation targets are 1-25, 144, 504 and 1008 blocks.
    const T = [...Array.from({ length: 25 }, (_, i) => i + 1), 144, 504, 1008];

    const feeEstimates = {};
    for (const target of T) {
      //100000 = 10 ^ 8 sats/BTC / 10 ^3 bytes/kbyte
      const fee = await this.#client.blockchainEstimatefee(target);
      feeEstimates[target] = 100000 * fee;
    }
    checkFeeEstimates(feeEstimates);
    return feeEstimates;
  }
}
export function blockstreamElectrumServer(network = networks.bitcoin) {
  checkNetwork(network, false);
  if (network !== networks.bitcoin && network !== networks.testnet) {
    throw new Error(
      'Blockstream electrum server only available for maninnet or testnet'
    );
  }
  if (network === networks.bitcoin) {
    return {
      host: BLOCKSTREAM_ELECTRUM_HOST,
      port: BLOCKSTREAM_ELECTRUM_PORT,
      protocol: BLOCKSTREAM_ELECTRUM_PROTOCOL
    };
  } else if (network === networks.testnet) {
    return {
      host: BLOCKSTREAM_TESTNET_ELECTRUM_HOST,
      port: BLOCKSTREAM_TESTNET_ELECTRUM_PORT,
      protocol: BLOCKSTREAM_TESTNET_ELECTRUM_PROTOCOL
    };
  }
}
