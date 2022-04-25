import { TPUB, UPUB, VPUB } from '../../src/walletConstants';
export const fixtures = {
  mnemonic:
    'pulp ritual farm danger swarm topple foil zone limb mail smoke lawsuit rent jungle grain step giraffe inmate outer embrace please lift powder trigger',
  addressesDescriptors: [
    {
      pub: {
        pubType: TPUB,
        accountNumber: 0
      },
      index: 0,
      isChange: false,
      //2 BTC
      value: 200000000
    },
    {
      pub: {
        pubType: TPUB,
        accountNumber: 0
      },
      index: 3,
      isChange: false,
      //1 BTC
      value: 100000000
    },
    {
      pub: {
        pubType: VPUB,
        accountNumber: 0
      },
      index: 5,
      isChange: false,
      //0.2 BTC
      value: 20000000
    },
    {
      pub: {
        pubType: VPUB,
        accountNumber: 1
      },
      index: 8,
      isChange: false,
      //0.9 BTC
      value: 90000000
    },
    {
      pub: {
        pubType: UPUB,
        accountNumber: 0
      },
      index: 1,
      isChange: true,
      //0.8 BTC
      value: 80000000
    }
  ],
  //This is the account where change and final recovered funds will go.
  defaultAccount: { pubType: VPUB, accountNumber: 1 },
  //36 minutes - This should pick the fee for the next 3 blocks
  //Note that tests will always query the mainnet. Esplora won't give estimates
  //for regtest.
  freezeTxTargetTime: 36 * 60,
  //3 BTC
  savingsValue: 300000000
};
