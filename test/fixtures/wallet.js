import {
  LEGACY,
  NATIVE_SEGWIT,
  NESTED_SEGWIT,
  GAP_LIMIT,
  VAULT_SKIP
} from '../../src/constants';
import { networks } from 'bitcoinjs-lib';
import { parseDerivationPath } from '../../src/bip32';
const addressDescriptors = [
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
  addressDescriptors,
  //An affine set of addresses are those that share network and mnemonic.
  //purpose and accountNumber may be different.
  //Technically a HD wallet initialized with a mnemonic could sign a tx for a
  //speciffic blockchain that mixes different purposes and accountNumbers
  affineAddressesDescriptors: {
    valid: [
      //test 0
      {
        mnemonic: addressDescriptors[0].mnemonic,
        network: addressDescriptors[0].network,
        addressDescriptors: [],
        isChange: false,
        purpose: LEGACY,
        accountNumber: 10,
        nextDerivationPath: "44'/1'/10'/0/0",
        lastDerivationPath: -1,
        defaultAccount: { accountNumber: 0, purpose: NATIVE_SEGWIT }
      },
      //test 1
      {
        mnemonic: addressDescriptors[0].mnemonic,
        network: addressDescriptors[0].network,
        addressDescriptors: [addressDescriptors[4]],
        gapAccountLimit: 4,
        isChange: true,
        purpose: NESTED_SEGWIT,
        accountNumber: 0,
        nextDerivationPath: "49'/1'/0'/1/0",
        lastDerivationPath: -1,
        defaultAccount: { accountNumber: 3, purpose: NESTED_SEGWIT }
      },
      {
        mnemonic: addressDescriptors[0].mnemonic,
        network: addressDescriptors[0].network,
        addressDescriptors: [addressDescriptors[0], addressDescriptors[1]],
        isChange: false,
        nextDerivationPath: "44'/1'/0'/0/4",
        lastDerivationPath: "44'/1'/0'/0/3",
        defaultAccount: { accountNumber: 0, purpose: LEGACY }
      },
      {
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [
          addressDescriptors[2],
          addressDescriptors[3],
          addressDescriptors[4]
        ],
        gapAccountLimit: 3,
        isChange: false,
        accountNumber: 4,
        nextDerivationPath: "49'/1'/4'/0/0",
        lastDerivationPath: -1,
        defaultAccount: { accountNumber: 3, purpose: NESTED_SEGWIT }
      },
      {
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [
          addressDescriptors[2],
          addressDescriptors[3],
          addressDescriptors[4]
        ],
        gapAccountLimit: 3,
        isChange: false,
        accountNumber: 0,
        nextDerivationPath: "49'/1'/0'/0/7",
        lastDerivationPath: "49'/1'/0'/0/6",
        defaultAccount: { accountNumber: 3, purpose: NESTED_SEGWIT }
      },
      {
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [
          addressDescriptors[2],
          addressDescriptors[3],
          addressDescriptors[4]
        ],
        gapAccountLimit: 3,
        isChange: true,
        accountNumber: 0,
        nextDerivationPath: "49'/1'/0'/1/0",
        lastDerivationPath: -1,
        defaultAccount: { accountNumber: 3, purpose: NESTED_SEGWIT }
      },
      {
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [],
        isChange: false,
        accountNumber: 15,
        purpose: LEGACY,
        nextDerivationPath: "44'/1'/15'/0/0",
        lastDerivationPath: -1,
        defaultAccount: { accountNumber: 0, purpose: NATIVE_SEGWIT }
      },
      {
        mnemonic: addressDescriptors[1].mnemonic,
        network: addressDescriptors[1].network,
        addressDescriptors: [addressDescriptors[1]],
        isChange: false,
        nextDerivationPath: "44'/1'/0'/0/4",
        lastDerivationPath: "44'/1'/0'/0/3",
        defaultAccount: { accountNumber: 0, purpose: LEGACY }
      },
      {
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [
          addressDescriptors[2],
          addressDescriptors[3],
          addressDescriptors[4],
          addressDescriptors[5],
          addressDescriptors[6],
          addressDescriptors[7]
        ],
        gapAccountLimit: 3,
        isChange: false,
        accountNumber: 0,
        purpose: LEGACY,
        nextDerivationPath: "44'/1'/0'/0/0",
        lastDerivationPath: -1,
        defaultAccount: { accountNumber: 3, purpose: NATIVE_SEGWIT }
      },
      {
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [
          addressDescriptors[2],
          addressDescriptors[3],
          addressDescriptors[4],
          addressDescriptors[5],
          addressDescriptors[6],
          addressDescriptors[7]
        ],
        gapAccountLimit: 3,
        isChange: false,
        accountNumber: 0,
        purpose: NESTED_SEGWIT,
        nextDerivationPath: "49'/1'/0'/0/7",
        lastDerivationPath: "49'/1'/0'/0/6",
        defaultAccount: { accountNumber: 3, purpose: NATIVE_SEGWIT }
      },
      {
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [
          addressDescriptors[2],
          addressDescriptors[3],
          addressDescriptors[4],
          addressDescriptors[5],
          addressDescriptors[6],
          addressDescriptors[7]
        ],
        gapAccountLimit: 3,
        isChange: true,
        accountNumber: 3,
        purpose: NATIVE_SEGWIT,
        nextDerivationPath: "84'/1'/3'/1/9",
        lastDerivationPath: "84'/1'/3'/1/8",
        defaultAccount: { accountNumber: 3, purpose: NATIVE_SEGWIT }
      }
    ],
    invalid: [
      //test 0
      {
        //This should throw because they correspond to different purposes
        //and account numbers and we did not specify any
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [
          addressDescriptors[2],
          addressDescriptors[3],
          addressDescriptors[4]
        ],
        gapAccountLimit: 3,
        isChange: false,
        errorMessage:
          'Must specify an account number since derivation paths have a mix of account numbers!'
      },
      //test 1
      {
        //This should throw because they correspond to different purposes
        //and account numbers and we did not specify any
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [
          addressDescriptors[2],
          addressDescriptors[3],
          addressDescriptors[4]
        ],
        gapAccountLimit: 3,
        purpose: NATIVE_SEGWIT,
        isChange: false,
        errorMessage:
          'Must specify an account number since derivation paths have a mix of account numbers!'
      },
      //test 2
      {
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [
          addressDescriptors[2],
          addressDescriptors[3],
          addressDescriptors[4]
        ],
        gapAccountLimit: 3,
        purpose: NATIVE_SEGWIT,
        //Invalid accountnumber
        accountNumber: -1,
        isChange: true,
        errorMessage: 'Incorrect parameters' //thown by parseDerivationPath
      },
      //test 3
      {
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [
          addressDescriptors[2],
          addressDescriptors[3],
          addressDescriptors[4]
        ],
        gapAccountLimit: 3,
        purpose: NATIVE_SEGWIT,
        accountNumber: 0,
        //Invalid isChange (not boolean)
        isChange: 1,
        errorMessage: 'Incorrect isChange parameter!'
      },
      //test 4
      {
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [],
        //isChange: false,
        accountNumber: 15,
        purpose: LEGACY,
        errorMessage: 'Incorrect isChange parameter!'
      },
      //test 5
      {
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [],
        isChange: false,
        //accountNumber: 15,
        purpose: LEGACY,
        errorMessage:
          'Must specify a purpose AND an account number since this wallet has never been used!'
      },
      //test 6
      {
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [],
        isChange: false,
        accountNumber: 15,
        //purpose: LEGACY,
        errorMessage:
          'Must specify a purpose AND an account number since this wallet has never been used!'
      },
      //test 7
      {
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [],
        isChange: false,
        //accountNumber: 15
        //purpose: LEGACY
        errorMessage:
          'Must specify a purpose AND an account number since this wallet has never been used!'
      },
      //test 8
      {
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [
          addressDescriptors[2],
          addressDescriptors[3],
          addressDescriptors[4],
          addressDescriptors[5],
          addressDescriptors[6],
          addressDescriptors[7]
        ],
        gapAccountLimit: 3,
        isChange: false,
        errorMessage:
          'Must specify an account number since derivation paths have a mix of account numbers!'
        //without account number and purpose
      },
      //test 9
      {
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [
          addressDescriptors[2],
          addressDescriptors[3],
          addressDescriptors[4],
          addressDescriptors[5],
          addressDescriptors[6],
          addressDescriptors[7]
        ],
        gapAccountLimit: 3,
        isChange: false,
        //without purpose
        accountNumber: 0,
        errorMessage:
          'Must specify a purpose AND an account number since derivation paths have a mix of purposes!'
      },
      //test 10
      {
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [
          addressDescriptors[2],
          addressDescriptors[3],
          addressDescriptors[4],
          addressDescriptors[5],
          addressDescriptors[6],
          addressDescriptors[7]
        ],
        gapAccountLimit: 3,
        isChange: false,
        purpose: LEGACY,
        //without accountNumber
        errorMessage:
          'Must specify an account number since derivation paths have a mix of account numbers!'
      },
      //test 11
      {
        //Different account number and same purpose
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [addressDescriptors[5], addressDescriptors[6]],
        gapAccountLimit: 3,
        isChange: false,
        errorMessage:
          'Must specify an account number since derivation paths have a mix of account numbers!'
      },
      //test 12
      {
        //Different account number and different purpose
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [addressDescriptors[4], addressDescriptors[6]],
        isChange: false,
        errorMessage:
          'Must specify an account number since derivation paths have a mix of account numbers!'
      },
      //test 13
      {
        //different purpose, same account number
        mnemonic: addressDescriptors[2].mnemonic,
        network: addressDescriptors[2].network,
        addressDescriptors: [addressDescriptors[4], addressDescriptors[5]],
        gapAccountLimit: 4,
        isChange: false,
        errorMessage:
          'Must specify a purpose AND an account number since derivation paths have a mix of purposes!'
      }
    ]
  },
  normalizeDerivationPaths: {
    invalid: [
      {
        description: 'Bad formatted entry - number of elements',
        usedPaths: ["44'/0'/1'/0"],
        errorMessage: 'Invalid number of elements'
      },
      {
        description: 'Bad formatted entry - invalid isChange',
        usedPaths: ["44'/1'/0'/2/0"],
        errorMessage: 'Invalid change type'
      },
      {
        description: 'Not set usedPaths',
        usedPaths: undefined,
        errorMessage: 'Invalid usedPaths'
      },
      {
        description: 'Invalid type gapLimit',
        gapLimit: '3',
        errorMessage: 'Invalid gapLimit'
      },
      {
        description: 'Invalid type gapAccountLimit',
        gapAccountLimit: 0,
        errorMessage: 'Invalid gapAccountLimit'
      },
      {
        description: 'Valid paths but non BIP-44 ones',
        usedPaths: ["47'/1'/0'/0/0"],
        errorMessage: 'Invalid purpose'
      },
      {
        description: 'Calls the function with invalid usedPaths type',
        usedPaths: "44'/1'/0'/0/0",
        errorMessage: 'Invalid usedPaths'
      },
      {
        description: 'Calls the function with undefined usedPaths',
        usedPaths: undefined,
        errorMessage: 'Invalid usedPaths'
      },
      {
        description: 'Invalid gapAccountLimit - default is 1',
        usedPaths: ["44'/1'/1'/1/0"],
        errorMessage:
          'Unreachable derivation path. Increase the gap account limit.'
      },
      {
        description: 'Good order but invalid gapLimit',
        usedPaths: ["44'/1'/0'/1/0", "44'/1'/0'/1/21"],
        errorMessage: 'Unreachable derivation path. Increase the gap limit.'
      },
      {
        description: 'Good order but both invalid gapLimit and gapAccountLimit',
        usedPaths: ["44'/1'/0'/1/0", "44'/1'/1'/1/21"],
        errorMessage: 'Unreachable derivation path. Increase the gap limit.'
      }
    ],
    valid: [
      { description: 'Emtpy set', usedPaths: [], usedParsedPaths: [] },
      {
        description: 'isChange differs',
        usedPaths: ["44'/1'/0'/0/8", "44'/1'/0'/1/8"],
        usedParsedPaths: [
          parseDerivationPath("44'/1'/0'/0/8"),
          parseDerivationPath("44'/1'/0'/1/8")
        ]
      },
      {
        description: 'One element',
        usedPaths: ["44'/1'/0'/1/8"],
        usedParsedPaths: [parseDerivationPath("44'/1'/0'/1/8")]
      },
      {
        description: 'Different formatting options',
        usedPaths: ["m/44h/1H/0'/0/8", "44h/1'/0H/1/8"],
        usedParsedPaths: [
          parseDerivationPath("44'/1'/0'/0/8"),
          parseDerivationPath("44'/1'/0'/1/8")
        ]
      },
      {
        description:
          'Deduplication works even with different formatting options',
        usedPaths: [
          "44'/1'/0'/0/8",
          "44'/1'/0'/0/8",
          "44'/1'/0'/0/8",
          "44'/1'/0'/0/8",
          //change formatting options:
          "44'/1'/0'/1/8",
          "44h/1'/0H/1/8",
          "m/44H/1'/0'/1/8",
          "M/44H/1'/0'/1/8"
        ],
        usedParsedPaths: [
          parseDerivationPath("44'/1'/0'/0/8"),
          parseDerivationPath("44'/1'/0'/1/8")
        ]
      },
      {
        description: 'Mixing network types',
        usedPaths: [
          "44'/1'/0'/1/18",
          "44'/1'/0'/0/8",
          "44'/1'/0'/1/9",
          "44'/0'/0'/0/8",
          "44'/0'/0'/1/18"
        ],
        usedParsedPaths: [
          parseDerivationPath("44'/0'/0'/0/8"),
          parseDerivationPath("44'/0'/0'/1/18"),
          parseDerivationPath("44'/1'/0'/0/8"),
          parseDerivationPath("44'/1'/0'/1/9"),
          parseDerivationPath("44'/1'/0'/1/18")
        ]
      },
      {
        description: 'Mixing network types and purposes',
        usedPaths: [
          "49'/1'/0'/1/18",
          "49'/1'/0'/0/8",
          "49'/1'/0'/1/9",
          "49'/0'/0'/0/8",
          "49'/0'/0'/1/18",
          //
          "84'/1'/0'/1/18",
          "84'/1'/0'/0/8",
          "84'/1'/0'/1/9",
          "84'/0'/0'/0/8",
          "84'/0'/0'/1/18",
          //
          "44'/1'/0'/1/18",
          "44'/1'/0'/0/8",
          "44'/1'/0'/1/9",
          "44'/0'/0'/0/8",
          "44'/0'/0'/1/18"
        ],
        usedParsedPaths: [
          parseDerivationPath("44'/0'/0'/0/8"),
          parseDerivationPath("44'/0'/0'/1/18"),
          parseDerivationPath("49'/0'/0'/0/8"),
          parseDerivationPath("49'/0'/0'/1/18"),
          parseDerivationPath("84'/0'/0'/0/8"),
          parseDerivationPath("84'/0'/0'/1/18"),
          parseDerivationPath("44'/1'/0'/0/8"),
          parseDerivationPath("44'/1'/0'/1/9"),
          parseDerivationPath("44'/1'/0'/1/18"),
          parseDerivationPath("49'/1'/0'/0/8"),
          parseDerivationPath("49'/1'/0'/1/9"),
          parseDerivationPath("49'/1'/0'/1/18"),
          parseDerivationPath("84'/1'/0'/0/8"),
          parseDerivationPath("84'/1'/0'/1/9"),
          parseDerivationPath("84'/1'/0'/1/18")
        ]
      },
      {
        description: 'Mixing network types, accounts and purposes',
        gapAccountLimit: 11, //16-5
        usedPaths: [
          "49'/1'/5'/1/18",
          "49'/1'/5'/0/8",
          "49'/1'/5'/1/9",
          "49'/0'/5'/0/8",
          "49'/0'/5'/1/18",
          //
          "84'/1'/5'/1/18",
          "84'/1'/5'/0/8",
          "84'/1'/5'/1/9",
          "84'/0'/5'/0/8",
          "84'/0'/5'/1/18",
          //
          "44'/1'/5'/1/18",
          "44'/1'/5'/0/8",
          "44'/1'/5'/1/9",
          "44'/0'/5'/0/8",
          "44'/0'/5'/1/18",
          //
          //
          "49'/1'/0'/1/18",
          "49'/1'/0'/0/8",
          "49'/1'/0'/1/9",
          "49'/0'/0'/0/8",
          "49'/0'/0'/1/18",
          //
          "84'/1'/0'/1/18",
          "84'/1'/0'/0/8",
          "84'/1'/0'/1/9",
          "84'/0'/0'/0/8",
          "84'/0'/0'/1/18",
          //
          "44'/1'/0'/1/18",
          "44'/1'/0'/0/8",
          "44'/1'/0'/1/9",
          "44'/0'/0'/0/8",
          "44'/0'/0'/1/18",
          //
          //
          "49'/1'/16'/1/18",
          "49'/1'/16'/0/8",
          "49'/1'/16'/1/9",
          "49'/0'/16'/0/8",
          "49'/0'/16'/1/18",
          //
          "84'/1'/16'/1/18",
          "84'/1'/16'/0/8",
          "84'/1'/16'/1/9",
          "84'/0'/16'/0/8",
          "84'/0'/16'/1/18",
          //
          "44'/1'/16'/1/18",
          "44'/1'/16'/0/8",
          "44'/1'/16'/1/9",
          "44'/0'/16'/0/8",
          "44'/0'/16'/1/18"
        ],
        usedParsedPaths: [
          parseDerivationPath("44'/0'/0'/0/8"),
          parseDerivationPath("44'/0'/0'/1/18"),
          parseDerivationPath("44'/0'/5'/0/8"),
          parseDerivationPath("44'/0'/5'/1/18"),
          parseDerivationPath("44'/0'/16'/0/8"),
          parseDerivationPath("44'/0'/16'/1/18"),
          parseDerivationPath("49'/0'/0'/0/8"),
          parseDerivationPath("49'/0'/0'/1/18"),
          parseDerivationPath("49'/0'/5'/0/8"),
          parseDerivationPath("49'/0'/5'/1/18"),
          parseDerivationPath("49'/0'/16'/0/8"),
          parseDerivationPath("49'/0'/16'/1/18"),
          parseDerivationPath("84'/0'/0'/0/8"),
          parseDerivationPath("84'/0'/0'/1/18"),
          parseDerivationPath("84'/0'/5'/0/8"),
          parseDerivationPath("84'/0'/5'/1/18"),
          parseDerivationPath("84'/0'/16'/0/8"),
          parseDerivationPath("84'/0'/16'/1/18"),
          parseDerivationPath("44'/1'/0'/0/8"),
          parseDerivationPath("44'/1'/0'/1/9"),
          parseDerivationPath("44'/1'/0'/1/18"),
          parseDerivationPath("44'/1'/5'/0/8"),
          parseDerivationPath("44'/1'/5'/1/9"),
          parseDerivationPath("44'/1'/5'/1/18"),
          parseDerivationPath("44'/1'/16'/0/8"),
          parseDerivationPath("44'/1'/16'/1/9"),
          parseDerivationPath("44'/1'/16'/1/18"),
          parseDerivationPath("49'/1'/0'/0/8"),
          parseDerivationPath("49'/1'/0'/1/9"),
          parseDerivationPath("49'/1'/0'/1/18"),
          parseDerivationPath("49'/1'/5'/0/8"),
          parseDerivationPath("49'/1'/5'/1/9"),
          parseDerivationPath("49'/1'/5'/1/18"),
          parseDerivationPath("49'/1'/16'/0/8"),
          parseDerivationPath("49'/1'/16'/1/9"),
          parseDerivationPath("49'/1'/16'/1/18"),
          parseDerivationPath("84'/1'/0'/0/8"),
          parseDerivationPath("84'/1'/0'/1/9"),
          parseDerivationPath("84'/1'/0'/1/18"),
          parseDerivationPath("84'/1'/5'/0/8"),
          parseDerivationPath("84'/1'/5'/1/9"),
          parseDerivationPath("84'/1'/5'/1/18"),
          parseDerivationPath("84'/1'/16'/0/8"),
          parseDerivationPath("84'/1'/16'/1/9"),
          parseDerivationPath("84'/1'/16'/1/18")
        ]
      }
    ]
  },
  getNextDerivationPath: {
    invalid: [
      {
        description: 'Bad formatted entry - number of elements',
        isChange: false,
        usedPaths: ["44'/0'/1'/0"],
        skip: VAULT_SKIP,
        prereservedPaths: [],
        errorMessage: 'Invalid number of elements'
      },
      {
        description: 'Invalid maxGap',
        isChange: false,
        usedPaths: ["44'/0'/0'/0/20"],
        skip: VAULT_SKIP,
        prereservedPaths: [],
        errorMessage: 'Unreachable derivation path. Increase the gap limit.'
      },
      {
        description: 'Tries to skip too many addresses',
        isChange: false,
        usedPaths: ["84'/0'/0'/0/19"],
        skip: 20,
        prereservedPaths: [],
        errorMessage: 'Invalid skip'
      },
      {
        description: 'Unreachable account number',
        isChange: false,
        usedPaths: ["84'/0'/1'/0/19"],
        skip: VAULT_SKIP,
        prereservedPaths: [],
        errorMessage:
          'Unreachable derivation path. Increase the gap account limit.'
      },
      {
        description: 'Skip cannot be equal to gapLimit',
        isChange: false,
        usedPaths: [],
        skip: 10,
        gapLimit: 10,
        prereservedPaths: [],
        errorMessage: 'Invalid skip'
      },
      {
        description: 'Skip cannot be larger than gapLimit',
        isChange: false,
        usedPaths: [],
        skip: 11,
        gapLimit: 10,
        prereservedPaths: [],
        errorMessage: 'Invalid skip'
      },
      {
        description: 'Invalid usedPaths',
        isChange: false,
        usedPaths: 'string',
        skip: VAULT_SKIP,
        prereservedPaths: [],
        errorMessage: 'Invalid usedPaths'
      },
      {
        description: 'Invalid usedPaths',
        isChange: false,
        usedPaths: [],
        skip: VAULT_SKIP,
        prereservedPaths: 'string',
        errorMessage: 'Invalid prereservedPaths'
      },
      {
        description: 'Unreachable gap account',
        isChange: false,
        usedPaths: ["44'/0h/1H/0/0"],
        skip: VAULT_SKIP,
        prereservedPaths: [],
        errorMessage:
          'Unreachable derivation path. Increase the gap account limit.'
      },
      {
        description: 'Unreachable gap account even if usedPaths only on change',
        isChange: false,
        usedPaths: ["44'/0h/1H/1/0"],
        skip: VAULT_SKIP,
        prereservedPaths: [],
        errorMessage:
          'Unreachable derivation path. Increase the gap account limit.'
      },
      {
        description: 'Wrong network on usedPaths',
        isChange: false,
        usedPaths: ["44'/1'/1'/1/0"],
        skip: VAULT_SKIP,
        gapAccountLimit: 2,
        prereservedPaths: [],
        errorMessage: 'The coin type does not math this network'
      }
    ],
    valid: [
      {
        description: 'Emtpy set, skip 0',
        isChange: false,
        usedPaths: [],
        prereservedPaths: [],
        distantReceivingPath: "84'/0'/0'/0/0"
      },
      {
        description: 'Emtpy set, skip 19',
        isChange: false,
        usedPaths: [],
        skip: 19,
        prereservedPaths: [],
        distantReceivingPath: "84'/0'/0'/0/19"
      },
      {
        description: 'isChange addresses is ignored',
        isChange: false,
        usedPaths: ["84'/0'/0'/1/19"],
        skip: 19,
        prereservedPaths: [],
        distantReceivingPath: "84'/0'/0'/0/19"
      },
      {
        description: 'Correctly jumps max gap',
        isChange: false,
        usedPaths: ["84'/0'/0'/0/19"],
        skip: 19,
        prereservedPaths: [],
        distantReceivingPath: "84'/0'/0'/0/39"
      },
      {
        description: 'Default jump size is correct',
        isChange: false,
        usedPaths: ["84'/0'/0'/0/19"],
        skip: VAULT_SKIP,
        prereservedPaths: [],
        distantReceivingPath: `84'/0'/0'/0/${19 + VAULT_SKIP + 1}`
      },
      {
        description:
          'Skip is over the default gapLimit by passing it as an argument',
        isChange: false,
        usedPaths: ["84'/0'/0'/0/19"],
        skip: 20,
        prereservedPaths: [],
        gapLimit: 21,
        distantReceivingPath: "84'/0'/0'/0/40",
        errorMessage: 'Invalid skip'
      },
      {
        description:
          'prereservedPaths does not affect if not in the default account',
        isChange: false,
        usedPaths: ["84'/0'/0'/0/19"],
        skip: VAULT_SKIP,
        prereservedPaths: ["84'/0'/1'/0/29"],
        distantReceivingPath: `84'/0'/0'/0/${19 + VAULT_SKIP + 1}`
      },
      {
        description: "There's a prereservedPath after 10",
        isChange: false,
        usedPaths: ["84'/0'/0'/0/19"],
        skip: VAULT_SKIP,
        prereservedPaths: ["84'/0'/0'/0/29"],
        distantReceivingPath: `84'/0'/0'/0/${19 + VAULT_SKIP + 1}`
      },
      {
        description: "There's a prereservedPath after in our skip target",
        isChange: false,
        usedPaths: ["84'/0'/0'/0/19"],
        skip: VAULT_SKIP,
        prereservedPaths: [`84'/0'/0'/0/${19 + VAULT_SKIP + 1}`],
        distantReceivingPath: `84'/0'/0'/0/${19 + VAULT_SKIP + 2}`
      },
      {
        description:
          "There's a prereservedPath after in our skip target which is the last one so we must reuse",
        isChange: false,
        usedPaths: ["84'/0'/0'/0/19"],
        skip: 19,
        prereservedPaths: [`84'/0'/0'/0/${19 + 19 + 1}`],
        distantReceivingPath: `84'/0'/0'/0/${19 + 19 + 1}`
      },
      {
        description: 'It gets the defaultAccount',
        isChange: false,
        usedPaths: ["49'/0'/0'/0/19", "84'/0'/0'/0/19", "44'/0'/0'/0/19"],
        skip: VAULT_SKIP,
        prereservedPaths: [],
        distantReceivingPath: `84'/0'/0'/0/${19 + VAULT_SKIP + 1}`
      },
      {
        description:
          'It gets the defaultAccount not native seg letting one account to be skipped',
        isChange: false,
        usedPaths: ["49'/0'/1'/0/19", "44'/0'/0'/0/19"],
        skip: VAULT_SKIP,
        gapAccountLimit: 2,
        prereservedPaths: [],
        distantReceivingPath: `49'/0'/1'/0/${19 + VAULT_SKIP + 1}`
      },
      {
        description: 'Skip 0 and prereservedPath',
        isChange: false,
        usedPaths: ["84'/0'/0'/0/0"],
        prereservedPaths: [`84'/0'/0'/0/1`],
        distantReceivingPath: `84'/0'/0'/0/2`
      },
      {
        description: 'Skip 0 and not prereservedPath',
        isChange: false,
        usedPaths: ["84'/0'/0'/0/1"],
        prereservedPaths: [],
        distantReceivingPath: `84'/0'/0'/0/2`
      },
      {
        description: 'Must reuse last prereservedPath',
        isChange: false,
        usedPaths: [],
        skip: 15,
        gapLimit: 20,
        prereservedPaths: [
          `84'/0'/0'/0/${15}`,
          `84'/0'/0'/0/${15 + 1}`,
          `84'/0'/0'/0/${15 + 2}`,
          `84'/0'/0'/0/${15 + 3}`,
          `84'/0'/0'/0/${15 + 4}`
        ],
        distantReceivingPath: `84'/0'/0'/0/${15 + 4}`
      },
      {
        description: 'Must reuse last prereservedPath - reverse order',
        isChange: false,
        usedPaths: [],
        skip: 15,
        gapLimit: 20,
        prereservedPaths: [
          `84'/0'/0'/0/${15 + 4}`,
          `84'/0'/0'/0/${15 + 3}`,
          `84'/0'/0'/0/${15 + 2}`,
          `84'/0'/0'/0/${15 + 1}`,
          `84'/0'/0'/0/${15}`
        ],
        distantReceivingPath: `84'/0'/0'/0/${15 + 4}`
      },
      {
        description: 'Leave rooom for last prereservedPath',
        isChange: false,
        usedPaths: [],
        skip: 15,
        gapLimit: 20,
        prereservedPaths: [
          `84'/0'/0'/0/${15}`,
          `84'/0'/0'/0/${15 + 1}`,
          `84'/0'/0'/0/${15 + 2}`,
          `84'/0'/0'/0/${15 + 3}`
        ],
        distantReceivingPath: `84'/0'/0'/0/${15 + 4}`
      },
      {
        description: 'Leave rooom for last prereservedPath - reverse order',
        isChange: false,
        usedPaths: [],
        skip: 15,
        gapLimit: 20,
        prereservedPaths: [
          `84'/0'/0'/0/${15 + 3}`,
          `84'/0'/0'/0/${15 + 2}`,
          `84'/0'/0'/0/${15 + 1}`,
          `84'/0'/0'/0/${15}`
        ],
        distantReceivingPath: `84'/0'/0'/0/${15 + 4}`
      },
      {
        description:
          'Leave rooom for last prereservedPath - but another account used',
        isChange: false,
        usedPaths: [`84'/0'/4'/0/${19}`],
        gapAccountLimit: 5,
        skip: 15,
        gapLimit: 20,
        prereservedPaths: [
          `84'/0'/0'/0/${15}`,
          `84'/0'/0'/0/${15 + 1}`,
          `84'/0'/0'/0/${15 + 2}`,
          `84'/0'/0'/0/${15 + 3}`
        ],
        distantReceivingPath: `84'/0'/4'/0/${34 + 1}`
      },
      {
        description: 'Change address determines default account',
        isChange: false,
        usedPaths: [`84'/0'/4'/1/${19}`, `44'/0'/0'/0/${19}`],
        gapAccountLimit: 5,
        skip: 15,
        gapLimit: 20,
        prereservedPaths: [],
        distantReceivingPath: `84'/0'/4'/0/${15}`
      },
      {
        description: 'Wrong network on prereservedPaths is possible',
        isChange: false,
        usedPaths: ["44'/0'/1'/1/0"],
        gapAccountLimit: 2,
        prereservedPaths: ["44'/1'/1'/1/0"],
        distantReceivingPath: `44'/0'/1'/0/0`
      },
      {
        description: 'Isolated integration test that was giving bad paths',
        isChange: false,
        usedPaths: [
          "44'/1'/0'/0/0",
          "44'/1'/0'/0/3",
          "49'/1'/0'/1/1",
          "84'/1'/0'/0/5",
          "84'/1'/1'/0/8"
        ],
        skip: 15,
        gapLimit: 20,
        network: networks.regtest,
        prereservedPaths: ["84'/1'/1'/0/25", "84'/1'/1'/0/24"],
        distantReceivingPath: "84'/1'/1'/0/26"
      },
      {
        description: 'It works with decreasing order',
        isChange: false,
        usedPaths: ["84'/1'/0'/0/5", "84'/1'/1'/0/8"],
        skip: 15,
        gapLimit: 20,
        network: networks.regtest,
        prereservedPaths: ["84'/1'/1'/0/25", "84'/1'/1'/0/24"],
        distantReceivingPath: "84'/1'/1'/0/26"
      },
      {
        description: 'Duplicated paths and all prereserved to the end',
        usedPaths: [
          "44'/1'/0'/0/0",
          "44'/1'/0'/0/3",
          "49'/1'/0'/1/1",
          "84'/1'/0'/0/5",
          "84'/1'/1'/0/8"
        ],
        network: networks.regtest,
        skip: VAULT_SKIP, //15
        isChange: false,
        prereservedPaths: [
          "84'/1'/1'/0/25",
          "84'/1'/1'/0/24",
          "84'/1'/1'/0/26",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/28",
          "84'/1'/1'/0/28",
          "84'/1'/1'/0/28",
          "84'/1'/1'/0/28",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/9",
          "84'/1'/1'/0/10",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27"
        ],
        distantReceivingPath: "84'/1'/1'/0/28"
      },
      {
        description:
          'Duplicated paths and all prereserved to the end and one additional prereserved out of the gap limit',
        usedPaths: [
          "44'/1'/0'/0/0",
          "44'/1'/0'/0/3",
          "49'/1'/0'/1/1",
          "84'/1'/0'/0/5",
          "84'/1'/1'/0/8"
        ],
        network: networks.regtest,
        skip: VAULT_SKIP, //15
        isChange: false,
        prereservedPaths: [
          "84'/1'/1'/0/25",
          "84'/1'/1'/0/24",
          "84'/1'/1'/0/26",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/28",
          "84'/1'/1'/0/28",
          "84'/1'/1'/0/28",
          "84'/1'/1'/0/28",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/9",
          "84'/1'/1'/0/10",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/27",
          "84'/1'/1'/0/29"
        ],
        distantReceivingPath: "84'/1'/1'/0/28"
      }
    ]
  }
};
