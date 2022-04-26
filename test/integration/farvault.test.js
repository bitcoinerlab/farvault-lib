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

import {
  initHDInterface,
  LEDGER_NANO_INTERFACE,
  SOFT_HD_INTERFACE
} from '../../src/HDInterface';
import {
  getExtendedPubAddress,
  getDerivationPathAddress,
  fetchFundedAddressesDescriptors,
  fetchUTXOSDescriptors
} from '../../src/wallet';
import { esploraFetchAddress, esploraFetchUTXOS } from '../../src/dataFetchers';
import { coinselect } from '../../src/coinselect';

import {
  NESTED_SEGWIT,
  NATIVE_SEGWIT,
  LEGACY,
  ESPLORA_BASEURL
} from '../../src/walletConstants';
import { getNetworkCoinType, serializeDerivationPath } from '../../src/bip32';

import { fixtures } from '../fixtures/wallet';

import { pickEsploraFeeEstimate } from '../../src/fees';

const regtestUtils = new RegtestUtils(bJs);
const network = networks.regtest;
const BITCOIND_CATCH_UP_TIME = 2000;
const REGTEST_SERVER_CATCH_UP_TIME = 1000;
const ESPLORA_CATCH_UP_TIME = 10000;
const TEST_TIME = 120000;

/**
 * Creates an HD wallet and funds it using mined coins from a regtest-server faucet.
 * It then mines 6 blocks to confirm payments.
 * @param {string} mnemonic - space separated list of BIP39 words used as mnemonic.
 * @param {Object[]} fixtureAddresses - list of address descriptors that will get funds from the faucet.
 * @param {Object} fixtureAddresses[].extendedPub - object containing the purpose and accountNumber of the descriptor.
 * @param {string} fixtureAddresses[].extendedPub[].purpose - LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT.
 * @param {number} fixtureAddresses[].extendedPub[].accountNumber - account number.
 * @param {number} fixtureAddresses[].index - address number within the accountNumber.
 * @param {boolean} fixtureAddresses[].isChange - whether this address is a change address or not.
 * @param {number} fixtureAddresses[].value - number of sats that this address will receive.
 */
async function createMockWallet(mnemonic, fixtureAddresses) {
  const HDInterface = await initHDInterface(SOFT_HD_INTERFACE, { mnemonic });
  const extendedPubs = [];
  const addressesDescriptors = [];
  const utxosDescritptors = [];
  for (const addressFixture of fixtureAddresses) {
    const { network, purpose, accountNumber } = addressFixture.extendedPub;
    const { index, isChange } = addressFixture;
    const extendedPub = await HDInterface.getExtendedPub({
      purpose,
      accountNumber,
      network
    });
    extendedPubs.indexOf(extendedPub) === -1 && extendedPubs.push(extendedPub);

    const address = getExtendedPubAddress(
      extendedPub,
      index,
      isChange,
      network
    );
    const derivationPath = serializeDerivationPath({
      purpose,
      coinType: getNetworkCoinType(network),
      accountNumber,
      isChange,
      index
    });
    addressesDescriptors.push({ derivationPath, network });
    const unspent = await regtestUtils.faucet(address, addressFixture.value);
    const utxo = {
      network,
      tx: (await regtestUtils.fetch(unspent.txId)).txHex,
      n: unspent.vout,
      derivationPath
    };
    utxosDescritptors.push(utxo);
    //console.log({ unspent, utxo });
  }
  // All of the above faucet payments will confirm
  const results = await regtestUtils.mine(6);
  return { HDInterface, extendedPubs, utxosDescritptors, addressesDescriptors };
}

describe('FarVault full pipe', () => {
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

        const {
          HDInterface,
          addressesDescriptors,
          utxosDescritptors
        } = await createMockWallet(fixtures.mnemonic, fixtures.addresses);

        //Give esplora some time to catch up
        await new Promise(r => setTimeout(r, ESPLORA_CATCH_UP_TIME));

        const walletAddressesDescriptors = await fetchFundedAddressesDescriptors(
          HDInterface,
          network,
          address => esploraFetchAddress(address)
        );

        const walletUtxosDescriptors = await fetchUTXOSDescriptors(
          HDInterface,
          walletAddressesDescriptors,
          address => esploraFetchUTXOS(address)
        );
        kill(-bitcoind.pid, 'SIGKILL');
        kill(-electrs.pid, 'SIGKILL');
        kill(-regtest_server.pid, 'SIGKILL');

        expect(walletUtxosDescriptors).toEqual(
          expect.arrayContaining(utxosDescritptors)
        );
        expect(
          utxosDescritptors.length - walletUtxosDescriptors.length >= 0
        ).toEqual(true);
        expect(walletAddressesDescriptors).toEqual(
          expect.arrayContaining(addressesDescriptors)
        );
        expect(walletAddressesDescriptors.length).toEqual(
          addressesDescriptors.length
        );

        const feeEstimates = await blockstreamFetchFeeEstimates();
        const feeRate = pickEsploraFeeEstimate(
          feeEstimates,
          fixtures.freezeTxTargetTime
        );

        const { utxos: selectedUtxosDescriptors, fee, targets } = coinselect({
          utxos: walletUtxosDescriptors,
          targets: [
            {
              address: await getDerivationPathAddress(
                HDInterface,
                walletAddressesDescriptors[0].derivationPath,
                walletAddressesDescriptors[0].network
              ),
              value: fixtures.savingsValue
            }
          ],
          changeAddress: () => 'bcrt1qlckxrvk56kezy35xuw3tk5w5gkvnmjl0cahw3u',
          feeRate,
          network
        });
        expect(selectedUtxosDescriptors).not.toBeUndefined();
        expect(targets).not.toBeUndefined();
      },
      ESPLORA_CATCH_UP_TIME +
        BITCOIND_CATCH_UP_TIME +
        REGTEST_SERVER_CATCH_UP_TIME +
        TEST_TIME
    );
  });
});
