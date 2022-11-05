import {
  ESPLORA,
  ELECTRUM,
  BLOCKSTREAM_ELECTRUM_HOST,
  BLOCKSTREAM_ELECTRUM_PORT,
  BLOCKSTREAM_ELECTRUM_PROTOCOL
} from '../constants';
import { networks } from '../networks';
import { checkNetwork } from '../check';
import { Electrum, blockstreamElectrumServer } from './electrum';
import {
  esploraFetchUtxos,
  esploraFetchAddress,
  esploraFetchFeeEstimates,
  blockstreamEsploraUrl
} from './esplora';

function isValidHttpUrl(string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

/** Class representing a client of a blockchain explorer.
 *
 * {@link https://github.com/Blockstream/esplora/blob/master/API.md Esplora} and {@link https://electrumx.readthedocs.io/ electrum} servers are supported.
 **/
export class Explorer {
  #service;
  #url;
  #electrum;

  /** Usage:
   *
   * * `new Explorer()` will use public Blockstream's esplora server.
   * * `new Explorer({service: ELECTRUM})` will use public Blockstream's electrum server.
   * * `new Explorer({url: LOCAL_ESPLORA_URL})` will use a esplora server on `LOCAL_ESPLORA_URL`.
   *
   * Or choose any other server:
   *
   * @param {object} params
   * @param {string} [params.service=ESPLORA] `ESPLORA` or `ELECTRUM`. Set `url` if `service = ESPLORA` or `host, port, protocol` if `service = ELECTRUM`.
   * @param {string} params.url Esplora's API url. Defaults to blockstream.info if `service = ESPLORA`.
   * @param {string} params.host Elecrum's host. Defaults to 'electrum.blockstream.info' if `service = ELECTRUM` and host, port and protocol are unset.
   * @param {number} params.port Elecrum's port. Defaults to 50002 if `service = ELECTRUM` and host, port and protocol are unset.
   * @param {protocol} params.protocol Elecrum's protocol. Either 'ssl' or 'tcp'. Defaults to 'ssl' if `service = ELECTRUM` and host, port and protocol are unset.
   * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
   */
  constructor({
    service = ESPLORA,
    url,
    host,
    port,
    protocol,
    network = networks.bitcoin
  }) {
    checkNetwork(network);
    if (service === ESPLORA) {
      if (typeof url === 'undefined') {
        url = blockstreamEsploraUrl(network);
      }
      if (host || port || protocol || !isValidHttpUrl(url))
        throw new Error(
          'Specify a valid URL for Esplora and nothing else. Note that the url can include the port: http://api.example.com:8080/api'
        );
      this.#url = url;
    } else if (service === ELECTRUM) {
      if (
        typeof host === 'undefined' &&
        typeof port === 'undefined' &&
        typeof protocol === 'undefined'
      ) {
        const server = blockstreamElectrumServer(network);
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
      this.#electrum = new Electrum({ host, port, protocol, network });
    } else {
      throw new Error('Invalid service.');
    }
    this.#service = service;
  }
  /** To be used with ELECTRUM servers before fetching any data.
   * @async
   **/
  async connect() {
    if (this.#service === ELECTRUM) {
      return await this.#electrum.connect();
    }
  }
  /** To be used with ELECTRUM servers to disconnect the socket.
   * @async
   **/
  async close() {
    if (this.#service === ELECTRUM) {
      return await this.#electrum.close();
    }
  }
  /**
   * Get the utxos of an address.
   * @async
   * @param {string} address A Bitcoin address
   * @returns {Promise<Array>} An array of utxos objects like this: `[{ tx, n },...]`,
   * where `tx` is a string in hex format and `n` is an integer >= 0.
   * */
  async fetchUtxos(address) {
    if (this.#service === ESPLORA) {
      return await esploraFetchUtxos(address, this.#url);
    } else if (this.#service === ELECTRUM) {
      return await this.#electrum.fetchUtxos(address);
    }
  }
  /**
   * Get the balance and usage status of an address.
   * @async
   * @param {string} address A Bitcoin address
   * @returns {Promise<object>} return
   * @returns {boolean} return.used Whether that address ever received sats.
   * @returns {number} return.balance Number of sats currently controlled by that address.
   * */
  async fetchAddress(address) {
    if (this.#service === ESPLORA) {
      return await esploraFetchAddress(address, this.#url);
    } else if (this.#service === ELECTRUM) {
      return await this.#electrum.fetchAddress(address);
    }
  }

  /**
   * Get an object where the key is the confirmation target (in number of blocks)
   * and the value is the estimated feerate (in sat/vB).
   *
   * The available confirmation targets are `1-25, 144, 504` and `1008` blocks.
   * @async
   * @returns {Promise<Object>} An object where the key is the confirmation target (in number of blocks).
   * For example:
   * ```
   * { "1": 87.882, "2": 87.882, "3": 87.882, "4": 87.882, "5": 81.129, "6": 68.285, ..., "144": 1.027, "504": 1.027, "1008": 1.027 }
   * ```
   */
  async fetchFeeEstimates() {
    if (this.#service === ESPLORA) {
      return await esploraFetchFeeEstimates(this.#url);
    } else if (this.#service === ELECTRUM) {
      return await this.#electrum.fetchFeeEstimates();
    }
  }
}
