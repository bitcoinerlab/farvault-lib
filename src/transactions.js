/** @module transactions */

import {
  NESTED_SEGWIT,
  NATIVE_SEGWIT,
  LEGACY,
  PSBT_VERSION
} from './walletConstants';
import {
  Psbt,
  payments,
  networks,
  Transaction,
  script,
  opcodes
} from 'bitcoinjs-lib';
import { decodeTx } from './decodeTx';
import { parseDerivationPath } from './bip32';
import varuint from 'varuint-bitcoin';

import ECPairFactory from 'ecpair';
let fromPublicKey;
import('tiny-secp256k1').then(ecc => {
  fromPublicKey = ECPairFactory(ecc).fromPublicKey;
});

import { feeRateSampling } from './fees';

import { parseRelativeTimeLockScript } from './scripts';

const validator = (pubkey, msghash, signature) =>
  fromPublicKey(pubkey).verify(msghash, signature);

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
 * It's only called by createTransaction and tested using createTransaction unit
 * tests.
 * @async
 */
async function createPSBT({
  utxos,
  targets,
  getPublicKey,
  network = networks.bitcoin
}) {
  const psbt = new Psbt({ network });
  for (const utxo of utxos) {
    const txid = decodeTx(utxo.tx).txid;

    let redeemScript = undefined;
    let witnessScript = undefined;
    let sequence = undefined;
    if (typeof utxo.witnessScript !== 'undefined') {
      //This is a P2WSH utxo.
      //This wallet only knows how to spend relativeTimeLockScript's
      const parsedScript = parseRelativeTimeLockScript(
        Buffer.from(utxo.witnessScript, 'hex')
      );
      if (parsedScript === false) {
        throw new Error('This wallet cannot spend this input witnessScript.');
      } else {
        const {
          maturedPublicKey,
          rushedPublicKey,
          bip68LockTime
        } = parsedScript;
        const pubkey = await getPublicKey(utxo.path, network);
        if (Buffer.compare(pubkey, maturedPublicKey) === 0) {
          witnessScript = Buffer.from(utxo.witnessScript);
          sequence = bip68LockTime;
          //console.log('WARNING: Test this', { sequence });
          //sequence = bip68LockTime;
        } else if (Buffer.compare(pubkey, rushedPublicKey) === 0) {
          witnessScript = Buffer.from(utxo.witnessScript);
        } else {
          throw new Error(
            "This wallet's pubkey cannot spend this input witnessScript."
          );
        }
      }
    } else {
      const purpose = parseDerivationPath(utxo.path).purpose;
      if (purpose === NESTED_SEGWIT) {
        const pubkey = await getPublicKey(utxo.path, network);
        const p2wpkh = payments.p2wpkh({ pubkey, network });
        redeemScript = payments.p2sh({ redeem: p2wpkh, network }).redeem.output;
      } else if (purpose !== NATIVE_SEGWIT && purpose !== LEGACY) {
        throw new Error(
          'Can only freeze P2WPKH, P2SH-P2WPKH, P2PKH  and FarVault P2WSH addresses'
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
      //hash: Transaction.fromHex(utxo.tx).getHash(false /*forWitness = false*/), //Passes a Buffer. getHash() returns a Buffer
      //hash: Transaction.fromHex(utxo.tx).getHash(), //Passes a Buffer. forWitness defaults to false anyway so no need to set false.
      //hash: Transaction.fromHex(utxo.tx).getId(), //Passes a string. This is a string that corresponds to the Buffer above (in reverse order) and serialized.
      index: utxo.n,
      nonWitnessUtxo: Transaction.fromHex(utxo.tx).toBuffer(),
      ...(typeof redeemScript !== 'undefined' ? { redeemScript } : {}),
      ...(typeof witnessScript !== 'undefined' ? { witnessScript } : {}),
      ...(typeof sequence !== 'undefined' ? { sequence } : {})
    });
  }
  for (const target of targets) {
    psbt.addOutput(target);
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
 * P2WSH for FarVault's timelocked utxos.
 *
 * For regular P2PKH, P2WPKH, P2WH-P2WPKH utxos, an utxo must be like this:
 * `{tx, n, path}`, where
 * * `tx` is a string containing the complete previous transaction in hex
 * * `n` is the index of the output
 * * `path` is the BIP-44/49/84 serialized derivation path string that can spend this utxo. F.ex.: `44'/1'/1'/0/0`.
 *
 * For relativeTimeLockScript utxos, the utxo must be:
 *`{tx, n, path, witnessScript}`, where
 * * `tx` is a string containing the complete previous transaction in hex
 * * `n` is the index of the output
 * * `path` is a BIP84 serialized derivation path that can spend this utxo. F.ex.: `84'/1'/1'/0/0`. Note that this path may correspond to the rushedPublicKey or the maturedPublicKey. This is checked internally comparing the pubkey of `utxo.path` with the `rushedPublicKey` and `maturedPublicKey` pubkeys from `witnessScript` 
 * * `witnessScript` is the relative timeLock script. The script is internally decompiled to obtain the rushedPublicKey, maturedPublicKey and also the bip68LockTime. Then, it is possible to deduce if this `path` belongs to the rushedPublicKey or the maturedPublicKey. With that information, the appropriate unlocking script is chosen and added into the transaction.
 *
 * You must provide the (async) function that gives back the public key of a
 * derivationPath.
 *
 * @async
 * @param {Object} parameters
 * @param {Object[]} parameters.utxos List of spendable utxos.
 * @param {string} parameters.utxos[].path Derivation path. F.ex.: `44'/1'/1'/0/0`.
 * @param {string} parameters.utxos[].tx The transaction serialized in hex.
 * @param {string} [parameters.utxos[].witnessScript] The witnessScript serialized in hex in case the utxo can be redeemed with an unlocking script.
 * @param {number} parameters.utxos[].n The vout index of the tx above.
 * @param {Object[]} parameters.targets List of addresses to send funds.
 * @param {string} parameters.targets[].address The address to send funds.
 * @param {number} parameters.targets[].value Number of satoshis to send the address above.
 * @param {module:HDInterface.createSigners} parameters.createSigners An **async** function that returns an array of signer functions. One for each utxo. Signer functions sign the hash of the transaction.
 * @param {module:HDInterface.getPublicKey} parameters.getPublicKey An **async** function that resolves the public key from a derivation path and the network.
 * @param {object} [parameters.network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 */

export async function createTransaction({
  utxos,
  targets,
  createSigners,
  getPublicKey,
  network = networks.bitcoin
}) {
  const psbt = await createPSBT({
    targets,
    utxos,
    getPublicKey,
    network
  });

  const signers = await createSigners({ psbt, utxos, network });
  for (let index = 0; index < utxos.length; index++) {
    psbt.signInput(index, {
      network,
      publicKey: await getPublicKey(utxos[index].path, network),
      sign: signers[index]
    });
  }
  psbt.validateSignaturesOfAllInputs(validator);

  //Instead of a psbt.finalizeAllInputs(); we go one by one
  //There are the 2 special cases where we are redeeming the relativeTimeLockScript
  //using different to paths. When finalizing we must set the unlocking condition.
  for (let i = 0; i < utxos.length; i++) {
    const utxo = utxos[i];
    if (typeof utxo.witnessScript === 'undefined') {
      psbt.finalizeInput(i);
    } else {
      //This wallet only knows how to spend relativeTimeLockScript's
      const parsedScript = parseRelativeTimeLockScript(
        Buffer.from(utxo.witnessScript, 'hex')
      );
      if (parsedScript === false) {
        throw new Error('This wallet cannot spend this input witnessScript.');
      } else {
        const { maturedPublicKey, rushedPublicKey } = parsedScript;
        const pubkey = await getPublicKey(utxo.path, network);
        if (Buffer.compare(pubkey, maturedPublicKey) === 0) {
          psbt.finalizeInput(i, (inputIndex, input, scriptParam) => {
            const maturedBranch = payments.p2wsh({
              redeem: {
                //parsedScript[0] has a zero because the input is only signed by
                //one pubkey. Either rushed or matured. It's not multi-sig
                input: script.compile([input.partialSig[0].signature]),
                output: utxo.witnessScript
              }
            });
            return {
              finalScriptWitness: witnessStackToScriptWitness(
                maturedBranch.witness
              )
            };
          });
        } else if (Buffer.compare(pubkey, rushedPublicKey) === 0) {
          psbt.finalizeInput(i, (inputIndex, input, scriptParam) => {
            const rushedBranch = payments.p2wsh({
              redeem: {
                //Force the 1st OP_CHECKSIG to fail. OP_0 === OP_FALSE
                input: script.compile([
                  //parsedScript[0] has a zero because the input is only signed by
                  //one pubkey. Either rushed or matured. It's not multi-sig
                  input.partialSig[0].signature,
                  opcodes.OP_0
                ]),
                output: utxo.witnessScript
              }
            });
            return {
              finalScriptWitness: witnessStackToScriptWitness(
                rushedBranch.witness
              )
            };
          });
        } else {
          throw new Error(
            "This wallet's pubkey cannot spend this input witnessScript."
          );
        }
      }
    }
  }

  const tx = psbt.extractTransaction(true).toHex();
  return tx;
}

export async function createMultiFeeTransactions({
  utxos,
  address, //do not set {address, value } because itx max value (it's multifee)
  getPublicKey,
  createSigners,
  feeRateSamplingParams = {},
  network = networks.bitcoin
}) {
  const txs = [];
  const feeRates = feeRateSampling(feeRateSamplingParams);
  const value = utxos.reduce(
    (acc, utxo) => acc + decodeTx(utxo.tx).vout[utxo.n].value,
    0
  );
  //We'll get the vzise of from an initial tx, assuming 0 fees: [0, ...feeRates]
  let vsize = 0;
  for (const feeRate of [0, ...feeRates]) {
    const fee = Math.ceil(vsize * feeRate);
    if (fee <= value) {
      const tx = await createTransaction({
        utxos,
        targets: [{ address, value: value - fee }],
        getPublicKey,
        createSigners,
        network
      });
      if (vsize === 0) {
        vsize = decodeTx(tx).vsize;
      } else {
        const realFeeRate = fee / vsize;
        txs.push({ tx, feeRate: realFeeRate, fee });
      }
    }
  }
  return txs;
}
