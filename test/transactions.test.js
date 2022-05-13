//import { describe, it, expect } from 'jest';

import { createRelativeTimeLockScript } from '../src/transactions';

import { initHDInterface, SOFT_HD_INTERFACE } from '../src/HDInterface';

import { fixtures } from './fixtures/transactions';

describe('Transactions', () => {
  const {
    maturedPublicKey,
    rushedPublicKey,
    encodedLockTime
  } = fixtures.createRelativeTimeLockScript.inputData;
  test('createRelativeTimeLockScript with invalid maturedPublicKey', () => {
    expect(() =>
      createRelativeTimeLockScript({
        encodedLockTime: 234324,
        rushedPublicKey,
        encodedLockTime
      })
    ).toThrow('Invalid maturedPublicKey');
  });

  test('createRelativeTimeLockScript with invalid rushedPublicKey', () => {
    expect(() =>
      createRelativeTimeLockScript({
        maturedPublicKey,
        rushedPublicKey: Buffer.from('ab', 'hex'),
        encodedLockTime
      })
    ).toThrow('Invalid rushedPublicKey');
  });

  test('createRelativeTimeLockScript with invalid encodedLockTime', () => {
    expect(() =>
      createRelativeTimeLockScript({
        maturedPublicKey,
        rushedPublicKey,
        encodedLockTime: null
      })
    ).toThrow('Invalid encodedLockTime');
  });
});
