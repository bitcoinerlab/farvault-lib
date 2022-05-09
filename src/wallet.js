/** @module wallet */

import {
  deriveExtPub,
  getNetworkCoinType,
  getExtPubAccountNumber,
  getExtPubPurpose,
  parseDerivationPath,
  serializeDerivationPath
} from './bip32';

import { payments, networks } from 'bitcoinjs-lib';
const { p2sh, p2wpkh, p2pkh } = payments;

import {
  XPUB,
  YPUB,
  ZPUB,
  TPUB,
  UPUB,
  VPUB,
  GAP_LIMIT,
  GAP_ACCOUNT_LIMIT,
  LEGACY,
  NESTED_SEGWIT,
  NATIVE_SEGWIT
} from './walletConstants';

import { blockstreamFetchAddress, blockstreamFetchUTXOs } from './dataFetchers';
import { checkPurpose, checkNetwork, checkExtPub } from './check';

/**
 * Given an extended pub key it returns the `address` that
 * corresponds to a `derivationPath`.
 *
 * @param {object} params
 * @param {module:HDInterface.extPubGetter} params.extPubGetter An **async** function that resolves the extended pub key.
 * @param {string} params.derivationPath F.ex.: "84’/0’/0’/0/0", "m/44'/1'/10'/0/0",
 * "m/49h/1h/8h/1/1"...
 * @param {object} [params.network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 *
 * @returns {string} A Bitcoin address
 */
export async function getDerivationPathAddress({
  extPubGetter,
  derivationPath,
  network = networks.bitcoin
}) {
  const { purpose, accountNumber, index, isChange } = parseDerivationPath(
    derivationPath
  );
  const extPub = await extPubGetter({ purpose, accountNumber, network });
  return getExtPubAddress({ extPub, index, isChange, network });
}

/**
 * Get a Bitcoin address from an exteneded pub.
 *
 * @param {object} params
 * @param {string} params.extPub An extended pub key string.
 * @param {object} [params.network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @param {boolean} params.isChange Whether this is a change address or not as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 * @param {number} params.index The addres index within the account as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 *
 * @returns {string} A Bitcoin address
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
 * Queries an online API to get all the addresses of an extended pub key
 * that have funds. It then pushes the funded addresses derivation paths to an
 * array that is finally returned. It also puses the used addresses
 * derivation paths to another array.
 *
 * Appart from the funded `fundedDerivationPaths` and `usedDerivationPaths`,
 * it also returns the `balance` in satoshis, and it also returns whether the
 * extPub has been `used` or not.
 *
 * Note that `used` denotes whether the extPub account has ever had any
 * funds at any point in the history even if it is currently unfunded. So it
 * might be the case that `used === true` and
 * `fundedDerivationPaths.length === 0`.
 *
 * @param {object} params
 * @param {string} params.extPub An extended pub key.
 * @param {object} [params.network=networks.bitcoin] A [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @param {function} [params.addressFetcher=blockstreamFetchAddress] One function that conforms to the values returned by {@link module:dataFetchers.esploraFetchAddress esploraFetchAddress}.
 * @returns {object} return
 *
 * @returns {boolean} return.used Whether that extended pub ever received sats (event if it's current balance is now 0)
 * @returns {number} return.balance Number of sats controlled by this extended pub key
 * @returns {string[]} return.usedDerivationPaths An array of derivationPaths corresponding to addresses that have had funds at some point in the past.`.
 * @returns {string[]} return.fundedDerivationPaths An array of derivationPaths corresponding to addresses with funds (>0 sats).`.
 */
async function fetchExtPubDerivationPaths({
  extPub,
  network = networks.bitcoin,
  addressFetcher = blockstreamFetchAddress
}) {
  checkExtPub({ extPub, network });
  const fundedDerivationPaths = [];
  const usedDerivationPaths = [];
  let balance = 0;
  let extPubUsed = false;

  for (const isChange of [true, false]) {
    for (
      let index = 0, consecutiveUnusedAddresses = 0;
      consecutiveUnusedAddresses < GAP_LIMIT;
      index++
    ) {
      const address = getExtPubAddress({ extPub, index, isChange, network });
      const { used, balance: addressBalance } = await addressFetcher(
        address,
        network
      );
      const accountNumber = getExtPubAccountNumber({ extPub, network });
      const purpose = getExtPubPurpose({ extPub, network });
      const derivationPath = serializeDerivationPath({
        purpose,
        coinType: getNetworkCoinType(network),
        accountNumber,
        isChange,
        index
      });

      if (addressBalance !== 0) {
        fundedDerivationPaths.push(derivationPath);
        balance += addressBalance;
      }
      if (used === true) {
        usedDerivationPaths.push(derivationPath);
        consecutiveUnusedAddresses = 0;
        extPubUsed = true;
      } else {
        consecutiveUnusedAddresses++;
      }
    }
  }

  return {
    fundedDerivationPaths,
    usedDerivationPaths,
    balance,
    used: extPubUsed
  };
}

/**
 * Queries an online API to get all the addresses that can be derived from
 * an HD wallet that:
 * * Currently have positive funds: `funded`.
 * * Either now or at any point in history have had positive funds: `used`.
 * Instead of returning the addresses it returns the derivation paths of these
 * addresses: `fundedDerivationPaths` and `usedDerivationPaths`.
 *
 * Note that `fundedDerivationPaths` is a subset of `usedDerivationPaths`.
 *
 * The way this function works is as follows:
 *
 * For each LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT purposes:
 *
 * It first checks if account number #0 has ever had any funds (has been used).
 * And it collects both all the addresses (derivation paths) that have been used
 * and the ones that still have funds.
 *
 * Every time that one acount number has been used, then this function tries to
 * get funds from the following account number until it cannot find used
 * accounts.
 *
 * It finally returns both the used and funded derivation paths of all accounts
 * and purposes.
 *
 * @param {object} params
 * @param {module:HDInterface.extPubGetter} params.extPubGetter An **async** function that resolves the extended pub key.
 * @param {object} [params.network=networks.bitcoin] A [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @param {function} [params.addressFetcher=blockstreamFetchAddress] One function that conforms to the values returned by {@link module:dataFetchers.esploraFetchAddress esploraFetchAddress}.
 *
 * @returns {object} return
 * @returns {string[]} return.usedDerivationPaths An array of derivationPaths corresponding to addresses that have had funds at some point in the past.`.
 * @returns {string[]} return.fundedDerivationPaths An array of derivationPaths corresponding to addresses with funds (>0 sats).`.
 */
export async function fetchDerivationPaths({
  extPubGetter,
  addressFetcher = blockstreamFetchAddress,
  network = networks.bitcoin
}) {
  const fundedDerivationPaths = [];
  const usedDerivationPaths = [];
  for (const purpose of [LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT]) {
    for (
      let accountNumber = 0, consecutiveUnusedAccounts = 0;
      consecutiveUnusedAccounts < GAP_ACCOUNT_LIMIT;
      accountNumber++
    ) {
      const extPub = await extPubGetter({ purpose, accountNumber, network });
      const {
        fundedDerivationPaths: extPubFundedDerivationPaths,
        usedDerivationPaths: extPubUsedDerivationPaths,
        used
      } = await fetchExtPubDerivationPaths({
        extPub,
        network,
        addressFetcher
      });
      if (used) {
        consecutiveUnusedAccounts = 0;
        usedDerivationPaths.push(...extPubUsedDerivationPaths);
        //Might be empty if used but not funded:
        fundedDerivationPaths.push(...extPubFundedDerivationPaths);
      } else {
        consecutiveUnusedAccounts++;
      }
    }
  }
  return { fundedDerivationPaths, usedDerivationPaths };
}

/**
 * Queries an online API to get all the UTXOS from a list of
 * derivationPaths.
 *
 * @param {object} params
 * @param {module:HDInterface.extPubGetter} params.extPubGetter An **async** function that resolves the extended pub key.
 * @param {string[]} params.derivationPaths An array of funded derivationPaths.`.
 * @param {function} [params.utxoFetcher=blockstreamFetchUTXOs] One function that conforms to the values returned by {@link module:dataFetchers.esploraFetchUTXOs esploraFetchUTXOs}.
 * @param {object} [params.network=networks.bitcoin] A [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @returns {object[]} An array of utxos: `[{tx, n, derivationPath}]`, where
 * `tx` is a hex encoded string of the transaction, `n` is the vout (an integer)
 * and `derivationPath` is a string. F.ex.: "84’/0’/0’/0/0" .
 */
export async function fetchUTXOs({
  extPubGetter,
  derivationPaths,
  utxoFetcher = blockstreamFetchUTXOs,
  network = networks.bitcoin
}) {
  const utxos = [];
  for (const derivationPath of derivationPaths) {
    const address = await getDerivationPathAddress({
      extPubGetter,
      derivationPath,
      network
    });
    const addressUTXOs = await utxoFetcher(address);
    addressUTXOs.map(utxo =>
      utxos.push({ tx: utxo.tx, n: utxo.vout, derivationPath })
    );
  }
  return utxos;
}

/**
 * Given a set of derivationPaths for the same mnemonic and network, an account
 * can be defined as the pair `{ purpose, accountNumber }`.
 *
 * Given a set of derivation paths with used utxos, this function chooses the
 * a **default account** pair using this criteria:
 *
 * It first selects the purpose used amongst all derivationPaths in this order of
 * preference: *Native Segit > Segwit > Legacy.
 *
 * Then, it chooses the largest account number used for the previously selected
 * purpose.
 *
 * @param {string[]} derivationPaths An array derivationPaths.
 * @returns {object} `{ purpose, accountNumber }`.
 */
export function getDefaultAccount(derivationPaths) {
  if (!Array.isArray(derivationPaths))
    throw new Error('Invalid derivationPaths');
  const parsedPaths = [];
  for (const derivationPath of derivationPaths) {
    //This will throw if bad formatted derivationPath
    parsedPaths.push(parseDerivationPath(derivationPath));
  }
  if (parsedPaths.length === 0) {
    return { purpose: NATIVE_SEGWIT, accountNumber: 0 };
  }
  let purpose = LEGACY;
  for (const parsedPath of parsedPaths) {
    if (parsedPath.purpose === NESTED_SEGWIT && purpose === LEGACY)
      purpose = NESTED_SEGWIT;
    if (parsedPath.purpose === NATIVE_SEGWIT) purpose = NATIVE_SEGWIT;
  }
  let accountNumber = 0;
  for (const parsedPath of parsedPaths) {
    if (
      parsedPath.purpose === purpose &&
      accountNumber < parsedPath.accountNumber
    )
      accountNumber = parsedPath.accountNumber;
  }
  return { purpose, accountNumber };
}

/**
 * Given a set of used derivation paths it returns the next change address (if
 * `isChange === true`) or the next external address if `isChange === false`.
 *
 * You don't need to pass the purpose or accountNumber. The function internally
 * finds the common purpose or accountNumber amongs all the derivation paths.
 *
 * However, you must explicitly pass an account number if the derivation paths
 * that are passed belong to different account numbers.
 *
 * In addition, you must specify both a purpose AND an account number if the
 * derivation paths passed belong to different purposes. F.ex.: if they belong
 * to nested Segwit and legacy addresses.
 *
 * Normally purposes and accountNumber are not passed in other wallet libraries.
 * We decided to give this option because FarVault allows creating transactions
 * with outputs that belong to different purposes and accountNumbers.
 *
 * @param {object} params
 * @param {string[]} params.derivationPaths An array of used derivationPaths.
 * It's important to pass used derivationPaths (not only the currently funded
 * ones). Otherwise this function may end up picking an address used in the past
 * compromising the privacy of the user.
 * @param {number} [params.purpose] The purpose we want to transform to: LEGACY,
 * NATIVE_SEGWIT or NESTED_SEGWIT.
 * @param {number} [params.accountNumber] The account number as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 * @param {boolean} params.isChange Whether this is a change address or not as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 * @param {object} params.network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * @returns {string} The next derivation path.
 *
 */

export function getNextExplicitDerivationPath({
  derivationPaths,
  purpose,
  accountNumber,
  isChange,
  network
}) {
  checkNetwork(network);
  if (purpose) {
    checkPurpose(purpose);
  }
  if (typeof isChange !== 'boolean')
    throw new Error('Incorrect isChange parameter!');
  if (!Array.isArray(derivationPaths))
    throw new Error('Invalid derivationPaths');

  //console.log({ derivationPaths, isChange, accountNumber });

  const parsedPaths = [];
  for (const derivationPath of derivationPaths) {
    //{ purpose, coinType, accountNumber, index, isChange }
    parsedPaths.push(parseDerivationPath(derivationPath));
  }

  if (
    parsedPaths.length === 0 &&
    (typeof purpose === 'undefined' || typeof accountNumber === 'undefined')
  ) {
    throw new Error(
      'Must specify a purpose AND an account number since this wallet has never been used!'
    );
  }
  if (parsedPaths.length > 1) {
    parsedPaths.reduce((prevParsedPath, parsedPath) => {
      if (
        typeof accountNumber === 'undefined' &&
        prevParsedPath.accountNumber !== parsedPath.accountNumber
      ) {
        throw new Error(
          'Must specify an account number since derivation paths have a mix of account numbers!'
        );
      }
      if (
        (typeof purpose === 'undefined' ||
          typeof accountNumber === 'undefined') &&
        prevParsedPath.purpose !== parsedPath.purpose
      ) {
        throw new Error(
          'Must specify a purpose AND an account number since derivation paths have a mix of purposes!'
        );
      }
      //Note that if derivation paths have both different purposes AND different
      //account numbers you must pass both accountNumber and purpose. But this
      //is already taken into account in the condition above.
      return parsedPath;
    });
  }

  const filteredParsedPaths = [];
  for (const parsedPath of parsedPaths) {
    if (parsedPath.coinType !== getNetworkCoinType(network)) {
      throw new Error('The coin type does not math this network');
    }
    if (
      parsedPath.isChange === isChange &&
      (typeof purpose === 'undefined' || parsedPath.purpose === purpose) &&
      (typeof accountNumber === 'undefined' ||
        parsedPath.accountNumber === accountNumber)
    ) {
      filteredParsedPaths.push(parsedPath);
    }
  }
  //console.log({ filteredParsedPaths });
  const maxIndex = filteredParsedPaths.reduce(function (
    prevMaxIndex,
    currPath
  ) {
    return Math.max(prevMaxIndex, currPath.index);
  },
  -1);

  return serializeDerivationPath({
    purpose: typeof purpose !== 'undefined' ? purpose : parsedPaths[0].purpose,
    coinType: getNetworkCoinType(network),
    accountNumber:
      typeof accountNumber !== 'undefined'
        ? accountNumber
        : parsedPaths[0].accountNumber,
    isChange,
    index: maxIndex + 1
  });
}

function getNextDerivationPath({ derivationPaths, isChange, network }) {
  return getNextExplicitDerivationPath({
    derivationPaths,
    ...getDefaultAccount(derivationPaths),
    isChange,
    network
  });
}

/**
 * Returns the next change address.
 *
 * It uses {@link module:wallet.getNextExplicitDerivationPath getNextExplicitDerivationPath} particularized for {@link module:wallet.getDefaultAccount the `derivationPaths`' default account} and
 * `isChange = true`.
 * @param {object} params
 * @param {string[]} params.derivationPaths An array of used derivationPaths.
 * It's important to pass used derivationPaths (not only the currently funded
 * ones). Otherwise this function may end up picking an address used in the past
 * compromising the privacy of the user.
 * @param {object} params.network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * @returns {string} The next change derivation path.
 */
export function getNextChangeDerivationPath({ derivationPaths, network }) {
  return getNextExplicitDerivationPath({
    derivationPaths,
    ...getDefaultAccount(derivationPaths),
    isChange: true,
    network
  });
}

/**
 * Returns the next available receiving address.
 *
 * It uses {@link module:wallet.getNextExplicitDerivationPath getNextExplicitDerivationPath} particularized for {@link module:wallet.getDefaultAccount the `derivationPaths`' default account} and
 * `isChange = false`.
 * @param {object} params
 * @param {string[]} params.derivationPaths An array of used derivationPaths.
 * It's important to pass used derivationPaths (not only the currently funded
 * ones). Otherwise this function may end up picking an address used in the past
 * compromising the privacy of the user.
 * @param {object} params.network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * @returns {string} The next external (receiving) derivation path.
 */
export function getNextReceivingDerivationPath({ derivationPaths, network }) {
  return getNextExplicitDerivationPath({
    derivationPaths,
    ...getDefaultAccount(derivationPaths),
    isChange: false,
    network
  });
}
