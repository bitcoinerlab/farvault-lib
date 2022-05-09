/** @module HDInterface */
export const LEDGER_NANO_INTERFACE = 'LEDGER_NANO_INTERFACE';
export const SOFT_HD_INTERFACE = 'SOFT_HD_INTERFACE';

import * as ledgerNano from './ledgerNano';
import * as soft from './soft';

import {
  deriveExtPub,
  parseDerivationPath,
  getNetworkCoinType
} from '../bip32';
import { networks } from 'bitcoinjs-lib';

async function getPublicKey(
  HDInterface,
  derivationPath,
  network = networks.bitcoin
) {
  const {
    purpose,
    coinType,
    accountNumber,
    index,
    isChange
  } = parseDerivationPath(derivationPath);
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
 * @typedef {function} module:HDInterface.extPubGetter
 * @param {object} params
 * @param {number} params.purpose The purpose we want to transform to: LEGACY,
 * NATIVE_SEGWIT or NESTED_SEGWIT.
 * @param {number} params.accountNumber The account number as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 * @param {object} [params.network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * @returns {string} An extended pub key. F.ex.: "xpub6D4BDPcP2GT577Vvch3R8wDkScZWzQzMMUm3PWbmWvVJrZwQY4VUNgqFJPMM3No2dFDFGTsxxpG5uJh7n7epu4trkrX7x7DogT5Uv6fcLW5".
 */

/**
 * Create an HD wallet. Can be of types `LEDGER_NANO_INTERFACE` or `SOFT_HD_INTERFACE`.
 *
 * It returns an object containing the following functions:
 *
 * * `getExtPub` (as defined in {@link module:HDInterface.extPubGetter})
 * * `getPublicKey`
 * * `createSigners`.
 *
 * @param {number} type `LEDGER_NANO_INTERFACE` or `SOFT_HD_INTERFACE`.
 * @param {object} [optionals] Pass an object `{ mnemonic }` when initializing a
 * SOFT_HD_INTERFACE. F.ex.: `{ mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about' }`.
 *
 * @returns {object} An object containing the following functions:
 *
 * * `getExtPub` (as defined in {@link module:HDInterface.extPubGetter})
 * * `getPublicKey`: `(derivationPath, network) => publicKey`
 * * `createSigners`: `({ psbt, utxos, network }) => [(hash_utxo_0)=>signature_utxo_0, (hash_utxo_1)=>signature_utxo_1, ...]`
 */
export async function initHDInterface(type, { mnemonic } = {}) {
  let HDInterface = null;
  if (type === LEDGER_NANO_INTERFACE) {
    const ledgerAppBtc = await ledgerNano.init();
    HDInterface = {
      type,
      getExtPub: (...args) => ledgerNano.getExtPub(ledgerAppBtc, ...args),
      createSigners: (...args) =>
        ledgerNano.createSigners(ledgerAppBtc, ...args)
    };
  } else if (type === SOFT_HD_INTERFACE) {
    if (typeof mnemonic === 'undefined') {
      console.log('WARN: Using default mnemonic!');
    }
    const seed = await soft.init(mnemonic);
    HDInterface = {
      type,
      getExtPub: (...args) => soft.getExtPub(seed, ...args),
      createSigners: (...args) => soft.createSigners(seed, ...args)
    };
  } else throw new Error('Cannot initialize this type of HD Wallet');

  return {
    ...HDInterface,
    getPublicKey: (...args) => getPublicKey(HDInterface, ...args)
  };
}
