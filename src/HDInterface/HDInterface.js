import memoize from 'lodash.memoize';

import { deriveExtPub, parseDerivationPath } from '../bip44';
import { networks, getNetworkId, getNetworkCoinType } from '../networks';

/** Base Class implementing an interface to a HD wallet. */
export class HDInterface {
  constructor() {
    //Overwrite own method to allow memoization
    this.getPublicKey = memoize(
      this.getPublicKey,
      (path, network = networks.bitcoin) => {
        return path + getNetworkId(network);
      }
    );
  }

  /**
   * @type {module:HDInterface.getExtPub}
   */
  getExtPub() {}
  /**
   * @type {module:HDInterface.createSigners}
   */
  createSigners() {}

  async getPublicKey(path, network = networks.bitcoin) {
    const { purpose, coinType, accountNumber, index, isChange } =
      parseDerivationPath(path);
    if (getNetworkCoinType(network) !== coinType) {
      throw new Error('Network mismatch');
    }
    const extPub = await this.getExtPub({
      purpose,
      accountNumber,
      network
    });
    return deriveExtPub({ extPub, index, isChange, network });
  }

  close() {}
}
