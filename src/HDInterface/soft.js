import { mnemonicToSeed } from 'bip39';
import { networks } from 'bitcoinjs-lib';
import { BIP32_PURPOSE } from '../walletConstants';
export async function init(
  mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
) {
  return await mnemonicToSeed(mnemonic);
}
import {
  validateNetwork,
  validatePubType,
  validateCoinTypePubType
} from '../validation';

import { changePubType, networkCoinType, fromSeed } from '../bip32';

export async function getPub(
  seed,
  { pubType, accountNumber, network = networks.testnet }
) {
  validatePubType(pubType);
  validateNetwork(network);
  validateCoinTypePubType(networkCoinType(network), pubType);
  if (!Number.isInteger(accountNumber) || accountNumber < 0)
    throw new Error('Invalid accountNumber');

  const root = await fromSeed(seed, network);
  return changePubType(
    root
      .derivePath(
        `${BIP32_PURPOSE[pubType]}'/${networkCoinType(
          network
        )}'/${accountNumber}'`
      )
      .neutered()
      .toBase58(),
    pubType
  );
}

export async function createSigners(seed, { psbt, utxos, network }) {
  const root = await fromSeed(seed, network);
  return utxos.map(utxo => $hash => {
    const signature = root.derivePath(utxo.derivationPath).sign($hash);
    return signature;
  });
}
