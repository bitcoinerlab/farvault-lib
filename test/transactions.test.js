import { fixtures } from './fixtures/transactions';
const { network, mnemonic } = fixtures;
import { SoftHDSigner } from '../src/HDSigner/soft';
import { LedgerHDSigner, NODEJS_TRANSPORT } from '../src/HDSigner/ledger';

import {
  createTransaction,
  createMultiFeeTransactions
} from '../src/transactions';

import { decodeTx } from '../src/decodeTx';

let ledgerHDSigner, softHDSigner;
beforeAll(async () => {
  if (process.env.__LEDGER_DETECTED__ === 'true') {
    ledgerHDSigner = new LedgerHDSigner({ transport: NODEJS_TRANSPORT });
    await ledgerHDSigner.init();
  }
  softHDSigner = new SoftHDSigner({ mnemonic });
  await softHDSigner.init();
}, 100 * 1000 /*increase the default timeout time*/);
afterAll(async () => {
  if (process.env.__LEDGER_DETECTED__ === 'true') {
    await ledgerHDSigner.close();
  }
  softHDSigner = new SoftHDSigner({ mnemonic });
  await softHDSigner.init();
});
const LEDGER_INTERFACE = 'LEDGER_INTERFACE';
const SOFT_INTERFACE = 'SOFT_INTERFACE';
for (const type of process.env.__LEDGER_DETECTED__ === 'true' //Note process.env stringifies stuff
  ? [LEDGER_INTERFACE, SOFT_INTERFACE]
  : [SOFT_INTERFACE]) {
  describe(`Transactions on ${type}`, () => {
    for (const { description, utxos, targets, tx } of fixtures.createTransaction
      .valid) {
      test(
        description,
        async () => {
          const HDSigner =
            type === LEDGER_INTERFACE ? ledgerHDSigner : softHDSigner;
          const _tx = await createTransaction({
            utxos,
            targets,
            createSigners: HDSigner.createSigners.bind(HDSigner),
            getPublicKey: HDSigner.getPublicKey.bind(HDSigner),
            network
          });

          expect(tx).toBe(_tx);
        },
        100 * 1000
      );
    }
  });

  describe(`Transactions with invalid HDSigner data on ${type}`, () => {
    //Just do it once for valid[0]
    if (fixtures.createTransaction.valid.length > 0) {
      const { description, utxos, targets, tx } =
        fixtures.createTransaction.valid[0];
      test(
        'Inject bad signature to: ' + description,
        async () => {
          const HDSigner =
            type === LEDGER_INTERFACE ? ledgerHDSigner : softHDSigner;
          const createInvalidSigners = async ({ psbt, utxos, network }) => {
            const signers = await HDSigner.createSigners({
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
              getPublicKey: HDSigner.getPublicKey.bind(HDSigner),
              network
            })
          ).rejects.toThrow('Invalid signature detected');
        },
        100 * 1000
      );

      test(
        'Inject bad pubkey to: ' + description,
        async () => {
          const HDSigner =
            type === LEDGER_INTERFACE ? ledgerHDSigner : softHDSigner;
          const getInvalidPublicKey = (path, network) => {
            return Buffer.from(
              '02783c942ac07f03a4c378ff6bd2cf8c99efc18bd1ae3cd37e6cd1ceca518bae2b',
              'hex'
            );
            //const pubKey = HDSigner.getPublicKey(path, network);
            //return pubKey;
          };
          await expect(
            createTransaction({
              utxos,
              targets,
              createSigners: HDSigner.createSigners.bind(HDSigner),
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
          const HDSigner =
            type === LEDGER_INTERFACE ? ledgerHDSigner : softHDSigner;
          await expect(
            createTransaction({
              utxos,
              targets,
              createSigners: HDSigner.createSigners.bind(HDSigner),
              getPublicKey: HDSigner.getPublicKey.bind(HDSigner),
              network
            })
          ).rejects.toThrow(exception);
        },
        100 * 1000
      );
    }
  });

  //Only test it using soft device. Otherwise this would be hell on a ledget nano
  if (type === SOFT_INTERFACE)
    describe(`Multifee transactions with invalid HDSigner data on ${type}`, () => {
      //Just do it once for valid[0]
      if (fixtures.createTransaction.valid.length > 0) {
        const { description, utxos, targets, tx } =
          fixtures.createTransaction.valid[0];
        test(
          'Multi-fee version of: ' + description,
          async () => {
            const HDSigner = softHDSigner;
            const txs = await createMultiFeeTransactions({
              utxos,
              address: targets[0].address,
              createSigners: HDSigner.createSigners.bind(HDSigner),
              getPublicKey: HDSigner.getPublicKey.bind(HDSigner),
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
