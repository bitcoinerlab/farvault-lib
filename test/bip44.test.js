import { GAP_LIMIT, GAP_ACCOUNT_LIMIT, NATIVE_SEGWIT } from '../src/constants';
import {
  parseDerivationPath,
  serializeDerivationPath,
  getDerivationPathAddress
} from '../src/bip44';
import { fixtures } from './fixtures/bip44';
import { getNextDerivationPath, exportedForTesting } from '../src/bip44/chain';
import { SoftHDSigner } from '../src/HDSigner/soft';
import { networks } from '../src/networks';

describe('bip32', () => {
  test('getDerivationPathAddress', async () => {
    for (const {
      address,
      path,
      extPub,
      network,
      mnemonic
    } of fixtures.addressDescriptors) {
      const HDSigner = new SoftHDSigner({ mnemonic });
      await HDSigner.init();
      expect(
        await getDerivationPathAddress({
          extPubGetter: async params => HDSigner.getExtPub(params),
          path,
          network
        })
      ).toEqual(address);
    }
  });

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

describe('bip44/chain getNextDerivationPath', () => {
  for (const valid of fixtures.getNextDerivationPath.valid) {
    test(`getNextDerivationPath ${valid.description}`, () => {
      expect(getNextDerivationPath({ ...valid })).toEqual(
        valid.distantReceivingPath
      );
    });
  }
  for (const invalid of fixtures.getNextDerivationPath.invalid) {
    test(`getNextDerivationPath ${invalid.description}`, () => {
      expect(() => getNextDerivationPath({ ...invalid })).toThrow(
        typeof invalid.errorMessage !== 'undefined'
          ? invalid.errorMessage
          : 'errorMessage not set'
      );
    });
  }
});

describe('bip44/chain private methods', () => {
  let i = 0;
  for (const {
    addressDescriptors,
    isChange,
    accountNumber,
    purpose,
    lastDerivationPath,
    network,
    mnemonic,
    gapAccountLimit
  } of fixtures.affineAddressesDescriptors.valid) {
    test(`getLastDerivationPath works - test ${i}`, () => {
      const usedPaths = [];
      for (const addressDescriptor of addressDescriptors) {
        usedPaths.push(addressDescriptor.path);
      }
      expect(lastDerivationPath).toEqual(
        exportedForTesting.getLastDerivationPath({
          usedPaths,
          isChange,
          network,
          purpose,
          accountNumber,
          gapAccountLimit
        })
      );
    });
    i++;
  }
  i = 0;
  for (const {
    addressDescriptors,
    isChange,
    accountNumber,
    purpose,
    network,
    mnemonic,
    gapAccountLimit,
    errorMessage
  } of fixtures.affineAddressesDescriptors.invalid) {
    test(`getLastDerivationPath fails - test ${i}`, () => {
      const usedPaths = [];
      for (const addressDescriptor of addressDescriptors) {
        usedPaths.push(addressDescriptor.path);
      }
      expect(() =>
        exportedForTesting.getLastDerivationPath({
          usedPaths,
          isChange,
          network,
          purpose,
          accountNumber,
          gapAccountLimit
        })
      ).toThrow(errorMessage);
    });
    i++;
  }
  test('getDefaultAccount', () => {
    for (const {
      addressDescriptors,
      defaultAccount,
      gapAccountLimit
    } of fixtures.affineAddressesDescriptors.valid) {
      const usedPaths = [];
      for (const addressDescriptor of addressDescriptors) {
        usedPaths.push(addressDescriptor.path);
      }
      expect(
        exportedForTesting.getDefaultAccount({ usedPaths, gapAccountLimit })
      ).toEqual(defaultAccount);
    }
  });
  test('Get next receiving derivation path works', () => {
    expect(
      getNextDerivationPath({
        usedPaths: [],
        purpose: NATIVE_SEGWIT,
        accountNumber: 0,
        isChange: false,
        network: networks.regtest
      })
    ).toEqual("84'/1'/0'/0/0");

    expect(
      getNextDerivationPath({
        isChange: false,
        usedPaths: [],
        network: networks.regtest
      })
    ).toEqual("84'/1'/0'/0/0");
  });
  for (const valid of fixtures.normalizeDerivationPaths.valid) {
    test(`normalizeDerivationPaths ${valid.description}`, () => {
      expect(
        exportedForTesting
          .normalizeDerivationPaths({
            gapAccountLimit:
              typeof valid.gapAccountLimit !== 'undefined'
                ? valid.gapAccountLimit
                : GAP_ACCOUNT_LIMIT,
            gapLimit:
              typeof valid.gapLimit !== 'undefined'
                ? valid.gapLimit
                : GAP_LIMIT,
            usedPaths: valid.usedPaths
          })
          .map(p => serializeDerivationPath(p))
      ).toEqual(valid.usedParsedPaths.map(p => serializeDerivationPath(p)));
    });
  }
  for (const invalid of fixtures.normalizeDerivationPaths.invalid) {
    test(`Invalid normalizeDerivationPaths ${invalid.description}`, () => {
      expect(() =>
        exportedForTesting.normalizeDerivationPaths({
          gapAccountLimit:
            typeof invalid.gapAccountLimit !== 'undefined'
              ? invalid.gapAccountLimit
              : GAP_ACCOUNT_LIMIT,
          gapLimit:
            typeof invalid.gapLimit !== 'undefined'
              ? invalid.gapLimit
              : GAP_LIMIT,
          usedPaths: invalid.usedPaths
        })
      ).toThrow(
        typeof invalid.errorMessage !== 'undefined'
          ? invalid.errorMessage
          : 'errorMessage not set'
      );
    });
  }
});
