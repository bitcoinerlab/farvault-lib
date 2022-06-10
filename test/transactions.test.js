import { fixtures } from './fixtures/transactions';
const { network, mnemonic } = fixtures;
import {
  initHDInterface,
  LEDGER_NANO_INTERFACE,
  SOFT_HD_INTERFACE,
  NODEJS_TRANSPORT
} from '../src/HDInterface';

import { createTransaction } from '../src/transactions';

for (const type of process.env.__LEDGER_NANO_DETECTED__ === 'true' //Note process.env stringifies stuff
  ? [LEDGER_NANO_INTERFACE, SOFT_HD_INTERFACE]
  : [SOFT_HD_INTERFACE]) {
  describe(`Transactions on ${type}`, () => {
    let HDInterface;
    beforeAll(async () => {
      HDInterface = await initHDInterface(type, {
        transport: NODEJS_TRANSPORT,
        mnemonic
      });
    }, 100 * 1000 /*increase the default timeout time*/);
    for (const { description, utxos, targets, tx } of fixtures.createTransaction
      .valid) {
      test(
        description,
        async () => {
          const _tx = await createTransaction({
            utxos,
            targets,
            createSigners: HDInterface.createSigners,
            getPublicKey: HDInterface.getPublicKey,
            network
          });

          expect(tx).toBe(_tx);
        },
        100 * 1000
      );
    }
  });
}
