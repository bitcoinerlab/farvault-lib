/** @module test/integration/farvault.test */

//Take inspitation from this: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/csv.spec.ts
//
//Create a bip32 wallet
//Fund the wallet with a faucet including p2pkh, p2sh-p2wpkh, p2wpkh UTXOs
//Coinselect up to X Bitcoin from all the UTXOs and send to @safe
//Send to @timeLocked

//Scenario 1: try to send to @hot before the time permits so: fails
//Scenario 2: try to send to @rescued before the time permits to get it in @hot: succeeds
//Scenario 3: try to send to @hot after the time permits so: succeeds
//
//Things to check: fees

const MULTIFEE_SAMPLES = 10;
import fs from 'fs';
import path from 'path';

import { payments } from 'bitcoinjs-lib';
import { generateMnemonic } from 'bip39';
import {
  createMockWallet,
  startTestingEnvironment,
  stopTestingEnvironment,
  BITCOIND_CATCH_UP_TIME,
  REGTEST_SERVER_CATCH_UP_TIME
} from '../tools';
import { blockstreamFetchFeeEstimates } from '../../src/dataFetchers';
import {
  createTransaction,
  createRelativeTimeLockScript,
  createMultiFeeTransactions
} from '../../src/FVTransactions';
import { decodeTx } from '../../src/decodeTx';

import { initHDInterface, SOFT_HD_INTERFACE } from '../../src/HDInterface';
import {
  getDerivationPathAddress,
  fetchDerivationPaths,
  fetchUTXOs,
  getNextReceivingDerivationPath,
  getNextChangeDerivationPath
} from '../../src/wallet';
import { esploraFetchAddress, esploraFetchUTXOs } from '../../src/dataFetchers';
import { coinselect } from '../../src/coinselect';

import { fixtures } from '../fixtures/farvault';

import { pickEsploraFeeEstimate } from '../../src/fees';

const ESPLORA_CATCH_UP_TIME = 10000;
const TEST_TIME = 120000;

import bip68 from 'bip68';

describe('FarVault full pipe', () => {
  const {
    network,
    mnemonic,
    guardTxTargetTime,
    unlockTxTargetTime,
    lockTime,
    lockNBlocks,
    safeValue,
    mockWallet,
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
          //Create an initial funded wallet
          const {
            HDInterface: hotHDInterface,
            derivationPaths,
            UTXOs,
            regtestUtils
          } = await createMockWallet(mnemonic, mockWallet, network);

          //Give esplora some time to catch up
          await new Promise(r => setTimeout(r, ESPLORA_CATCH_UP_TIME));

          //Get the derivationPaths and UTXOs of the wallet
          const {
            fundedDerivationPaths,
            usedDerivationPaths
          } = await fetchDerivationPaths({
            extPubGetter: hotHDInterface.getExtPub,
            addressFetcher: address => esploraFetchAddress(address),
            network
          });
          const walletUTXOs = await fetchUTXOs({
            extPubGetter: hotHDInterface.getExtPub,
            derivationPaths: fundedDerivationPaths,
            utxoFetcher: address => esploraFetchUTXOs(address),
            network
          });

          //Create the safeAddress that will keep the funds safe.
          //We must not save this mnemonic below.
          const safeHDInterface = await initHDInterface(SOFT_HD_INTERFACE, {
            mnemonic: generateMnemonic(256)
          });
          const safeDerivationPath = getNextReceivingDerivationPath({
            derivationPaths: [],
            network
          });
          expect(safeDerivationPath).toEqual("84'/1'/0'/0/0");
          const safeAddress = await getDerivationPathAddress({
            extPubGetter: safeHDInterface.getExtPub,
            derivationPath: safeDerivationPath,
            network
          });

          expect(walletUTXOs).toEqual(expect.arrayContaining(UTXOs));
          expect(UTXOs.length - walletUTXOs.length >= 0).toEqual(true);
          expect(fundedDerivationPaths).toEqual(
            expect.arrayContaining(derivationPaths)
          );
          expect(fundedDerivationPaths.length).toEqual(derivationPaths.length);

          const rushedMnemonic = generateMnemonic(256);
          const rushedHDInterface = await initHDInterface(SOFT_HD_INTERFACE, {
            mnemonic: rushedMnemonic
          });
          const rushedDerivationPath = getNextReceivingDerivationPath({
            derivationPaths: [],
            network
          });
          expect(rushedDerivationPath).toEqual("84'/1'/0'/0/0");
          const rushedPublicKey = await rushedHDInterface.getPublicKey(
            rushedDerivationPath,
            network
          );
          const maturedMnemonic = generateMnemonic(256);
          const maturedHDInterface = await initHDInterface(SOFT_HD_INTERFACE, {
            mnemonic: maturedMnemonic
          });
          const maturedDerivationPath = getNextReceivingDerivationPath({
            derivationPaths: [],
            network
          });
          expect(maturedDerivationPath).toEqual("84'/1'/0'/0/0");
          const maturedPublicKey = await maturedHDInterface.getPublicKey(
            maturedDerivationPath,
            network
          );

          //Create the hot address that is P2WPKH that will take funds from hot
          const hotDerivationPath = getNextReceivingDerivationPath({
            derivationPaths: usedDerivationPaths,
            network
          });
          //Mark it as used:
          usedDerivationPaths.push(hotDerivationPath);
          fundedDerivationPaths.push(hotDerivationPath);
          const hotPublicKey = await hotHDInterface.getPublicKey(
            hotDerivationPath,
            network
          );

          const feeEstimates = await blockstreamFetchFeeEstimates();
          const guardTxFeeRate = pickEsploraFeeEstimate(
            feeEstimates,
            guardTxTargetTime
          );

          //Get which UTXOs will be protected. UTXOs are selected based on
          //the number of sats (safeValue) that the user selected
          const {
            utxos: fundsUTXOs,
            fee: safeFee,
            targets: guardTargets
          } = await coinselect({
            utxos: walletUTXOs,
            targets: [
              {
                address: safeAddress,
                value: safeValue
              }
            ],
            changeAddress: async () => {
              const derivationPath = getNextChangeDerivationPath({
                derivationPaths: usedDerivationPaths,
                network
              });
              //Mark it as used:
              usedDerivationPaths.push(derivationPath);
              fundedDerivationPaths.push(derivationPath);
              return await getDerivationPathAddress({
                extPubGetter: hotHDInterface.getExtPub,
                derivationPath,
                network
              });
            },
            feeRate: guardTxFeeRate,
            network
          });
          expect(fundsUTXOs).not.toBeUndefined();
          expect(guardTargets).not.toBeUndefined();

          console.log(
            'WARNING! Test it also with send all so that targets.length === 1'
          );

          //Create the transaction that will send the funds to safeAddress.
          //We won't keep the keys of this safeAddress. We will save
          //pre-computed txs that can unlock them based on a contract.
          const guardTx = await createTransaction({
            utxos: fundsUTXOs,
            targets: guardTargets,
            getPublicKey: hotHDInterface.getPublicKey,
            createSigners: hotHDInterface.createSigners,
            network
          });
          console.log('WARNING! Should check the fees here somehow');

          const encodedLockTime = bip68.encode({
            //seconds must be a multiple of 512
            //seconds: Math.round(lockTime / 512) * 512
            blocks: lockNBlocks
          });
          const relativeTimeLockScript = createRelativeTimeLockScript({
            maturedPublicKey,
            rushedPublicKey,
            encodedLockTime
          });
          console.log({ relativeTimeLockScript });

          const recoverTxs = await createMultiFeeTransactions({
            utxos: [
              {
                derivationPath: safeDerivationPath,
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
            samples: MULTIFEE_SAMPLES,
            network
          });
          if (!Array.isArray(recoverTxs) || recoverTxs.length === 0) {
            throw new Error('Could not create recover funds txs');
          }

          const setup = { recoverTxs: {} };
          const hotAddress = await getDerivationPathAddress({
            //unlock will use hotHDInterface. cancel will use rushedHDInterface
            extPubGetter: hotHDInterface.getExtPub,
            //unlock will use hotHDInterface. cancel will use coldDerivationPath
            derivationPath: hotDerivationPath,
            network
          });
          for (const recoverTx of recoverTxs) {
            const unlockTxs = await createMultiFeeTransactions({
              utxos: [
                {
                  tx: recoverTx.tx,
                  n: 0,
                  derivationPath: maturedDerivationPath,
                  witnessScript: relativeTimeLockScript
                }
              ],
              address: hotAddress,
              getPublicKey: maturedHDInterface.getPublicKey,
              createSigners: maturedHDInterface.createSigners,
              samples: MULTIFEE_SAMPLES,
              network
            });
            const cancelTxs = await createMultiFeeTransactions({
              utxos: [
                {
                  tx: recoverTx.tx,
                  n: 0,
                  derivationPath: rushedDerivationPath,
                  witnessScript: relativeTimeLockScript
                }
              ],
              address: coldAddress,
              getPublicKey: rushedHDInterface.getPublicKey,
              createSigners: rushedHDInterface.createSigners,
              samples: MULTIFEE_SAMPLES,
              network
            });
            setup.recoverTxs[decodeTx(recoverTx.tx).txid] = {
              tx: recoverTx.tx,
              decodedTx: decodeTx(recoverTx.tx),
              feeRate: recoverTx.feeRate,
              fee: recoverTx.fee,
              unlockTxs,
              cancelTxs
            };

            console.log(Object.keys(setup.recoverTxs).length);
          }
          fs.writeFileSync(
            path.resolve(__dirname, 'setup.json'),
            JSON.stringify(setup)
          );

          //CREATE A FUNCTION IN FEES FOR THIS BLOCK
          //
          //
          const unlockTxFeeRate = pickEsploraFeeEstimate(
            feeEstimates,
            unlockTxTargetTime
          );
          //TODO: encapsulate this into a function and test it.
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

          await regtestUtils.broadcast(guardTx);
          const recoverTxId = Object.keys(setup.recoverTxs)[3];
          const unlockTx = setup.recoverTxs[recoverTxId].unlockTxs[5].tx;
          await regtestUtils.broadcast(setup.recoverTxs[recoverTxId].tx);
          //Rejection reason should be non-BIP68-final
          if (lockNBlocks > 1)
            console.log(await regtestUtils.mine(lockNBlocks - 1));
          await expect(regtestUtils.broadcast(unlockTx)).rejects.toThrow(
            'non-BIP68-final'
          );
          console.log(await regtestUtils.mine(1));
          await expect(regtestUtils.broadcast(unlockTx)).resolves.toEqual(null);
          //console.log(await regtestUtils.mine(1));
          console.log(await regtestUtils.fetch(recoverTxId));
          console.log(await regtestUtils.fetch(decodeTx(unlockTx).txid));

          //await regtestUtils.broadcast(guardTx);
          //const recoverTxId = Object.keys(setup.recoverTxs)[3];
          //const cancelTx = setup.recoverTxs[recoverTxId].cancelTxs[5].tx;
          //await regtestUtils.broadcast(setup.recoverTxs[recoverTxId].tx);
          //await regtestUtils.broadcast(cancelTx);
          //console.log(await regtestUtils.mine(6));
          //console.log(await regtestUtils.fetch(recoverTxId));
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
