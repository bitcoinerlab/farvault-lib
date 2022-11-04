//Take inspitation from this: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/csv.spec.ts
//
//Create a bip32 wallet
//Fund the wallet with a faucet including p2pkh, p2sh-p2wpkh, p2wpkh utxos
//Coinselect up to X Bitcoin from all the utxos and send to @safe
//Send to @timeLocked

//Scenario 1: try to send to @hot before the time permits so: fails
//Scenario 2: try to send to @rescued before the time permits to get it in @hot: succeeds
//Scenario 3: try to send to @hot after the time permits so: succeeds
//
//Things to check: fees

const MULTIFEE_SAMPLES = 100;

import { payments } from 'bitcoinjs-lib';
import { generateMnemonic } from 'bip39';
import {
  fundRegtest,
  BITCOIND_CATCH_UP_TIME,
  REGTEST_SERVER_CATCH_UP_TIME,
  ESPLORA_CATCH_UP_TIME
} from '../tools';
import {
  createTransaction,
  createMultiFeeTransactions
} from '../../src/transactions';
import { createRelativeTimeLockScript } from '../../src/scripts';
import { decodeTx } from '../../src/decodeTx';

import { SoftHDInterface } from '../../src/HDInterface/soft';
import { getDerivationPathAddress } from '../../src/bip44';
import { Explorer } from '../../src/explorer';
import { Discovery } from '../../src/discovery';
import { getNextDerivationPath } from '../../src/bip44/chain';
import { VAULT_SKIP, ESPLORA, LOCAL_ESPLORA_URL } from '../../src/constants';
import { coinselect } from '../../src/coinselect';

import { fixtures } from '../fixtures/farvault';

import { pickFeeEstimate } from '../../src/fees';

const TEST_TIME = 120000;

import bip68 from 'bip68';

import { readSetup, writeSetup } from '../../src/serialization';

describe('FarVault full pipe', () => {
  const {
    network,
    mnemonic,
    guardTxTargetTime,
    unlockTxTargetTime,
    lockTime,
    lockNBlocks,
    safeValue,
    fundingDescriptors,
    coldAddress
  } = fixtures;
  describe('Create a wallet', () => {
    test(
      'Create a blockchain, a wallet, fund it, coinselect X BTC, send to @timeLocked and try to claim from @hot before time',
      async () => {
        //Create an initial funded wallet.
        //This is my hot wallet.
        const {
          HDInterface: hotHDInterface,
          paths: walletPaths,
          utxos: walletUtxos,
          regtestUtils
        } = await fundRegtest({
          mnemonic,
          fundingDescriptors,
          network
        });

        //Give esplora some time to catch up
        await new Promise(r => setTimeout(r, ESPLORA_CATCH_UP_TIME));

        const blockstreamExplorer = new Explorer({ service: ESPLORA });
        const localExplorer = new Explorer({
          service: ESPLORA,
          url: LOCAL_ESPLORA_URL
        });

        const discovery = new Discovery({
          extPubGetter: hotHDInterface.getExtPub.bind(hotHDInterface),
          explorer: localExplorer,
          forceFetchChange: true
        });
        await discovery.fetch(network);
        const usedPaths = discovery.getUsedDerivationPaths({ network });
        const fundedPaths = discovery.getFundedDerivationPaths({ network });
        ////Get the derivation paths and utxos of the wallet
        await discovery.fetchUtxos({ network });
        const utxos = discovery.getUtxos({ network });

        expect(utxos).toEqual(expect.arrayContaining(walletUtxos));
        //This used to fail but was fixed:
        //https://github.com/bitcoinjs/regtest-client/pull/4
        expect(walletUtxos.length - utxos.length === 0).toEqual(true);
        expect(fundedPaths).toEqual(expect.arrayContaining(walletPaths));
        expect(fundedPaths.length).toEqual(walletPaths.length);

        //Create the safeAddress that will keep the funds safe.
        //We must not save this mnemonic below.
        const safeHDInterface = new SoftHDInterface({
          mnemonic: generateMnemonic(256)
        });
        await safeHDInterface.init();
        const safePath = getNextDerivationPath({
          isChange: false,
          usedPaths: [],
          network
        });
        expect(safePath).toEqual("84'/1'/0'/0/0");
        const safeAddress = await getDerivationPathAddress({
          extPubGetter: safeHDInterface.getExtPub.bind(safeHDInterface),
          path: safePath,
          network
        });

        const rushedHDInterface = new SoftHDInterface({
          mnemonic: generateMnemonic(256)
        });
        await rushedHDInterface.init();
        const rushedPath = getNextDerivationPath({
          isChange: false,
          usedPaths: [],
          network
        });
        expect(rushedPath).toEqual("84'/1'/0'/0/0");
        const rushedPublicKey = await rushedHDInterface.getPublicKey(
          rushedPath,
          network
        );

        const maturedHDInterface = new SoftHDInterface({
          mnemonic: generateMnemonic(256)
        });
        await maturedHDInterface.init();
        const maturedPath = getNextDerivationPath({
          isChange: false,
          usedPaths: [],
          network
        });
        expect(maturedPath).toEqual("84'/1'/0'/0/0");
        const maturedPublicKey = await maturedHDInterface.getPublicKey(
          maturedPath,
          network
        );

        //Get the list of paths that may receive funds from the setup file
        //Try not to re-use addresses that may be used as destinataries of
        //other vaults.
        const setup = readSetup() || { vaults: {} };
        const prereservedPaths = Object.values(setup.vaults).map(
          vault => vault.hotPath
        );
        const hotPath = getNextDerivationPath({
          usedPaths,
          prereservedPaths,
          isChange: false,
          skip: VAULT_SKIP,
          network
        });
        prereservedPaths.push(hotPath);
        //console.log({ usedPaths, prereservedPaths, nextPath: hotPath });
        const hotPublicKey = await hotHDInterface.getPublicKey(
          hotPath,
          network
        );

        const feeEstimates = await blockstreamExplorer.fetchFeeEstimates();
        const guardTxFeeRate = pickFeeEstimate(feeEstimates, guardTxTargetTime);

        //Get which utxos will be protected. utxos are selected based on
        //the number of sats (safeValue) that the user selected
        const {
          utxos: fundsUtxos,
          fee: safeFee,
          targets: guardTargets
        } = await coinselect({
          utxos,
          targets: [
            {
              address: safeAddress,
              value: safeValue
            }
          ],
          changeAddress: async () => {
            const path = getNextDerivationPath({
              isChange: true,
              usedPaths,
              prereservedPaths,
              network
            });
            prereservedPaths.push(path);
            return await getDerivationPathAddress({
              extPubGetter: hotHDInterface.getExtPub.bind(hotHDInterface),
              path,
              network
            });
          },
          feeRate: guardTxFeeRate,
          network
        });
        expect(fundsUtxos).not.toBeUndefined();
        expect(guardTargets).not.toBeUndefined();

        console.log(
          'WARNING! Test it also with send all so that targets.length === 1'
        );

        const timer = Date.now();

        //Create the transaction that will send the funds to safeAddress.
        //We won't keep the keys of this safeAddress. We will save
        //pre-computed txs that can unlock them based on a contract.
        const guardTx = await createTransaction({
          utxos: fundsUtxos,
          targets: guardTargets,
          getPublicKey: hotHDInterface.getPublicKey.bind(hotHDInterface),
          createSigners: hotHDInterface.createSigners.bind(hotHDInterface),
          network
        });
        const guardTxid = decodeTx(guardTx, network).txid;
        console.log('WARNING! Should check the fees here somehow');

        const bip68LockTime = bip68.encode({
          //seconds must be a multiple of 512
          //seconds: Math.round(lockTime / 512) * 512
          blocks: lockNBlocks
        });
        const relativeTimeLockScript = createRelativeTimeLockScript({
          maturedPublicKey,
          rushedPublicKey,
          bip68LockTime
        });
        //console.log({ relativeTimeLockScript });

        const recoverTxs = await createMultiFeeTransactions({
          utxos: [
            {
              path: safePath,
              n: 0,
              tx: guardTx
            }
          ],
          address: payments.p2wsh({
            redeem: {
              output: relativeTimeLockScript,
              network
            },
            network
          }).address,
          getPublicKey: safeHDInterface.getPublicKey.bind(safeHDInterface),
          createSigners: safeHDInterface.createSigners.bind(safeHDInterface),
          feeRateSamplingParams: { samples: MULTIFEE_SAMPLES },
          network
        });
        if (!Array.isArray(recoverTxs) || recoverTxs.length === 0) {
          throw new Error('Could not create recover funds txs');
        }

        const hotAddress = await getDerivationPathAddress({
          //unlock will use hotHDInterface. cancel will use rushedHDInterface
          extPubGetter: hotHDInterface.getExtPub.bind(hotHDInterface),
          //unlock will use hotHDInterface. cancel will use coldDerivationPath
          path: hotPath,
          network
        });
        setup.vaults[guardTxid] = {
          hotPath,
          hotAddress,
          coldAddress,
          guardTx,
          guardTxid,
          recoverTxs: {}
        };
        for (const recoverTx of recoverTxs) {
          const unlockTxs = await createMultiFeeTransactions({
            utxos: [
              {
                tx: recoverTx.tx,
                n: 0,
                path: maturedPath,
                witnessScript: relativeTimeLockScript.toString('hex')
              }
            ],
            address: hotAddress,
            getPublicKey:
              maturedHDInterface.getPublicKey.bind(maturedHDInterface),
            createSigners:
              maturedHDInterface.createSigners.bind(maturedHDInterface),
            feeRateSamplingParams: { samples: MULTIFEE_SAMPLES },
            network
          });
          const cancelTxs = await createMultiFeeTransactions({
            utxos: [
              {
                tx: recoverTx.tx,
                n: 0,
                path: rushedPath,
                witnessScript: relativeTimeLockScript.toString('hex')
              }
            ],
            address: coldAddress,
            getPublicKey:
              rushedHDInterface.getPublicKey.bind(rushedHDInterface),
            createSigners:
              rushedHDInterface.createSigners.bind(rushedHDInterface),
            feeRateSamplingParams: { samples: MULTIFEE_SAMPLES },
            network
          });

          setup.vaults[guardTxid].recoverTxs[
            decodeTx(recoverTx.tx, network).txid
          ] = {
            txid: decodeTx(recoverTx.tx, network).txid,
            tx: recoverTx.tx,
            feeRate: recoverTx.feeRate,
            fee: recoverTx.fee,
            unlockTxs,
            cancelTxs
          };
        }

        console.log(
          'Vault creation time: ' + Math.round((Date.now() - timer) / 1000)
        );
        writeSetup(setup);

        //CREATE A FUNCTION IN FEES FOR THIS BLOCK
        //
        //
        const unlockTxFeeRate = pickFeeEstimate(
          feeEstimates,
          unlockTxTargetTime
        );
        //TODO: encapsulate this into a function and test it.
        //Note that we will het a setup object (not an array)
        //Pick the best recoverTx as the one with the lowest feeRate that is
        //larger than the unlockTxFeeRate.
        //If none of the recoverTx has a feeRate larger than unlockTxFeeRate
        //then pick the one with largest feeRate.
        const recoverTx = recoverTxs.reduce((best, curr) =>
          (curr.feeRate >= unlockTxFeeRate && curr.feeRate < best.feeRate) ||
          (best.feeRate < unlockTxFeeRate && curr.feeRate > best.feeRate)
            ? curr
            : best
        );
        //
        //
        //CREATE A FUNCTION IN FEES FOR THIS BLOCK
        //Note that we're picking 5 below. Use the function to get the correct tx based on fee.

        const recoverTxid = decodeTx(recoverTx.tx, network).txid;

        await regtestUtils.broadcast(guardTx);
        const unlockTx =
          setup.vaults[guardTxid].recoverTxs[recoverTxid].unlockTxs[5].tx;
        await regtestUtils.broadcast(
          setup.vaults[guardTxid].recoverTxs[recoverTxid].tx
        );
        //Rejection reason should be non-BIP68-final
        if (lockNBlocks > 1)
          console.log(await regtestUtils.mine(lockNBlocks - 1));
        await expect(regtestUtils.broadcast(unlockTx)).rejects.toThrow(
          'non-BIP68-final'
        );
        await regtestUtils.mine(1);
        await expect(regtestUtils.broadcast(unlockTx)).resolves.toEqual(null);
        //console.log(await regtestUtils.mine(1));
        await regtestUtils.fetch(recoverTxid);
        await regtestUtils.fetch(decodeTx(unlockTx, network).txid);

        //await regtestUtils.broadcast(guardTx);
        //const cancelTx = setup.vaults.[guardTxid].recoverTxs[recoverTxid].cancelTxs[5].tx;
        //await regtestUtils.broadcast(setup.vaults.[guardTxid].recoverTxs[recoverTxid].tx);
        //await regtestUtils.broadcast(cancelTx);
        //console.log(await regtestUtils.mine(6));
        //console.log(await regtestUtils.fetch(recoverTxid));
        //console.log(await regtestUtils.fetch(decodeTx(cancelTx, network).txid));
      },
      ESPLORA_CATCH_UP_TIME +
        BITCOIND_CATCH_UP_TIME +
        REGTEST_SERVER_CATCH_UP_TIME +
        TEST_TIME
    );
  });
});
