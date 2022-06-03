import { fixtures } from './fixtures/transactions';
const { network, mnemonic, fundingDescriptors } = fixtures;
import { LEDGER_NANO_INTERFACE, SOFT_HD_INTERFACE } from '../src/HDInterface';
import {
  fundRegtest,
  BITCOIND_CATCH_UP_TIME,
  REGTEST_SERVER_CATCH_UP_TIME
} from './tools';
import { getDerivationPathAddress } from '../src/wallet';

import { createTransaction } from '../src/transactions';
import { decodeTx } from '../src/decodeTx';
import { Transaction } from 'bitcoinjs-lib';

if (process.env.__LEDGER_NANO_DETECTED__ === 'false') {
  //Note process.env stringifies stuff
  describe(`Transactions on ${LEDGER_NANO_INTERFACE}`, () => {
    test('Run tests for the Ledger Nano Device', () => {
      expect(process.env.__LEDGER_NANO_DETECTED__).toEqual('true');
    });
  });
}

for (const type of process.env.__LEDGER_NANO_DETECTED__ === 'true' //Note process.env stringifies stuff
  ? [LEDGER_NANO_INTERFACE, SOFT_HD_INTERFACE]
  : [SOFT_HD_INTERFACE]) {
  describe(`Transactions on ${type}`, () => {
    let lastTx;
    const fundRegtestOutput = {};
    beforeAll(async () => {
      fundRegtestOutput[type] = await fundRegtest({
        type,
        mnemonic,
        fundingDescriptors,
        network
      });
    }, 100 * 1000 /*increase the default timeout time*/);

    for (const { description, targetsSelector, utxosSelector } of fixtures
      .createTransaction.valid) {
      //The way to test transactions is to build the tx, and then broadcast it.
      //See if it the transaction is included in a mined block and it indeed
      //sent the funds to the targets. Also see that the utxos spent where
      //the correct ones.
      test(
        description,
        async () => {
          expect(fundRegtestOutput[type]).not.toBe(undefined);
          const {
            HDInterface,
            paths,
            utxos: walletUtxos,
            regtestUtils
          } = fundRegtestOutput[type];

          const utxos = utxosSelector(walletUtxos, lastTx);
          const targets = targetsSelector(utxos);
          const tx = await createTransaction({
            utxos,
            targets,
            createSigners: HDInterface.createSigners,
            getPublicKey: HDInterface.getPublicKey,
            network
          });
          //console.log('TRACE', description, type, { utxos, targets, tx });
          await regtestUtils.broadcast(tx);
          await regtestUtils.mine(11);

          //Retrieve the tx:
          const fetchedTx = await regtestUtils.fetch(decodeTx(tx).txid);
          lastTx = tx;

          //Confirm the tx outputs
          for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            expect(target).toEqual({
              address: fetchedTx.outs[i].address,
              value: fetchedTx.outs[i].value
            });
          }

          //Confirm the tx inputs
          for (let i = 0; i < utxos.length; i++) {
            const utxo = utxos[i];
            expect({ txid: decodeTx(utxo.tx).txid, n: utxo.n }).toEqual({
              txid: fetchedTx.ins[i].txId,
              n: fetchedTx.ins[i].vout
            });
          }
        },
        100 * 1000
      );
    }
  });
}
