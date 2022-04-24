/** @module coinselect */

import bjsCoinselect from 'coinselect';
import bjsCoinselectSplit from 'coinselect/split';
import { parseDerivationPath } from './bip32';
import { decodeTx } from './decodeTx';
import { LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT } from './walletConstants';
import { networks, address as bjsAddress } from 'bitcoinjs-lib';
import { checkAddress } from './check';

/**
 * Given a set of target addresses where the user wants to send some bitcoin,
 * it selects a subset of utxos so that the targets are funded.
 *
 * This function is basically a wrapper of excellent
 * [bitcoinjs-lib/coinselect lib](https://github.com/bitcoinjs/coinselect)
 * adding Segwit support and automatically detecting if the user wants to send
 * max-funds to an address.
 *
 * It builds on ideas from [Bluewallet](https://github.com/BlueWallet/BlueWallet/)'s
 * coinselect for Segwit support.
 *
 * Pass only one target with empty value to send all utxos funds (except fee) to
 * the target's address.
 *
 * Pass a `changeAddress` callback in case it's needed.
 *
 * Read the issues below to understand some of the decissions on the
 * `{script:{length}}` pieces of code in the implementation:
 *
 * * [https://github.com/BlueWallet/BlueWallet/issues/4352#issuecomment-1102307443](https://github.com/BlueWallet/BlueWallet/issues/4352#issuecomment-1102307443)
 * * [https://github.com/bitcoinjs/coinselect/issues/69](https://github.com/bitcoinjs/coinselect/issues/69)
 * * [https://github.com/BlueWallet/BlueWallet/pull/3810](https://github.com/BlueWallet/BlueWallet/pull/3810)
 * @param {Object} parameters
 * @param {Object[]} parameters.utxos List of spendable utxos.
 * @param {string} parameters.utxos[].derivationPath Derivation path. F.ex.: `44'/1'/1'/0/0`.
 * @param {string} parameters.utxos[].tx The transaction serialized in hex.
 * @param {number} parameters.utxos[].n The vout index of the tx above.
 * @param {Object[]} parameters.targets List of addresses to send funds.
 * If `targets.length === 1`' , and `targets[0].value` is `undefined`, then
 * all funds will be sent to `targets[0].address`, while leaving an appropriate
 * amount for the fee.
 * @param {string} parameters.targets[].address The address to send funds.
 * @param {number} parameters.targets[].value Number of satoshis to send the address above.
 * @param {number} parameters.feeRate satoshis per vbyte. Must be `>= 1`. Round it up in case of doubt. It is better to pay an extra 0.x satoshi/byte than be under-measuring and miss some cut off for some miner.
 * @param {function} parameters.changeAddress Callback function that returns a string with a change address where change will go. Might not be called.
 * @param {Object} parameters.network A [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js). Default is testnet.
 * @returns {Object[]} return.utxos The subset of input utxos selected. Undefined if no solution is found.
 * @returns {Object[]} return.targets The input targets plus (if necessary) a new target for the change address. Undefined if no solution is found.
 * @returns {number} return.fee The accumulated fee in vbytes. This is always returned even if no solution was found.
 */
export function coinselect({
  utxos,
  targets,
  feeRate,
  changeAddress,
  network = networks.testnet
}) {
  let addedWitness = false;
  const csUtxos = utxos.map(utxo => {
    const { purpose } = parseDerivationPath(utxo.derivationPath);
    let decodedTx;
    try {
      decodedTx = decodeTx(utxo.tx, network);
    } catch (error) {
      throw new Error('Invalid tx');
    }
    if (
      network !== networks.bitcoin &&
      network !== networks.regtest &&
      networks !== networks.testnet
    )
      throw new Error('Invalid network');
    const csUtxo = {};
    csUtxo.value = decodedTx.vout[utxo.n].value;
    csUtxo.vout = utxo.n;
    csUtxo.tx = utxo.tx;
    csUtxo.derivationPath = utxo.derivationPath;
    // compensating for coinselect inability to deal with segwit inputs,
    // and overriding script length for proper vbytes calculation
    // based on https://github.com/BlueWallet/BlueWallet/blob/master/class/wallets/abstract-hd-electrum-wallet.js
    //console.log('TRACE LENGTH', bjsAddress.toOutputScript(decodedTx.vout[utxo.n].address, network).length);
    if (purpose === LEGACY) {
    } else if (purpose === NESTED_SEGWIT) {
      let additionalWitnessBytes = 0;
      if (addedWitness === false) {
        //Line 84: https://gist.github.com/junderw/b43af3253ea5865ed52cb51c200ac19c
        additionalWitnessBytes = 1;
        addedWitness = true;
      }
      csUtxo.script = { length: 50 + additionalWitnessBytes };
    } else if (purpose === NATIVE_SEGWIT) {
      let additionalWitnessBytes = 0;
      if (addedWitness === false) {
        //Line 84: https://gist.github.com/junderw/b43af3253ea5865ed52cb51c200ac19c
        additionalWitnessBytes = 1;
        addedWitness = true;
      }
      csUtxo.script = { length: 27 + additionalWitnessBytes };
    } else {
      throw new Error(
        'coinselect does ONLY work with p2wpkh, p2sh-p2wpkh or p2wpkh'
      );
    }
    return csUtxo;
  });

  const csTargets = targets.map(target => {
    const csTarget = {};
    //Note that we can send max by using only one target with value undefined.
    if (targets.length !== 1 || typeof target.value !== 'undefined') {
      if (!Number.isInteger(target.value)) {
        throw new Error('Invalid target value');
      }
      if (!Number.isSafeInteger(target.value) || target.value <= 0) {
        throw new Error('Invalid target value');
      }
      if (typeof feeRate !== 'number' || feeRate < 1) {
        throw new Error('Invalid fee rate value');
      }
    }
    csTarget.address = target.address;
    if (typeof target.value !== 'undefined') {
      csTarget.value = target.value;
    }
    checkAddress(target.address, network);
    //console.log('TRACE LENGTH', bjsAddress.toOutputScript(target.address, network).length);
    //Read discussion:
    //https://github.com/BlueWallet/BlueWallet/issues/4352#issuecomment-1102307443
    //
    //if (
    //  (target.address.startsWith('bc1') && network === networks.bitcoin) ||
    //  (target.address.startsWith('tb1') && network === networks.testnet) ||
    //  (target.address.startsWith('bcrt1') && network === networks.regtest)
    //) {
    //console.log('TRACE LENGTH', bjsAddress.toOutputScript(target.address, network).length);
    csTarget.script = {
      length: bjsAddress.toOutputScript(target.address, network).length
    };
    //}
    return csTarget;
  });

  //From coinselect lib:
  //https://github.com/bitcoinjs/coinselect
  //Pro-tip: if you want to send-all inputs to an output address, coinselect/split with a partial output (.address defined, no .value) can be used to send-all, while leaving an appropriate amount for the fee.

  const coinSelectAlgo =
    targets.length === 1 && typeof targets[0].value === 'undefined'
      ? bjsCoinselectSplit
      : bjsCoinselect;

  const { inputs, outputs, fee } = coinSelectAlgo(csUtxos, csTargets, feeRate);
  // .inputs and .outputs will be undefined if no solution was found
  if (!inputs || !outputs) {
    return { fee };
  } else {
    outputs.forEach(output => {
      if (!output.address) {
        if (typeof changeAddress !== 'function') {
          console.log(typeof changeAddress, changeAddress);
          throw new Error('Invalid changeAddress fn');
        }
        output.address = changeAddress();
        checkAddress(output.address, network);
      }
      if (output.script) {
        //This is something we added above.
        delete output.script;
      }
    });
    inputs.forEach(input => {
      if (input.script) {
        //This is something we added above.
        delete input.script;
      }
      //This is something we added above.
      delete input.value;
      input.n = input.vout;
      delete input.vout;
    });
    return { utxos: inputs, targets: outputs, fee };
  }
}
