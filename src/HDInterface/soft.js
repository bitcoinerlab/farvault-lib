import { mnemonicToSeed } from 'bip39';
import { networks } from 'bitcoinjs-lib';
export async function init(
  mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
) {
  return await mnemonicToSeed(mnemonic);
}
import { checkNetwork, checkPurpose, checkExtPub } from '../check';
import memoize from 'lodash.memoize';

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
  //No need to memoize
  checkPurpose(purpose);
  checkNetwork(network);
  if (!Number.isInteger(accountNumber) || accountNumber < 0)
    throw new Error('Invalid accountNumber');

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

//Create the cache-key for memoize with the seed:
const rootDerivePath = memoize(
  (seed, root, path, network) => root.derivePath(path),
  //The root directly depends from the seed and network:
  (seed, root, path, network) =>
    seed.toString() + '_' + path + '_' + network.bip32.public.toString()
);

export async function createSigners(
  seed,
  { psbt, utxos, network = networks.bitcoin }
) {
  const root = await fromSeed(seed, network);
  return utxos.map(utxo => $hash => {
    const signature = rootDerivePath(seed, root, utxo.path, network).sign(
      $hash
    );
    //console.log({signature: signature.toString('hex')});
    return signature;
  });
}

//export async function createSigners(
//  seed,
//  { psbt, utxos, network = networks.bitcoin }
//) {
//  const root = await fromSeed(seed, network);
//  return utxos.map(utxo => $hash => {
//    const signature = root.derivePath(utxo.path).sign($hash);
//    return signature;
//  });
//}
