function MUST_IMPLEMENT() {
  throw new Error('This Interface method must be implemented.');
}

/** Class describing an Interface to a client that connects to a Blockchain
 * explorer. For example, {@link EsploraExplorer a client to an Esplora Server}
 * or {@link ElectrumExplorer a client to an Electrum Server}.
 *
 * Devs adding new Explorer clients to farvault-lib must implement this class
 * methods.
 **/
export class Explorer {
  /**
   * Connect to the server.
   * @async
   **/
  async connect() {
    MUST_IMPLEMENT();
  }
  /**
   * Close the connection.
   * @async
   **/
  async close() {
    MUST_IMPLEMENT();
  }
  /**
   * Get the utxos of an address.
   * @async
   * @param {string} address A Bitcoin address
   * @returns {Promise<Array>} An array of utxos objects like this: `[{ tx, n },...]`,
   * where `tx` is a string in hex format and `n` is an integer >= 0.
   * */
  async fetchUtxos(address) {
    MUST_IMPLEMENT();
  }
  /**
   * Get the balance of an address and find out whether the address ever
   * received some coins.
   * @async
   * @param {string} address A Bitcoin address
   * @returns {Promise<object>} return
   * @returns {boolean} return.used Whether that address ever received sats.
   * @returns {number} return.balance Number of sats currently controlled by that address.
   * */
  async fetchAddress(address) {
    MUST_IMPLEMENT();
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
    MUST_IMPLEMENT();
  }
}
