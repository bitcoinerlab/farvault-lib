import {
  checkAccount,
  checkNetwork,
  checkPurpose,
  checkFeeEstimates,
  checkExtPub
} from '../src/check';
import { LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT } from '../src/walletConstants';
import { networks } from 'bitcoinjs-lib';
//import { P2PKH, P2WPKH, P2SH_P2WPKH } from '../src/accounts';
describe('data check', () => {
  test('checkNetwork', () => {
    expect(() => checkNetwork(networks.bitcoin)).not.toThrow();
    expect(() => checkNetwork(networks.testnet)).not.toThrow();
    expect(() => checkNetwork(networks.regtest)).not.toThrow();
    expect(() => checkNetwork()).toThrow(
      'Network must be mainnet, testnet or regtest'
    );
    expect(() => checkNetwork(23)).toThrow(
      'Network must be mainnet, testnet or regtest'
    );

    expect(() => checkNetwork(networks.bitcoin, false)).not.toThrow();
    expect(() => checkNetwork(networks.testnet, false)).not.toThrow();
    expect(() => checkNetwork(networks.regtest, false)).toThrow(
      'Network must be mainnet or testnet'
    );
    expect(() => checkNetwork()).toThrow(
      'Network must be mainnet, testnet or regtest'
    );
    expect(() => checkNetwork(23, false)).toThrow(
      'Network must be mainnet or testnet'
    );
  });
  test('checkPurpose fails', () => {
    expect(() => checkPurpose()).toThrow('Invalid purpose!');
    expect(() => checkPurpose('legacy')).toThrow('Invalid purpose!');
  });
  test('checkPurpose passes', () => {
    expect(checkPurpose(LEGACY)).toEqual(true);
    expect(checkPurpose(NESTED_SEGWIT)).toEqual(true);
    expect(checkPurpose(NATIVE_SEGWIT)).toEqual(true);
  });

  test('checkFeeEstimates', () => {
    expect(() => checkFeeEstimates('hello world')).toThrow(
      'Invalid esplora fee estimates!'
    );
    expect(() => checkFeeEstimates({ hello: 'world' })).toThrow(
      'Invalid esplora fee estimates!'
    );
    expect(() => checkFeeEstimates({ a: 123 })).toThrow(
      'Invalid esplora fee estimates!'
    );
    expect(() => checkFeeEstimates({ 12: 'a' })).toThrow(
      'Invalid esplora fee estimates!'
    );
    expect(() => checkFeeEstimates({ 12: 'a' })).toThrow(
      'Invalid esplora fee estimates!'
    );
    expect(() => checkFeeEstimates({ 12: 0 })).not.toThrow(
      'Invalid esplora fee estimates!'
    );
    expect(() => checkFeeEstimates({ 12: -1 })).toThrow(
      'Invalid esplora fee estimates!'
    );
    expect(
      checkFeeEstimates({
        1: 87.882,
        2: 87.882,
        3: 87.882,
        4: 87.882,
        5: 81.129,
        6: 68.285,
        144: 1.027,
        504: 1.027,
        1008: 1.027
      })
    ).toEqual(true);
  });

  test('checkExtPub', () => {
    expect(() => checkExtPub()).toThrow();
    for (const pair of [
      {
        extPub:
          'xpub6D4BDPcP2GT577Vvch3R8wDkScZWzQzMMUm3PWbmWvVJrZwQY4VUNgqFJPMM3No2dFDFGTsxxpG5uJh7n7epu4trkrX7x7DogT5Uv6fcLW5',
        network: networks.bitcoin
      },
      {
        extPub:
          'vpub5ZF1UXDLjTvu8ChdRQ6TLSLBae2WieUzbVBcgkrwQ9VAgAxGw2PZgzsdFZsafGStDyWmp5ViTJhm7TYwLzsh7MhCtPhvKMcd1FVmv8zvSev',
        network: networks.regtest
      }
    ]) {
      expect(() => checkExtPub(pair)).not.toThrow();
    }
  });
});
