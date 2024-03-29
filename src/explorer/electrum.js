import net from 'net';
import tls from 'tls';
import ElectrumClient from 'electrum-client';

import { networks } from '../networks';
import { checkNetwork, checkFeeEstimates } from '../check';
import {
  ELECTRUM_BLOCKSTREAM_HOST,
  ELECTRUM_BLOCKSTREAM_PORT,
  ELECTRUM_BLOCKSTREAM_PROTOCOL,
  ELECTRUM_BLOCKSTREAM_TESTNET_HOST,
  ELECTRUM_BLOCKSTREAM_TESTNET_PORT,
  ELECTRUM_BLOCKSTREAM_TESTNET_PROTOCOL
} from '../constants';
import { address as bjsAddress, crypto } from 'bitcoinjs-lib';
import { Explorer } from './interface';

function defaultElectrumServer(network = networks.bitcoin) {
  if (
    network !== networks.bitcoin &&
    network !== networks.testnet &&
    network !== networks.regtest
  ) {
    throw new Error(
      'Default electrum server only available for maninnet, testnet or regtest'
    );
  }
  if (network === networks.bitcoin) {
    return {
      host: ELECTRUM_BLOCKSTREAM_HOST,
      port: ELECTRUM_BLOCKSTREAM_PORT,
      protocol: ELECTRUM_BLOCKSTREAM_PROTOCOL
    };
  } else if (network === networks.testnet) {
    return {
      host: ELECTRUM_BLOCKSTREAM_TESTNET_HOST,
      port: ELECTRUM_BLOCKSTREAM_TESTNET_PORT,
      protocol: ELECTRUM_BLOCKSTREAM_TESTNET_PROTOCOL
    };
  } else if (network === networks.regtest) {
    return {
      host: ELECTRUM_LOCAL_REGTEST_HOST,
      port: ELECTRUM_LOCAL_REGTEST_PORT,
      protocol: ELECTRUM_LOCAL_REGTEST_PROTOCOL
    };
  }
}

function addressToScriptHash(address, network = networks.bitcoin) {
  const script = bjsAddress.toOutputScript(address, network);
  const scriptHash = Buffer.from(crypto.sha256(script))
    .reverse()
    .toString('hex');
  return scriptHash;
}

/**
 * Implements an {@link Explorer} Interface for an Electrum server.
 */
export class ElectrumExplorer extends Explorer {
  #client;
  #height;
  #blockTime;

  #host;
  #port;
  #protocol;
  #network;

  /**
   * Constructor.
   *
   * `host`, `port` and `protocol` default to Blockstream esplora servers if
   * `network` is bitcoin or testnet and to a local esplora sever in case of
   * `regtest`.
   *
   * @param {object} params
   * @param {string} params.host Elecrum's host.
   * @param {number} params.port Elecrum's port.
   * @param {protocol} params.protocol Elecrum's protocol. Either 'ssl' or 'tcp'.
   * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
   */
  constructor(
    { host, port, protocol, network = networks.bitcoin } = {
      host: ELECTRUM_BLOCKSTREAM_HOST,
      port: ELECTRUM_BLOCKSTREAM_PORT,
      protocol: ELECTRUM_BLOCKSTREAM_PROTOCOL,
      network: networks.bitcoin
    }
  ) {
    super();
    checkNetwork(network);
    if (
      typeof host === 'undefined' &&
      typeof port === 'undefined' &&
      typeof protocol === 'undefined'
    ) {
      const server = defaultElectrumServer(network);
      host = server.host;
      port = server.port;
      protocol = server.protocol;
    }
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
    this.#network = network;
  }

  #assertConnect() {
    if (typeof this.#client === 'undefined') {
      throw new Error('Client not connected.');
    }
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
   * Implements {@link Explorer#connect}.
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
   * Implements {@link Explorer#close}.
   */
  async close() {
    this.#assertConnect();
    const ret = await this.#client.close();
    this.#client = undefined;
    //await new Promise(r => setTimeout(r, 9000)); //give some tome so that timeouts are closed
    return ret;
  }

  /**
   * Implements {@link Explorer#fetchUtxos}.
   */
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
   * Implements {@link Explorer#fetchAddress}.
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
