import {
  LEGACY,
  NATIVE_SEGWIT,
  NESTED_SEGWIT
} from '../../src/walletConstants';
import { networks } from 'bitcoinjs-lib';
const addressesDescriptors = [
  {
    //0
    //https://iancoleman.io/bip39/
    address: 'mgFuvHBMqnmsDFHkr1XPJm3nD4VaakAHkX',
    path: "m/44'/1'/0'/0/0",
    extPub:
      'tpubDEcKTFgiimhCDQVTjkdK6MVHnmrQ2MQDLc35VZv3FG3gVom9jv3aKjcKnceuadqsPJySEwvQw5nzKCcSQZYfuYSaLhoU1w4H8QxeDzHM9WB',
    mnemonic:
      'pulp ritual farm danger swarm topple foil zone limb mail smoke lawsuit rent jungle grain step giraffe inmate outer embrace please lift powder trigger',
    network: networks.testnet
  },
  {
    //1
    //https://iancoleman.io/bip39/
    address: 'n45eSfCzP8qespuY59Lof91iytfEfBwYek',
    path: "m/44'/1'/0'/0/3",
    extPub:
      'tpubDEcKTFgiimhCDQVTjkdK6MVHnmrQ2MQDLc35VZv3FG3gVom9jv3aKjcKnceuadqsPJySEwvQw5nzKCcSQZYfuYSaLhoU1w4H8QxeDzHM9WB',
    mnemonic:
      'pulp ritual farm danger swarm topple foil zone limb mail smoke lawsuit rent jungle grain step giraffe inmate outer embrace please lift powder trigger',
    network: networks.testnet
  },

  {
    //2
    //From https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki
    address: '2Mww8dCYPUpKHofjgcXcBCEGmniw9CoaiD2',
    path: "m/49'/1'/0'/0/0",
    extPub:
      'upub5EFU65HtV5TeiSHmZZm7FUffBGy8UKeqp7vw43jYbvZPpoVsgU93oac7Wk3u6moKegAEWtGNF8DehrnHtv21XXEMYRUocHqguyjknFHYfgY',
    mnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    network: networks.testnet
  },
  {
    //3
    //https://iancoleman.io/bip39/
    address: '2NGH8tu2EGN2EuDdtRhmFFtWDu817ad4ikz',
    path: "m/49'/1'/0'/0/6",
    extPub:
      'upub5EFU65HtV5TeiSHmZZm7FUffBGy8UKeqp7vw43jYbvZPpoVsgU93oac7Wk3u6moKegAEWtGNF8DehrnHtv21XXEMYRUocHqguyjknFHYfgY',
    mnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    network: networks.testnet
  },
  {
    //4
    //https://iancoleman.io/bip39/
    address: '2NDYJPke9TdPprAgPYrWhcrGrcLMsAFmafy',
    path: "m/49'/1'/3'/1/8",
    extPub:
      'upub5Gcm8pAyU7WFMG6oP1HGwiBPM4cDyAH5GEGi7yHhG5XYMeyxtpeZR7ZqvCYtHiuLorwRB2eHrFwMMHCcpndrNm4JJHzqtHstrfPLeqoPg7C',
    mnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    network: networks.testnet
  },

  {
    //5
    //https://iancoleman.io/bip39/
    address: 'tb1qlzfxxz7rdty42ws2afnlgp2kk007hfevpt3ew4',
    path: "84'/1'/3'/1/8",
    extPub:
      'vpub5Y6cjg78GGuNUV98gipypz6d4rdGzpqhnwCWDYvy2gnULAapQV92CsDdsdM5SKfQxUqwQHUpFYoqrcmarxjkVxiUMJfQW9ZDwgz2iGacU5X',
    mnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    network: networks.testnet
  },
  {
    //6
    //https://iancoleman.io/bip39/
    address: 'tb1qaj6xxrj2n2ddqxe3a0wncxvc0jrwd3qrf0flx0',
    path: "84'/1'/0'/1/8",
    extPub:
      'vpub5Y6cjg78GGuNLsaPhmYsiw4gYX3HoQiRBiSwDaBXKUafCt9bNwWQiitDk5VZ5BVxYnQdwoTyXSs2JHRPAgjAvtbBrf8ZhDYe2jWAqvZVnsc',
    mnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    network: networks.testnet
  },
  {
    //7
    //https://iancoleman.io/bip39/
    address: 'tb1qk9ca9jh7a2muk2venu26qsc2an5cvnwpetqelf',
    path: "84'/1'/0'/0/8",
    extPub:
      'vpub5Y6cjg78GGuNLsaPhmYsiw4gYX3HoQiRBiSwDaBXKUafCt9bNwWQiitDk5VZ5BVxYnQdwoTyXSs2JHRPAgjAvtbBrf8ZhDYe2jWAqvZVnsc',
    mnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    network: networks.testnet
  }
];
export const fixtures = {
  addressesDescriptors,
  //An affine set of addresses are those that share network and mnemonic.
  //purpose and accountNumber may be different.
  //Technically a HD wallet initialized with a mnemonic could sign a tx for a
  //speciffic blockchain that mixes different purposes and accountNumbers
  affinedAddressesDescriptors: {
    valid: [
      //test 0
      {
        mnemonic: addressesDescriptors[0].mnemonic,
        network: addressesDescriptors[0].network,
        addressesDescriptors: [],
        isChange: false,
        purpose: LEGACY,
        accountNumber: 10,
        nextDerivationPath: "44'/1'/10'/0/0",
        defaultAccount: { accountNumber: 0, purpose: NATIVE_SEGWIT }
      },
      //test 1
      {
        mnemonic: addressesDescriptors[0].mnemonic,
        network: addressesDescriptors[0].network,
        addressesDescriptors: [addressesDescriptors[4]],
        gapAccountLimit: 3,
        isChange: true,
        purpose: NESTED_SEGWIT,
        accountNumber: 0,
        nextDerivationPath: "49'/1'/0'/1/0",
        defaultAccount: { accountNumber: 3, purpose: NESTED_SEGWIT }
      },
      {
        mnemonic: addressesDescriptors[0].mnemonic,
        network: addressesDescriptors[0].network,
        addressesDescriptors: [
          addressesDescriptors[0],
          addressesDescriptors[1]
        ],
        isChange: false,
        nextDerivationPath: "44'/1'/0'/0/4",
        defaultAccount: { accountNumber: 0, purpose: LEGACY }
      },
      {
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [
          addressesDescriptors[2],
          addressesDescriptors[3],
          addressesDescriptors[4]
        ],
        gapAccountLimit: 3,
        isChange: false,
        accountNumber: 4,
        nextDerivationPath: "49'/1'/4'/0/0",
        defaultAccount: { accountNumber: 3, purpose: NESTED_SEGWIT }
      },
      {
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [
          addressesDescriptors[2],
          addressesDescriptors[3],
          addressesDescriptors[4]
        ],
        gapAccountLimit: 3,
        isChange: false,
        accountNumber: 0,
        nextDerivationPath: "49'/1'/0'/0/7",
        defaultAccount: { accountNumber: 3, purpose: NESTED_SEGWIT }
      },
      {
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [
          addressesDescriptors[2],
          addressesDescriptors[3],
          addressesDescriptors[4]
        ],
        gapAccountLimit: 3,
        isChange: true,
        accountNumber: 0,
        nextDerivationPath: "49'/1'/0'/1/0",
        defaultAccount: { accountNumber: 3, purpose: NESTED_SEGWIT }
      },
      {
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [],
        isChange: false,
        accountNumber: 15,
        purpose: LEGACY,
        nextDerivationPath: "44'/1'/15'/0/0",
        defaultAccount: { accountNumber: 0, purpose: NATIVE_SEGWIT }
      },
      {
        mnemonic: addressesDescriptors[1].mnemonic,
        network: addressesDescriptors[1].network,
        addressesDescriptors: [addressesDescriptors[1]],
        isChange: false,
        nextDerivationPath: "44'/1'/0'/0/4",
        defaultAccount: { accountNumber: 0, purpose: LEGACY }
      },
      {
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [
          addressesDescriptors[2],
          addressesDescriptors[3],
          addressesDescriptors[4],
          addressesDescriptors[5],
          addressesDescriptors[6],
          addressesDescriptors[7]
        ],
        gapAccountLimit: 3,
        isChange: false,
        accountNumber: 0,
        purpose: LEGACY,
        nextDerivationPath: "44'/1'/0'/0/0",
        defaultAccount: { accountNumber: 3, purpose: NATIVE_SEGWIT }
      },
      {
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [
          addressesDescriptors[2],
          addressesDescriptors[3],
          addressesDescriptors[4],
          addressesDescriptors[5],
          addressesDescriptors[6],
          addressesDescriptors[7]
        ],
        gapAccountLimit: 3,
        isChange: false,
        accountNumber: 0,
        purpose: NESTED_SEGWIT,
        nextDerivationPath: "49'/1'/0'/0/7",
        defaultAccount: { accountNumber: 3, purpose: NATIVE_SEGWIT }
      },
      {
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [
          addressesDescriptors[2],
          addressesDescriptors[3],
          addressesDescriptors[4],
          addressesDescriptors[5],
          addressesDescriptors[6],
          addressesDescriptors[7]
        ],
        gapAccountLimit: 3,
        isChange: true,
        accountNumber: 3,
        purpose: NATIVE_SEGWIT,
        nextDerivationPath: "84'/1'/3'/1/9",
        defaultAccount: { accountNumber: 3, purpose: NATIVE_SEGWIT }
      }
    ],
    invalid: [
      {
        //This should throw because they correspond to different purposes
        //and account numbers and we did not specify any
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [
          addressesDescriptors[2],
          addressesDescriptors[3],
          addressesDescriptors[4]
        ],
        gapAccountLimit: 3,
        isChange: false,
        errorMessage:
          'Must specify an account number since derivation paths have a mix of account numbers!'
      },
      {
        //This should throw because they correspond to different purposes
        //and account numbers and we did not specify any
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [
          addressesDescriptors[2],
          addressesDescriptors[3],
          addressesDescriptors[4]
        ],
        gapAccountLimit: 3,
        purpose: NATIVE_SEGWIT,
        isChange: false,
        errorMessage:
          'Must specify an account number since derivation paths have a mix of account numbers!'
      },
      {
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [
          addressesDescriptors[2],
          addressesDescriptors[3],
          addressesDescriptors[4]
        ],
        gapAccountLimit: 3,
        purpose: NATIVE_SEGWIT,
        //Invalid accountnumber
        accountNumber: -1,
        isChange: true,
        errorMessage: 'Incorrect parameters' //thown by parseDerivationPath
      },
      {
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [
          addressesDescriptors[2],
          addressesDescriptors[3],
          addressesDescriptors[4]
        ],
        gapAccountLimit: 3,
        purpose: NATIVE_SEGWIT,
        accountNumber: 0,
        //Invalid isChange (not boolean)
        isChange: 1,
        errorMessage: 'Incorrect isChange parameter!'
      },
      {
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [],
        //isChange: false,
        accountNumber: 15,
        purpose: LEGACY,
        errorMessage: 'Incorrect isChange parameter!'
      },
      {
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [],
        isChange: false,
        //accountNumber: 15,
        purpose: LEGACY,
        errorMessage:
          'Must specify a purpose AND an account number since this wallet has never been used!'
      },
      {
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [],
        isChange: false,
        accountNumber: 15,
        //purpose: LEGACY,
        errorMessage:
          'Must specify a purpose AND an account number since this wallet has never been used!'
      },
      {
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [],
        isChange: false,
        //accountNumber: 15
        //purpose: LEGACY
        errorMessage:
          'Must specify a purpose AND an account number since this wallet has never been used!'
      },
      {
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [
          addressesDescriptors[2],
          addressesDescriptors[3],
          addressesDescriptors[4],
          addressesDescriptors[5],
          addressesDescriptors[6],
          addressesDescriptors[7]
        ],
        gapAccountLimit: 3,
        isChange: false,
        errorMessage:
          'Must specify an account number since derivation paths have a mix of account numbers!'
        //without account number and purpose
      },
      {
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [
          addressesDescriptors[2],
          addressesDescriptors[3],
          addressesDescriptors[4],
          addressesDescriptors[5],
          addressesDescriptors[6],
          addressesDescriptors[7]
        ],
        gapAccountLimit: 3,
        isChange: false,
        //without purpose
        accountNumber: 0,
        errorMessage:
          'Must specify a purpose AND an account number since derivation paths have a mix of purposes!'
      },
      {
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [
          addressesDescriptors[2],
          addressesDescriptors[3],
          addressesDescriptors[4],
          addressesDescriptors[5],
          addressesDescriptors[6],
          addressesDescriptors[7]
        ],
        gapAccountLimit: 3,
        isChange: false,
        purpose: LEGACY,
        //without accountNumber
        errorMessage:
          'Must specify an account number since derivation paths have a mix of account numbers!'
      },
      {
        //Different account number and same purpose
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [
          addressesDescriptors[5],
          addressesDescriptors[6]
        ],
        gapAccountLimit: 3,
        isChange: false,
        errorMessage:
          'Must specify an account number since derivation paths have a mix of account numbers!'
      },
      {
        //Different account number and different purpose
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [
          addressesDescriptors[4],
          addressesDescriptors[6]
        ],
        isChange: false,
        errorMessage:
          'Must specify an account number since derivation paths have a mix of account numbers!'
      },
      {
        //different purpose, same account number
        mnemonic: addressesDescriptors[2].mnemonic,
        network: addressesDescriptors[2].network,
        addressesDescriptors: [
          addressesDescriptors[4],
          addressesDescriptors[5]
        ],
        gapAccountLimit: 3,
        isChange: false,
        errorMessage:
          'Must specify a purpose AND an account number since derivation paths have a mix of purposes!'
      }
    ]
  }
};
