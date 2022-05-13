import { parseDerivationPath } from '../src/bip32';
import { fixtures } from './fixtures/bip32';

describe('bip32', () => {
  test('parseDerivationPath parses paths correctly', () => {
    fixtures.paths.valid.map(path =>
      expect(() => parseDerivationPath(path)).not.toThrow()
    );

    expect(parseDerivationPath("44'/1'/0'/0/0")).toEqual({
      purpose: 44,
      coinType: 1,
      accountNumber: 0,
      index: 0,
      isChange: false
    });
    expect(parseDerivationPath("44'/1'/10'/1/2")).toEqual({
      purpose: 44,
      coinType: 1,
      accountNumber: 10,
      index: 2,
      isChange: true
    });
    //Non hardened accountNumber
    expect(() => parseDerivationPath("44'/1'/10/1/2")).toThrow();
    //Non hardened coinType
    expect(() => parseDerivationPath("44'/1/10'/1/2")).toThrow();
    //Non hardened purpose
    expect(() => parseDerivationPath("44/1'/10'/1/2")).toThrow();
    //4 levels only
    expect(() => parseDerivationPath("44'/1'/10'/1")).toThrow();
    //hardened isChange
    expect(() => parseDerivationPath("44'/1'/10'/1'/2")).toThrow();
    //hardened index
    expect(() => parseDerivationPath("44'/1'/10'/1/2'")).toThrow();
  });
});
