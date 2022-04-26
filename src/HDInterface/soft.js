import { mnemonicToSeed } from 'bip39';
import { networks } from 'bitcoinjs-lib';
export async function init(
  mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
) {
  return await mnemonicToSeed(mnemonic);
}
import { checkNetwork, checkPurpose } from '../check';

import { setExtendedPubPrefix, getNetworkCoinType, fromSeed } from '../bip32';

export async function getExtendedPub(
  seed,
  { purpose, accountNumber, network = networks.testnet }
) {
  checkPurpose(purpose);
  checkNetwork(network);
  if (!Number.isInteger(accountNumber) || accountNumber < 0)
    throw new Error('Invalid accountNumber');

  const root = await fromSeed(seed, network);
  return setExtendedPubPrefix(
    root
      .derivePath(
        `${purpose}'/${getNetworkCoinType(network)}'/${accountNumber}'`
      )
      .neutered()
      .toBase58(),
    purpose,
    network
  );
}

export async function createSigners(seed, { psbt, utxos, network }) {
  const root = await fromSeed(seed, network);
  return utxos.map(utxo => $hash => {
    const signature = root.derivePath(utxo.derivationPath).sign($hash);
    return signature;
  });
}
