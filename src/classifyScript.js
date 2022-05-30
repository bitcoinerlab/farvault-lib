/*
 * So far, this module is unused and untested.
 * Keep it in case it is useful in the future.
 *
 * It was taken from here:
 *
 * https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/psbt.js
 *
 * But it may have some problems. Read this:
 * https://github.com/bitcoinjs/bitcoinjs-lib/issues/1768
 * and this:
 * https://github.com/bitcoinjs/bitcoinjs-lib/pull/1377
 **/

import {
  Transaction,
  Psbt,
  payments,
  networks,
  address,
  script
} from 'bitcoinjs-lib';

function isPaymentFactory(payment) {
  return script => {
    try {
      payment({ output: script });
      return true;
    } catch (err) {
      return false;
    }
  };
}
const isP2MS = isPaymentFactory(payments.p2ms);
const isP2PK = isPaymentFactory(payments.p2pk);
const isP2PKH = isPaymentFactory(payments.p2pkh);
const isP2WPKH = isPaymentFactory(payments.p2wpkh);
const isP2WSHScript = isPaymentFactory(payments.p2wsh);
const isP2SHScript = isPaymentFactory(payments.p2sh);

export function classifyScript(script) {
  if (isP2WPKH(script)) return 'witnesspubkeyhash';
  if (isP2PKH(script)) return 'pubkeyhash';
  if (isP2MS(script)) return 'multisig';
  if (isP2PK(script)) return 'pubkey';
  return 'nonstandard';
}
