import { LEGACY, NATIVE_SEGWIT, NESTED_SEGWIT } from '../../src/constants';
import { networks } from '../../src/networks';
export const fixtures = {
  //Integration test:
  mnemonic:
    'pulp ritual farm danger swarm topple foil zone limb mail smoke lawsuit rent jungle grain step giraffe inmate outer embrace please lift powder trigger',
  network: networks.regtest,
  coldAddress: 'bcrt1qmqprgmkhfqt97d7p4pl99upx6vdg98gt83hlls',
  //36 minutes - This should pick the fee for the next 3 blocks
  //Note that tests will always query the mainnet. Esplora won't give estimates
  //for regtest.
  guardTxTargetTime: 36 * 60,
  //11 minutes - This should pick the fee for next block
  //Note that tests will always query the mainnet. Esplora won't give estimates
  //for regtest.
  unlockTxTargetTime: 11 * 60,
  //0 minutes - This should pick the fee for the current block
  //Note that tests will always query the mainnet. Esplora won't give estimates
  //for regtest.
  cancelTxTargetTime: 0 * 60,
  //4 hours
  lockTime: 4 * 60 * 60,
  lockNBlocks: 1,
  //3 BTC
  safeValue: 300000000,
  //This is the account where change and final recovered funds will go.
  defaultAccount: {
    purpose: NATIVE_SEGWIT,
    accountNumber: 1
  },
  fundingDescriptors: [
    {
      purpose: LEGACY,
      accountNumber: 0,
      index: 0,
      isChange: false,
      //2 BTC
      value: 200000000
    },
    {
      purpose: LEGACY,
      accountNumber: 0,
      index: 3,
      isChange: false,
      //1 BTC
      value: 100000000
    },
    {
      purpose: NATIVE_SEGWIT,
      accountNumber: 0,
      index: 5,
      isChange: false,
      //0.2 BTC
      value: 20000000
    },
    {
      purpose: NATIVE_SEGWIT,
      accountNumber: 1,
      index: 8,
      isChange: false,
      //0.9 BTC
      value: 90000000
    },
    {
      purpose: NESTED_SEGWIT,
      accountNumber: 0,
      index: 1,
      isChange: true,
      //0.8 BTC
      value: 80000000
    }
  ]
};
