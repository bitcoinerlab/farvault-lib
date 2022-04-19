//import { describe, it, expect } from 'jest';

import { exportedForTesting } from '../src/payments';

import { initHDInterface, SOFT_HD_INTERFACE } from '../src/HDInterface';

import { fixtures } from './fixtures/payments';


describe('Payments', () => {
  const {
    hotPublicKey,
    rescuedPublicKey,
    lockTime
  } = fixtures.createRelativeTimeLockScript.inputData;
  test('createRelativeTimeLockScript with invalid hotPublicKey', () => {
    expect(() =>
      exportedForTesting.createRelativeTimeLockScript(
        234324,
        rescuedPublicKey,
        lockTime
      )
    ).toThrow('Invalid hotPublicKey');
  });

  test('createRelativeTimeLockScript with invalid rescuedPublicKey', () => {
    expect(() =>
      exportedForTesting.createRelativeTimeLockScript(
        hotPublicKey,
        Buffer.from('ab', 'hex'),
        lockTime
      )
    ).toThrow('Invalid rescuedPublicKey');
  });

  test('createRelativeTimeLockScript with invalid lockTime', () => {
    expect(() =>
      exportedForTesting.createRelativeTimeLockScript(
        hotPublicKey,
        rescuedPublicKey,
        null
      )
    ).toThrow('Invalid lockTime');
  });
});
