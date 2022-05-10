/** @module FVtransactions - Specific FarVault transactions.*/

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

export function createRelativeTimeLockScript({
  maturedPublicKey,
  rushedPublicKey,
  encodedLockTime
}) {
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
          ${script.number.encode(encodedLockTime).toString('hex')}
          OP_CHECKSEQUENCEVERIFY
      OP_ENDIF
    `
      .trim()
      .replace(/\s+/g, ' ')
  );
}

//https://github.com/bitcoinjs/bitcoinjs-lib/issues/1799#issuecomment-1121656429
function decompiledToScriptNumberBuffer(decompiled) {
  return typeof decompiled === 'number' &&
    decompiled >= 0x51 && // OP_1 (or OP_TRUE)
    decompiled <= 0x60 // OP_16
    ? Buffer.from([decompiled - 0x50])
    : decompiled; // this is a Buffer
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
    bip68.encode(
      bip68.decode(
        script.number.decode(decompiledToScriptNumberBuffer(decompiled[6]))
      )
    ) === script.number.decode(decompiledToScriptNumberBuffer(decompiled[6])) &&
    decompiled[7] === opcodes.OP_CHECKSEQUENCEVERIFY &&
    decompiled[8] === opcodes.OP_ENDIF
  ) {
    return {
      maturedPublicKey: decompiled[0],
      rushedPublicKey: decompiled[3],
      encodedLockTime: script.number.decode(
        decompiledToScriptNumberBuffer(decompiled[6])
      )
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
        const pubkey = await getPublicKey(utxo.derivationPath, network);
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
      const purpose = parseDerivationPath(utxo.derivationPath).purpose;
      if (purpose === NESTED_SEGWIT) {
        const pubkey = await getPublicKey(utxo.derivationPath, network);
        const p2wpkh = payments.p2wpkh({ pubkey, network });
        redeemScript = payments.p2sh({ redeem: p2wpkh, network }).redeem.output;
      } else if (purpose !== NATIVE_SEGWIT && purpose !== LEGACY) {
        throw new Error(
          'Can only freeze P2WPKH, P2SH-P2WPKH, P2PKH  and FarVault P2WSH addresses'
        );
      }
    }

    psbt.addInput({
      hash: txid,
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
      publicKey: await getPublicKey(utxos[index].derivationPath, network),
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
        const pubkey = await getPublicKey(utxo.derivationPath, network);
        if (Buffer.compare(pubkey, maturedPublicKey) === 0) {
          psbt.finalizeInput(i, (inputIndex, input, scriptParam) => {
            const maturedBranch = payments.p2wsh({
              redeem: {
                input: script.compile([input.partialSig[i].signature]),
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
                  input.partialSig[i].signature,
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
  samples,
  network = networks.bitcoin
}) {
  const txs = [];
  const fRO = typeof samples !== undefined ? { samples } : {};
  const feeRates = feeRateSampling(fRO);
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
