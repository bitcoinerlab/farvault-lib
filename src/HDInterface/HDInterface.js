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

export const LEDGER_NANO_INTERFACE = 'LEDGER_NANO_INTERFACE';
export const SOFT_HD_INTERFACE = 'SOFT_HD_INTERFACE';

import * as ledgerNano from './ledgerNano';
import * as soft from './soft';

export const WEB_TRANSPORT = ledgerNano.WEB_TRANSPORT;
export const NODEJS_TRANSPORT = ledgerNano.NODEJS_TRANSPORT;

import memoize from 'lodash.memoize';

import { deriveExtPub, parseDerivationPath } from '../bip44';
import { networks, getNetworkId, getNetworkCoinType } from '../networks';

/**
 * @async
 * @typedef {function} module:HDInterface.getPublicKey
 * Returns the extended pub key of an initialized HDInterface.
 * @param {object} params
 * @param {string} params.path The serialized derivation path.
 * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
 * @returns {Promise<Buffer>} The public key.
 */
async function getPublicKey(HDInterface, path, network = networks.bitcoin) {
  const { purpose, coinType, accountNumber, index, isChange } =
    parseDerivationPath(path);
  if (getNetworkCoinType(network) !== coinType) {
    throw new Error('Network mismatch');
  }
  const extPub = await HDInterface.getExtPub({
    purpose,
    accountNumber,
    network
  });
  return deriveExtPub({ extPub, index, isChange, network });
}

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
  let HDInterface = null;
  if (type === LEDGER_NANO_INTERFACE) {
    const { ledgerTransport, ledgerAppBtc } = await ledgerNano.init(transport);
    HDInterface = {
      //getExtPub is async for ledger nano
      getExtPub: (...args) => ledgerNano.getExtPub(ledgerAppBtc, ...args),
      //createSigners is async for ledger nano
      createSigners: (...args) =>
        ledgerNano.createSigners(ledgerAppBtc, ...args),
      close: () => ledgerNano.close(ledgerTransport)
    };
  } else if (type === SOFT_HD_INTERFACE) {
    if (typeof mnemonic === 'undefined') {
      console.log('WARN: Using default mnemonic!');
    }
    const seed = await soft.init(mnemonic);
    HDInterface = {
      getExtPub: (...args) => soft.getExtPub(seed, ...args),
      createSigners: (...args) => soft.createSigners(seed, ...args),
      close: () => {}
    };
  } else throw new Error('Cannot initialize this type of HD Wallet');

  return {
    ...HDInterface,
    //getPublicKey: (...args) => getPublicKey(HDInterface, ...args)
    //Extremelly important to memoize,
    //specially for large number of multi-fee transactions
    getPublicKey: memoize(
      (path, network = networks.bitcoin) =>
        getPublicKey(HDInterface, path, network),
      (path, network = networks.bitcoin) => {
        return path + getNetworkId(network);
      }
    )
  };
}