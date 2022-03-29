/*Super compplete example and the way to run tests:
https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/csv.spec.ts
*/
import { initHDInterface, LEDGER_NANO_INTERFACE } from './HDInterface';
import varuint from 'varuint-bitcoin';

import {
  Psbt,
  crypto,
  payments,
  networks,
  address,
  script,
  opcodes,
  Transaction
} from 'bitcoinjs-lib';
import bip68 from 'bip68';


const PSBT_VERSION = 2;

const LOCKTIME = bip68.encode({
  seconds: Math.round((1 * 7 * 24 * 60 * 60) / 512) * 512
}); //1 week - seconds must be a multiple of 512

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

/*
 *
 * Example here:
 * ~/tmp/lackfish.js
 *
 These guys do something like what I am tryint to achieve:
 https://github.com/LedgerHQ/ledgerjs/issues/521

 https://github.com/bitcoinjs/bitcoinjs-lib/issues/1771

How ledger can sign segwit Sign any segwit extending signP2SHTransaction
https://github.com/LedgerHQ/ledgerjs/pull/189

Ledger tests for signP2SHTransaction:
[Line 400] https://github.com/LedgerHQ/ledgerjs/blob/master/packages/hw-app-btc/tests/Btc.test.ts
https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/transactions.spec.ts

How to sign bitcoinjs + ledger
https://github.com/bitcoinjs/bitcoinjs-lib/issues/1517
This is the working code provided by ledgerjs:
https://github.com/LedgerHQ/ledgerjs/blob/master/packages/hw-app-btc/tests/Btc.test.ts

How to create a CSV with bitcoinjs
https://bitcoinjs-guide.bitcoin-studio.com/bitcoinjs-guide/v5/part-three-pay-to-script-hash/timelocks/csv_p2wsh.html

Example of code:
~/farvault/timelock/signtransaction/Bitcoin-Programming-with-BitcoinJS/code/csv_p2wsh.js

Bitcoin scripts, remember how they work:
https://blockgeeks.com/guides/best-bitcoin-script-guide/

Very simple p2sh and timelock:
https://github.com/bitcoinjs/bitcoinjs-lib/issues/1590

Very complicated script:
https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/csv.spec.ts


Ejempli de  OP_CHECKSEQUENCEVERIFY con taproot
https://github.com/bitcoinjs/bitcoinjs-lib/pull/1742

Hoy does blockstream use OP_CHECKSEQUENCEVERIFY in their wallets:
https://github.com/trezor/trezor-firmware/issues/706
(he puesto una pregunta abajo a ver si me dicen algo)

Explicación de por que no se usan pubkeyhashes:
https://bitcoin.stackexchange.com/questions/110091/why-does-the-locking-script-for-multsig-contain-pubkeys-instead-of-pubkeyhash

Si envío a una dirección segwit puedo saber el TX_ID incluso antes de firmar
https://bitcoin.stackexchange.com/questions/84931/use-utxos-before-transaction-is-signed-broadcasted
*/

/*
 *
 * Send from Segwit address:
 *
 * tb1q2ydn7tlyl4cyc4mcw5h0k0zdsa2crhvu5wfq82
 * balance: 154581
 * account: 0
 * testnet: true
 * segwit: true
 * change: true
 * index: 1
 * vpub
 * path: m/84'/1'/1/1
 *
 * Send change to:
 * tb1qql9hcxcq9gk4xtwamtavjxudt2whdhut4lqaex
 * account: 0
 * testnet: true
 * segwit: true
 * change: true
 * index: 3
 * vpub
 *
 * frozenAddress:
 * tb1qwkvsvxe8mah367l49xet943fdtksnvapvqh5ff
 * This belongs to FV3-TestN-NativeSegwit, index: 0, account: 2
 *
 * rescueAddress:
 * tb1qk4jww0c89pk20pr490gx6r0kx7lalldu4kda8a
 * This belongs to FV3-TestN-NativeSegwit, index: 1, account: 2
 *
 */

// Witness script
// We use pub keys and not pub key hash because the blockchain only stores the
// hash of the script anyway. P2SH or P2WSH
function createRelativeTimeLockScript(
  hotPublicKey,
  rescuedPublicKey,
  lockTime
) {
  return script.fromASM(
    //`
    //  OP_IF
    //      ${script.number.encode(lockTime).toString('hex')}
    //      OP_CHECKSEQUENCEVERIFY
    //      OP_DROP
    //  OP_ELSE
    //      ${rescueAddress.publicKey.toString('hex')}
    //      OP_CHECKSIGVERIFY
    //  OP_ENDIF
    //  ${frozenAddress.publicKey.toString('hex')}
    //  OP_CHECKSIG
    //`

    //I could use OP_CHECKSIG or OP_CHECKSIGVERIFY since there are no further conditions
    //after the if/else
    `
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
    `
      .trim()
      .replace(/\s+/g, ' ')
  );
}

function createDefrostPSBT({
  frozenUTXO,
  hotPublicKey,
  rescuedPublicKey,
  fee,
  network = networks.testnet
}) {
  const decodedFreezeTX = decoderawtransaction(frozenUTXO.tx, network);
  const frozenValue = decodedFreezeTX.vout[frozenUTXO.n].value;
  const relativeTimeLockScript = createRelativeTimeLockScript(
    hotPublicKey,
    rescuedPublicKey,
    LOCKTIME
  );

  const p2wsh = payments.p2wsh({
    redeem: { output: relativeTimeLockScript, network },
    network
  });

  const psbt = new Psbt({ network });
  psbt
    .addInput({
      hash: decodedFreezeTX.txid,
      index: frozenUTXO.n,
      //nonWitnessUtxo does not mean that this is not a witness transaction
      //It will take the witness stuff from the whole transaction.
      nonWitnessUtxo: Transaction.fromHex(frozenUTXO.tx).toBuffer()
    })
    .addOutput({
      address: p2wsh.address,
      value: frozenValue - fee
    });
  psbt.setVersion(PSBT_VERSION);
  return psbt;
}

function createRescuePSBT({
  timeLockedUTXO,
  hotPublicKey,
  rescuedPublicKey,
  fee,
  network = networks.testnet
}) {
  console.log({ timeLockedUTXO, hotPublicKey, rescuedPublicKey, fee, network });
  const decodedDefrostTX = decoderawtransaction(timeLockedUTXO.tx, network);
  const timeLockedValue = decodedDefrostTX.vout[timeLockedUTXO.n].value;
  console.log({ timeLockedValue });

  const p2wpkh = payments.p2wpkh({
    pubkey: rescuedPublicKey,
    network
  });

  const relativeTimeLockScript = createRelativeTimeLockScript(
    hotPublicKey,
    rescuedPublicKey,
    LOCKTIME
  );

  //Seguir esto:
  //https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/csv.spec.ts
  //que es lo mismo q lackfish

  const psbt = new Psbt({ network });
  psbt
    .addInput({
      hash: decodedDefrostTX.txid,
      index: timeLockedUTXO.n,
      //nonWitnessUtxo does not mean that this is not a witness transaction
      //It will take the witness stuff from the whole transaction.
      //nonWitnessUtxo: Transaction.fromHex(timeLockedUTXO.tx).toBuffer(),
      witnessUtxo: {
        //script: relativeTimeLockScript,
        script: Buffer.from(
          //This is "00" for "OP_0" and "20" which is 32d = 20hex. 32 is the length of the sha256
          //This is the scriptPubKey https://bitcoin.stackexchange.com/a/95311
          '0020' + crypto.sha256(relativeTimeLockScript).toString('hex'),
          'hex'
        ),
        value: timeLockedValue
      },

      witnessScript: Buffer.from(relativeTimeLockScript)
    })
    .addOutput({
      address: p2wpkh.address,
      value: timeLockedValue - fee
    });
  psbt.setVersion(PSBT_VERSION);
  return psbt;
}

//https://github.com/bitcoinjs/bitcoinjs-lib/issues/1606
function decoderawtransaction(hex, network) {
  const tx = Transaction.fromHex(hex);
  return {
    txid: tx.getId(),
    hash: tx.getHash(true /*for witness*/).toString('hex'),
    size: tx.byteLength(),
    vsize: tx.virtualSize(),
    weight: tx.weight(),
    version: tx.version,
    locktime: tx.locktime,
    hasWitnesses: tx.hasWitnesses(),
    vin: tx.ins.map(input => ({
      txid: Buffer.from(input.hash).reverse().toString('hex'),
      vout: input.index,
      scriptSig: {
        asm: script.toASM(input.script),
        hex: input.script.toString('hex')
      },
      txinwitness: input.witness.map(b => b.toString('hex')),
      sequence: input.sequence
    })),
    vout: tx.outs.map((output, i) => ({
      value: output.value,
      n: i,
      scriptPubKey: {
        asm: script.toASM(output.script),
        hex: output.script.toString('hex')
      },
      address: address.fromOutputScript(output.script, network)
      //scriptType: classifyScript(output.script)
    }))
  };
}

export async function ledgerPayment(network = networks.testnet) {
  //Create a normal segwit frozenAddress. We will delete the fronzenKeys.
  //Prepare the PSBT freezePSBT that funds frozenAddress from the user wallet.
  //Don't broadcast it yet.
  //
  //Using the keys from frozenAddress prepare a PSBT:
  //    A PSBT called defrostPSBT that sends to a CSV script hash.
  //    This CSV SH can be redeemed using:
  //        I) hotAddress after 1 week: heatPSBT
  //        II) rescueAddress anytime: rescuePSBT
  //            share with 3rd partirds
  //
  //The user saves defrostPSBT, rescuePSBT
  //We broadcast frozenAddress. Once confirmed we delete frozenKeys

  //https://bitcoin.stackexchange.com/questions/87372/what-does-the-sequence-in-a-transaction-input-mean?noredirect=1&lq=1
  //
  //The spending transaction must use a nSequence >= CSV parameter
  //

  /*frozenAddress: "tb1q9wjm2s3dwk6jvalnw0v3aervtnj9rgv035pyar"
    account: 1
    addressBalance: 345000
    change: false
    index: 0
    pubType: "vpub"
    used: true
    */

  /*Take the addresses as input. Then, one by one:
  https://blockstream.info/testnet/api/address/tb1q9wjm2s3dwk6jvalnw0v3aervtnj9rgv035pyar/utxo
  This gives all the unspent utxo of the address. All these utxo may belong to different tx
  So you get all the txid 8015e24f1b8129e96f10948c15a8ee5270734aef17fe3b3540a97bc60c6a230f + the vout index.
  Then you call https://blockstream.info/testnet/api/tx/8015e24f1b8129e96f10948c15a8ee5270734aef17fe3b3540a97bc60c6a230f/hex
  One can use https://live.blockcypher.com/btc/decodetx/ to get all this:
  */

  //Minimum set of information needed to create a PSBT.
  //With this info no further network calls
  const RESCUED_DERIVATION_PATH = "m/84'/1'/0'/0/22";
  const utxos = [
    {
      tx:
        '02000000000101bb0a16b2a2347f9a8fd1c04c225bf1655b228e39cfbfb2dd192d53b4384f4ba600000000000000000002a8430500000000001600142ba5b5422d75b52677f373d91ee46c5ce451a18fd55b020000000000160014511b3f2fe4fd704c5778752efb3c4d875581dd9c0247304402200ac66bda44a4f30f2a3b4099d772be8f36a1f0876c0d0bb028366f8d4b66495502201368f0184bd82adf5f3648e47d6ec84716f787561efe55f1b88590b824fb54b901210371052ca3e40c4e2f062d7acfedb8453f48c3e783fdb48818c1d4051f2385e53700000000',
      n: 0,
      derivationPath: "84'/1'/1'/0/0"
    }
  ];
  const frozenUTXO = utxos[0];

  console.log({
    decoded: decoderawtransaction(utxos[0].tx, network)
  });
  // script: Buffer.from('0020' + bitcoin.crypto.sha256(p2ms.output).toString('hex'), 'hex'),
  const HDInterface = await initHDInterface(LEDGER_NANO_INTERFACE);
  //TODO-> Use this: https://blockstream.info/api/fee-estimates
  const feeRate = 10;

  const hotPublicKey = await HDInterface.getPublicKey(
    "m/84'/1'/0'/0/21",
    network
  );
  const rescuedPublicKey = await HDInterface.getPublicKey(
    RESCUED_DERIVATION_PATH,
    network
  );
  //This has been already broadcast
  if (1 === 0) {
    //const frozenPublicKey = await HDInterface.getPublicKey(
    //  frozenUTXO.derivationPath,
    //  network
    //);

    console.log({ hotPublicKey, rescuedPublicKey });

    //https://github.com/bitcoinjs/bitcoinjs-lib/issues/1566
    //This has to be computed offline setting fee = 0 and running it on the
    //testnet for example. Then get the generated tx and check the vsize
    //Then add 1 byte per signature
    //See below: console.log({ tx, vsize: decoderawtransaction(tx, network) });
    //const fee = 0;
    const DEFROST_PSBT_VSIZE = 122 + 1;
    const fee = DEFROST_PSBT_VSIZE * feeRate;
    console.log({ fee });
    const defrostPSBT = createDefrostPSBT({
      frozenUTXO,
      hotPublicKey,
      rescuedPublicKey,
      fee,
      network
    });

    console.log({
      txPreSign: defrostPSBT.__CACHE.__TX.toHex()
    });
    //txPreSign: 02000000010f236a0cc67ba940353bfe17ef4a737052eea8158c94106fe929811b4fe215800000000000ffffffff01a54305000000000022002092146ab06c0e1250bedced94c0ad91cc716300162a7f5adb12c8d838da8be15300000000
    //TODO: Change address + fee
    const tx = await HDInterface.Pay({
      psbt: defrostPSBT,
      psbtHasWitnesses: true,
      utxo: frozenUTXO,
      isSegwit: true,
      psbtVersion: PSBT_VERSION,
      network
    });
    console.log({ tx, vsize: decoderawtransaction(tx, network).vsize });
    //tx: 020000000001010f236a0cc67ba940353bfe17ef4a737052eea8158c94106fe929811b4fe215800000000000ffffffff01da3e05000000000022002092146ab06c0e1250bedced94c0ad91cc716300162a7f5adb12c8d838da8be15302483045022100aec6f888722e8cee35a3ca4383332f743e75f81bde56ce39b6e2289031c7d1e7022075e16c0a0febc28b739c657a80e23a4e42690c1baa8774e021df9329bab4d6d8012102dc068cda695d823a411b9c600c6bc1f2de2af71c8050e40ba5ebca9bf64540c000000000
    //https://blockstream.info/testnet/tx/ca02f7826caf4ed10fbbfa5a6c5cce1d967dcd589784369b0c9b317cd8d97fac

    const timeLockedUTXO = {
      tx,
      n: 0,
      derivationPath: RESCUED_DERIVATION_PATH
    };
  }

  const timeLockedUTXO = {
    tx:
      '020000000001010f236a0cc67ba940353bfe17ef4a737052eea8158c94106fe929811b4fe215800000000000ffffffff01da3e05000000000022002092146ab06c0e1250bedced94c0ad91cc716300162a7f5adb12c8d838da8be15302483045022100aec6f888722e8cee35a3ca4383332f743e75f81bde56ce39b6e2289031c7d1e7022075e16c0a0febc28b739c657a80e23a4e42690c1baa8774e021df9329bab4d6d8012102dc068cda695d823a411b9c600c6bc1f2de2af71c8050e40ba5ebca9bf64540c000000000',
    n: 0,
    derivationPath: RESCUED_DERIVATION_PATH
  };

  const rescuePSBT = createRescuePSBT({
    timeLockedUTXO,
    hotPublicKey,
    rescuedPublicKey,
    fee: 1000,
    network
  });

  const relativeTimeLockScript = createRelativeTimeLockScript(
    hotPublicKey,
    rescuedPublicKey,
    LOCKTIME
  );
  console.log(
    'Funds sent previously to :',
    payments.p2wsh({
      redeem: { output: relativeTimeLockScript, network },
      network
    }).address
  );
  console.log({
    relativeTimeLockScript: relativeTimeLockScript.toString('hex')
  });

  //const redeemScript = relativeTimeLockScript.toString('hex');

  //Probar mi escript:
  //https://siminchen.github.io/bitcoinIDE/build/editor.html
  //no va
  //En cambio los de ledger test si que van
  //https://github.com/LedgerHQ/ledgerjs/blob/master/packages/hw-app-btc/tests/Btc.test.ts
  //52210289b4a3ad52a919abd2bdd6920d8a6879b1e788c38aa76f0440a6f32a9f1996d02103a3393b1439d1693b063482c04bd40142db97bdf139eedd1b51ffb7070a37eac321030b9a409a1e476b0d5d17b804fcdb81cf30f9b99c6f3ae1178206e08bc500639853ae

  /* Esto es equivalente:
     * const redeemScript = payments
    .p2wsh({
      network: network,
      redeem: {
        output: relativeTimeLockScript
      }
    })
    .redeem.output.toString('hex');*/
  //console.log({ redeemScript, unlockingTxA: rescuePSBT.__CACHE.__TX.toHex(), unlockingTxB: tx.toHex() });

  const tx = new Transaction();
  tx.version = PSBT_VERSION;
  tx.addInput(
    Buffer.from(
      decoderawtransaction(timeLockedUTXO.tx, network).txid,
      'hex'
    ).reverse(),
    timeLockedUTXO.n
  );
  tx.addOutput(
    address.toOutputScript(
      payments.p2wpkh({
        pubkey: rescuedPublicKey,
        network
      }).address,
      network
    ),
    342770
  );
  //txA based on this->https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/csv.spec.ts
  //Es lo mismo!
  //Lo de verified iunputs le pasa a esta tambien:
  //https://github.com/LedgerHQ/ledgerjs/issues/521
  //
  //El fallo es por esto:
  //https://blog.trezor.io/details-of-firmware-updates-for-trezor-one-version-1-9-1-and-trezor-model-t-version-2-3-1-1eba8f60f2dd
  console.log({ txA: tx.toHex(), txB: rescuePSBT.__CACHE.__TX.toHex() });

  //Este lo hace facil y sencillo:
  //https://github.com/LedgerHQ/ledgerjs/issues/249

  const redeemScript = payments
    .p2wsh({
      network: network,
      redeem: {
        output: relativeTimeLockScript
      }
    })
    .redeem.output.toString('hex');
  console.log({redeemScript, redeemScriptB: '0020' + crypto.sha256(relativeTimeLockScript).toString('hex'), redeemScriptC: crypto.sha256(relativeTimeLockScript).toString('hex')});
  const signature = await HDInterface.signP2SHTransaction({
    utxo: timeLockedUTXO,
    //redeemScript: relativeTimeLockScript.toString('hex'),
    //redeemScript: '0020' + crypto.sha256(relativeTimeLockScript).toString('hex'),
    //redeemScript: crypto.sha256(relativeTimeLockScript).toString('hex'),
    //Here you must input the hex of the witnessScript
    redeemScript,
    transactionVersion: PSBT_VERSION,
    unlockingTx: rescuePSBT.__CACHE.__TX.toHex(),
    //unlockingTx: "02000000000101ac7fd9d87c319b0c9b36849758cd7d961dce5c6c5afabb0fd14eaf6c82f702ca0000000000ffffffff01f23a05000000000016001460249d753e999575b495caee1724ec1194e28b8103483045022100ecff686363d920e4399fdb4f72c138c8d5ba08f4d1d3cabcecf79f1b867d26b90220411703496e0409af532c2ec7d087ccccaaebdffe0b0773805df265062cd626c501004f63039d0440b275210201e2f6560da66a2e9156e659b31604feb37ed5d56a0031d6da58551cb5e88168ac672103a07da2636797b2c27e5b1f0ff8b5f8fc7cfdfa62e3e70f86dc1791b71678312bac6800000000",
    //unlockingTx: tx.toHex(),
    network
  });

  console.log({ signature });
  console.log({
    redeem: script.compile([signature, opcodes.OP_FALSE]).toString('hex')
  });

  const getFinalScripts = (inputIndex, input, scriptParam) => {
    // Step 1: Check to make sure the meaningful locking script matches what you expect.
    const decompiled = script.decompile(scriptParam);
    if (!decompiled || decompiled[0] !== opcodes.OP_IF) {
      throw new Error(`Can not finalize input #${inputIndex}`);
    }
    console.log('getFinalScripts', { inputIndex, input, scriptParam });
    const payment = payments.p2wsh({
      network: network,
      redeem: {
        network: network,
        output: scriptParam,
        input: script.compile([signature, opcodes.OP_FALSE])
      }
    });

    console.log({witness: payment.witness});

    //POR ALGUN MOTIVO LOS WITNESS QUE ME PRODUCE LA TX NO INCLUYEN EL OP_FALSE


    return {
      finalScriptSig: payment.input,
      finalScriptWitness: witnessStackToScriptWitness(payment.witness)
    };
  };
  //"0200000001ac7fd9d87c319b0c9b36849758cd7d961dce5c6c5afabb0fd14eaf6c82f702ca0000000000ffffffff01f23a05000000000016001460249d753e999575b495caee1724ec1194e28b8100000000"
  rescuePSBT.finalizeInput(0, getFinalScripts);
  console.log('txC:' + rescuePSBT.extractTransaction().toHex());

  //  //
  //  //const scriptSigForP2WSH = script.compile([p2wsh.output]);
  //  const witnessStackForP2WSH = witnessStackToScriptWitness(p2wsh.witness);
  //  //02000000000101ac7fd9d87c319b0c9b36849758cd7d961dce5c6c5afabb0fd14eaf6c82f702ca0000000000ffffffff01f23a05000000000016001460249d753e999575b495caee1724ec1194e28b81019b03483045022100ecff686363d920e4399fdb4f72c138c8d5ba08f4d1d3cabcecf79f1b867d26b90220411703496e0409af532c2ec7d087ccccaaebdffe0b0773805df265062cd626c501004f63039d0440b275210201e2f6560da66a2e9156e659b31604feb37ed5d56a0031d6da58551cb5e88168ac672103a07da2636797b2c27e5b1f0ff8b5f8fc7cfdfa62e3e70f86dc1791b71678312bac6800000000
  //  //const witnessStackForP2WSH = [script.compile([signature, opcodes.OP_FALSE]), p2wsh.output];
  //  //02000000000101ac7fd9d87c319b0c9b36849758cd7d961dce5c6c5afabb0fd14eaf6c82f702ca0000000000ffffffff01f23a05000000000016001460249d753e999575b495caee1724ec1194e28b81024a483045022100ecff686363d920e4399fdb4f72c138c8d5ba08f4d1d3cabcecf79f1b867d26b90220411703496e0409af532c2ec7d087ccccaaebdffe0b0773805df265062cd626c5010022002092146ab06c0e1250bedced94c0ad91cc716300162a7f5adb12c8d838da8be15300000000
  //
  //  console.log({
  //    p2wsh,
  //    relativeTimeLockScript,
  //    //scriptSigForP2WSH,
  //    witnessStackForP2WSH
  //  });
  //
  //  //tx.setInputScript(0, scriptSigForP2WSH);
  //  tx.setWitness(0, [witnessStackForP2WSH]);
  //  console.log('Broadcast:', tx.toHex());
  //
  //  //Test here the scripts:
  //  //https://ide.scriptwiz.app/
  //  //this one is interesting! In order to checksig it asks for a tx template!
  //  //
  //  //483045022100a3310a93a3d960d96e63cfdaf9943f4790034c908abdd9d9c5ccc323608f22be02201ef87bc7a446fb5f9fdb96d554b956ef25f4e3f7b39bc98654048ef2f08b67bf015163039d0440b275210201e2f6560da66a2e9156e659b31604feb37ed5d56a0031d6da58551cb5e88168ac672103a07da2636797b2c27e5b1f0ff8b5f8fc7cfdfa62e3e70f86dc1791b71678312bac68
  //  //https://ide.bitauth.com/
  //  //->Gives an error:
  //  //Program called an OP_CHECKSEQUENCEVERIFY operation with an incompatible sequence type flag. The input sequence number and required sequence number must both use the same sequence locktime type.
  //  //OP_PUSHBYTES_72 0x3045022100a3310a93a3d960d96e63cfdaf9943f4790034c908abdd9d9c5ccc323608f22be02201ef87bc7a446fb5f9fdb96d554b956ef25f4e3f7b39bc98654048ef2f08b67bf01 OP_0 OP_IF OP_PUSHBYTES_3 0x9d0440 OP_CHECKSEQUENCEVERIFY OP_DROP OP_PUSHBYTES_33 0x0201e2f6560da66a2e9156e659b31604feb37ed5d56a0031d6da58551cb5e88168 OP_CHECKSIG OP_ELSE OP_PUSHBYTES_33 0x03a07da2636797b2c27e5b1f0ff8b5f8fc7cfdfa62e3e70f86dc1791b71678312b OP_CHECKSIG OP_ENDIF
  //
  //  //https://siminchen.github.io/bitcoinIDE/build/editor.html
}
