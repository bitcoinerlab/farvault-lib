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
  createTestWallet,
  startTestingEnvironment,
  stopTestingEnvironment,
  BITCOIND_CATCH_UP_TIME,
  REGTEST_SERVER_CATCH_UP_TIME
} from '../tools';
import { blockstreamFetchFeeEstimates } from '../../src/dataFetchers';
import {
  createTransaction,
  createMultiFeeTransactions
} from '../../src/transactions';
import { createRelativeTimeLockScript } from '../../src/scripts';
import { decodeTx } from '../../src/decodeTx';

import { initHDInterface, SOFT_HD_INTERFACE } from '../../src/HDInterface';
import {
  getDerivationPathAddress,
  fetchDerivationPaths,
  fetchDerivationPathsUtxos,
  getNextDerivationPath
} from '../../src/wallet';
import { VAULT_SKIP } from '../../src/walletConstants';
import { esploraFetchAddress, esploraFetchUtxos } from '../../src/dataFetchers';
import { coinselect } from '../../src/coinselect';

import { fixtures } from '../fixtures/farvault';

import { pickEsploraFeeEstimate } from '../../src/fees';

const ESPLORA_CATCH_UP_TIME = 10000;
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
    testWallet,
    coldAddress
  } = fixtures;
  describe('Create a wallet', () => {
    test(
      'Create a blockchain, a wallet, fund it, coinselect X BTC, send to @timeLocked and try to claim from @hot before time',
      async () => {
        const {
          bitcoind,
          electrs,
          regtest_server
        } = await startTestingEnvironment();

        try {
          //Create an initial funded wallet.
          //This is my hot wallet.
          const {
            HDInterface: hotHDInterface,
            paths: walletPaths,
            utxos: walletUtxos,
            regtestUtils
          } = await createTestWallet({
            mnemonic,
            addressesDescriptors: testWallet,
            network
          });

          //Give esplora some time to catch up
          await new Promise(r => setTimeout(r, ESPLORA_CATCH_UP_TIME));

          //Get the derivation paths and utxos of the wallet
          const { fundedPaths, usedPaths } = await fetchDerivationPaths({
            extPubGetter: hotHDInterface.getExtPub,
            addressFetcher: address => esploraFetchAddress(address),
            network
          });
          const utxos = await fetchDerivationPathsUtxos({
            extPubGetter: hotHDInterface.getExtPub,
            paths: fundedPaths,
            utxoFetcher: address => esploraFetchUtxos(address),
            network
          });

          expect(utxos).toEqual(expect.arrayContaining(walletUtxos));
          expect(walletUtxos.length - utxos.length >= 0).toEqual(true);
          expect(fundedPaths).toEqual(expect.arrayContaining(walletPaths));
          expect(fundedPaths.length).toEqual(walletPaths.length);

          //Create the safeAddress that will keep the funds safe.
          //We must not save this mnemonic below.
          const safeHDInterface = await initHDInterface(SOFT_HD_INTERFACE, {
            mnemonic: generateMnemonic(256)
          });
          const safePath = getNextDerivationPath({
            isChange: false,
            usedPaths: [],
            network
          });
          expect(safePath).toEqual("84'/1'/0'/0/0");
          const safeAddress = await getDerivationPathAddress({
            extPubGetter: safeHDInterface.getExtPub,
            path: safePath,
            network
          });

          const rushedHDInterface = await initHDInterface(SOFT_HD_INTERFACE, {
            mnemonic: generateMnemonic(256)
          });
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

          const maturedHDInterface = await initHDInterface(SOFT_HD_INTERFACE, {
            mnemonic: generateMnemonic(256)
          });
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
          console.log({ usedPaths, prereservedPaths, nextPath: hotPath });
          const hotPublicKey = await hotHDInterface.getPublicKey(
            hotPath,
            network
          );

          const feeEstimates = await blockstreamFetchFeeEstimates();
          const guardTxFeeRate = pickEsploraFeeEstimate(
            feeEstimates,
            guardTxTargetTime
          );

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
                extPubGetter: hotHDInterface.getExtPub,
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
            getPublicKey: hotHDInterface.getPublicKey,
            createSigners: hotHDInterface.createSigners,
            network
          });
          const guardTxid = decodeTx(guardTx).txid;
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
          console.log({ relativeTimeLockScript });

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
            getPublicKey: safeHDInterface.getPublicKey,
            createSigners: safeHDInterface.createSigners,
            feeRateSamplingParams: { samples: MULTIFEE_SAMPLES },
            network
          });
          if (!Array.isArray(recoverTxs) || recoverTxs.length === 0) {
            throw new Error('Could not create recover funds txs');
          }

          const hotAddress = await getDerivationPathAddress({
            //unlock will use hotHDInterface. cancel will use rushedHDInterface
            extPubGetter: hotHDInterface.getExtPub,
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
                  witnessScript: relativeTimeLockScript
                }
              ],
              address: hotAddress,
              getPublicKey: maturedHDInterface.getPublicKey,
              createSigners: maturedHDInterface.createSigners,
              feeRateSamplingParams: { samples: MULTIFEE_SAMPLES },
              network
            });
            const cancelTxs = await createMultiFeeTransactions({
              utxos: [
                {
                  tx: recoverTx.tx,
                  n: 0,
                  path: rushedPath,
                  witnessScript: relativeTimeLockScript
                }
              ],
              address: coldAddress,
              getPublicKey: rushedHDInterface.getPublicKey,
              createSigners: rushedHDInterface.createSigners,
              feeRateSamplingParams: { samples: MULTIFEE_SAMPLES },
              network
            });

            setup.vaults[guardTxid].recoverTxs[decodeTx(recoverTx.tx).txid] = {
              txid: decodeTx(recoverTx.tx).txid,
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
          const unlockTxFeeRate = pickEsploraFeeEstimate(
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

          const recoverTxid = decodeTx(recoverTx.tx).txid;

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
          console.log(await regtestUtils.mine(1));
          await expect(regtestUtils.broadcast(unlockTx)).resolves.toEqual(null);
          //console.log(await regtestUtils.mine(1));
          console.log(await regtestUtils.fetch(recoverTxid));
          console.log(await regtestUtils.fetch(decodeTx(unlockTx).txid));

          //await regtestUtils.broadcast(guardTx);
          //const cancelTx = setup.vaults.[guardTxid].recoverTxs[recoverTxid].cancelTxs[5].tx;
          //await regtestUtils.broadcast(setup.vaults.[guardTxid].recoverTxs[recoverTxid].tx);
          //await regtestUtils.broadcast(cancelTx);
          //console.log(await regtestUtils.mine(6));
          //console.log(await regtestUtils.fetch(recoverTxid));
          //console.log(await regtestUtils.fetch(decodeTx(cancelTx).txid));

          //We can stop the bitcoin and explorer servers
          stopTestingEnvironment({ bitcoind, electrs, regtest_server });
        } catch (error) {
          console.log('Catched an error, stoping testing environment', error);
          stopTestingEnvironment({ bitcoind, electrs, regtest_server });
          throw new Error(error);
        }
      },
      ESPLORA_CATCH_UP_TIME +
        BITCOIND_CATCH_UP_TIME +
        REGTEST_SERVER_CATCH_UP_TIME +
        TEST_TIME
    );
  });
});
