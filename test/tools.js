/** @module test */

import fs from 'fs';
const TESTING_SERVERS_COOKIE = '/tmp/farvault_testing_environment_started';
import { getDerivationPathAddress } from '../src/wallet';
import {
  initHDInterface,
  SOFT_HD_INTERFACE,
  NODEJS_TRANSPORT
} from '../src/HDInterface';
import { getNetworkCoinType, serializeDerivationPath } from '../src/bip32';
import bJs, { networks } from 'bitcoinjs-lib';
import { RegtestUtils } from 'regtest-client';
import { spawn, spawnSync } from 'child_process';
import { kill } from 'process';
const regtestUtils = new RegtestUtils(bJs);

export const BITCOIND_CATCH_UP_TIME = 2000;
export const REGTEST_SERVER_CATCH_UP_TIME = 1000;

import { REGTEST_COINTYPE } from '../src/walletConstants';

/**
 * Creates an HD wallet and funds it using mined coins from a regtest-server faucet.
 * It then mines 6 blocks to confirm payments.
 * @async
 * @param {string} mnemonic - space separated list of BIP39 words used as mnemonic.
 * @param {Object[]} fundingDescriptors - list of address descriptors that will get funds from the faucet.
 * @param {string} fundingDescriptors[].purpose - LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT.
 * @param {number} fundingDescriptors[].accountNumber - account number.
 * @param {number} fundingDescriptors[].index - address number within the accountNumber.
 * @param {boolean} fundingDescriptors[].isChange - whether this address is a change address or not.
 * @param {number} fundingDescriptors[].value - number of sats that this address will receive.
 * @param {number} [fundingDescriptors[].coinType=REGTEST_COINTYPE] - Should always be REGTEST_COINTYPE
 * @param {object} [parameters.network=networks.regtest] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * @return {Promise<object>} `{
    HDInterface,
    extPubs,
    utxos,
    paths,
    network,
    regtestUtils
  }`
 */
export async function fundRegtest({
  type = SOFT_HD_INTERFACE,
  mnemonic,
  fundingDescriptors,
  network = networks.regtest
}) {
  if (network !== networks.regtest) {
    throw new Error('Tests are only run on a regtest chain');
  }
  const HDInterface = await initHDInterface(type, {
    mnemonic,
    transport: NODEJS_TRANSPORT
  });
  const extPubs = [];
  const paths = [];
  const utxos = [];
  for (const descriptor of fundingDescriptors) {
    if (
      typeof descriptor.coinType !== 'undefined' &&
      descriptor.coinType !== REGTEST_COINTYPE
    ) {
      throw new Error(
        'Tests are only run on a regtest chain. All address descriptors should belong to regtest.'
      );
    }
    const { index, isChange, purpose, accountNumber } = descriptor;
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
  if (utxos.length > 0) await regtestUtils.mine(6);
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
  if (fs.existsSync(TESTING_SERVERS_COOKIE)) {
    throw new Error(`

Cannot start the testing environment since it was not cleanly closed on previous run.
Try to manually stop the servers. Probably something like this will do the trick:

killall -9 Bitcoin-Qt electrs node bitcoind
#Note this will kill all the processes with those names so make it sure it does not break anything in your environment.

After killing the processes, you must manually remove the locking file:
rm ${TESTING_SERVERS_COOKIE}

    `);
  }
  fs.writeFileSync(TESTING_SERVERS_COOKIE, 'started');
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
  if (bitcoind) kill(-bitcoind.pid, 'SIGKILL');
  if (electrs) kill(-electrs.pid, 'SIGKILL');
  if (regtest_server) kill(-regtest_server.pid, 'SIGKILL');
  fs.unlinkSync(TESTING_SERVERS_COOKIE);
}
