import {
  LEGACY,
  NATIVE_SEGWIT,
  NESTED_SEGWIT
} from '../../src/walletConstants';
import { networks } from 'bitcoinjs-lib';
export const fixtures = {
  //Integration test:
  mnemonic:
    'pulp ritual farm danger swarm topple foil zone limb mail smoke lawsuit rent jungle grain step giraffe inmate outer embrace please lift powder trigger',
  network: networks.regtest,
  //36 minutes - This should pick the fee for the next 3 blocks
  //Note that tests will always query the mainnet. Esplora won't give estimates
  //for regtest.
  freezeTxTargetTime: 36 * 60,
  //3 BTC
  savingsValue: 300000000,
  //This is the account where change and final recovered funds will go.
  defaultAccount: {
    purpose: NATIVE_SEGWIT,
    accountNumber: 1
  },
  mockWallet: [
    {
      extPub: {
        purpose: LEGACY,
        accountNumber: 0
      },
      index: 0,
      isChange: false,
      //2 BTC
      value: 200000000
    },
    {
      extPub: {
        purpose: LEGACY,
        accountNumber: 0
      },
      index: 3,
      isChange: false,
      //1 BTC
      value: 100000000
    },
    {
      extPub: {
        purpose: NATIVE_SEGWIT,
        accountNumber: 0
      },
      index: 5,
      isChange: false,
      //0.2 BTC
      value: 20000000
    },
    {
      extPub: {
        purpose: NATIVE_SEGWIT,
        accountNumber: 1
      },
      index: 8,
      isChange: false,
      //0.9 BTC
      value: 90000000
    },
    {
      extPub: {
        purpose: NESTED_SEGWIT,
        accountNumber: 0
      },
      index: 1,
      isChange: true,
      //0.8 BTC
      value: 80000000
    }
  ]
};
