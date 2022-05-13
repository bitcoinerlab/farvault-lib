import { fixtures } from './fixtures/wallet';
import { initHDInterface, SOFT_HD_INTERFACE } from '../src/HDInterface';
import {
  getDerivationPathAddress,
  getNextExplicitDerivationPath,
  getDefaultAccount,
  getNextReceivingDerivationPath
} from '../src/wallet';
import { LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT } from '../src/walletConstants';
import { networks } from 'bitcoinjs-lib';

describe('wallet', () => {
  test('getDerivationPathAddress', async () => {
    for (const {
      address,
      path,
      extPub,
      network,
      mnemonic
    } of fixtures.addressesDescriptors) {
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
    addressesDescriptors,
    isChange,
    accountNumber,
    purpose,
    nextDerivationPath,
    network,
    mnemonic,
    gapAccountLimit
  } of fixtures.affinedAddressesDescriptors.valid) {
    test(`getNextExplicitDerivationPath works - test ${i}`, () => {
      const usedPaths = [];
      for (const addressDescriptor of addressesDescriptors) {
        usedPaths.push(addressDescriptor.path);
      }
      expect(nextDerivationPath).toEqual(
        getNextExplicitDerivationPath({
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
    addressesDescriptors,
    isChange,
    accountNumber,
    purpose,
    nextDerivationPath,
    network,
    mnemonic,
    gapAccountLimit,
    errorMessage
  } of fixtures.affinedAddressesDescriptors.invalid) {
    test(`getNextExplicitDerivationPath fails - test ${i}`, () => {
      const usedPaths = [];
      for (const addressDescriptor of addressesDescriptors) {
        usedPaths.push(addressDescriptor.path);
      }
      expect(() =>
        getNextExplicitDerivationPath({
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
      addressesDescriptors,
      defaultAccount,
      gapAccountLimit
    } of fixtures.affinedAddressesDescriptors.valid) {
      const usedPaths = [];
      for (const addressDescriptor of addressesDescriptors) {
        usedPaths.push(addressDescriptor.path);
      }
      expect(getDefaultAccount({ usedPaths, gapAccountLimit })).toEqual(
        defaultAccount
      );
    }
  });
  test('getNextReceivingDerivationPath works', () => {
    expect(
      getNextExplicitDerivationPath({
        usedPaths: [],
        purpose: NATIVE_SEGWIT,
        accountNumber: 0,
        isChange: false,
        network: networks.regtest
      })
    ).toEqual("84'/1'/0'/0/0");

    expect(
      getNextReceivingDerivationPath({
        usedPaths: [],
        network: networks.regtest
      })
    ).toEqual("84'/1'/0'/0/0");
  });
});
