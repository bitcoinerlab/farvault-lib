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
      //234 BTC
      value: 23432423432
    },
    {
      pub: {
        pubType: TPUB,
        accountNumber: 0
      },
      index: 3,
      isChange: false,
      //234 BTC
      value: 23432423432
    },
    {
      pub: {
        pubType: VPUB,
        accountNumber: 0
      },
      index: 5,
      isChange: false,
      //0.0001 BTC
      value: 10000
    },
    {
      pub: {
        pubType: UPUB,
        accountNumber: 0
      },
      index: 1,
      isChange: true,
      //0.0002 BTC
      value: 20000
    }
  ]
};
