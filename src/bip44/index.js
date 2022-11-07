/**
 * All the methods in this module assume
 * {@link https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#Path_levels BIP32}
 * HD address derivation and
 * {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#Path_levels BIP44 path levels}.
 *
 * These are the only `purposes` supported by this module:
 * * Legacy ({@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}).
 * * Nested segwit ({@link https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki BIP49}).
 * * Native segwit ({@link https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki BIP84}).
 *
 * @module bip44
 */

import { checkPurpose, checkNetwork, checkExtPub } from '../check';
import b58 from 'bs58check';
import {
  XPUB,
  YPUB,
  ZPUB,
  TPUB,
  UPUB,
  VPUB,
  PURPOSES,
  PUBVERSIONSIZE,
  PUBVERSIONS,
  LEGACY,
  NESTED_SEGWIT,
  NATIVE_SEGWIT,
  COINTYPE
} from '../constants';
import { networks, getNetworkCoinType, getNetworkId } from '../networks';

import { payments } from 'bitcoinjs-lib';
const { p2sh, p2wpkh, p2pkh } = payments;

import BIP32Factory from 'bip32';
import * as ecc from '../secp256k1';
let bjsBip32;
if (typeof ecc === 'object' && typeof ecc.then === 'function') {
  (async () => {
    //webpack modules will load WASM asynchronously. Node won't.
    bjsBip32 = BIP32Factory(await ecc);
  })();
} else {
  bjsBip32 = BIP32Factory(ecc);
}

/**
 * Takes a seed and returns an instance of a
 * {@link https://github.com/bitcoinjs/bip32 bitcoinjs-lib BIP32} class
 * represening a node.
 *
 * Use the returned instance to (among other things):
 * derive paths (get other nodes), sign hashes, get public or private keys, ...
 *
 * The seed could have been created from bip39 (using {@link https://github.com/bitcoinjs/bip39/ mnemonicToSeed}) or not.
 * We don't care at this point where it comes from.
 *
 * This is in fact a bip32 pure method (not bip44).
 * @param {Buffer} seed
 * @param {object} network A {@link module:networks.networks network}.
 * @returns {object} An instance of a {@link https://github.com/bitcoinjs/bip32 bitcoinjs-lib BIP32} class for the root node.
 */
export function fromSeed(seed, network = networks.bitcoin) {
  return bjsBip32.fromSeed(seed, network);
}

/**
 * Converts and returns an extended pub to use a new `purpose` as defined in
 * {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 *
 * The `purpose` specifies whether the extended pub corresponds to a
 * legacy, nested or native segwit wallet specification.
 *
 * Use this function as an interface to any
 * {@link https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki BIP32}
 * library that assumes the `purpose` is always that of a legacy wallet, even if the
 * wallet is used to represent segwit addresses.
 *
 * In other words, use this tool to convert extended pubs that start with "xpub"
 * or "tpub" prefixes to: "ypub", "zpub", or "upub" and "vpub", respectively.
 * And vice-versa.
 *
 * Note that converting the prefix is not as easy as changing the first 4 characters.
 * Use this function to manage conversions correctly.
 *
 * Motivation: initially,
 * {@link https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki BIP32}
 * assumed that an extended pub would always start
 * with an "xpub" or "tpub" prefix for mainnet and test networks respectively.
 * This is achieved by serializing some hardcoded `XPUBVERSION` and
 * `TPUBVERSION` bytes that were choosen so that the serialization would produce
 * "xpub" or "tpub" as an artifact.
 *
 * Then {@link https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki BIP49}
 * and
 * {@link https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki BIP84}
 * appeared and proposed to add different version bytes to
 * generate ypub, zpub, upub and vpub prefixes. ypub/upub were used to specify
 * nested segwit wallets and vpub/zpub to specify native segwit.
 *
 * Some BIP32 libs do not allow these new prefixes since BIP32 does only define
 * xpub and tpub.
 *
 * This is a handy tool to be able to interact with these libs.
 *
 * For example Ledger's javascript library returns an
 * {@link https://github.com/LedgerHQ/ledger-live/tree/develop/libs/ledgerjs/packages/hw-app-btc#getwalletxpub "xpub" prefix even when requesting a Segwit account}.
 *
 * Also {@link https://github.com/bitcoinjs/bip32 bitcoinjs-lib/bip32}
 * assumes only xpub or tpub prefixes.
 *
 * Note: Internally, FarVault always uses different prefixes for
 * {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44},
 * {@link https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki BIP49}
 * and {@link https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki BIP84}.
 *
 * @param {object} params
 * @param {string} params.extPub An extended pub.
 * @param {number} params.purpose The purpose we want to transform to: `LEGACY`,
 * `NATIVE_SEGWIT` or `NESTED_SEGWIT`.
 * @param {object} params.network A {@link module:networks.networks network}.
 * @returns {string} extPub An extended pub converted to `purpose`.
 */
export function setExtPubPrefix({ extPub, purpose, network }) {
  checkNetwork(network);
  checkPurpose(purpose);
  let data = b58.decode(extPub);
  data = data.slice(4);
  data = Buffer.concat([
    Buffer.from(
      PUBVERSIONS[getNetworkId(network)][purpose]
        .toString(16)
        .padStart(PUBVERSIONSIZE, 0),
      'hex'
    ),
    data
  ]);
  const newExtPub = b58.encode(data);
  checkExtPub({ extPub: newExtPub, network });
  return newExtPub;
}

/**
 * Derives an extended pub key for a particular `index` and `isChange`.
 *
 * See {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}
 * to learn about `isChange` and `index` parameters.
 *
 * Returns a pubkey (of type `Buffer`).
 *
 * @param {object} params
 * @param {string} params.extPub An extended pub key.
 * @param {number} params.index The index (an integer >= 0).
 * @param {boolean} params.isChange Whether it is a change address.
 * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
 * @returns {Buffer} A pubkey.
 */
export function deriveExtPub({
  extPub,
  index,
  isChange,
  network = networks.bitcoin
}) {
  checkExtPub({ extPub, network });
  //Read setExtPubPrefix to understand why we pass to LEGACY. This is is done
  //because bjsBip32 assumes that the extPub starts with "xpub" or "tpub" even
  //when dealing with Segwit addresses.
  return bjsBip32
    .fromBase58(setExtPubPrefix({ extPub, purpose: LEGACY, network }), network)
    .derive(isChange ? 1 : 0)
    .derive(index).publicKey;
}

/**
 * Takes an extended pub key and extracts its account number.
 *
 * It assumes {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44},
 * {@link https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki BIP49}
 * or {@link https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki BIP84}
 * derivation schemes.
 *
 * @param {object} params
 * @param {string} params.extPub An extended pub key.
 * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
 * @returns {number} The extracted account number.
 */
function getExtPubAccountNumber({ extPub, network = networks.bitcoin }) {
  checkExtPub({ extPub, network });
  const decoded = bjsBip32.fromBase58(
    setExtPubPrefix({ extPub, purpose: LEGACY, network }),
    network
  );
  if (decoded.depth !== 3) {
    throw new Error(
      'Cannot get account number if depth is not 3:' + decoded.depth
    );
  }
  const accountNumber = decoded.index & 0x7fffffff; //unharden
  return accountNumber;
}

/** Extracts the purpose from an extended pub.
 *
 * It assumes that the extended pub will have xpub, ypub, zpub, tpub, upub vpub
 * prefixes as defined in
 * {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44},
 * {@link https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki BIP49}
 * and {@link https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki BIP84}.
 *
 * Note that the network is not needed to extract the `purpose`. It's an optional
 * parameter. Pass it if you want to make an additional check and make sure that the prefix
 * matches with the network. For example regtest, signet or testnet networks
 * must have prefix tpub/upub/ypub while bitcoin must have: xpub/ypub/zpub.
 * @param {object} params
 * @param {string} params.extPub An extended pub key string
 * @param {object} params.network A {@link module:networks.networks network}. This is an optional parameter. Use it only to make an additional check and make sure that the extPub format matches this `network`
 * @returns {string} The purpose. Can be LEGACY, NESTED_SEGWIT or NATIVE_SEGWIT
 */
function getExtPubPurpose({ extPub, network }) {
  checkExtPub({ extPub, network });
  const extPubType = extPub.slice(0, 4);
  return PURPOSES[extPubType];
}

/**
 * Takes a string representation of a derivation path and returns the elements
 * that form it.
 *
 * It assumes {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44},
 * {@link https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki BIP49}
 * or {@link https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki BIP84}
 * derivation schemes.
 *
 * @param {string} path F.ex.: "84’/0’/0’/0/0" or "m/44'/1H/1h/0/0").
 * Note that "m/" is optional and h, H or ' can be used indistinctably.
 * @returns {object} Returns the `path` elements: `{ purpose: number, coinType: number, accountNumber:number, index:number, isChange:boolean }`.
 *
 * See {@link module:bip44.serializeDerivationPath serializeDerivationPath} for further description of the types of the returned object elements.
 */
export function parseDerivationPath(path) {
  //No need to memoize it
  let purpose;
  let coinType;
  let index;
  let isChange;
  let accountNumber;
  if (typeof path !== 'string') {
    throw new Error('Invalid path type');
  }
  //Remove initial m/ or M/ (if present)
  path = path.replace(/^(m\/)/i, '');
  //Sometimes hardened paths are writen with "h" or "H"
  path = path.replace(/H/gi, "'");
  const pathComponents = path.split('/');
  if (pathComponents.length !== 5) {
    throw new Error('Invalid number of elements in path');
  }

  if (
    pathComponents[0] !== `${LEGACY}'` &&
    pathComponents[0] !== `${NESTED_SEGWIT}'` &&
    pathComponents[0] !== `${NATIVE_SEGWIT}'`
  ) {
    throw new Error('Invalid purpose in path');
  } else {
    purpose = parseInt(pathComponents[0].replace("'", ''));
  }

  if (
    pathComponents[1] !== `${getNetworkCoinType(networks.bitcoin)}'` &&
    pathComponents[1] !== `${getNetworkCoinType(networks.testnet)}'` &&
    pathComponents[1] !== `${getNetworkCoinType(networks.signet)}'` &&
    pathComponents[1] !== `${getNetworkCoinType(networks.regtest)}'`
  ) {
    throw new Error('Invalid coin type in path');
  } else {
    coinType = parseInt(pathComponents[1]);
  }
  if (`${Math.abs(parseInt(pathComponents[2]))}'` !== pathComponents[2]) {
    throw new Error('Invalid account number in path');
  } else {
    accountNumber = parseInt(pathComponents[2]);
  }
  if (pathComponents[3] !== '0' && pathComponents[3] !== '1') {
    throw new Error('Invalid change type in path');
  } else {
    isChange = pathComponents[3] === '1';
  }
  if (`${Math.abs(parseInt(pathComponents[4]))}` !== pathComponents[4]) {
    throw new Error('Invalid index in path');
  } else {
    index = parseInt(pathComponents[4]);
  }

  return { purpose, coinType, accountNumber, index, isChange };
}

/**
 * Serializes a derivation path.
 *
 * It assumes {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44},
 * {@link https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki BIP49}
 * or {@link https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki BIP84}
 * derivation schemes.
 *
 * @param {object} params
 * @param {number} params.purpose `LEGACY`, `NESTED_SEGWIT` or `NATIVE_SEGWIT`.
 * @param {number} params.coinType 0 for Bitcoin mainnet, 1 for regtest, signet or testnet.
 * @param {number} params.accountNumber The account number as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 * @param {boolean} params.isChange Whether this is a change address or not as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 * @param {number} params.index The addres index within the account as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 *
 * @returns {string} The serialized derivation path.
 */
export function serializeDerivationPath({
  purpose,
  coinType,
  accountNumber,
  isChange,
  index
}) {
  //verify purpose, coinType and accountNumber:
  checkPurpose(purpose);
  if (
    Object.values(COINTYPE).includes(coinType) === false ||
    Number.isSafeInteger(accountNumber) === false ||
    accountNumber < 0
  ) {
    throw new Error('Incorrect parameters');
  }

  let path;
  if (typeof isChange === 'undefined') {
    if (typeof index !== 'undefined') {
      throw new Error('Incompatible parameters');
    }
    path = `${purpose}'/${coinType}'/${accountNumber}'`;
  } else {
    if (
      typeof isChange !== 'boolean' ||
      Number.isSafeInteger(index) === false ||
      index < 0
    ) {
      throw new Error('Incorrect parameters');
    }
    path = `${purpose}'/${coinType}'/${accountNumber}'/${
      isChange ? 1 : 0
    }/${index}`;
    //Further verification:
    const parsedDerivationPath = parseDerivationPath(path);
    Object.keys(parsedDerivationPath).map(key => {
      if (parsedDerivationPath[key] !== arguments[0][key]) {
        throw new Error('Error serializing a derivation path');
      }
    });
  }

  return path;
}

/**
 * Get a Bitcoin address from an exteneded pub.
 *
 * @param {object} params
 * @param {string} params.extPub An extended pub key string.
 * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
 * @param {boolean} params.isChange Whether this is a change address or not as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 * @param {number} params.index The addres index within the account as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 *
 * @returns {string} A Bitcoin address.
 */
export function getExtPubAddress({
  extPub,
  isChange = false,
  index = 0,
  network = networks.bitcoin
}) {
  const purpose = getExtPubPurpose({ extPub, network });
  let functionCall;
  if (purpose === LEGACY) {
    functionCall = getLegacyAddress;
  } else if (purpose === NESTED_SEGWIT) {
    functionCall = getNestedSegwitAddress;
  } else if (purpose === NATIVE_SEGWIT) {
    functionCall = getNativeSegwitAddress;
  } else {
    throw new Error('Invalid purpose!');
  }
  return functionCall({ extPub, isChange, index, network });
}
function getLegacyAddress({
  extPub,
  isChange = false,
  index = 0,
  network = networks.bitcoin
}) {
  if (extPub.slice(0, 4) !== XPUB && extPub.slice(0, 4) !== TPUB)
    throw new Error('Not xpub or tpub');
  return p2pkh({
    pubkey: deriveExtPub({ extPub, index, isChange, network }),
    network
  }).address;
}
function getNestedSegwitAddress({
  extPub,
  isChange = false,
  index = 0,
  network = networks.bitcoin
}) {
  if (extPub.slice(0, 4) !== YPUB && extPub.slice(0, 4) !== UPUB)
    throw new Error('Not ypub or upub');
  return p2sh({
    redeem: p2wpkh({
      pubkey: deriveExtPub({ extPub, index, isChange, network }),
      network
    }),
    network
  }).address;
}
function getNativeSegwitAddress({
  extPub,
  isChange = false,
  index = 0,
  network = networks.bitcoin
}) {
  if (extPub.slice(0, 4) !== ZPUB && extPub.slice(0, 4) !== VPUB)
    throw new Error('Not zpub or vpub');
  return p2wpkh({
    pubkey: deriveExtPub({ extPub, index, isChange, network }),
    network
  }).address;
}

/**
 * Given an extended pub key it returns the `address` that
 * corresponds to a derivation `path`.
 *
 * @async
 * @param {object} params
 * @param {HDSigner#getExtPub} params.extPubGetter An **async** function that resolves the extended pub key. Assumes bip44 paths.
 * @param {string} params.path F.ex.: "84’/0’/0’/0/0", "m/44'/1'/10'/0/0",
 * "m/49h/1h/8h/1/1"...
 * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}
 *
 * @returns {Promise<string>} A Bitcoin address.
 */
export async function getDerivationPathAddress({
  extPubGetter,
  path,
  network = networks.bitcoin
}) {
  const { purpose, accountNumber, index, isChange } = parseDerivationPath(path);
  const extPub = await extPubGetter({ purpose, accountNumber, network });
  return getExtPubAddress({ extPub, index, isChange, network });
}
