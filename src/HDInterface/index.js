//TODO: creo que no es necesario pero bueni:
//  estudiar el caso de
//   const createInvalidSigners = async ({ psbt, utxos, network }) => {
//   ver si hace falta el "bind"
//   Ver lo mismo para
//                 getPublicKey: getInvalidPublicKey,
//
//TODO: how to document HDInterface specially @typedef: extPubGetter, getPublicKey, createSigners
//This does not work
//
//TODO: test the ledger nano
//
//TODO: Los tests con la Ledger me fallan otra vez
//estos test
//    ✕ Unlock: Take the previous tested tx and spend a matured key P2SH-P2WSH. (9712 ms)
//    ✕ Unlock: Take the previous tested tx and spend a matured key P2SH. (5476 ms)
//    ✕ Unlock: Take the previous tested tx and spend a matured key P2SH. In addition also spend a P2WPKH (15916 ms)
//    ✕ Unlock using the matured branch, without mining after 0 seconds. (21289 ms)

/** @module HDInterface */
/*
 * This module inits an HD device (software or ledger nano) and returns
 * an object with 2 methods:
 *
 * getPublicKey
 * createSigners
 *
 * These 2 methods are then used in createTransaction.
 *
 * createTransaction is robust to errors within this module (if the HW devices
 * changed their behaviour, f.ex.).
 *
 * A very large set of test transactions have been set in transactions.test.js
 * that test all the methods in this file.
 *
 * Even in case these 2 methods provided bad data this is detected in
 * createTransaction.  See the speciffic tests Transactions with
 * "invalid HDInterface data" in transactions.test.js.
 */

/**
 * @async
 * @typedef {function} module:HDInterface.getExtPub
 * Returns the extended pub key of an initialized HDInterface.
 * @param {object} params
 * @param {number} params.purpose The purpose we want to transform to: LEGACY,
 * NATIVE_SEGWIT or NESTED_SEGWIT.
 * @param {number} params.accountNumber The account number as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
 * @returns {Promise<string>} An extended pub key. F.ex.: "xpub6D4BDPcP2GT577Vvch3R8wDkScZWzQzMMUm3PWbmWvVJrZwQY4VUNgqFJPMM3No2dFDFGTsxxpG5uJh7n7epu4trkrX7x7DogT5Uv6fcLW5".
 */

/**
 * @async
 * @typedef {function} module:HDInterface.createSigners
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
 * @param {object} params
 * @param {object} params.psbt The [bitcoinjs-lib Psbt object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/psbt.js) where the `tx` to be signed will be extracted.
 * @param {Object[]} params.utxos List of spendable utxos controlled by this HDInterface. The function will create a signer for each utxo.
 * @param {string} params.utxos[].path Derivation path of the key that must sign the hash. F.ex.: `44'/1'/1'/0/0`.
 * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
 * @returns {Promise<function[]>} An array of functions, where each function corresponds to an utxo from the `utxos` input array.`.
 */

/**
 * @async
 * @typedef {function} module:HDInterface.getPublicKey
 * Returns the extended pub key of an initialized HDInterface.
 * @param {object} params
 * @param {string} params.path The serialized derivation path.
 * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
 * @returns {Promise<Buffer>} The public key.
 */

import { SoftHDInterface } from './soft';
import {
  WEB_TRANSPORT,
  NODEJS_TRANSPORT,
  LedgerHDInterface
} from './ledgerNano';

export { WEB_TRANSPORT, NODEJS_TRANSPORT };
export const LEDGER_NANO_INTERFACE = 'LEDGER_NANO_INTERFACE';
export const SOFT_HD_INTERFACE = 'SOFT_HD_INTERFACE';

/**
 * Create an HD wallet. Can be of types `LEDGER_NANO_INTERFACE` or `SOFT_HD_INTERFACE`.
 *
 * It returns an object containing the following functions:
 *
 * * `getExtPub` (as defined in {@link module:HDInterface.getExtPub})
 * * `getPublicKey` (as defined in {@link module:HDInterface.getPublicKey})
 * * `createSigners` (as defined in {@link module:HDInterface.createSigners}).
 *
 * @async
 * @param {number} type `LEDGER_NANO_INTERFACE` or `SOFT_HD_INTERFACE`.
 * @param {object} [optionals] Pass an object `{ mnemonic }` when initializing a
 * SOFT_HD_INTERFACE. F.ex.: `{ mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about' }`.
 *
 * @returns {Promise<object>} An object containing the following functions:
 *
 * * `getExtPub` (as defined in {@link module:HDInterface.getExtPub})
 * * `getPublicKey` (as defined in {@link module:HDInterface.getPublicKey})
 * * `createSigners` (as defined in {@link module:HDInterface.createSigners})
 */
export async function initHDInterface(type, { transport, mnemonic } = {}) {
  let instance = null;
  if (type === LEDGER_NANO_INTERFACE) {
    instance = new LedgerHDInterface({ transport });
  } else if (type === SOFT_HD_INTERFACE) {
    instance = new SoftHDInterface({ mnemonic });
  } else throw new Error('Cannot initialize this type of HD Wallet');
  await instance.init();
  return instance;
}
