import {
  startTestingEnvironment,
  stopTestingEnvironment,
  fundRegtest
} from './tools';

import assert from 'assert';

import { createTransaction } from '../src/transactions';
import { createRelativeTimeLockScript } from '../src/scripts';

import fs from 'fs';
import path from 'path';

const transactionsFixturesFile = path.resolve(
  __dirname,
  'fixtures',
  'transactions.js'
);

import prettier from 'prettier';

const VALID_TRANSACTION_FIXTURES = [];
const INVALID_TRANSACTION_FIXTURES = [];

//Send p2pkh -> address
//Send p2wpkh -> address
//Send p2sh-p2wpkh -> address
//Then combining them -> address
//
//Test P2WSH
//  -> Redeem with matured
//  -> Redeem with rushed
//Test P2SH using FarVault vaults
//  -> Redeem with matured
//  -> Redeem with rushed
//Test one tx that includes P2PKH, P2SH-P2WPKH, P2WPKH and an rushed input and outputs to a relativeTimeLockScript with change
//
//Then the same as above but multiFee
//
//
//Then think about tests using the ledger device.
//Make only one test but make it as complete as possible:
//It can be tested using:
//https://github.com/LedgerHQ/ledgerjs/tree/master/packages/hw-transport-node-hid-singleton
//Just test one tx that includes P2PKH, P2SH-P2WPKH, P2WPKH and an rushed input and outputs to a relativeTimeLockScript with change
//We could mock the response from the device after the first run.¿?
//

import { payments, networks } from 'bitcoinjs-lib';
import { LEGACY, NATIVE_SEGWIT, NESTED_SEGWIT } from '../src/walletConstants';
import { decodeTx } from '../src/decodeTx';

const network = networks.regtest;

//Randombly generated using https://iancoleman.io/bip39/:
//p2pkh:
const burnAddress = 'mzHbZVVTJePJ9NL7xak52cqbrJpHLbujJr';
//bech32
const burnAddress_B = 'bcrt1q8vpynm8adzaxjn6cmmld6qn33apfw65w0akw4w';

//This is the mnemonic you must set to the ledger nano too for the tests
//Do not send funds here!!!
const mnemonic =
  'find subject time jump river dignity resist water arrange runway purpose question exchange random concert guitar rifle sun slim add pet loud depend view';

//Get them from iancoleman:
const pubKey_84h_1h_5h_0_8 =
  '02783c942ac07f03a4c378ff6bd2cf8c99efc18bd1ae3cd37e6cd1ceca518bae2b';
const address_84h_1h_5h_0_8 = 'bcrt1qq3xgmhju3kkv05eqklw8aqja99g56ee60vszep';

const pubKey_84h_1h_5h_0_9 =
  '0265390b15172789e2476d6eaf895198e5561f0099c05a85ed991c10e5fcce8359';
const address_84h_1h_5h_0_9 = 'bcrt1q3ct33tdtsskw6djtzv26xftf83vfnnul8l5jj9';

const pubKey_84h_1h_5h_0_10 =
  '0228c94c739ce6972db99d47a2ac231656be8d33e3bae3f87b172419cf86bb8296';
const address_84h_1h_5h_0_10 = 'bcrt1qaypfjevgn62c27thxs8azpsyjy0eewf2ct3vjk';

const pubKey_84h_1h_5h_0_11 =
  '024aa3a34ee33754ffd2ef75ad9fa31afceefebb0c71ca4169ef1056aebcecbca1';
const address_84h_1h_5h_0_11 = 'bcrt1qtfnp3yly3q8wjaqmpvktct5xunkulcalyv9ekx';

const maturedPublicKey = Buffer.from(pubKey_84h_1h_5h_0_10, 'hex');
const maturedPath = "84'/1'/5'/0/10";

const rushedPublicKey = Buffer.from(pubKey_84h_1h_5h_0_11, 'hex');
const rushedPath = "84'/1'/5'/0/11";
const bip68LockTime = 10; //=== 0xa; //This is 10 blocks -> https://github.com/bitcoinjs/bip68/blob/master/test/fixtures.json

/*
Set the script below into
https://siminchen.github.io/bitcoinIDE/build/editor.html
Numbers are assumed to be hex.
Note that OP_NOP3: OP_CHECKSEQUENCEVERIFY.
Very important to use OP_10 instead of 10!!!
  0228c94c739ce6972db99d47a2ac231656be8d33e3bae3f87b172419cf86bb8296
      OP_CHECKSIG
      OP_NOTIF
  024aa3a34ee33754ffd2ef75ad9fa31afceefebb0c71ca4169ef1056aebcecbca1
          OP_CHECKSIG
      OP_ELSE
  OP_10
          OP_NOP3
      OP_ENDIF
  */
const relativeTimeLockScript =
  '210228c94c739ce6972db99d47a2ac231656be8d33e3bae3f87b172419cf86bb8296ac6421024aa3a34ee33754ffd2ef75ad9fa31afceefebb0c71ca4169ef1056aebcecbca1ac675ab268';

/*
 * Create a new script that uses zero seconds:
 * https://github.com/bitcoinjs/bip68/blob/9d68ca2d58301a9b76a2d457d845eb70d60c241d/test/fixtures.json#L213
 * bip68encoded = 0x400000 = 4194304 
 * this has to be converted to LE:
 * bip68encoded = 0x400000 -> LE -> 0x000040 
 *
  0228c94c739ce6972db99d47a2ac231656be8d33e3bae3f87b172419cf86bb8296
      OP_CHECKSIG
      OP_NOTIF
  024aa3a34ee33754ffd2ef75ad9fa31afceefebb0c71ca4169ef1056aebcecbca1
          OP_CHECKSIG
      OP_ELSE
          000040
          OP_NOP3
      OP_ENDIF
 * 
 * 210228c94c739ce6972db99d47a2ac231656be8d33e3bae3f87b172419cf86bb8296ac6421024aa3a34ee33754ffd2ef75ad9fa31afceefebb0c71ca4169ef1056aebcecbca1ac6703000040b268
 *
 */

const relativeTimeLockScript0Secs =
  '210228c94c739ce6972db99d47a2ac231656be8d33e3bae3f87b172419cf86bb8296ac6421024aa3a34ee33754ffd2ef75ad9fa31afceefebb0c71ca4169ef1056aebcecbca1ac6703000040b268';

const relativeTimeLockScript512Secs = //0x00400003 = 4194307 -> LE -> 0x030040
  '210228c94c739ce6972db99d47a2ac231656be8d33e3bae3f87b172419cf86bb8296ac6421024aa3a34ee33754ffd2ef75ad9fa31afceefebb0c71ca4169ef1056aebcecbca1ac6703030040b268';

const recoveryAddressP2SH = payments.p2sh({
  redeem: {
    output: Buffer.from(relativeTimeLockScript, 'hex')
  },
  network
}).address;
const recoveryTargetP2SH = [
  { address: recoveryAddressP2SH, valueRatioBeforeFee: 1 }
];

const recoveryAddressP2SH_P2WSH = payments.p2sh({
  redeem: payments.p2wsh({
    redeem: {
      output: Buffer.from(relativeTimeLockScript, 'hex')
    },
    network
  }),
  network
}).address;
const recoveryTargetP2SH_P2WSH = [
  { address: recoveryAddressP2SH_P2WSH, valueRatioBeforeFee: 1 }
];

const recoveryAddressP2SH0Secs = payments.p2sh({
  redeem: {
    output: Buffer.from(relativeTimeLockScript0Secs, 'hex')
  },
  network
}).address;
const recoveryTargetP2SH0Secs = [
  { address: recoveryAddressP2SH0Secs, valueRatioBeforeFee: 1 }
];

const recoveryAddressP2SH512Secs = payments.p2sh({
  redeem: {
    output: Buffer.from(relativeTimeLockScript512Secs, 'hex')
  },
  network
}).address;
const recoveryTargetP2SH512Secs = [
  { address: recoveryAddressP2SH512Secs, valueRatioBeforeFee: 1 }
];

const FEE = 1000;

const P2PKH = {
  purpose: LEGACY,
  accountNumber: 0,
  index: 0,
  isChange: false,
  //1 BTC
  value: 100000000
};

const P2SH_P2WPKH = {
  purpose: NESTED_SEGWIT,
  accountNumber: 0,
  index: 0,
  isChange: false,
  //1 BTC
  value: 100000000
};

const P2WPKH = {
  purpose: NATIVE_SEGWIT,
  accountNumber: 0,
  index: 0,
  isChange: false,
  //1 BTC
  value: 100000000
};

const oneTarget = [{ address: burnAddress, valueRatioBeforeFee: 1 }];
const twoTargets = [
  { address: burnAddress, valueRatioBeforeFee: 1 / 2 },
  { address: burnAddress_B, valueRatioBeforeFee: 1 / 2 }
];

/**
 * This needs to produce: targets, utxos and tx
 */

async function createFixture({
  description,
  utxos = [],
  fundingDescriptors = [],
  targetTemplates,
  prevBlocksToMine,
  fixtures
}) {
  console.log(description);
  const {
    HDInterface,
    paths,
    utxos: newUtxos,
    regtestUtils
  } = await fundRegtest({
    mnemonic,
    fundingDescriptors
  });
  utxos.push(...newUtxos);

  let inputValue = utxos.reduce(
    (sum, utxo) => sum + decodeTx(utxo.tx, network).vout[utxo.n].value,
    0
  );
  const targets = targetTemplates.map(t => ({
    address: t.address,
    value:
      Math.floor(t.valueRatioBeforeFee * inputValue) -
      Math.ceil(FEE / targetTemplates.length)
  }));

  const tx = await createTransaction({
    utxos,
    targets,
    createSigners: HDInterface.createSigners,
    getPublicKey: HDInterface.getPublicKey,
    network
  });
  await regtestUtils.mine(prevBlocksToMine);
  await regtestUtils.broadcast(tx);

  //Retrieve the tx:
  const fetchedTx = await regtestUtils.fetch(decodeTx(tx, network).txid);

  //Now confirm this is a valid fixture:
  //Confirm the tx outputs
  let outputValue = 0;
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    assert.deepStrictEqual(target, {
      address: fetchedTx.outs[i].address,
      value: fetchedTx.outs[i].value
    });
    outputValue += fetchedTx.outs[i].value;
    //Fixtures always have targets with same value
    if (i > 0) assert.deepStrictEqual(target.value, targets[i - 1].value);
  }

  //Confirm the tx inputs
  inputValue = 0;
  for (let i = 0; i < utxos.length; i++) {
    const utxo = utxos[i];
    assert.deepStrictEqual(
      {
        txid: decodeTx(utxo.tx, network).txid,
        n: utxo.n
      },
      {
        txid: fetchedTx.ins[i].txId,
        n: fetchedTx.ins[i].vout
      }
    );
    const prevTx = await regtestUtils.fetch(fetchedTx.ins[i].txId);
    inputValue += prevTx.outs[fetchedTx.ins[i].vout].value;
  }
  //It may be slightly different because of rounding
  assert.deepStrictEqual(FEE, inputValue - outputValue);

  if (Array.isArray(fixtures)) {
    fixtures.push({ description, utxos, tx, targets });
  }

  return tx;
}

async function main() {
  const { bitcoind, electrs, regtest_server } = await startTestingEnvironment({
    startElectrs: false
  });

  let tx;

  tx = await createFixture({
    description:
      'Spend from P2PKH, P2SH_P2WPKH and P2WPKH and send to 2 outputs',
    fundingDescriptors: [P2PKH, P2SH_P2WPKH, P2WPKH],
    targetTemplates: twoTargets,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  tx = await createFixture({
    description: 'Spend one P2PKH output',
    fundingDescriptors: [P2PKH],
    targetTemplates: oneTarget,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  tx = await createFixture({
    description: 'Spend two P2PKH outputs from the same address',
    fundingDescriptors: [P2PKH, P2PKH],
    targetTemplates: oneTarget,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  tx = await createFixture({
    description: 'Spend two P2PKH outputs from two different addresses',
    fundingDescriptors: [P2PKH, { ...P2PKH, index: 1 }],
    targetTemplates: oneTarget,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  tx = await createFixture({
    description: 'Spend one P2SH_P2WPKH output',
    fundingDescriptors: [P2SH_P2WPKH],
    targetTemplates: oneTarget,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  tx = await createFixture({
    description: 'Spend two P2SH_P2WPKH outputs from the same address',
    fundingDescriptors: [P2SH_P2WPKH, P2SH_P2WPKH],
    targetTemplates: oneTarget,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  tx = await createFixture({
    description: 'Spend two P2SH_P2WPKH outputs from two different addresses',
    fundingDescriptors: [P2SH_P2WPKH, { ...P2SH_P2WPKH, index: 1 }],
    targetTemplates: oneTarget,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  tx = await createFixture({
    description: 'Spend one P2WPKH output',
    fundingDescriptors: [P2WPKH],
    targetTemplates: oneTarget,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  tx = await createFixture({
    description: 'Spend two P2WPKH outputs from the same address',
    fundingDescriptors: [P2WPKH, P2WPKH],
    targetTemplates: oneTarget,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  tx = await createFixture({
    description: 'Spend two P2WPKH outputs from two different addresses',
    fundingDescriptors: [P2WPKH, { ...P2WPKH, index: 1 }],
    targetTemplates: oneTarget,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  //They go in pairs
  tx = await createFixture({
    description:
      'Send to FarVault timelocked address from Legacy to P2SH-P2WSH',
    fundingDescriptors: [P2PKH],
    targetTemplates: recoveryTargetP2SH_P2WSH,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  tx = await createFixture({
    description:
      'Unlock: Take the previous tested tx and spend a matured key P2SH-P2WSH.',
    utxos: [
      {
        witnessScript: relativeTimeLockScript,
        path: maturedPath,
        tx,
        n: 0
      }
    ],
    prevBlocksToMine: bip68LockTime,
    targetTemplates: oneTarget,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  //They go in pairs
  tx = await createFixture({
    description: 'Send to FarVault timelocked address from Legacy to P2SH',
    fundingDescriptors: [P2PKH],
    targetTemplates: recoveryTargetP2SH,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  tx = await createFixture({
    description:
      'Unlock: Take the previous tested tx and spend a matured key P2SH.',
    utxos: [
      {
        redeemScript: relativeTimeLockScript,
        path: maturedPath,
        tx,
        n: 0
      }
    ],
    prevBlocksToMine: bip68LockTime,
    targetTemplates: oneTarget,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  //They go in pairs
  tx = await createFixture({
    description: 'Send to FarVault timelocked address from Legacy to P2SH',
    fundingDescriptors: [P2PKH],
    targetTemplates: recoveryTargetP2SH,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  tx = await createFixture({
    description:
      'Unlock: Take the previous tested tx and spend a matured key P2SH. In addition also spend a P2WPKH',
    utxos: [
      {
        redeemScript: relativeTimeLockScript,
        path: maturedPath,
        tx,
        n: 0
      }
    ],
    fundingDescriptors: [P2WPKH],
    prevBlocksToMine: bip68LockTime,
    targetTemplates: oneTarget,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  //They go in pairs
  tx = await createFixture({
    description: 'Send to FarVault timelocked address from Legacy to P2SH',
    fundingDescriptors: [P2PKH],
    targetTemplates: recoveryTargetP2SH,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  tx = await createFixture({
    description:
      'Unlock: Take the previous tested tx and spend a rushed key P2SH. In addition also spend a P2SH_P2WPKH and a P2PKH. Then send the unlocked funds to twoTargets.',
    utxos: [
      {
        redeemScript: relativeTimeLockScript,
        path: rushedPath,
        tx,
        n: 0
      }
    ],
    fundingDescriptors: [P2SH_P2WPKH, P2PKH],
    prevBlocksToMine: 0,
    targetTemplates: twoTargets,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  //They go in pairs
  tx = await createFixture({
    description:
      'Send to FarVault timelocked address from Legacy to a P2SH script that locks 0 seconds',
    fundingDescriptors: [P2PKH],
    targetTemplates: recoveryTargetP2SH0Secs,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  tx = await createFixture({
    description:
      'Unlock using the matured branch, without mining after 0 seconds.',
    utxos: [
      {
        redeemScript: relativeTimeLockScript0Secs,
        path: maturedPath,
        tx,
        n: 0
      }
    ],
    fundingDescriptors: [P2PKH, P2PKH],
    prevBlocksToMine: 0,
    targetTemplates: twoTargets,
    fixtures: VALID_TRANSACTION_FIXTURES
  });

  //They go in pairs
  tx = await createFixture({
    description:
      'Send to FarVault timelocked address from Legacy to a P2SH script that locks 512 seconds',
    fundingDescriptors: [P2PKH],
    targetTemplates: recoveryTargetP2SH512Secs,
    fixtures: VALID_TRANSACTION_FIXTURES
  });
  //  tx = await createFixture({
  //    description:
  //      'Unlock using the matured branch, without mining after 512 seconds.',
  //    errorMessage: 'Error: non-BIP68-final',
  //    utxos: [
  //      {
  //        redeemScript: relativeTimeLockScript512Secs,
  //        path: maturedPath,
  //        tx,
  //        n: 0
  //      }
  //    ],
  //    fundingDescriptors: [P2PKH, P2PKH],
  //    prevBlocksToMine: 1, //Even with one block is not enough
  //    targetTemplates: twoTargets,
  //    fixtures: VALID_TRANSACTION_FIXTURES
  //  });

  //INVALID TESTS:
  //
  {
    const validFixtures = [];
    await createFixture({
      description: 'Spend one P2PKH output',
      fundingDescriptors: [P2PKH],
      targetTemplates: oneTarget,
      fixtures: validFixtures
    });
    //Remove the path
    const { path, ...utxo } = validFixtures[0].utxos[0];
    INVALID_TRANSACTION_FIXTURES.push({
      description: 'Try to spend more than available in the inputs',
      utxos: validFixtures[0].utxos,
      targets: [{ address: burnAddress, value: 200000000 }],
      exception: 'Outputs are spending more than Inputs'
    });
  }
  {
    const validFixtures = [];
    await createFixture({
      description: 'Spend one P2PKH output',
      fundingDescriptors: [P2PKH],
      targetTemplates: oneTarget,
      fixtures: validFixtures
    });
    //Remove the path
    const { path, ...utxo } = validFixtures[0].utxos[0];
    INVALID_TRANSACTION_FIXTURES.push({
      description: 'Utxo with missing path',
      utxos: [utxo],
      targets: { ...validFixtures[0].targets },
      exception: 'Invalid path type'
    });
  }
  {
    const validFixtures = [];
    const tx = await createFixture({
      description:
        'Send to FarVault timelocked address from Legacy to a P2SH script that locks 0 seconds',
      fundingDescriptors: [P2PKH],
      targetTemplates: recoveryTargetP2SH0Secs
    });
    await createFixture({
      description:
        'Unlock using the matured branch, without mining after 0 seconds.',
      utxos: [
        {
          redeemScript: relativeTimeLockScript0Secs,
          path: maturedPath,
          tx,
          n: 0
        }
      ],
      fundingDescriptors: [P2PKH, P2PKH],
      prevBlocksToMine: 0,
      targetTemplates: twoTargets,
      fixtures: validFixtures
    });
    //Remove the redeemScript from the utxo and add a witnessScript instead
    const { redeemScript, ...utxo } = {
      ...validFixtures[0].utxos[0],
      witnessScript: validFixtures[0].utxos[0].redeemScript
    };
    INVALID_TRANSACTION_FIXTURES.push({
      description:
        'Pass a witnessScript instead of a redeemScript for P2SH but it is not a P2SH-P2WSH',
      utxos: [utxo],
      targets: validFixtures[0].targets,
      exception:
        'Got a witnessScript but this is not a P2WSH neither a P2SH-P2WSH utxo'
    });
  }
  {
    const validFixtures = [];
    const tx = await createFixture({
      description: 'Send to P2PKH',
      fundingDescriptors: [P2PKH],
      targetTemplates: recoveryTargetP2SH0Secs,
      fixtures: validFixtures
    });
    const { HDInterface } = await fundRegtest({
      mnemonic,
      fundingDescriptors: []
    });
    const utxoPubKey = await HDInterface.getPublicKey(
      validFixtures[0].utxos[0].path,
      network
    );
    const utxo = {
      redeemScript: createRelativeTimeLockScript({
        maturedPublicKey: utxoPubKey,
        rushedPublicKey: Buffer.from(pubKey_84h_1h_5h_0_9, 'hex'),
        bip68LockTime
      }).toString('hex'),
      ...validFixtures[0].utxos[0]
    };
    INVALID_TRANSACTION_FIXTURES.push({
      description: 'Add a redeemScript to a P2PKH utxo',
      utxos: [utxo],
      targets: validFixtures[0].targets,
      exception: 'Got a redeemScript but this is not a P2SH utxo'
    });
  }
  {
    INVALID_TRANSACTION_FIXTURES.push({
      description: 'Pass both redeemScript and witnessScript',
      utxos: [
        {
          redeemScript: 'a',
          witnessScript: 'a',
          path: maturedPath,
          tx,
          n: 0
        }
      ],
      targets: [{ address: burnAddress, value: 0.0000001 }],
      exception: 'A PSBT cannot be P2SH and P2WSH at the same time.'
    });
  }
  {
    INVALID_TRANSACTION_FIXTURES.push({
      description: 'Try to unlock using a script using an unknown script',
      utxos: [
        {
          redeemScript: 'a',
          path: maturedPath,
          tx,
          n: 0
        }
      ],
      targets: [{ address: burnAddress, value: 0.0000001 }],
      exception: 'This wallet cannot spend this script: a'
    });
  }
  {
    INVALID_TRANSACTION_FIXTURES.push({
      description: 'Try to unlock using a script using an invalid path',
      utxos: [
        {
          redeemScript: createRelativeTimeLockScript({
            maturedPublicKey: Buffer.from(pubKey_84h_1h_5h_0_9, 'hex'),
            rushedPublicKey: Buffer.from(pubKey_84h_1h_5h_0_9, 'hex'),
            bip68LockTime
          }).toString('hex'),
          path: maturedPath,
          tx,
          n: 0
        }
      ],
      targets: [{ address: burnAddress, value: 0.0000001 }],
      exception:
        "This wallet's utxo pubkey cannot spend this relativeTimeLockScript."
    });
  }

  await stopTestingEnvironment({ bitcoind, electrs, regtest_server });

  const fixturesFileName = path.resolve(
    __dirname,
    'fixtures',
    'transactions.js'
  );

  const fixturesFileContents = `//This file has been automatically generated by ${path.relative(
    path.dirname(fixturesFileName),
    __filename
  )}.
//Please do not edit it. Add tests to the script above instead.

import { networks } from 'bitcoinjs-lib';
const network = networks.regtest;
export const fixtures = {
  network,
  mnemonic: '${mnemonic}',
  createTransaction: {
    valid: ${JSON.stringify(VALID_TRANSACTION_FIXTURES)},
    invalid: ${JSON.stringify(INVALID_TRANSACTION_FIXTURES)}
  }
};
`;
  fs.writeFileSync(
    fixturesFileName,
    prettier.format(fixturesFileContents, { parser: 'babel' })
  );
}

main();
