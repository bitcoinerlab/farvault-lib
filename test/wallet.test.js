import { fixtures } from './fixtures/wallet';
import { initHDInterface, SOFT_HD_INTERFACE } from '../src/HDInterface';
import {
  getDerivationPathAddress,
  getNextDerivationPath,
  exportedForTesting
} from '../src/wallet';
import {
  LEGACY,
  NESTED_SEGWIT,
  NATIVE_SEGWIT,
  GAP_LIMIT,
  GAP_ACCOUNT_LIMIT,
  VAULT_SKIP
} from '../src/walletConstants';
import { serializeDerivationPath } from '../src/bip32';
import { networks } from 'bitcoinjs-lib';

describe('wallet', () => {
  test('getDerivationPathAddress', async () => {
    for (const {
      address,
      path,
      extPub,
      network,
      mnemonic
    } of fixtures.addressDescriptors) {
      const HDInterface = await initHDInterface(SOFT_HD_INTERFACE, {
        mnemonic
      });
      expect(
        await getDerivationPathAddress({
          extPubGetter: async params => HDInterface.getExtPub(params),
          path,
          network
        })
      ).toEqual(address);
    }
  });
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
});
describe('normalizeDerivationPaths', () => {
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

describe('getNextDerivationPath', () => {
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
