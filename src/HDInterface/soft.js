import { mnemonicToSeed } from 'bip39';
import { networks } from 'bitcoinjs-lib';
export async function init(
  mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
) {
  return await mnemonicToSeed(mnemonic);
}
import { checkNetwork, checkPurpose, checkExtPub } from '../check';

import {
  setExtPubPrefix,
  getNetworkCoinType,
  fromSeed,
  serializeDerivationPath
} from '../bip32';

export async function getExtPub(
  seed,
  { purpose, accountNumber, network = networks.bitcoin }
) {
  checkPurpose(purpose);
  checkNetwork(network);
  if (!Number.isInteger(accountNumber) || accountNumber < 0)
    throw new Error('Invalid accountNumber');

  //Study possible problems memoizing this function since it returns a Promise
  console.log('CACHE! recreating this fromSeed everytime is stupid and slow');
  //Study possible problems memoizing this function since it returns a Promise
  //
  const root = await fromSeed(seed, network);
  const extPub = setExtPubPrefix({
    extPub: root
      .derivePath(
        serializeDerivationPath({
          purpose,
          coinType: getNetworkCoinType(network),
          accountNumber
        })
      )
      .neutered()
      .toBase58(),
    purpose,
    network
  });
  checkExtPub({ extPub, accountNumber, network });
  return extPub;
}

export async function createSigners(
  seed,
  { psbt, utxos, network = networks.bitcoin }
) {
  //Study possible problems memoizing this function since it returns a Promise
  console.log('CACHE! recreating this fromSeed everytime is stupid and slow');
  //Study possible problems memoizing this function since it returns a Promise
  //
  const root = await fromSeed(seed, network);
  return utxos.map(utxo => $hash => {
    const signature = root.derivePath(utxo.path).sign($hash);
    return signature;
  });
}
