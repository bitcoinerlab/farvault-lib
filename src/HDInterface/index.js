export const LEDGER_NANO_INTERFACE = 'LEDGER_NANO_INTERFACE';
export const SOFT_HD_INTERFACE = 'SOFT_HD_INTERFACE';

import * as ledgerNano from './ledgerNano';
import * as soft from './soft';

import { PUBTYPES } from '../walletConstants';
import { derivePubKey, parseDerivationPath, networkCoinType } from '../bip32';
async function getPublicKey(
  HDInterface,
  derivationPath,
  network = networks.testnet
) {
  const {
    purpose,
    coinType,
    accountNumber,
    index,
    isChange
  } = parseDerivationPath(derivationPath);
  if (networkCoinType(network) !== coinType) {
    throw new Error('Network mismatch');
  }
  const pubType = PUBTYPES[coinType][purpose];
  const pub = await HDInterface.getPub({ pubType, accountNumber, network });
  return derivePubKey(pub, index, isChange, network);
}

export async function initHDInterface(type, { mnemonic } = {}) {
  let HDInterface = null;
  if (type === LEDGER_NANO_INTERFACE) {
    const ledgerAppBtc = await ledgerNano.init();
    HDInterface = {
      type,
      getPub: (...args) => ledgerNano.getPub(ledgerAppBtc, ...args),
      createSigners: (...args) =>
        ledgerNano.createSigners(ledgerAppBtc, ...args)
    };
  } else if (type === SOFT_HD_INTERFACE) {
    if (typeof mnemonic === undefined) {
      console.log('WARN: Using default mnemonic!');
    }
    const seed = await soft.init(mnemonic);
    HDInterface = {
      type,
      getPub: (...args) => soft.getPub(seed, ...args),
      createSigners: (...args) => soft.createSigners(seed, ...args)
    };
  } else throw new Error('Cannot initialize this type of HD Wallet');

  return {
    ...HDInterface,
    getPublicKey: (...args) => getPublicKey(HDInterface, ...args)
  };
}
