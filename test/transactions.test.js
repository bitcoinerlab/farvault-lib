import { fixtures } from './fixtures/transactions';
const { network, mnemonic } = fixtures;
import {
  initHDInterface,
  LEDGER_NANO_INTERFACE,
  SOFT_HD_INTERFACE,
  NODEJS_TRANSPORT
} from '../src/HDInterface';

import {
  createTransaction,
  createMultiFeeTransactions
} from '../src/transactions';

import { decodeTx } from '../src/decodeTx';

let ledgerHDInterface, softHDInterface;
beforeAll(async () => {
  if (process.env.__LEDGER_NANO_DETECTED__ === 'true') {
    ledgerHDInterface = await initHDInterface(LEDGER_NANO_INTERFACE, {
      transport: NODEJS_TRANSPORT,
      mnemonic
    });
  }
  softHDInterface = await initHDInterface(SOFT_HD_INTERFACE, {
    mnemonic
  });
}, 100 * 1000 /*increase the default timeout time*/);
afterAll(async () => {
  if (process.env.__LEDGER_NANO_DETECTED__ === 'true') {
    await ledgerHDInterface.close();
  }
  softHDInterface = await initHDInterface(SOFT_HD_INTERFACE, {
    mnemonic
  });
});

for (const type of process.env.__LEDGER_NANO_DETECTED__ === 'true' //Note process.env stringifies stuff
  ? [LEDGER_NANO_INTERFACE, SOFT_HD_INTERFACE]
  : [SOFT_HD_INTERFACE]) {
  describe(`Transactions on ${type}`, () => {
    for (const { description, utxos, targets, tx } of fixtures.createTransaction
      .valid) {
      test(
        description,
        async () => {
          const HDInterface =
            type === LEDGER_NANO_INTERFACE
              ? ledgerHDInterface
              : softHDInterface;
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

  describe(`Transactions with invalid HDInterface data on ${type}`, () => {
    //Just do it once for valid[0]
    if (fixtures.createTransaction.valid.length > 0) {
      const { description, utxos, targets, tx } =
        fixtures.createTransaction.valid[0];
      test(
        'Inject bad signature to: ' + description,
        async () => {
          const HDInterface =
            type === LEDGER_NANO_INTERFACE
              ? ledgerHDInterface
              : softHDInterface;
          const createInvalidSigners = async ({ psbt, utxos, network }) => {
            const signers = await HDInterface.createSigners({
              psbt,
              utxos,
              network
            });
            return signers.map(
              signer => () =>
                Buffer.from(
                  'b04bf6930029a0c748b65e2337a1c26721be772f64cd92cb0ff939d4ca5d3e1b662c2825a6b1b4a7c045369b3c27e5119a7d4b60f758b581f7dd8e3df5f47d9f',
                  'hex'
                )
            );
          };
          await expect(
            createTransaction({
              utxos,
              targets,
              createSigners: createInvalidSigners,
              getPublicKey: HDInterface.getPublicKey,
              network
            })
          ).rejects.toThrow('Invalid signature detected');
        },
        100 * 1000
      );

      test(
        'Inject bad pubkey to: ' + description,
        async () => {
          const HDInterface =
            type === LEDGER_NANO_INTERFACE
              ? ledgerHDInterface
              : softHDInterface;
          const getInvalidPublicKey = (path, network) => {
            return Buffer.from(
              '02783c942ac07f03a4c378ff6bd2cf8c99efc18bd1ae3cd37e6cd1ceca518bae2b',
              'hex'
            );
            //const pubKey = HDInterface.getPublicKey(path, network);
            //return pubKey;
          };
          await expect(
            createTransaction({
              utxos,
              targets,
              createSigners: HDInterface.createSigners,
              getPublicKey: getInvalidPublicKey,
              network
            })
          ).rejects.toThrow(
            'Can not sign for this input with the key 02783c942ac07f03a4c378ff6bd2cf8c99efc18bd1ae3cd37e6cd1ceca518bae2b'
          );
        },
        100 * 1000
      );
    }
  });

  describe(`Invalid transactions on ${type}`, () => {
    for (const { description, utxos, targets, exception } of fixtures
      .createTransaction.invalid) {
      test(
        description,
        async () => {
          const HDInterface =
            type === LEDGER_NANO_INTERFACE
              ? ledgerHDInterface
              : softHDInterface;
          expect(
            createTransaction({
              utxos,
              targets,
              createSigners: HDInterface.createSigners,
              getPublicKey: HDInterface.getPublicKey,
              network
            })
          ).rejects.toThrow(exception);
        },
        100 * 1000
      );
    }
  });

  //Only test it using soft device. Otherwise this would be hell on a ledget nano
  if (type === SOFT_HD_INTERFACE)
    describe(`Multifee transactions with invalid HDInterface data on ${type}`, () => {
      //Just do it once for valid[0]
      if (fixtures.createTransaction.valid.length > 0) {
        const { description, utxos, targets, tx } =
          fixtures.createTransaction.valid[0];
        test(
          'Multi-fee version of: ' + description,
          async () => {
            const HDInterface = softHDInterface;
            const txs = await createMultiFeeTransactions({
              utxos,
              address: targets[0].address,
              createSigners: HDInterface.createSigners,
              getPublicKey: HDInterface.getPublicKey,
              network
            });
            let inputValue = 0;
            for (const utxo of utxos) {
              inputValue += decodeTx(utxo.tx).vout[utxo.n].value;
            }
            let prevFeeRate = 0;
            for (const tx of txs) {
              const decodedTx = decodeTx(tx.tx);

              expect(tx.feeRate).toBeGreaterThan(prevFeeRate);
              prevFeeRate = tx.feeRate;

              expect(tx.feeRate).toBeGreaterThanOrEqual(1);

              const fee = inputValue - decodedTx.vout[0].value;
              const feeRate = fee / decodedTx.vsize;

              expect(feeRate).toEqual(tx.feeRate);
              expect(decodedTx.vsize).toBeCloseTo(tx.fee / tx.feeRate, 10); //Equal up to 10 decimals

              expect(fee).toEqual(tx.fee);
            }
          },
          100 * 1000
        );
      }
    });
}
