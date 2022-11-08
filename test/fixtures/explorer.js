import {
  LEGACY,
  NATIVE_SEGWIT,
  NESTED_SEGWIT,
  ESPLORA_LOCAL_REGTEST_URL,
  ELECTRUM_LOCAL_REGTEST_HOST,
  ELECTRUM_LOCAL_REGTEST_PORT,
  ELECTRUM_LOCAL_REGTEST_PROTOCOL
} from '../../src/constants';
import { networks } from '../../src/networks';

export const ESPLORA = 'ESPLORA';
export const ELECTRUM = 'ELECTRUM';

//Use a tool such as: https://iancoleman.io/bip39/
export const fixtures = {
  local: {
    mnemonic:
      'caution help average spoil brain enforce balcony siege volcano snap child ugly',
    network: networks.regtest,
    servers: [
      {
        service: ELECTRUM,
        host: ELECTRUM_LOCAL_REGTEST_HOST,
        port: ELECTRUM_LOCAL_REGTEST_PORT,
        protocol: ELECTRUM_LOCAL_REGTEST_PROTOCOL,
        network: networks.regtest
      },
      {
        service: ESPLORA,
        url: ESPLORA_LOCAL_REGTEST_URL
      }
    ],
    unusedAddress: '2N4HNDu7u2WV2XXbMV2e38RjUAiosbeKwBH',
    burnAddress: '2N5vEX6xsMhxDLPa8GGXJHnYVh2BwTtvq8V',
    fundingDescriptors: [
      {
        purpose: LEGACY,
        accountNumber: 0,
        index: 0,
        isChange: false,
        //2 BTC
        value: 200000000,
        address: 'mkMjHzQCpx1xcvRuJ86vSePM31wbMXoHQA'
      },
      {
        purpose: LEGACY,
        accountNumber: 0,
        index: 3,
        isChange: false,
        //1 BTC
        value: 100000000,
        address: 'mg8qpQbxkko9aAgMFCZTNk8zyxBRdUfy3o'
      },
      {
        purpose: NATIVE_SEGWIT,
        accountNumber: 0,
        index: 5,
        isChange: false,
        //0.2 BTC
        value: 20000000,
        address: 'bcrt1qprtxrmghxjsytqpurwspnes87l8xgnznz3t4zw'
      },
      {
        purpose: NATIVE_SEGWIT,
        accountNumber: 1,
        index: 8,
        isChange: false,
        //0.9 BTC
        value: 90000000,
        address: 'bcrt1qptap2w5x9lztclzqk8p2wmkvq08nnpt5d3zfgn'
      },
      {
        purpose: NESTED_SEGWIT,
        accountNumber: 0,
        index: 1,
        isChange: true,
        //0.8 BTC
        value: 80000000,
        address: '2N3wTSwsNSYAUB6r97bw3EN3WzwWHuAbi4G'
      }
    ]
  },
  public: {
    mnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    network: networks.bitcoin,
    servers: [
      {
        service: ELECTRUM,
        host: 'electrum.bitaroo.net',
        port: 50002,
        protocol: 'ssl'
      },
      {
        service: ELECTRUM,
        host: 'electrum3.bluewallet.io',
        port: 50001,
        protocol: 'tcp'
      },
      {
        service: ELECTRUM,
        host: 'electrum2.bluewallet.io',
        port: 443,
        protocol: 'ssl'
      },
      {
        //will default to blockstream electrum
        service: ELECTRUM
      }
    ]
    //if (server.network !== networks.regtest) {
    //  test('fetchFeeEstimates', async () => {
    //    await explorer.fetchFeeEstimates();
    //  }, 10000);
    //}
  }
};
