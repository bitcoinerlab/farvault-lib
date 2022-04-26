import {
  checkAccount,
  checkAccountType,
  checkNetwork,
  checkPurpose,
  checkFeeEstimates
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
  //test('checkAccount', () => {
  //  expect(() => checkAccount()).toThrow();
  //  expect(() =>
  //    checkAccount({ accountNumber: 0, accountType: P2WPKH })
  //  ).toThrow();
  //  expect(() =>
  //    checkAccount({
  //      accountNumber: 2.1,
  //      accountType: P2WPKH,
  //      network: networks.bitcoin
  //    })
  //  ).toThrow();
  //  expect(() =>
  //    checkAccount({
  //      accountNumber: -1,
  //      accountType: P2WPKH,
  //      network: networks.bitcoin
  //    })
  //  ).toThrow();
  //  expect(
  //    checkAccount({
  //      accountNumber: 0,
  //      accountType: P2WPKH,
  //      network: networks.bitcoin
  //    })
  //  ).toEqual(true);
  //});
  //test('checkAccountType', () => {
  //  [P2PKH, P2WPKH, P2SH_P2WPKH].map(accountType =>
  //    expect(checkAccountType(accountType)).toEqual(true)
  //  );
  //  expect(() => checkAccountType()).toThrow('Invalid account type!');
  //  expect(() => checkAccountType('P2SH')).toThrow('Invalid account type!');
  //});

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
});
