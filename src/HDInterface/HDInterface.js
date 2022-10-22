import memoize from 'lodash.memoize';

import { deriveExtPub, parseDerivationPath } from '../bip44';
import { networks, getNetworkId, getNetworkCoinType } from '../networks';

/**
 * Base Class implementing an interface to a HD wallet.
 *
 * As a farvault-lib user, you are probably trying to use {@link SoftHDInterface}
 * (for a software based HD signing device) or {@link LedgerHDInterface} for a
 * Ledger Nano HD device.
 *
 * This is the base HD interface for farvault-lib. Devs adding more signing HD
 * devices to farvault-lib must extend this class.
 *
 * Derived classes must implement the emtpy methods defined here which are not
 * implemented.
 *
 * Constructor parameters may differ in derived classes. The rest of the methods
 * must be implemented following exactly the interface described here.
 */
export class HDInterface {
  constructor() {
    //Overwrite own method to allow memoization
    this.getPublicKey = memoize(
      this.getPublicKey,
      (path, network = networks.bitcoin) => {
        return path + getNetworkId(network);
      }
    );
  }

  /**
   * Initializes the HD interface.
   *
   * Call it before accessing any other method.
   * @async
   */
  async init() {}

  /**
   * Returns the extended pub key of an initialized HDInterface.
   *
   * @async
   * @param {object} params
   * @param {number} params.purpose The purpose we want to transform to: LEGACY,
   * NATIVE_SEGWIT or NESTED_SEGWIT.
   * @param {number} params.accountNumber The account number as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
   * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
   * @returns {Promise<string>} An extended pub key. F.ex.: "xpub6D4BDPcP2GT577Vvch3R8wDkScZWzQzMMUm3PWbmWvVJrZwQY4VUNgqFJPMM3No2dFDFGTsxxpG5uJh7n7epu4trkrX7x7DogT5Uv6fcLW5".
   */
  getExtPub() {}

  /**
   * Creates an array of signer functions following this pattern:
   *
   * ```javascript
   * async ({ psbt, utxos, network }) => [
   *   hash_utxo_0 => await computeSignature(hash, psbt, utxos[0], network),
   *   hash_utxo_1 => await computeSignature(hash, psbt, utxos[1], network),
   *   ...,
   *   hash_utxo_n => await computeSignature(hash, psbt, utxos[n], network),
   * ];
   * ```
   * These signer functions can then be hooked into bitcoinjs-lib's [`signInput`](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/psbt.js) as the `sign` property in:
   * `Psbt.signInput(index, {sign})`
   *
   * Pass all the utxos that will be signed. The psbt may have more utxos.
   *
   * Utxos must include:
   * * `utxo.witnessScript` for P2WSH pr P2SH-P2WSH
   * * `utxo.redeemScript` for P2SH.
   *
   * The `sequence` is obtained from the locking script in `witnessScript` and
   * `redeemScript` by parsing the script and comparing it with the known
   * scripts that this wallet software can spend.
   *
   * Also pass the psbt (still not finalized). Unlocking scripts may have
   * not been set yet. Just the basic psbt that can be signed.
   *
   * Read some discussion about the motivation behind this function
   * [here](https://github.com/bitcoinjs/bitcoinjs-lib/issues/1517#issuecomment-1064914601).
   *
   * @async
   * @param {object} params
   * @param {object} params.psbt The [bitcoinjs-lib Psbt object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/psbt.js) where the `tx` to be signed will be extracted.
   * @param {Object[]} params.utxos Array of spendable utxos controlled by this HDInterface. The function will create a signer for each utxo.
   * @param {string} params.utxos[].path Derivation path of the key that must sign the hash. F.ex.: `44'/1'/1'/0/0`.
   * @param {string} params.utxos[].tx The transaction serialized in hex.
   * @param {number} params.utxos[].n The vout index of the tx above.
   * @param {string} [params.utxos[].witnessScript] The witnessScript serialized in hex in case the utxo can be redeemed with an unlocking script (P2WSH or P2SH-P2WSH).
   * @param {string} [params.utxos[].redeemScript] The redeemScript serialized in hex in case the utxo can be redeemed with an unlocking script (P2SH).
   * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
   * @returns {Promise<function[]>} An array of functions, where each function corresponds to an utxo from the `utxos` input array.
   */
  createSigners() {}

  /**
   * Returns the public key of a path.
   *
   * @async
   * @param {object} params
   * @param {string} params.path The serialized derivation path.
   * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
   * @returns {Promise<Buffer>} The public key.
   */
  async getPublicKey(path, network = networks.bitcoin) {
    const { purpose, coinType, accountNumber, index, isChange } =
      parseDerivationPath(path);
    if (getNetworkCoinType(network) !== coinType) {
      throw new Error('Network mismatch');
    }
    const extPub = await this.getExtPub({
      purpose,
      accountNumber,
      network
    });
    return deriveExtPub({ extPub, index, isChange, network });
  }

  /**
   * Close the exchange with the Interface. Call it to release the interface.
   * This is an optional method since not all HD signers need to be released.
   *
   * @async
   */
  close() {}
}
