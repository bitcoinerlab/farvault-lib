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
      value: 23432423432
    },
    {
      pub: {
        pubType: TPUB,
        accountNumber: 0
      },
      index: 3,
      isChange: false,
      value: 23432423432
    },
    {
      pub: {
        pubType: VPUB,
        accountNumber: 0
      },
      index: 5,
      isChange: false,
      value: 10000
    },
    {
      pub: {
        pubType: UPUB,
        accountNumber: 0
      },
      index: 1,
      isChange: true,
      value: 20000
    }
  ]
};
