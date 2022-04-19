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

import {
  initHDInterface,
  LEDGER_NANO_INTERFACE,
  SOFT_HD_INTERFACE
} from '../../src/HDInterface';
import { getPubAddress, bip32UnspentAddresses } from '../../src/wallet';
import { esploraFetchAddress, esploraFetchUTXOS } from '../../src/dataFetchers';
import { coinselect } from '../../src/coinselect';

import {
  BIP32_PURPOSE,
  NESTED_SEGWIT,
  NATIVE_SEGWIT,
  LEGACY,
  ESPLORA_BASEURL
} from '../../src/walletConstants';
import { networkCoinType } from '../../src/bip32';

import { fixtures } from '../fixtures/wallet';

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
 * @param {Object[]} addressesDescriptors - list of address descriptors that will get funds from the faucet.
 * @param {Object} addressesDescriptors[].pub - object containing the pubType and accountNumber of the descriptor.
 * @param {string} addressesDescriptors[].pub[].pubType - '{x,y,z,t,u,v}pub'.
 * @param {number} addressesDescriptors[].pub[].accountNumber - account number.
 * @param {number} addressesDescriptors[].index - address number within the accountNumber.
 * @param {boolean} addressesDescriptors[].isChange - whether this address is a change address or not.
 * @param {number} addressesDescriptors[].value - number of sats that this address will receive.
 */
async function createWallet(mnemonic, addressesDescriptors) {
  const HDInterface = await initHDInterface(SOFT_HD_INTERFACE, { mnemonic });
  const pubs = [];
  const addresses = [];
  const utxos = [];
  for (const addressDescriptor of addressesDescriptors) {
    const { pubType, accountNumber } = addressDescriptor.pub;
    const { index, isChange } = addressDescriptor;
    const pub = await HDInterface.getPub({ pubType, accountNumber, network });
    pubs.indexOf(pub) === -1 && pubs.push(pub);

    const address = getPubAddress(pub, index, isChange, network);
    const derivationPath = `${BIP32_PURPOSE[pubType]}'/${networkCoinType(
      network
    )}'/${accountNumber}'/${isChange ? 1 : 0}/${index}`;
    addresses.push({ address, derivationPath });
    const unspent = await regtestUtils.faucet(address, addressDescriptor.value);
    const utxo = {
      tx: (await regtestUtils.fetch(unspent.txId)).txHex,
      n: unspent.vout,
      derivationPath
    };
    utxos.push(utxo);
    //console.log({ unspent, utxo });
  }
  // All of the above faucet payments will confirm
  const results = await regtestUtils.mine(6);
  return { HDInterface, pubs, utxos, addresses };
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

        const { HDInterface, addresses, utxos } = await createWallet(
          fixtures.mnemonic,
          fixtures.addressesDescriptors
        );

        //Give esplora some time to catch up
        await new Promise(r => setTimeout(r, ESPLORA_CATCH_UP_TIME));

        const walletAddresses = await bip32UnspentAddresses(
          HDInterface,
          network,
          address => esploraFetchAddress(address)
        );

        const walletUtxos = [];
        for (const address of walletAddresses) {
          const utxos = await esploraFetchUTXOS(address.address);
          utxos.map(utxo =>
            walletUtxos.push({
              tx: utxo.tx,
              n: utxo.vout,
              derivationPath: address.derivationPath
            })
          );
        }

        kill(-bitcoind.pid, 'SIGKILL');
        kill(-electrs.pid, 'SIGKILL');
        kill(-regtest_server.pid, 'SIGKILL');

        expect(walletUtxos).toEqual(expect.arrayContaining(utxos));
        expect(walletUtxos.length).toEqual(utxos.length);
        expect(walletAddresses).toEqual(expect.arrayContaining(addresses));
        expect(walletAddresses.length).toEqual(addresses.length);

        const { utxos: selectedUtxos, fee, targets } = coinselect({
          utxos: walletUtxos,
          targets: [{ address: walletAddresses[0].address }],
          feeRate: 1,
          network
        });
        console.log({ selectedUtxos, fee, targets });
      },
      ESPLORA_CATCH_UP_TIME +
        BITCOIND_CATCH_UP_TIME +
        REGTEST_SERVER_CATCH_UP_TIME +
        TEST_TIME
    );
  });
});
