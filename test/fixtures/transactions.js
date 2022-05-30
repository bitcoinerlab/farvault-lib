//I don't need to run the esplora server
//I should use a bitcoin server (not the shitty UI)
//
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

import { networks } from 'bitcoinjs-lib';
import {
  LEDGER_NANO_INTERFACE,
  SOFT_HD_INTERFACE
} from '../../src/HDInterface';
import {
  LEGACY,
  NATIVE_SEGWIT,
  NESTED_SEGWIT
} from '../../src/walletConstants';

//Randombly generated using https://iancoleman.io/bip39/:
//p2pkh:
const burnAddress = 'mzHbZVVTJePJ9NL7xak52cqbrJpHLbujJr';
//bech32
const burnAddress_B = 'bcrt1q8vpynm8adzaxjn6cmmld6qn33apfw65w0akw4w';

const fee = 1000;

const testWallet = [];

const P2PKH = {
  account: {
    purpose: LEGACY,
    accountNumber: 0
  },
  index: 0,
  isChange: false,
  //1 BTC
  value: 100000000
};

const P2SHP2WPKH = {
  account: {
    purpose: NESTED_SEGWIT,
    accountNumber: 0
  },
  index: 0,
  isChange: false,
  //1 BTC
  value: 100000000
};

const P2WPKH = {
  account: {
    purpose: LEGACY,
    accountNumber: 0
  },
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

function createValidFixture(data, testWallet) {
  testWallet.push(...data.descriptors);
  const inputValue = data.descriptors.reduce((sum, d) => sum + d.value, 0);
  return {
    description: data.description,
    walletUtxoIndices: data.descriptors.map(descr => testWallet.indexOf(descr)),
    targets: data.targets.map(t => ({
      address: t.address,
      value:
        Math.floor(t.valueRatioBeforeFee * inputValue) -
        Math.ceil(fee / data.targets.length)
    }))
  };
}

export const fixtures = {
  type: LEDGER_NANO_INTERFACE,
  //type: SOFT_HD_INTERFACE,
  mnemonic:
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  network: networks.regtest,
  testWallet,
  createTransaction: {
    valid: [
      createValidFixture(
        {
          description: 'Spend one P2PKH output',
          descriptors: [{ ...P2PKH }],
          targets: oneTarget
        },
        testWallet
      ),
      createValidFixture(
        {
          description: 'Spend two P2PKH outputs from the same address',
          descriptors: [{ ...P2PKH }, { ...P2PKH }],
          targets: oneTarget
        },
        testWallet
      ),
      createValidFixture(
        {
          description: 'Spend two P2PKH outputs from two different addresses',
          descriptors: [{ ...P2PKH }, { ...P2PKH, index: 1 }],
          targets: oneTarget
        },
        testWallet
      ),
      createValidFixture(
        {
          description: 'Spend one P2SHP2WPKH output',
          descriptors: [{ ...P2SHP2WPKH }],
          targets: oneTarget
        },
        testWallet
      ),
      createValidFixture(
        {
          description: 'Spend two P2SHP2WPKH outputs from the same address',
          descriptors: [{ ...P2SHP2WPKH }, { ...P2SHP2WPKH }],
          targets: oneTarget
        },
        testWallet
      ),
      createValidFixture(
        {
          description:
            'Spend two P2SHP2WPKH outputs from two different addresses',
          descriptors: [{ ...P2SHP2WPKH }, { ...P2SHP2WPKH, index: 1 }],
          targets: oneTarget
        },
        testWallet
      ),
      createValidFixture(
        {
          description: 'Spend one P2WPKH output',
          descriptors: [{ ...P2WPKH }],
          targets: oneTarget
        },
        testWallet
      ),
      createValidFixture(
        {
          description: 'Spend two P2WPKH outputs from the same address',
          descriptors: [{ ...P2WPKH }, { ...P2WPKH }],
          targets: oneTarget
        },
        testWallet
      ),
      createValidFixture(
        {
          description: 'Spend two P2WPKH outputs from two different addresses',
          descriptors: [{ ...P2WPKH }, { ...P2WPKH, index: 1 }],
          targets: oneTarget
        },
        testWallet
      ),
      createValidFixture(
        {
          description:
            'Spend from P2PKH, P2SHP2WPKH and P2PKH and send to 2 outputs',
          descriptors: [{ ...P2PKH }, { ...P2SHP2WPKH }, { ...P2WPKH }],
          targets: twoTargets
        },
        testWallet
      )
    ]
  }
};
