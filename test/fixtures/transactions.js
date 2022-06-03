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
import {
  LEGACY,
  NATIVE_SEGWIT,
  NESTED_SEGWIT
} from '../../src/walletConstants';
import { decodeTx } from '../../src/decodeTx';

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

const recoveryAddressP2SH = payments.p2sh({
  redeem: {
    output: Buffer.from(relativeTimeLockScript, 'hex')
  },
  network
}).address;
const recoveryTargetP2SH = [
  { address: recoveryAddressP2SH, valueRatioBeforeFee: 1 }
];

const fee = 1000;

const fundingDescriptors = [];

const P2PKH = {
  purpose: LEGACY,
  accountNumber: 0,
  index: 0,
  isChange: false,
  //1 BTC
  value: 100000000
};

const P2SHP2WPKH = {
  purpose: NESTED_SEGWIT,
  accountNumber: 0,
  index: 0,
  isChange: false,
  //1 BTC
  value: 100000000
};

const P2WPKH = {
  purpose: LEGACY,
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

/** Prepares fundingDescriptors which will be used later to send funds when
 * creating the testWallet.
 *
 * It also identifies the utxos & targets that must be used to test the tx.
 *
 * If we don't pass utxoDescriptors, assume that it must be the unique outout
 * of the last tx.
 */

function createValidFixture(
  {
    description,
    utxoDescriptors,
    witnessScript,
    redeemScript,
    path,
    targetTemplates
  },
  fundingDescriptors
) {
  //fundingDescriptors will be passed to fundRegtest so that mining funds
  //are sent to these descritors so that new utxos will be ready for our tests
  if (utxoDescriptors) {
    fundingDescriptors.push(...utxoDescriptors);
  }

  const utxosSelector = (walletUtxos, lastTx) => {
    const utxos = [];
    if (utxoDescriptors)
      utxos.push(
        ...utxoDescriptors
          .map(descriptor => fundingDescriptors.indexOf(descriptor))
          .map(index => walletUtxos[index])
      );
    if ((witnessScript || redeemScript) && decodeTx(lastTx).vout.length !== 1) {
      throw new Error(
        'When consuming previous tx, then we assume that it only had one output'
      );
    }
    if (witnessScript) utxos.push({ tx: lastTx, n: 0, path, witnessScript });
    if (redeemScript) utxos.push({ tx: lastTx, n: 0, path, redeemScript });
    return utxos;
  };
  const targetsSelector = utxos => {
    const inputValue = utxos.reduce(
      (sum, utxo) => sum + decodeTx(utxo.tx).vout[utxo.n].value,
      0
    );
    return targetTemplates.map(t => ({
      address: t.address,
      value:
        Math.floor(t.valueRatioBeforeFee * inputValue) -
        Math.ceil(fee / targetTemplates.length)
    }));
  };
  return {
    description,
    utxosSelector,
    targetsSelector
  };
}
export const fixtures = {
  network,
  mnemonic,
  fundingDescriptors,
  createTransaction: {
    valid: [
      createValidFixture(
        {
          description: 'Spend one P2PKH output',
          utxoDescriptors: [{ ...P2PKH }],
          targetTemplates: oneTarget
        },
        fundingDescriptors
      ),
      createValidFixture(
        {
          description: 'Spend two P2PKH outputs from the same address',
          utxoDescriptors: [{ ...P2PKH }, { ...P2PKH }],
          targetTemplates: oneTarget
        },
        fundingDescriptors
      ),
      createValidFixture(
        {
          description: 'Spend two P2PKH outputs from two different addresses',
          utxoDescriptors: [{ ...P2PKH }, { ...P2PKH, index: 1 }],
          targetTemplates: oneTarget
        },
        fundingDescriptors
      ),
      createValidFixture(
        {
          description: 'Spend one P2SHP2WPKH output',
          utxoDescriptors: [{ ...P2SHP2WPKH }],
          targetTemplates: oneTarget
        },
        fundingDescriptors
      ),
      createValidFixture(
        {
          description: 'Spend two P2SHP2WPKH outputs from the same address',
          utxoDescriptors: [{ ...P2SHP2WPKH }, { ...P2SHP2WPKH }],
          targetTemplates: oneTarget
        },
        fundingDescriptors
      ),
      createValidFixture(
        {
          description:
            'Spend two P2SHP2WPKH outputs from two different addresses',
          utxoDescriptors: [{ ...P2SHP2WPKH }, { ...P2SHP2WPKH, index: 1 }],
          targetTemplates: oneTarget
        },
        fundingDescriptors
      ),
      createValidFixture(
        {
          description: 'Spend one P2WPKH output',
          utxoDescriptors: [{ ...P2WPKH }],
          targetTemplates: oneTarget
        },
        fundingDescriptors
      ),
      createValidFixture(
        {
          description: 'Spend two P2WPKH outputs from the same address',
          utxoDescriptors: [{ ...P2WPKH }, { ...P2WPKH }],
          targetTemplates: oneTarget
        },
        fundingDescriptors
      ),
      createValidFixture(
        {
          description: 'Spend two P2WPKH outputs from two different addresses',
          utxoDescriptors: [{ ...P2WPKH }, { ...P2WPKH, index: 1 }],
          targetTemplates: oneTarget
        },
        fundingDescriptors
      ),
      createValidFixture(
        {
          description:
            'Spend from P2PKH, P2SHP2WPKH and P2PKH and send to 2 outputs',
          utxoDescriptors: [{ ...P2PKH }, { ...P2SHP2WPKH }, { ...P2WPKH }],
          targetTemplates: twoTargets
        },
        fundingDescriptors
      ),
      createValidFixture(
        {
          description:
            'Send to FarVault timelocked address from Legacy to P2SH',
          utxoDescriptors: [{ ...P2PKH }],
          targetTemplates: recoveryTargetP2SH
        },
        fundingDescriptors
      ),
      //createValidFixture will return a utxosSelector function that takes walletUtxos and regtestUtils as input
      createValidFixture(
        {
          description:
            'Unlock: Take the previous tested tx and spend a matured key P2SH.',
          //If we pass a relativeTimeLockScript, we are consuming an additional
          //utxo that we assume that it corresponds to the unique outout of the
          //last tx (created in the previous createValidFixture)
          redeemScript: relativeTimeLockScript,
          path: maturedPath,
          targetTemplates: oneTarget
        },
        fundingDescriptors
      ),
      createValidFixture(
        {
          description:
            'Send to FarVault timelocked address from Legacy to P2SH',
          utxoDescriptors: [{ ...P2PKH }],
          targetTemplates: recoveryTargetP2SH
        },
        fundingDescriptors
      ),
      //createValidFixture will return a utxosSelector function that takes walletUtxos and regtestUtils as input
      createValidFixture(
        {
          description:
            'Unlock: Take the previous tested tx and spend a matured key P2SH. In addition also spend a P2WPKH',
          utxoDescriptors: [{ ...P2WPKH }],
          //If we pass a relativeTimeLockScript, we are consuming an additional
          //utxo that we assume that it corresponds to the unique outout of the
          //last tx (created in the previous createValidFixture)
          redeemScript: relativeTimeLockScript,
          path: maturedPath,
          targetTemplates: oneTarget
        },
        fundingDescriptors
      )
    ]
  }
};
