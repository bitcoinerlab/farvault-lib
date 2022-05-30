import { fixtures } from './fixtures/transactions';
const { type, network, mnemonic, testWallet } = fixtures;
import {
  createTestWallet,
  startTestingEnvironment,
  stopTestingEnvironment,
  BITCOIND_CATCH_UP_TIME,
  REGTEST_SERVER_CATCH_UP_TIME
} from './tools';
import { getDerivationPathAddress } from '../src/wallet';

import { createTransaction } from '../src/transactions';
import { decodeTx } from '../src/decodeTx';
import { Transaction } from 'bitcoinjs-lib';

let HDInterface, paths, walletUtxos, regtestUtils;
let bitcoind, regtest_server;
beforeAll(async () => {
  ({ bitcoind, regtest_server } = await startTestingEnvironment({
    startElectrs: false
  }));
  ({
    HDInterface,
    paths,
    utxos: walletUtxos,
    regtestUtils
  } = await createTestWallet({ type, mnemonic, addressesDescriptors: testWallet, network }));
}, 100 * 1000 /*increase the default timeout time*/);
afterAll(() => {
  stopTestingEnvironment({ bitcoind, regtest_server });
});

describe('Transactions', () => {
  for (const { description, targets, walletUtxoIndices } of fixtures
    .createTransaction.valid) {
    //The way to test it is to build the tx, and then broadcast it.
    //See if it the transaction is included in a mined block and it indeed
    //send the funds to the targets. Also see that the utxos were spent.
    test(description, async () => {
      const utxos = walletUtxoIndices.map(index => walletUtxos[index]);
      const tx = await createTransaction({
        utxos,
        targets,
        createSigners: HDInterface.createSigners,
        getPublicKey: HDInterface.getPublicKey,
        network
      });
      await regtestUtils.broadcast(tx);
      await regtestUtils.mine(6);

      //Retrieve the tx:
      const fetchedTx = await regtestUtils.fetch(decodeTx(tx).txid);

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
    }, 100 * 1000);
  }
});
