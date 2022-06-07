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

    for (const {
      description,
      errorMessage,
      targetsSelector,
      utxosSelector,
      prevBlocksToMine,
      fee
    } of fixtures.createTransaction) {
      //The way to test transactions is to build the tx, and then broadcast it.
      //See if it the transaction is included in a mined block and it indeed
      //sent the funds to the targets. Also see that the utxos spent where
      //the correct ones.
      test(
        (typeof errorMessage === 'string' ? 'ERROR: ' : '') +
          description +
          (typeof errorMessage === 'string' ? ' - ' + errorMessage : ''),
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

          const transactAndMine = async () => {
            const tx = await createTransaction({
              utxos,
              targets,
              createSigners: HDInterface.createSigners,
              getPublicKey: HDInterface.getPublicKey,
              network
            });
            //console.log('TRACE', {
            //  description,
            //  type,
            //  prevBlocksToMine,
            //  utxos,
            //  targets,
            //  tx
            //});
            await regtestUtils.mine(prevBlocksToMine);
            await regtestUtils.broadcast(tx);

            //Retrieve the tx:
            const fetchedTx = await regtestUtils.fetch(decodeTx(tx).txid);
            return { tx, fetchedTx };
          };
          let fetchedTx;
          if (typeof errorMessage !== 'undefined') {
            try {
              ({ tx: lastTx, fetchedTx } = await transactAndMine());
            } catch (err) {
              expect(err.toString()).toEqual(errorMessage);
            }
          } else {
            ({ tx: lastTx, fetchedTx } = await transactAndMine());
            //Confirm the tx outputs
            let outputValue = 0;
            for (let i = 0; i < targets.length; i++) {
              const target = targets[i];
              expect(target).toEqual({
                address: fetchedTx.outs[i].address,
                value: fetchedTx.outs[i].value
              });
              outputValue += fetchedTx.outs[i].value;
              //Fixtures always have targets with same value
              if (i > 0) expect(target.value).toEqual(targets[i - 1].value);
            }

            //Confirm the tx inputs
            let inputValue = 0;
            for (let i = 0; i < utxos.length; i++) {
              const utxo = utxos[i];
              expect({ txid: decodeTx(utxo.tx).txid, n: utxo.n }).toEqual({
                txid: fetchedTx.ins[i].txId,
                n: fetchedTx.ins[i].vout
              });
              const prevTx = await regtestUtils.fetch(fetchedTx.ins[i].txId);
              inputValue += prevTx.outs[fetchedTx.ins[i].vout].value;
            }
            //It may be slightly different because of rounding
            expect(fee).toEqual(inputValue - outputValue);
          }
        },
        100 * 1000
      );
    }
  });
}
