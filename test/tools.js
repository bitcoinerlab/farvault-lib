/** @module test */

import { getDerivationPathAddress } from '../src/wallet';
import {
  initHDInterface,
  SOFT_HD_INTERFACE,
  NODEJS_TRANSPORT
} from '../src/HDInterface';
import { getNetworkCoinType, serializeDerivationPath } from '../src/bip32';
import bJs from 'bitcoinjs-lib';
import { RegtestUtils } from 'regtest-client';
import { spawn, spawnSync } from 'child_process';
import { kill } from 'process';
const regtestUtils = new RegtestUtils(bJs);

export const BITCOIND_CATCH_UP_TIME = 2000;
export const REGTEST_SERVER_CATCH_UP_TIME = 1000;

/**
 * Creates an HD wallet and funds it using mined coins from a regtest-server faucet.
 * It then mines 6 blocks to confirm payments.
 * @async
 * @param {string} mnemonic - space separated list of BIP39 words used as mnemonic.
 * @param {Object[]} addressesDescriptors - list of address descriptors that will get funds from the faucet.
 * @param {Object} addressesDescriptors[].extPub - object containing the purpose and accountNumber of the descriptor.
 * @param {string} addressesDescriptors[].extPub[].purpose - LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT.
 * @param {number} addressesDescriptors[].extPub[].accountNumber - account number.
 * @param {number} addressesDescriptors[].index - address number within the accountNumber.
 * @param {boolean} addressesDescriptors[].isChange - whether this address is a change address or not.
 * @param {number} addressesDescriptors[].value - number of sats that this address will receive.
 * @return {Promise<object>} `{
    HDInterface,
    extPubs,
    utxos,
    paths,
    network,
    regtestUtils
  }`
 */
export async function createTestWallet({
  type = SOFT_HD_INTERFACE,
  mnemonic,
  addressesDescriptors,
  network
}) {
  const HDInterface = await initHDInterface(type, {
    mnemonic,
    transport: NODEJS_TRANSPORT
  });
  const extPubs = [];
  const paths = [];
  const utxos = [];
  for (const descriptor of addressesDescriptors) {
    const { purpose, accountNumber } = descriptor.account;
    const { index, isChange } = descriptor;
    const extPub = await HDInterface.getExtPub({
      purpose,
      accountNumber,
      network
    });
    if (extPubs.indexOf(extPub) === -1) extPubs.push(extPub);

    const path = serializeDerivationPath({
      purpose,
      coinType: getNetworkCoinType(network),
      accountNumber,
      isChange,
      index
    });
    paths.push(path);
    const address = await getDerivationPathAddress({
      extPubGetter: HDInterface.getExtPub,
      path,
      network
    });

    const unspent = await regtestUtils.faucet(address, descriptor.value);
    const utxo = {
      tx: (await regtestUtils.fetch(unspent.txId)).txHex,
      n: unspent.vout,
      path
    };
    utxos.push(utxo);
    //console.log({ unspent, utxo });
  }
  // All of the above faucet payments will confirm
  const results = await regtestUtils.mine(6);
  return {
    HDInterface,
    extPubs,
    utxos,
    paths,
    network,
    regtestUtils
  };
}

export async function startTestingEnvironment({ startElectrs = true } = {}) {
  const bitcoind = spawn('./testing_environment/bitcoind.sh', {
    detached: true,
    stdio: 'ignore'
  });
  await new Promise(r => setTimeout(r, BITCOIND_CATCH_UP_TIME));
  const electrs = startElectrs
    ? spawn('./testing_environment/electrs.sh', {
        detached: true,
        stdio: 'ignore'
      })
    : undefined;
  const regtest_server = spawn('./testing_environment/regtest_server.sh', {
    detached: true,
    stdio: 'ignore'
  });
  await new Promise(r => setTimeout(r, REGTEST_SERVER_CATCH_UP_TIME));
  //wait until the command finishes:
  spawnSync('./testing_environment/createwallet.sh');
  return { bitcoind, electrs, regtest_server };
}
export async function stopTestingEnvironment({
  bitcoind,
  electrs,
  regtest_server
}) {
  kill(-bitcoind.pid, 'SIGKILL');
  if (electrs) kill(-electrs.pid, 'SIGKILL');
  kill(-regtest_server.pid, 'SIGKILL');
}
