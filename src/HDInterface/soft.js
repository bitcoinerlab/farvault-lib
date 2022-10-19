import { HDInterface } from './HDInterface';
import { mnemonicToSeed } from 'bip39';
import { networks, getNetworkId, getNetworkCoinType } from '../networks';

import { checkNetwork, checkPurpose, checkExtPub } from '../check';
import memoize from 'lodash.memoize';

import { setExtPubPrefix, fromSeed, serializeDerivationPath } from '../bip44';

//Create the cache-key for memoize with the seed:
const rootDerivePath = memoize(
  (seed, root, path, network) => root.derivePath(path),
  //The root directly depends from the seed and network:
  (seed, root, path, network) =>
    seed.toString() + '_' + path + '_' + getNetworkId(network)
);

/**
 * Implements a Software-based HD interface.
 *
 * It is derived from {@link HDInterface} and it implements all the methods
 * described there.
 */
export class SoftHDInterface extends HDInterface {
  #mnemonic;
  #seed;
  /**
   * Constructor
   *
   * @param {object} params
   * @param {string} params.mnemonic Space separated list of BIP39 words used as mnemonic.
   */
  constructor({ mnemonic }) {
    super();
    if (typeof mnemonic === 'undefined') {
      console.log('WARNING: Using default mnemonic.');
      this.#mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    } else this.#mnemonic = mnemonic;
  }

  /**
   * Implements {@link HDInterface#init}.
   */
  async init() {
    this.#seed = await mnemonicToSeed(this.#mnemonic);
  }

  /**
   * Implements {@link HDInterface#createSigners}.
   */
  createSigners({ psbt, utxos, network = networks.bitcoin }) {
    const root = fromSeed(this.#seed, network);
    return utxos.map(utxo => $hash => {
      const signature = rootDerivePath(
        this.#seed,
        root,
        utxo.path,
        network
      ).sign($hash);
      //console.log({signature: signature.toString('hex')});
      return signature;
    });
  }

  /**
   * Implements {@link HDInterface#getExtPub}.
   */
  getExtPub({ purpose, accountNumber, network = networks.bitcoin }) {
    //No need to memoize
    checkPurpose(purpose);
    checkNetwork(network);
    if (!Number.isInteger(accountNumber) || accountNumber < 0)
      throw new Error('Invalid accountNumber');

    const root = fromSeed(this.#seed, network);
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
}
