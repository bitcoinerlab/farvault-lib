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
import bip68 from 'bip68';
import varuint from 'varuint-bitcoin';

import ECPairFactory from 'ecpair';
let fromPublicKey;
import('tiny-secp256k1').then(ecc => {
  fromPublicKey = ECPairFactory(ecc).fromPublicKey;
});

import { feeRateSampling } from './fees';

const validator = (pubkey, msghash, signature) =>
  fromPublicKey(pubkey).verify(msghash, signature);

/**
 * Same utility function used in bitcoinjs-lib for finalizing inputs.
 * We must use it to finalize custom FarVault timeLockTransactions.
 *
 * Refer to {@link https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/psbt.js#L1187 bitcoinjs-lib's implementation}
 * for the details.
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

//
/**
 * Take an integer and encode it so that bitcoinjs-lib fromASM can compile it.
 * It will produce a Buffer for integers !== 0 and OP_0 for number = 0.
 *
 * Read more about it {@link https://github.com/bitcoinjs/bitcoinjs-lib/issues/1799#issuecomment-1121656429 here}.
 *
 * Use it like this:
 *
 * ```javascript
 * //To produce "0 1 OP_ADD":
 * fromASM(
 * `${numberEncodeAsm(0)} ${numberEncodeAsm(1)} OP_ADD`
 *   .trim().replace(/\s+/g, ' ')
 * )
 * ```
 *
 * @param {number} number An integer.
 * @returns {string|Buffer} Returns `"OP_0"` for `number === 0` and a `Buffer` for other numbers.
 */
function numberEncodeAsm(number) {
  if (Number.isSafeInteger(number) === false) {
    throw new Error('Invalid number');
  }
  if (number === 0) {
    return 'OP_0';
  } else return script.number.encode(number).toString('hex');
}
//https://github.com/bitcoinjs/bitcoinjs-lib/issues/1799#issuecomment-1121656429
function scriptNumberDecode(decompiled) {
  if (
    (typeof decompiled === 'number' && decompiled === 0) ||
    (Buffer.isBuffer(decompiled) &&
      Buffer.compare(decompiled, Buffer.from('00', 'hex')) === 0)
  ) {
    return 0;
  } else {
    if (
      typeof decompiled === 'number' &&
      decompiled >= 0x51 && // OP_1 (or OP_TRUE)
      decompiled <= 0x60 // OP_16
    ) {
      return script.number.decode(Buffer.from([decompiled - 0x50]));
    } else {
      if (!Buffer.isBuffer(decompiled))
        throw new Error('Invalid decompiled number');
      // this is a Buffer
      return script.number.decode(decompiled);
    }
  }
}

//I only did some basic tests. The test suite for this must be better!
export function createRelativeTimeLockScript({
  maturedPublicKey,
  rushedPublicKey,
  encodedLockTime
}) {
  if (encodedLockTime === 0) {
    throw new Error('FarVault does not allow sequence to be 0.');
    /*
     * If encodedLockTime is 0 while unlocking a matured pubkey, then
     * the UNLOCKING + LOCKING script is evaluated
     * resulting into a zero (where 0 === OP_FALSE) on the top of the stack.
     *
     * Note that OP_CHECKSEQUENCEVERIFY behaves as a NOP if the check is ok and
     * it does not consume encodedLockTime value.
     *
     * This is fine when encodedLockTime != 0 but if encodedLockTime is zero then
     * it produces the following error when the miner evaluates the script:
     *
     * non-mandatory-script-verify-flag (Script evaluated without error but finished with a false/empty top stack element
     *
     * This is how the ulocking is evaluated when unlocking with a matured key.
     * Note how a zero would be left at the top if ENCODED_LOCKTIME = 0 ->
     *
     * <MATURED_SIGNATURE> <- This is the unlocking script.
     * <MATURED_PUB> <- Here and below corresponds to the locking script.
     * OP_CHECKSIG
     * OP_NOTIF
     * <RUSHED_PUB>
     * OP_CHECKSIG
     * OP_ELSE
     * <ENCODED_LOCKTIME>
     * OP_CHECKSEQUENCEVERIFY
     * OP_ENDIF
     *
     * -> If we're in the matured branch:
     *
     * TRUE
     * OP_NOTIF
     * <RUSHED_PUB>
     * OP_CHECKSIG
     * OP_ELSE
     * <ENCODED_LOCKTIME>
     * OP_CHECKSEQUENCEVERIFY
     * OP_ENDIF
     *
     * ->
     *
     * TRUE
     * OP_ELSE
     * <ENCODED_LOCKTIME>
     * OP_CHECKSEQUENCEVERIFY
     * OP_ENDIF
     *
     * ->
     *
     * <ENCODED_LOCKTIME>
     * OP_CHECKSEQUENCEVERIFY
     *
     * -> OP_CHECKSEQUENCEVERIFY behaves as a NOP if the sequence is ok:
     *
     * <ENCODED_LOCKTIME>
     *
     * -> If ENCODED_LOCKTIME = 0:
     *
     * FALSE
     */
  }

  //Do some more validation before producing the lockins script:
  if (
    !Buffer.isBuffer(maturedPublicKey) ||
    Buffer.byteLength(maturedPublicKey) !== 33
  ) {
    throw new Error('Invalid maturedPublicKey');
  }
  if (
    !Buffer.isBuffer(rushedPublicKey) ||
    Buffer.byteLength(rushedPublicKey) !== 33
  ) {
    throw new Error('Invalid rushedPublicKey');
  }
  if (
    typeof encodedLockTime !== 'number' ||
    bip68.encode(bip68.decode(encodedLockTime)) !== encodedLockTime
  ) {
    throw new Error('Invalid encodedLockTime');
  }
  return script.fromASM(
    `
      ${maturedPublicKey.toString('hex')}
      OP_CHECKSIG
      OP_NOTIF
          ${rushedPublicKey.toString('hex')}
          OP_CHECKSIG 
      OP_ELSE
          ${numberEncodeAsm(encodedLockTime)}
          OP_CHECKSEQUENCEVERIFY
      OP_ENDIF
    `
      .trim()
      .replace(/\s+/g, ' ')
  );
}

function parseRelativeTimeLockScript(relativeTimeLockScript) {
  const decompiled = script.decompile(relativeTimeLockScript);
  if (
    decompiled.length === 9 &&
    Buffer.isBuffer(decompiled[0]) &&
    Buffer.byteLength(decompiled[0]) === 33 &&
    decompiled[1] === opcodes.OP_CHECKSIG &&
    decompiled[2] === opcodes.OP_NOTIF &&
    Buffer.isBuffer(decompiled[3]) &&
    Buffer.byteLength(decompiled[3]) === 33 &&
    decompiled[4] === opcodes.OP_CHECKSIG &&
    decompiled[5] === opcodes.OP_ELSE &&
    bip68.encode(bip68.decode(scriptNumberDecode(decompiled[6]))) ===
      scriptNumberDecode(decompiled[6]) &&
    decompiled[7] === opcodes.OP_CHECKSEQUENCEVERIFY &&
    decompiled[8] === opcodes.OP_ENDIF
  ) {
    return {
      maturedPublicKey: decompiled[0],
      rushedPublicKey: decompiled[3],
      encodedLockTime: scriptNumberDecode(decompiled[6])
    };
  }
  return false;
}

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
          encodedLockTime
        } = parsedScript;
        const pubkey = await getPublicKey(utxo.path, network);
        if (Buffer.compare(pubkey, maturedPublicKey) === 0) {
          witnessScript = Buffer.from(utxo.witnessScript);
          sequence = encodedLockTime;
          //console.log('WARNING: Test this', { sequence });
          //sequence = encodedLockTime;
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
