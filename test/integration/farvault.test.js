/** @module test/integration/farvault.test */

//Take inspitation from this: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/csv.spec.ts
//
//Create a bip32 wallet
//Fund the wallet with a faucet including p2pkh, p2sh-p2wpkh, p2wpkh UTXOs
//Coinselect up to X Bitcoin from all the UTXOs and send to @frozen
//Send to @timeLocked

//Scenario 1: try to send to @hot before the time permits so: fails
//Scenario 2: try to send to @rescued before the time permits to get it in @hot: succeeds
//Scenario 3: try to send to @hot after the time permits so: succeeds
//
//Things to check: fees

import bJs, { networks } from 'bitcoinjs-lib';
//import { generateMnemonic } from 'bip39';
import { RegtestUtils } from 'regtest-client';
import { spawn, spawnSync } from 'child_process';
import { kill } from 'process';
import { blockstreamFetchFeeEstimates } from '../../src/dataFetchers';

import { initHDInterface, SOFT_HD_INTERFACE } from '../../src/HDInterface';
import {
  getExtPubAddress,
  getDerivationPathAddress,
  fetchDerivationPaths,
  fetchUTXOs,
  getNextExternalDerivationPath,
  getNextChangeDerivationPath
} from '../../src/wallet';
import { esploraFetchAddress, esploraFetchUTXOs } from '../../src/dataFetchers';
import { coinselect } from '../../src/coinselect';

import {
  NESTED_SEGWIT,
  NATIVE_SEGWIT,
  LEGACY,
  ESPLORA_BASEURL
} from '../../src/walletConstants';
import { getNetworkCoinType, serializeDerivationPath } from '../../src/bip32';

import { fixtures } from '../fixtures/farvault';

import { pickEsploraFeeEstimate } from '../../src/fees';

const regtestUtils = new RegtestUtils(bJs);
const BITCOIND_CATCH_UP_TIME = 2000;
const REGTEST_SERVER_CATCH_UP_TIME = 1000;
const ESPLORA_CATCH_UP_TIME = 10000;
const TEST_TIME = 120000;

/**
 * Creates an HD wallet and funds it using mined coins from a regtest-server faucet.
 * It then mines 6 blocks to confirm payments.
 * @param {string} mnemonic - space separated list of BIP39 words used as mnemonic.
 * @param {Object[]} addressesDescriptors - list of address descriptors that will get funds from the faucet.
 * @param {Object} addressesDescriptors[].extPub - object containing the purpose and accountNumber of the descriptor.
 * @param {string} addressesDescriptors[].extPub[].purpose - LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT.
 * @param {number} addressesDescriptors[].extPub[].accountNumber - account number.
 * @param {number} addressesDescriptors[].index - address number within the accountNumber.
 * @param {boolean} addressesDescriptors[].isChange - whether this address is a change address or not.
 * @param {number} addressesDescriptors[].value - number of sats that this address will receive.
 */
async function createMockWallet(mnemonic, addressesDescriptors, network) {
  const HDInterface = await initHDInterface(SOFT_HD_INTERFACE, { mnemonic });
  const extPubs = [];
  const derivationPaths = [];
  const UTXOs = [];
  for (const descriptor of addressesDescriptors) {
    const { purpose, accountNumber } = descriptor.extPub;
    const { index, isChange } = descriptor;
    const extPub = await HDInterface.getExtPub({
      purpose,
      accountNumber,
      network
    });
    if (extPubs.indexOf(extPub) === -1) extPubs.push(extPub);

    const address = getExtPubAddress({ extPub, index, isChange, network });
    const derivationPath = serializeDerivationPath({
      purpose,
      coinType: getNetworkCoinType(network),
      accountNumber,
      isChange,
      index
    });
    derivationPaths.push(derivationPath);
    const unspent = await regtestUtils.faucet(address, descriptor.value);
    const utxo = {
      tx: (await regtestUtils.fetch(unspent.txId)).txHex,
      n: unspent.vout,
      derivationPath
    };
    UTXOs.push(utxo);
    //console.log({ unspent, utxo });
  }
  // All of the above faucet payments will confirm
  const results = await regtestUtils.mine(6);
  return { HDInterface, extPubs, UTXOs, derivationPaths, network };
}

describe('FarVault full pipe', () => {
  const {
    network,
    mnemonic,
    freezeTxTargetTime,
    savingsValue,
    mockWallet
  } = fixtures;
  describe('Create a wallet', () => {
    test(
      'Create a blockchain, a wallet, fund it, coinselect X BTC, send to @timeLocked and try to claim from @hot before time',
      async () => {
        const bitcoind = spawn('./testing_environment/bitcoind.sh', {
          detached: true,
          stdio: 'ignore'
        });
        await new Promise(r => setTimeout(r, BITCOIND_CATCH_UP_TIME));
        const electrs = spawn('./testing_environment/electrs.sh', {
          detached: true,
          stdio: 'ignore'
        });
        const regtest_server = spawn(
          './testing_environment/regtest_server.sh',
          { detached: true, stdio: 'ignore' }
        );
        await new Promise(r => setTimeout(r, REGTEST_SERVER_CATCH_UP_TIME));
        //wait until the command finishes:
        spawnSync('./testing_environment/createwallet.sh');

        const { HDInterface, derivationPaths, UTXOs } = await createMockWallet(
          mnemonic,
          mockWallet,
          network
        );

        //Give esplora some time to catch up
        await new Promise(r => setTimeout(r, ESPLORA_CATCH_UP_TIME));

        const {
          fundedDerivationPaths,
          usedDerivationPaths
        } = await fetchDerivationPaths({
          extPubGetter: params => HDInterface.getExtPub(params),
          addressFetcher: address => esploraFetchAddress(address),
          network
        });

        const walletUTXOs = await fetchUTXOs({
          extPubGetter: params => HDInterface.getExtPub(params),
          derivationPaths: fundedDerivationPaths,
          utxoFetcher: address => esploraFetchUTXOs(address),
          network
        });

        kill(-bitcoind.pid, 'SIGKILL');
        kill(-electrs.pid, 'SIGKILL');
        kill(-regtest_server.pid, 'SIGKILL');

        //Send it to ourselves:
        const nextDerivationPath = getNextExternalDerivationPath({
          derivationPaths: usedDerivationPaths,
          network
        });
        //Mark it as used:
        usedDerivationPaths.push(nextDerivationPath);

        expect(walletUTXOs).toEqual(expect.arrayContaining(UTXOs));
        expect(UTXOs.length - walletUTXOs.length >= 0).toEqual(true);
        expect(fundedDerivationPaths).toEqual(
          expect.arrayContaining(derivationPaths)
        );
        expect(fundedDerivationPaths.length).toEqual(derivationPaths.length);

        const feeEstimates = await blockstreamFetchFeeEstimates();
        const feeRate = pickEsploraFeeEstimate(
          feeEstimates,
          freezeTxTargetTime
        );

        const { utxos: selectedUTXOs, fee, targets } = await coinselect({
          utxos: walletUTXOs,
          targets: [
            {
              address: await getDerivationPathAddress({
                extPubGetter: params => HDInterface.getExtPub(params),
                derivationPath: nextDerivationPath,
                network
              }),
              value: savingsValue
            }
          ],
          changeAddress: async () => {
            const derivationPath = getNextChangeDerivationPath({
              derivationPaths: usedDerivationPaths,
              network
            });
            //Mark it as used:
            derivationPaths.push(derivationPath);
            return await getDerivationPathAddress({
              extPubGetter: params => HDInterface.getExtPub(params),
              derivationPath,
              network
            });
          },
          feeRate,
          network
        });
        expect(selectedUTXOs).not.toBeUndefined();
        expect(targets).not.toBeUndefined();
      },
      ESPLORA_CATCH_UP_TIME +
        BITCOIND_CATCH_UP_TIME +
        REGTEST_SERVER_CATCH_UP_TIME +
        TEST_TIME
    );
  });
});
