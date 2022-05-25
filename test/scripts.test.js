//import { describe, it, expect } from 'jest';

import {
  createRelativeTimeLockScript,
  parseRelativeTimeLockScript,
  exportedForTesting
} from '../src/scripts';
const { numberEncodeAsm, scriptNumberDecode } = exportedForTesting;

import { initHDInterface, SOFT_HD_INTERFACE } from '../src/HDInterface';

import { fixtures } from './fixtures/scripts';

describe('createRelativeTimeLockScript', () => {
  for (const { description, script, ...params } of fixtures
    .createRelativeTimeLockScript.valid) {
    test(description, () => {
      expect(createRelativeTimeLockScript(params)).toEqual(script);
    });
  }

  for (const { description, errorMessage, ...params } of fixtures
    .createRelativeTimeLockScript.invalid) {
    test(description, () => {
      expect(() => createRelativeTimeLockScript(params)).toThrow(errorMessage);
    });
  }
});

describe('numberEncodeAsm', () => {
  for (const { description, encoded, number } of fixtures.numberEncodeAsm
    .valid) {
    test(description, () => {
      expect(parseInt(numberEncodeAsm(number), 16)).toEqual(
        parseInt(encoded, 16)
      );
    });
  }
  for (const { description, errorMessage, number } of fixtures.numberEncodeAsm
    .invalid) {
    test(description, () => {
      expect(() => numberEncodeAsm(number)).toThrow(errorMessage);
    });
  }
});

describe('scriptNumberDecode', () => {
  for (const { description, decompiled, number } of fixtures.scriptNumberDecode
    .valid) {
    test(description, () => {
      expect(scriptNumberDecode(decompiled)).toEqual(number);
    });
  }
  for (const { description, errorMessage, decompiled } of fixtures
    .scriptNumberDecode.invalid) {
    test(description, () => {
      expect(() => scriptNumberDecode(decompiled)).toThrow(errorMessage);
    });
  }
});

describe('parseRelativeTimeLockScript', () => {
  for (const { description, script, returns } of fixtures
    .parseRelativeTimeLockScript.valid) {
    test(description, () => {
      expect(parseRelativeTimeLockScript(script)).toEqual(returns);
    });
  }
  for (const { description, script, errorMessage } of fixtures
    .parseRelativeTimeLockScript.invalid) {
    test(description, () => {
      expect(() => parseRelativeTimeLockScript(script)).toThrow(errorMessage);
    });
  }
});
