import { validateNetwork } from '../src/validation';
import { networks } from 'bitcoinjs-lib';
describe('data validation', () => {
  test('validateNetwork', () => {
    expect(() => validateNetwork(networks.bitcoin)).not.toThrow();
    expect(() => validateNetwork(networks.testnet)).not.toThrow();
    expect(() => validateNetwork(networks.regtest)).not.toThrow();
    expect(() => validateNetwork()).toThrow(
      'Network must be mainnet, testnet or regtest'
    );
    expect(() => validateNetwork(23)).toThrow('Network must be mainnet, testnet or regtest');

    expect(() => validateNetwork(networks.bitcoin, false)).not.toThrow();
    expect(() => validateNetwork(networks.testnet, false)).not.toThrow();
    expect(() => validateNetwork(networks.regtest, false)).toThrow('Network must be mainnet or testnet');
    expect(() => validateNetwork()).toThrow(
      'Network must be mainnet, testnet or regtest'
    );
    expect(() => validateNetwork(23, false)).toThrow('Network must be mainnet or testnet');
  });
});
