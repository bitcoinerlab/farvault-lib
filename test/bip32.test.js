import { parseDerivationPath } from '../src/bip32';
import { fixtures } from './fixtures/bip32';

describe('bip32', () => {
  test('parseDerivationPath parses paths correctly', () => {
    fixtures.derivationPaths.valid.map(derivationPath =>
      expect(() => parseDerivationPath(derivationPath)).not.toThrow()
    );

    expect(parseDerivationPath("44'/1'/0'/0/0")).toEqual({
      purpose: 44,
      coinType: 1,
      accountNumber: 0,
      index: 0,
      isChange: false
    });
  });
});
