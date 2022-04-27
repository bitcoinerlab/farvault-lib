import { fixtures } from './fixtures/wallet';
import { initHDInterface, SOFT_HD_INTERFACE } from '../src/HDInterface';
import { getDerivationPathAddress } from '../src/wallet';

describe('wallet', () => {
  test('getDerivationPathAddress', async () => {
    const HDInterface = await initHDInterface(SOFT_HD_INTERFACE, {
      mnemonic: fixtures.mnemonic
    });
    for (const address of fixtures.addresses) {
      if (address.test) {
        expect(
          await getDerivationPathAddress({
            HDInterface,
            derivationPath: address.test.derivationPath,
            network: fixtures.network
          })
        ).toEqual(address.test.address);
      }
    }
  });
});
