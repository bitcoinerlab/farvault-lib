import { checkNetwork, checkFeeEstimates } from '../src/check';
import { networks } from 'bitcoinjs-lib';
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
});
