import { fixtures } from './fixtures/wallet';
import { initHDInterface, SOFT_HD_INTERFACE } from '../src/HDInterface';
import {
  getDerivationPathAddress,
  getNextExplicitDerivationPath,
  getDefaultAccount
} from '../src/wallet';
import { LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT } from '../src/walletConstants';

describe('wallet', () => {
  test('getDerivationPathAddress', async () => {
    for (const {
      address,
      derivationPath,
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
          derivationPath,
          network
        })
      ).toEqual(address);
    }
  });
  test('getNextExplicitDerivationPath works', async () => {
    for (const {
      addressesDescriptors,
      isChange,
      accountNumber,
      purpose,
      nextDerivationPath,
      network,
      mnemonic
    } of fixtures.affinedAddressesDescriptors.valid) {
      const derivationPaths = [];
      for (const addressDescriptor of addressesDescriptors) {
        derivationPaths.push(addressDescriptor.derivationPath);
      }
      expect(nextDerivationPath).toEqual(
        getNextExplicitDerivationPath({
          derivationPaths,
          isChange,
          network,
          purpose,
          accountNumber
        })
      );
    }
  });
  test('getNextExplicitDerivationPath fails', async () => {
    for (const {
      addressesDescriptors,
      isChange,
      accountNumber,
      purpose,
      nextDerivationPath,
      network,
      mnemonic,
      errorMessage
    } of fixtures.affinedAddressesDescriptors.invalid) {
      const derivationPaths = [];
      for (const addressDescriptor of addressesDescriptors) {
        derivationPaths.push(addressDescriptor.derivationPath);
      }
      expect(() =>
        getNextExplicitDerivationPath({
          derivationPaths,
          isChange,
          network,
          purpose,
          accountNumber
        })
      ).toThrow(errorMessage);
    }
  });
  test('getDefaultAccount', () => {
    for (const { addressesDescriptors, defaultAccount } of fixtures
      .affinedAddressesDescriptors.valid) {
      const derivationPaths = [];
      for (const addressDescriptor of addressesDescriptors) {
        derivationPaths.push(addressDescriptor.derivationPath);
      }
      expect(getDefaultAccount(derivationPaths)).toEqual(defaultAccount);
    }
  });
});
