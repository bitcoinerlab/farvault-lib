import memoize from 'lodash.memoize';

import { networks, getNetworkId, getNetworkCoinType } from '../networks';

function MUST_IMPLEMENT() {
  throw new Error('This Interface method must be implemented.');
}

/**
 * Class desccribing an Interface to an HD Signer (also popularly known as an 
 * HD wallet). For example, this Interface is implemented in LedgerHDSigners to
 * communicate with a Ledger Nano. Also, this Interface is implemented in
 * SoftHDSigner to communicate with a software HD wallet that is created using
 * a BIP39 word mnemonic.
 *
 * As a farvault-lib user, you are probably trying to use {@link SoftHDSigner}
 * (for a software based HD signing device) or {@link LedgerHDSigner} for a
 * Ledger Nano HD device.
 *
 * This is the HDSigner Interface for farvault-lib. Devs adding more signing HD
 * devices to farvault-lib must implement this class methods.
 *
 * Methods must be implemented following exactly the interface described here.
 */
export class HDSigner {
  /**
   * Initializes the HD interface.
   *
   * Call it before accessing any other method.
   * @async
   */
  async init() {
    MUST_IMPLEMENT();
  }

  /**
   * Returns the extended pub key of an initialized HDSigner.
   *
   * @async
   * @param {object} params
   * @param {number} params.purpose The purpose we want to transform to: LEGACY,
   * NATIVE_SEGWIT or NESTED_SEGWIT.
   * @param {number} params.accountNumber The account number as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
   * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
   * @returns {Promise<string>} An extended pub key. F.ex.: "xpub6D4BDPcP2GT577Vvch3R8wDkScZWzQzMMUm3PWbmWvVJrZwQY4VUNgqFJPMM3No2dFDFGTsxxpG5uJh7n7epu4trkrX7x7DogT5Uv6fcLW5".
   */
  getExtPub() {
    MUST_IMPLEMENT();
  }

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
   * @param {Object[]} params.utxos Array of spendable utxos controlled by this HDSigner. The function will create a signer for each utxo.
   * @param {string} params.utxos[].path Derivation path of the key that must sign the hash. F.ex.: `44'/1'/1'/0/0`.
   * @param {string} params.utxos[].tx The transaction serialized in hex.
   * @param {number} params.utxos[].n The vout index of the tx above.
   * @param {string} [params.utxos[].witnessScript] The witnessScript serialized in hex in case the utxo can be redeemed with an unlocking script (P2WSH or P2SH-P2WSH).
   * @param {string} [params.utxos[].redeemScript] The redeemScript serialized in hex in case the utxo can be redeemed with an unlocking script (P2SH).
   * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
   * @returns {Promise<function[]>} An array of functions, where each function corresponds to an utxo from the `utxos` input array.
   */
  createSigners() {
    MUST_IMPLEMENT();
  }

  /**
   * Returns the public key of a path.
   *
   * @async
   * @param {object} params
   * @param {string} params.path The serialized derivation path.
   * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
   * @returns {Promise<Buffer>} The public key.
   */
  async getPublicKey() {
    MUST_IMPLEMENT();
  }

  /**
   * Close the exchange with the Interface. Call it to release the interface.
   * This is an optional method since not all HD signers need to be released.
   *
   * @async
   */
  close() {
    MUST_IMPLEMENT();
  }
}
