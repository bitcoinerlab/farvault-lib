import {
  LEGACY,
  NATIVE_SEGWIT,
  NESTED_SEGWIT
} from '../../src/walletConstants';
import { networks } from 'bitcoinjs-lib';
export const fixtures = {
  mnemonic:
    'pulp ritual farm danger swarm topple foil zone limb mail smoke lawsuit rent jungle grain step giraffe inmate outer embrace please lift powder trigger',
  network: networks.regtest,
  addresses: [
    {
      extPub: {
        purpose: LEGACY,
        accountNumber: 0
      },
      index: 0,
      isChange: false,
      //2 BTC
      value: 200000000,
      test: {
        //Using https://mfcoin.net/recovery_tool/
        address: 'mgFuvHBMqnmsDFHkr1XPJm3nD4VaakAHkX',
        derivationPath: "m/44'/1'/0'/0/0",
        extPub:
          'tpubDEcKTFgiimhCDQVTjkdK6MVHnmrQ2MQDLc35VZv3FG3gVom9jv3aKjcKnceuadqsPJySEwvQw5nzKCcSQZYfuYSaLhoU1w4H8QxeDzHM9WB'
      }
    },
    {
      extPub: {
        purpose: LEGACY,
        accountNumber: 0
      },
      index: 3,
      isChange: false,
      //1 BTC
      value: 100000000,
      test: {
        //Using https://mfcoin.net/recovery_tool/
        address: 'n45eSfCzP8qespuY59Lof91iytfEfBwYek',
        derivationPath: "m/44'/1'/0'/0/3",
        extPub:
          'tpubDEcKTFgiimhCDQVTjkdK6MVHnmrQ2MQDLc35VZv3FG3gVom9jv3aKjcKnceuadqsPJySEwvQw5nzKCcSQZYfuYSaLhoU1w4H8QxeDzHM9WB'
      }
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
  ],
  //This is the account where change and final recovered funds will go.
  defaultAccount: {
    purpose: NATIVE_SEGWIT,
    accountNumber: 1
  },
  //36 minutes - This should pick the fee for the next 3 blocks
  //Note that tests will always query the mainnet. Esplora won't give estimates
  //for regtest.
  freezeTxTargetTime: 36 * 60,
  //3 BTC
  savingsValue: 300000000
};
