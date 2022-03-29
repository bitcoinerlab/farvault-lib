/*Super compplete example and the way to run tests:
https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/csv.spec.ts
*/
//TODO: find the new unlock txs
//TODO: create a random receiving address
//TODO: find the vbytes of each transaction
//TODO: buy a Trezor
//TODO:
//Plan: farvault.com will generate 2 html files with all the information embedded
//that will let you a) emergency-rescue b) hot
//The file in addition will let you download the tx in raw, also extract json
//This is the most important aspect of farvault.com! No complex recovery
//Also, farvault.com will use testmempoolaccept to make sure everything is fine

import {
  initHDInterface,
  LEDGER_NANO_INTERFACE,
  SOFT_HD_INTERFACE
} from './HDInterface';
import varuint from 'varuint-bitcoin';

import { coinSelect } from './coinselect';
import {
  Psbt,
  payments,
  networks,
  script,
  opcodes,
  Transaction
} from 'bitcoinjs-lib';
import { decodeTx } from './decodeTx';

import ECPairFactory from 'ecpair';
let fromPublicKey;
import('tiny-secp256k1').then(ecc => {
  fromPublicKey = ECPairFactory(ecc).fromPublicKey;
});

import { networkCoinType, parseDerivationPath } from './bip32';

import { NESTED_SEGWIT, NATIVE_SEGWIT, LEGACY } from './walletConstants';

import * as bip39 from 'bip39';
import bip68 from 'bip68';

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

import { utxos, unusedDerivationPaths } from './utxos';

const PSBT_VERSION = 2;

const ONE_MINUTE = 60;
const ONE_HOUR = ONE_MINUTE * 60;
const ONE_DAY = ONE_HOUR * 24;
const ONE_WEEK = ONE_DAY * 7;

const LOCKTIME = bip68.encode({
  seconds: Math.round((4 * ONE_HOUR) / 512) * 512
}); //seconds must be a multiple of 512

function createRelativeTimeLockScript(
  hotPublicKey,
  rescuedPublicKey,
  lockTime
) {
  return script.fromASM(
    /* Simpler to understand but slightly more expensive
     * `
      OP_IF
          ${script.number.encode(lockTime).toString('hex')}
          OP_CHECKSEQUENCEVERIFY
          OP_DROP
          ${hotPublicKey.toString('hex')}
          OP_CHECKSIG
      OP_ELSE
          ${rescuedPublicKey.toString('hex')}
          OP_CHECKSIG
      OP_ENDIF
    `*/
    `
      ${hotPublicKey.toString('hex')}
      OP_CHECKSIG
      OP_NOTIF
          ${rescuedPublicKey.toString('hex')}
          OP_CHECKSIG 
      OP_ELSE
          ${script.number.encode(lockTime).toString('hex')}
          OP_CHECKSEQUENCEVERIFY
      OP_ENDIF
    `
      .trim()
      .replace(/\s+/g, ' ')
  );
}
//Redeem: Either <sequence><sig_hot> or <sig_rescueeck op_dup

function createTimeLockPSBT({
  frozenUTXO,
  relativeTimeLockScript,
  fee,
  network = networks.testnet
}) {
  const decodedFreezeTx = decodeTx(frozenUTXO.tx, network);
  const frozenValue = decodedFreezeTx.vout[frozenUTXO.n].value;

  const p2wsh = payments.p2wsh({
    redeem: { output: relativeTimeLockScript, network },
    network
  });

  const psbt = new Psbt({ network });
  psbt
    .addInput({
      hash: decodedFreezeTx.txid,
      index: frozenUTXO.n,
      //nonWitnessUtxo does not mean that this is not a witness transaction
      //It means it takes witness information from the transaction.
      nonWitnessUtxo: Transaction.fromHex(frozenUTXO.tx).toBuffer()
    })
    .addOutput({
      address: p2wsh.address,
      value: frozenValue - fee
    });
  psbt.setVersion(PSBT_VERSION);
  return psbt;
}

function createRedeemFromTimeLockedPSBT({
  timeLockedUTXO,
  redeemerPublicKey,
  sequence = undefined,
  relativeTimeLockScript,
  fee,
  network = networks.testnet
}) {
  const decodedTimeLockTx = decodeTx(timeLockedUTXO.tx, network);
  const timeLockedValue = decodedTimeLockTx.vout[timeLockedUTXO.n].value;

  const p2wpkh = payments.p2wpkh({
    pubkey: redeemerPublicKey,
    network
  });

  const psbt = new Psbt({ network });
  psbt
    .addInput({
      hash: decodedTimeLockTx.txid,
      index: timeLockedUTXO.n,
      //nonWitnessUtxo does not mean that this is not a witness transaction
      nonWitnessUtxo: Transaction.fromHex(timeLockedUTXO.tx).toBuffer(),
      witnessScript: Buffer.from(relativeTimeLockScript),
      ...(sequence ? { sequence } : {})
    })
    .addOutput({
      address: p2wpkh.address,
      value: timeLockedValue - fee
    });
  psbt.setVersion(PSBT_VERSION);
  return psbt;
}
function createRescuePSBT(args) {
  const { rescuedPublicKey, ...newArgs } = { ...args };
  return createRedeemFromTimeLockedPSBT({
    ...newArgs,
    redeemerPublicKey: rescuedPublicKey
  });
}
function createHeatPSBT(args) {
  const { hotPublicKey, ...newArgs } = { ...args };
  return createRedeemFromTimeLockedPSBT({
    ...newArgs,
    redeemerPublicKey: hotPublicKey
  });
}

async function createFreezePSBT({
  fundsUTXOs,
  frozenPublicKey,
  fee,
  network = networks.testnet,
  HDInterface
}) {
  const psbt = new Psbt({ network });
  let frozenValue = 0;
  for (const utxo of fundsUTXOs) {
    const decodedFundTx = decodeTx(utxo.tx);
    frozenValue += decodedFundTx.vout[utxo.n].value;

    const purpose = parseDerivationPath(utxo.derivationPath).purpose;
    let redeemScript = undefined;
    if (purpose === NESTED_SEGWIT) {
      const pubkey = await HDInterface.getPublicKey(
        utxo.derivationPath,
        network
      );
      const p2wpkh = payments.p2wpkh({ pubkey, network });
      redeemScript = payments.p2sh({ redeem: p2wpkh, network }).redeem.output;
    } else if (purpose !== NATIVE_SEGWIT && purpose !== LEGACY) {
      throw new Error('Can only freeze P2WPKH, P2SH-P2WPK and P2PKH addresses');
    }
    psbt.addInput({
      hash: decodedFundTx.txid,
      index: utxo.n,
      nonWitnessUtxo: Transaction.fromHex(utxo.tx).toBuffer(),
      ...(redeemScript ? { redeemScript } : {})
    });
  }
  const p2wpkh = payments.p2wpkh({
    pubkey: frozenPublicKey,
    network
  });
  psbt.addOutput({
    address: p2wpkh.address,
    value: frozenValue - fee
  });
  psbt.setVersion(PSBT_VERSION);
  return psbt;
}

const validator = (pubkey, msghash, signature) =>
  fromPublicKey(pubkey).verify(msghash, signature);

export async function ledgerPayment(network = networks.testnet) {
  const useLedger = true;

  const mnemonics =
    'find subject time jump river dignity resist water arrange runway purpose question exchange random concert guitar rifle sun slim add pet loud depend view';

  //independentFrozenAddress = false to use a fixed path from the HDInterface
  //(it should be accompained with a random path - not yet implemented; not it's
  //a hardocded path - not good). independentFrozenAddress = false with a random
  //path may make sense to not depend on makeRandom.
  //independentFrozenAddress = true to use a totally random path not depandant
  //on the HDInterface. We create a totally independent frozenHDInterface
  const independentFrozenAddress = true;

  const fundsUTXOs = [
    utxos[0] /*p2pkh*/,
    utxos[1] /*p2pkh*/,
    utxos[2] /*nested segwit*/,
    utxos[3] /*nested segwit*/,
    utxos[5] /*native segwit*/
  ];

  //const fundsUTXOs = [utxos[4] /*nested segwit*/, utxos[6] /*native segwit*/];
  //const fundsUTXOs = [utxos[4] /*nested segwit*/];
  //const fundsUTXOs = [ utxos[5], utxos[6], utxos[7] /*native segwit*/];
  //const fundsUTXOs = [utxos[4]];
  //const fundsUTXOs = [utxos[0] /*p2pkh*/];

  //const fundsUTXOs = [utxos[6] /*native segwit*/];

  console.log(
    coinSelect({
      utxos: fundsUTXOs,
      target: unusedDerivationPaths[0],
      feeRate: 10,
      network
    })
  );

  let frozenDerivationPath;
  let frozenHDInterface;

  const HDInterface = useLedger
    ? await initHDInterface(LEDGER_NANO_INTERFACE)
    : await initHDInterface(SOFT_HD_INTERFACE, { mnemonics });

  //Random - not tied to the HDInterface of the rest of keys
  if (independentFrozenAddress) {
    const frozenMnemonic = bip39.generateMnemonic(256);
    console.log({ frozenMnemonic });
    frozenHDInterface = await initHDInterface(SOFT_HD_INTERFACE, {
      mnemonics
    });
    frozenDerivationPath = `${NATIVE_SEGWIT}'/${networkCoinType(
      network
    )}'/0'/0/0`;
  } else {
    frozenDerivationPath = unusedDerivationPaths[0]; //Native Segwit
    frozenHDInterface = HDInterface;
  }
  //Must be native Segwit
  if (parseDerivationPath(frozenDerivationPath).purpose !== NATIVE_SEGWIT) {
    throw new Error(
      'The frozen address must be Native Segwit to avoid malleability attacks'
    );
  }
  const hotDerivationPath = unusedDerivationPaths[1]; //Native Segwit
  const rescuedDerivationPath = unusedDerivationPaths[2]; //Native Segwit

  const frozenPublicKey = await frozenHDInterface.getPublicKey(
    frozenDerivationPath,
    network
  );
  const hotPublicKey = await HDInterface.getPublicKey(
    hotDerivationPath,
    network
  );
  const rescuedPublicKey = await HDInterface.getPublicKey(
    rescuedDerivationPath,
    network
  );
  const relativeTimeLockScript = createRelativeTimeLockScript(
    hotPublicKey,
    rescuedPublicKey,
    LOCKTIME
  );

  //FIXME: This is a flexible tx. We don't know the inputs. Therefore, we
  //cannot pre-compute the vsize.
  const freezePSBT = await createFreezePSBT({
    fundsUTXOs,
    frozenPublicKey,
    fee: 1000,
    network,
    HDInterface
  });
  //console.log('TRACE - presigning', {
  //  tx: freezePSBT.__CACHE.__TX.toHex(),
  //  vsize: freezePSBT.__CACHE.__TX.virtualSize(),
  //  weight: freezePSBT.__CACHE.__TX.weight() //length * 108 + 2 (if seg)
  //});
  const frozenSigners = await HDInterface.createSigners({
    psbt: freezePSBT,
    utxos: fundsUTXOs,
    network
  });
  for (let index = 0; index < fundsUTXOs.length; index++) {
    freezePSBT.signInput(index, {
      network,
      publicKey: await HDInterface.getPublicKey(
        fundsUTXOs[index].derivationPath,
        network
      ),
      sign: frozenSigners[index]
    });
  }
  freezePSBT.validateSignaturesOfAllInputs(validator);
  freezePSBT.finalizeAllInputs();
  //console.log('TRACE - postsigning', {
  //  tx: freezePSBT.__CACHE.__TX.toHex(),
  //  vsize: freezePSBT.extractTransaction().virtualSize(),
  //  weight: freezePSBT.extractTransaction().weight()
  //});

  const freezeTx = freezePSBT.extractTransaction().toHex();
  console.log({ freezeTx });

  const frozenUTXO = {
    tx: freezeTx,
    derivationPath: frozenDerivationPath,
    n: 0
  };
  const timeLockTxs = [];

  console.log({
    hotPublicKey: hotPublicKey.toString('hex'),
    rescuedPublicKey: rescuedPublicKey.toString('hex'),
    relativeTimeLockScript: relativeTimeLockScript.toString('hex')
  });

  for (let txC = 0; txC < 100; txC++) {
    const timeLockPSBT = await createTimeLockPSBT({
      frozenUTXO,
      relativeTimeLockScript,
      fee: txC * 10,
      network
    });
    const timeLockedSigners = await frozenHDInterface.createSigners({
      psbt: timeLockPSBT,
      utxos: [frozenUTXO],
      network
    });
    timeLockPSBT.signInput(0, {
      network,
      publicKey: await frozenHDInterface.getPublicKey(
        frozenUTXO.derivationPath,
        network
      ),
      sign: timeLockedSigners[0]
    });
    timeLockPSBT.validateSignaturesOfAllInputs(validator);
    timeLockPSBT.finalizeAllInputs();

    const timeLockTx = timeLockPSBT.extractTransaction().toHex();
    console.log({ fee: txC * 10, timeLockTx });
    timeLockTxs.push(timeLockTx);
  }

  const timeLockedUTXO = {
    //tx: timeLockTx,
    tx: timeLockTxs[0],
    n: 0
  };

  const rescuePSBT = await createRescuePSBT({
    timeLockedUTXO,
    rescuedPublicKey,
    relativeTimeLockScript,
    fee: 1000,
    network
  });
  const rescuedSigners = await HDInterface.createSigners({
    psbt: rescuePSBT,
    utxos: [
      {
        ...timeLockedUTXO,
        witnessScript: relativeTimeLockScript.toString('hex'),
        derivationPath: rescuedDerivationPath
      }
    ],
    network
  });
  rescuePSBT.signInput(0, {
    network,
    publicKey: await HDInterface.getPublicKey(rescuedDerivationPath, network),
    sign: rescuedSigners[0]
  });
  rescuePSBT.validateSignaturesOfAllInputs(validator);
  rescuePSBT.finalizeInput(0, (inputIndex, input, scriptParam) => {
    const rescueBranch = payments.p2wsh({
      redeem: {
        //Force the 1st OP_CHECKSIG to fail. OP_0 === OP_FALSE
        input: script.compile([input.partialSig[0].signature, opcodes.OP_0]),
        output: relativeTimeLockScript
      }
    });
    return {
      finalScriptWitness: witnessStackToScriptWitness(rescueBranch.witness)
    };
  });
  const rescueTx = rescuePSBT.extractTransaction().toHex();
  console.log({ rescueTx });

  const heatPSBT = await createHeatPSBT({
    timeLockedUTXO,
    hotPublicKey,
    relativeTimeLockScript,
    fee: 1000,
    sequence: LOCKTIME,
    network
  });
  const hotSigners = await HDInterface.createSigners({
    psbt: heatPSBT,
    utxos: [
      {
        ...timeLockedUTXO,
        witnessScript: relativeTimeLockScript.toString('hex'),
        sequence: LOCKTIME,
        derivationPath: hotDerivationPath
      }
    ],
    network
  });
  heatPSBT.signInput(0, {
    network,
    publicKey: await HDInterface.getPublicKey(hotDerivationPath, network),
    sign: hotSigners[0]
  });
  heatPSBT.validateSignaturesOfAllInputs(validator);
  heatPSBT.finalizeInput(0, (inputIndex, input, scriptParam) => {
    const heatBranch = payments.p2wsh({
      redeem: {
        //input: script.compile([input.partialSig[0].signature, opcodes.OP_TRUE]),
        input: script.compile([input.partialSig[0].signature]),
        output: relativeTimeLockScript
      }
    });
    return {
      finalScriptWitness: witnessStackToScriptWitness(heatBranch.witness)
    };
  });
  const heatTx = heatPSBT.extractTransaction().toHex();
  console.log({ heatTx });

  //TEST:
  //curl --user myusername --data-binary '{"jsonrpc": "1.0", "id": "curltest", "method": "testmempoolaccept", "params": [["signedhex"]]}' -H 'content-type: text/plain;' http://127.0.0.1:8332/
}
