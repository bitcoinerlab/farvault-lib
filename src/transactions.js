/** @module transactions */

import {
  NESTED_SEGWIT,
  NATIVE_SEGWIT,
  LEGACY,
  PSBT_VERSION
} from './constants';
import { Psbt, payments, networks, Transaction } from 'bitcoinjs-lib';
import { parseDerivationPath } from './bip32';
import varuint from 'varuint-bitcoin';

import memoize from 'lodash.memoize';

import { ECPair } from './secp256k1';

import { feeRateSampling } from './fees';

import { unlockScript, isP2SH, isP2WSH, isP2WPKH, isP2PKH } from './scripts';

const validator = (pubkey, msghash, signature) =>
  ECPair.fromPublicKey(pubkey).verify(msghash, signature);

const txFromHex = memoize(function (tx) {
  return Transaction.fromHex(tx);
});

/**
 * Same utility function, line-by-line, as the one used in bitcoinjs-lib for
 * finalizing inputs.
 *
 * We must use it to finalize custom FarVault timeLockTransactions.
 *
 * Refer to {@link https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/psbt.js#L1187 bitcoinjs-lib's implementation}
 * for the details.
 *
 * bitcoinjs-lib has it own excellent suite of tests and so it's already been
 * thoroughly tested.
 */
function witnessStackToScriptWitness(witness) {
  let buffer = Buffer.allocUnsafe(0);
  function writeSlice(slice) {
    buffer = Buffer.concat([buffer, Buffer.from(slice)]);
  }
  function writeVarInt(i) {
    const currentLen = buffer.length;
    const varintLen = varuint.encodingLength(i);
    buffer = Buffer.concat([buffer, Buffer.allocUnsafe(varintLen)]);
    varuint.encode(i, buffer, currentLen);
  }
  function writeVarSlice(slice) {
    writeVarInt(slice.length);
    writeSlice(slice);
  }
  function writeVector(vector) {
    writeVarInt(vector.length);
    vector.forEach(writeVarSlice);
  }
  writeVector(witness);
  return buffer;
}

/**
 * Builds a PSBT object ready to be signed.
 * It assumes that all the utxos can be spent using this wallet.
 * It sends funds to targets, where targets are [{ address, value (in sats) }]
 *
 * This is an internal function that separates concerns with
 * {@link module:transactions.createTransaction createTransaction}. Using PSBTs may end up being useful
 * when multi-sig is implemented in the future.
 *
 * This function validates several things:
 * * It makes sure that params in a utxo: redeemScript, witnessScript and path
 * are compatible.
 * * It makes sure that if a script is passed in the utxo then this script can be
 * spent with the path.
 * * It makes sure that if a redeemScript is passed, then the utxo corresponds to
 * a P2SH
 * * It makes sure that if a witnessScript is passed, then the utxo corresponds to
 * a P2SH (for nested P2SH-P2WSH) or a P2WSH for a native witness script.
 * * For standard payments it makes sure that the utxo script corresponds to
 * the correct BIP-44, BIP-49 or BIP-84 specifications.
 *
 * It's only called by createTransaction and tested using createTransaction unit
 * tests.
 * @async
 */
function createPSBT({
  utxos,
  pubkeys,
  sequences,
  targets,
  network = networks.bitcoin
}) {
  const psbt = new Psbt({ network });
  for (let i = 0; i < utxos.length; i++) {
    const utxo = utxos[i];
    const bjsTx = txFromHex(utxo.tx);

    const txid = bjsTx.getId();
    const sequence = sequences[i];
    const utxoScript = bjsTx.outs[utxo.n].script;

    let redeemScript = undefined;
    let witnessScript = undefined;

    //P2SH, P2WSH or P2SW-P2WSH:
    if (utxo.witnessScript || utxo.redeemScript) {
      //Get the redeemScript and/or the witnessScript
      //P2SH:
      if (utxo.redeemScript) {
        redeemScript = Buffer.from(utxo.redeemScript, 'hex');
        if (!isP2SH(utxoScript))
          throw new Error('Got a redeemScript but this is not a P2SH utxo');
      }
      //P2WSH:
      else if (utxo.witnessScript && isP2WSH(utxoScript)) {
        witnessScript = Buffer.from(utxo.witnessScript, 'hex');
      }
      //P2SH-P2WSH:
      else if (utxo.witnessScript && isP2SH(utxoScript)) {
        witnessScript = Buffer.from(utxo.witnessScript, 'hex');
        const nestedUnlockingPayment = payments.p2wsh({
          redeem: { output: Buffer.from(utxo.witnessScript, 'hex') },
          network
        });
        redeemScript = payments.p2sh({
          redeem: nestedUnlockingPayment,
          network
        }).redeem.output;

        const redeemScriptOutput = payments.p2sh({
          redeem: { output: redeemScript },
          network
        }).output;
        if (!redeemScriptOutput.equals(utxoScript)) {
          throw new Error(
            'Got a witnessScript but this is not a P2WSH neither a P2SH-P2WSH utxo'
          );
        }
      } else {
        throw new Error(
          'Got a script but could not classify it into P2SH, P2WSH or P2SH-P2WSH'
        );
      }
    }
    //Standard payments: P2PKH, P2WPKH, P2SH-P2WPKH:
    //We will make sure the path corresponds to the script type of the utxo to
    //detect possible errors:
    else {
      //const purpose = parseInt(utxo.path.split('/')[0]);
      const purpose = parseDerivationPath(utxo.path).purpose;
      if (purpose === NESTED_SEGWIT) {
        if (!isP2SH(utxoScript))
          throw new Error(
            'This is a NESTED_SEGWIT utxo that does not have a P2SH script'
          );
        const p2wpkh = payments.p2wpkh({ pubkey: pubkeys[i], network });
        redeemScript = payments.p2sh({ redeem: p2wpkh, network }).redeem.output;
      } else if (purpose === NATIVE_SEGWIT) {
        if (!isP2WPKH(utxoScript))
          throw new Error(
            'This is a NATIVE_SEGWIT utxo that does not have a P2WPKH script'
          );
      } else if (purpose === LEGACY) {
        if (!isP2PKH(utxoScript))
          throw new Error(
            'This is a LEGACY utxo that does not have a P2PKH script'
          );
      } else {
        throw new Error(
          'Can only process P2WPKH, P2SH-P2WPKH, P2PKH and FarVault P2WSH, P2SH, P2SH-P2WPKH addresses'
        );
      }
    }

    psbt.addInput({
      //hash param can be either a string or a Buffer.
      //When it is a string: hash corresponds to the txid:
      //https://learnmeabitcoin.com/technical/txid
      //
      //The txid is what can be commonly found in the Bitcoin explorers and software to refer to transactions.
      //Note that the txid never includes information about the witness part (because Bitcoin is backwards compatible)
      //
      //When hash is a Buffer it corresponds to the binary hash of the transaction
      //Note that when we convert it to (string) txid, then it must be done
      //like this for historical reasons:
      //string_txid = reverseBuffer(buffer_hash).toString('hex')
      hash: txid,
      //The three below will also work:
      //hash: txFromHex(utxo.tx).getHash(false /*forWitness = false*/), //Passes a Buffer. getHash() returns a Buffer
      //hash: txFromHex(utxo.tx).getHash(), //Passes a Buffer. forWitness defaults to false anyway so no need to set false.
      //hash: txFromHex(utxo.tx).getId(), //Passes a string. This is a string that corresponds to the Buffer above (in reverse order) and serialized.
      index: utxo.n,
      nonWitnessUtxo: bjsTx.toBuffer(),
      ...(typeof redeemScript !== 'undefined' ? { redeemScript } : {}),
      ...(typeof witnessScript !== 'undefined' ? { witnessScript } : {}),
      ...(typeof sequence !== 'undefined' ? { sequence } : {})
    });
  }
  for (const target of targets) {
    //Here we pass a clone because of a bitcoinjs-lib bug where addInput mutates
    //the target (it adds an script property):
    //https://github.com/bitcoinjs/bitcoinjs-lib/issues/1805
    psbt.addOutput({ ...target });
  }
  psbt.setVersion(PSBT_VERSION);
  return psbt;
}

/**
 * Builds a transaction ready to be broadcasted.
 *
 * It assumes that all the utxos of the transaction can be spent using the same
 * wallet controlled by this software.

 * Targets are expressed as: `[{ address, value }]`, with value in satoshis.
 *
 * Utxos can be standard: P2PKH, P2WPKH, P2WH-P2WPKH. And they can also be
 * P2SH, P2SH-P2WSH or P2WSH for FarVault's timelocked utxos.
 *
 * For regular P2PKH, P2WPKH, P2SH-P2WPKH utxos, an utxo must have these fields:
 * `{tx, n, path}`, where
 * * `tx` is a string containing the complete previous transaction in hex
 * * `n` is the index of the output
 * * `path` is the BIP-44/49/84 serialized derivation path string that can spend this utxo. F.ex.: `44'/1'/1'/0/0`.
 *
 * For relativeTimeLockScript utxos, the utxo must be:
 *`{tx, n, path, witnessScript|redeemScript}`, where:
 * * `tx` is a string containing the complete previous transaction in hex
 * * `n` is the index of the output
 * * `path` is a BIP84 serialized derivation path that can spend this utxo. F.ex.: `84'/1'/1'/0/0`. Note that this path may correspond to the rushedPublicKey or the maturedPublicKey. This is checked internally comparing the pubkey of `utxo.path` with the `rushedPublicKey` and `maturedPublicKey` pubkeys extracted from the `witnessScript`/`redeemScript`.
 * * `witnessScript|redeemScript` is the relative timeLock script. The script is internally decompiled to obtain the rushedPublicKey, maturedPublicKey and also the bip68LockTime. Then, it is possible to deduce if this `path` belongs to the rushedPublicKey or the maturedPublicKey. With that information, the appropriate unlocking script is chosen and added into the transaction. `witnessScript` is for segwit transactions (P2WSH and P2SH-P2WSH) and `redeemScript` for P2SH transactions.
 *
 * This function validates the utxos in child function `createPSBT`.
 *
 * You must provide the (async) function that gives back the public key of a
 * derivationPath.
 *
 * @async
 * @param {Object} parameters
 * @param {Object[]} parameters.utxos List of spendable utxos.
 * @param {string} parameters.utxos[].path Derivation path. F.ex.: `44'/1'/1'/0/0`.
 * @param {string} parameters.utxos[].tx The transaction serialized in hex.
 * @param {string} [parameters.utxos[].redeemScript The legacy-P2SH script serialized in hex in case the utxo can be redeemed with an unlocking legacy-P2SH script.
 * @param {string} [parameters.utxos[].witnessScript The witnessScript serialized in hex in case the utxo is a P2WSH or P2SH-P2WSH output. When an utxo has a witnessScript string, this function automatically detects the output type: P2WSH or P2SH-P2WSH.
 * @param {number} parameters.utxos[].n The vout index of the tx above.
 * @param {Object[]} parameters.targets List of addresses to send funds.
 * @param {string} parameters.targets[].address The address to send funds.
 * @param {number} parameters.targets[].value Number of satoshis to send the address above.
 * @param {module:HDInterface.createSigners} parameters.createSigners An **async** function that returns an array of signer functions. One for each utxo. Signer functions sign the hash of the transaction.
 * @param {module:HDInterface.getPublicKey} parameters.getPublicKey An **async** function that resolves the public key from a derivation path and the network.
 * @param {boolean} [parameters.validateSignatures=true] Whether you want to validate signatures. This should always be true to detect errors. However, when createMultiFeeTransactions it is ok to only validate one of the transactions (for one of the fees). Signature validation is slow and this helps improving speed when creating a large number of transactions.
 * @param {object} [parameters.network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * @returns {Promise<string>} A promise that resolves into a transaction string in hex
 */

export async function createTransaction({
  utxos,
  targets,
  getPublicKey,
  createSigners,
  validateSignatures = true,
  network = networks.bitcoin
}) {
  const pubkeys = [];
  const sequences = [];
  const createUnlockingScripts = [];
  //Compute the arrays above:
  for (let i = 0; i < utxos.length; i++) {
    const utxo = utxos[i];
    pubkeys[i] = await getPublicKey(utxo.path, network);
    const script = utxo.witnessScript || utxo.redeemScript;
    if (script) {
      if (utxo.witnessScript && utxo.redeemScript)
        throw new Error('A PSBT cannot be P2SH and P2WSH at the same time.');
      const unlockParams = unlockScript({ script, pubkey: pubkeys[i] });
      if (unlockParams === false)
        throw new Error(
          'This wallet cannot spend this script: ' + String(script)
        );
      sequences[i] = unlockParams.sequence;
      createUnlockingScripts[i] = unlockParams.createUnlockingScript;
    }
  }

  //createPSBT also validates the utxo in many ways (relevant checks done there)
  const psbt = createPSBT({ targets, utxos, pubkeys, sequences, network });

  const signers = await createSigners({ psbt, utxos, network });

  //Instead of a psbt.finalizeAllInputs(); we go one by one
  //There are the 2 special cases where we are redeeming the relativeTimeLockScript
  //using different to paths. When finalizing we must set the unlocking condition.
  for (let i = 0; i < utxos.length; i++) {
    psbt.signInput(i, { publicKey: pubkeys[i], sign: signers[i], network });
    //This is very slow... turn it off with validateSignatures=false
    if (validateSignatures) {
      //This is a very important test to do specially when signing using a HW wallet since
      //it gets tricky to make bitcoinjs-lib to work well with ledgerjs.
      if (psbt.validateSignaturesOfInput(i, validator, pubkeys[i]) !== true) {
        throw new Error('Invalid signature detected');
      }
    }
    const utxo = utxos[i];
    const script = utxo.witnessScript || utxo.redeemScript;
    if (!script) {
      psbt.finalizeInput(i);
    } else {
      psbt.finalizeInput(i, (inputIndex, input, lockingScript) => {
        //partialSig[0] has a zero because the input is only signed with
        //one pubkey. Either rushed or matured. It's not multi-sig
        if (input.partialSig.length !== 1) {
          throw new Error(
            'This wallet only handles one signature per input (yet).'
          );
        }
        const signature = input.partialSig[0].signature;
        let unlockingScript = createUnlockingScripts[i](signature);
        const utxoScript = txFromHex(utxo.tx).outs[utxo.n].script;

        let witness = [];
        let unlockingPayment;

        //Classify between P2SH, P2SH-P2WSH or P2WSH:
        //P2WSH:
        if (!!utxo.witnessScript && isP2WSH(utxoScript)) {
          unlockingPayment = payments.p2wsh({
            redeem: { input: unlockingScript, output: lockingScript },
            network
          });
          witness = unlockingPayment.witness;
        }
        //P2SH-P2WSH:
        else if (!!utxo.witnessScript && isP2SH(utxoScript)) {
          const nestedUnlockingPayment = payments.p2wsh({
            redeem: { input: unlockingScript, output: lockingScript },
            network
          });
          unlockingPayment = payments.p2sh({
            redeem: nestedUnlockingPayment,
            network
          });
          witness = nestedUnlockingPayment.witness;
        }
        //P2SH:
        else if (!!utxo.redeemScript && isP2SH(utxoScript)) {
          unlockingPayment = payments.p2sh({
            redeem: { input: unlockingScript, output: lockingScript },
            network
          });
        } else {
          throw new Error('Cannot not classify this script');
        }
        return {
          finalScriptWitness: witnessStackToScriptWitness(witness),
          //scriptSig means unlockingScript:
          //https://www.mycryptopedia.com/scriptpubkey-scriptsig/
          finalScriptSig: unlockingPayment.input
        };
      });
    }
  }
  //extractTransaction also catches if trying to spend more than in inputs
  //(there's a test in test/fixtures/transactions.js)
  const tx = psbt.extractTransaction(true).toHex();
  return tx;
}

/**
 * Same as {@link module:transactions.createTransaction createTransaction} but it returns an array of
 * transactions for a set of different fees.
 *
 * The number of transactions is dictated by `feeRateSamplingParams`.
 *
 * Note that signatures are only validated in the case of `minSatsPerByte` (see
 * {@link module:fees.feeRateSampling feeRateSampling}).
 * If this signature is valid, then we assume the rest of signatures are also
 * valid. This is done for performance reasons.
 *
 * @async
 * @param {Object} parameters
 * @param {Object[]} parameters.utxos List of spendable utxos.
 * @param {string} parameters.utxos[].path Derivation path. F.ex.: `44'/1'/1'/0/0`.
 * @param {string} parameters.utxos[].tx The transaction serialized in hex.
 * @param {string} [parameters.utxos[].redeemScript The legacy-P2SH script serialized in hex in case the utxo can be redeemed with an unlocking legacy-P2SH script.
 * @param {string} [parameters.utxos[].witnessScript The witnessScript serialized in hex in case the utxo is a P2WSH or P2SH-P2WSH output. When an utxo has a witnessScript string, this function automatically detects the output type: P2WSH or P2SH-P2WSH.
 * @param {number} parameters.utxos[].n The vout index of the tx above.
 * @param {Object[]} parameters.targets List of addresses to send funds.
 * @param {string} parameters.targets[].address The address to send funds.
 * @param {number} parameters.targets[].value Number of satoshis to send the address above.
 * @param {module:HDInterface.createSigners} parameters.createSigners An **async** function that returns an array of signer functions. One for each utxo. Signer functions sign the hash of the transaction.
 * @param {object} parameters.feeRateSamplingParams Same params as the ones in {@link module:fees.feeRateSampling feeRateSampling}.
 * @param {module:HDInterface.getPublicKey} parameters.getPublicKey An **async** function that resolves the public key from a derivation path and the network.
 * @param {object} [parameters.network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * @returns {Array.<Promise<{tx:string, fee:number, feeRate:number}>>} An array of promises that resolve to transactions in hex, the fee in sats and the feeRate in sats/vbyte
 */
export async function createMultiFeeTransactions({
  utxos,
  address, //do not set {address, value } because multifee assumes we send max value
  getPublicKey,
  createSigners,
  feeRateSamplingParams = {},
  network = networks.bitcoin
}) {
  const txs = [];
  const feeRates = feeRateSampling(feeRateSamplingParams);
  const value = utxos.reduce(
    (acc, utxo) => acc + txFromHex(utxo.tx).outs[utxo.n].value,
    0
  );
  //We'll get the vzise of from an initial tx, assuming 0 fees: [0, ...feeRates]
  let vsize = 0;
  for (const feeRate of [0, ...feeRates]) {
    //The vsize for a tx with different fees may slightly vary
    //because of the signature.
    //(I've observed 1 vbyte difference sometimes)
    //Let's assume a slightly larger tx size (+1vbyte).
    const fee = Math.ceil((vsize + 1) * feeRate);
    if (fee <= value) {
      const tx = await createTransaction({
        utxos,
        targets: [{ address, value: value - fee }],
        getPublicKey,
        createSigners,
        //Signature validation is very expensive. Only validate signatures in
        //the case of minSatsPerByte. If this signature is valudworks, then the rest will also
        //have valid signatures.
        validateSignatures: feeRate === feeRates[0],
        network
      });
      if (vsize === 0) {
        //Take the vsize for a tx with 0 fees.
        vsize = txFromHex(tx).virtualSize();
      } else {
        const realVsize = txFromHex(tx).virtualSize();
        const realFeeRate = fee / realVsize;
        txs.push({ tx, feeRate: realFeeRate, fee });
      }
    }
  }
  return txs;
}
