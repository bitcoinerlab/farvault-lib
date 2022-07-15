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
} from './constants';

import { blockstreamFetchAddress, blockstreamFetchUtxos } from './dataFetchers';
import { checkPurpose, checkNetwork, checkExtPub } from './check';

/**
 * Given an extended pub key it returns the `address` that
 * corresponds to a derivation `path`.
 *
 * @async
 * @param {object} params
 * @param {module:HDInterface.getExtPub} params.extPubGetter An **async** function that resolves the extended pub key.
 * @param {string} params.path F.ex.: "84’/0’/0’/0/0", "m/44'/1'/10'/0/0",
 * "m/49h/1h/8h/1/1"...
 * @param {object} [params.network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 *
 * @returns {Promise<string>} A Bitcoin address
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
function getExtPubAddress({
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
 * Appart from the funded `fundedPaths` and used `usedPaths`,
 * it also returns the `balance` in satoshis, and it also returns whether the
 * extPub has been `used` or not.
 *
 * Note that `used` denotes whether the extPub account has ever had any
 * funds at any point in the history even if it is currently unfunded. So it
 * might be the case that `used === true` and
 * `fundedPaths.length === 0`.
 *
 * @async
 * @param {object} params
 * @param {string} params.extPub An extended pub key.
 * @param {function} [params.addressFetcher=blockstreamFetchAddress] One function that conforms to the values returned by {@link module:dataFetchers.esploraFetchAddress esploraFetchAddress}.
 * @param {number} [params.gapLimit=GAP_LIMIT] The gap limit. See [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#Address_gap_limit).
 * @param {object} [params.network=networks.bitcoin] A [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @returns {Promise<object>} return
 *
 * @returns {boolean} return.used Whether that extended pub ever received sats (event if it's current balance is now 0)
 * @returns {number} return.balance Number of sats controlled by this extended pub key
 * @returns {string[]} return.usedPaths An array of derivation paths corresponding to addresses that have had funds at some point in the past.
 * @returns {string[]} return.fundedPaths An array of derivation paths corresponding to addresses with funds (>0 sats).
 */
async function fetchExtPubDerivationPaths({
  extPub,
  addressFetcher = blockstreamFetchAddress,
  gapLimit = GAP_LIMIT,
  network = networks.bitcoin
}) {
  checkExtPub({ extPub, network });
  const fundedPaths = [];
  const usedPaths = [];
  let balance = 0;
  let extPubUsed = false;

  //GAP_LIMIT  minimum value must be 1, which means that GAPS are not allowed.
  //https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#Address_gap_limit
  //If the software hits GAP_LIMIT unused addresses in a row, it expects there
  //are no used addresses beyond this point.
  for (const isChange of [true, false]) {
    for (
      let index = 0, consecutiveUnusedAddresses = 0;
      consecutiveUnusedAddresses < gapLimit;
      index++
    ) {
      const address = getExtPubAddress({ extPub, index, isChange, network });
      const { used, balance: addressBalance } = await addressFetcher(
        address,
        network
      );
      const accountNumber = getExtPubAccountNumber({ extPub, network });
      const purpose = getExtPubPurpose({ extPub, network });
      const path = serializeDerivationPath({
        purpose,
        coinType: getNetworkCoinType(network),
        accountNumber,
        isChange,
        index
      });

      if (addressBalance !== 0) {
        fundedPaths.push(path);
        balance += addressBalance;
      }
      if (used === true) {
        usedPaths.push(path);
        consecutiveUnusedAddresses = 0;
        extPubUsed = true;
      } else {
        consecutiveUnusedAddresses++;
      }
    }
  }

  return {
    fundedPaths,
    usedPaths,
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
 * addresses: `fundedPaths` and `usedPaths`.
 *
 * Note that `fundedPaths` is a subset of `usedPaths`.
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
 * @async
 * @param {object} params
 * @param {module:HDInterface.getExtPub} params.extPubGetter An **async** function that resolves the extended pub key.
 * @param {function} [params.addressFetcher=blockstreamFetchAddress] One function that conforms to the values returned by {@link module:dataFetchers.esploraFetchAddress esploraFetchAddress}.
 * @param {number} [params.gapLimit=GAP_LIMIT] The gap limit. See [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#Address_gap_limit).
 * @param {number} [params.gapAccountLimit=GAP_ACCOUNT_LIMIT] The gap account limit: Number of consecutive unused accounts that can be hit. If the software hits `gapAccountLimit` unused accounts in a row, it expects there are no used accounts beyond this point.
 * @param {object} [params.network=networks.bitcoin] A [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 *
 * @returns {Promise<object>} return
 * @returns {string[]} return.usedPaths An array of derivation paths corresponding to addresses that have had funds at some point in the past.
 * @returns {string[]} return.fundedPaths An array of derivation paths corresponding to addresses with funds (>0 sats).
 */
export async function fetchDerivationPaths({
  extPubGetter,
  addressFetcher = blockstreamFetchAddress,
  gapLimit = GAP_LIMIT,
  gapAccountLimit = GAP_ACCOUNT_LIMIT,
  network = networks.bitcoin
}) {
  const fundedPaths = [];
  const usedPaths = [];
  for (const purpose of [LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT]) {
    for (
      let accountNumber = 0, consecutiveUnusedAccounts = 0;
      consecutiveUnusedAccounts < gapAccountLimit;
      accountNumber++
    ) {
      const extPub = await extPubGetter({ purpose, accountNumber, network });
      const {
        fundedPaths: extPubFundedDerivationPaths,
        usedPaths: extPubUsedDerivationPaths,
        used
      } = await fetchExtPubDerivationPaths({
        extPub,
        network,
        addressFetcher,
        gapLimit
      });
      if (used) {
        consecutiveUnusedAccounts = 0;
        usedPaths.push(...extPubUsedDerivationPaths);
        //Might be empty if used but not funded:
        fundedPaths.push(...extPubFundedDerivationPaths);
      } else {
        consecutiveUnusedAccounts++;
      }
    }
  }
  return { fundedPaths, usedPaths };
}

/**
 * Queries an online API to get all the utxos from a list of
 * derivation paths.
 *
 * @async
 * @param {object} params
 * @param {module:HDInterface.getExtPub} params.extPubGetter An **async** function that resolves the extended pub key.
 * @param {string[]} params.paths An array of derivation paths.
 * @param {function} [params.utxoFetcher=blockstreamFetchUtxos] One function that conforms to the values returned by {@link module:dataFetchers.esploraFetchUtxos esploraFetchUtxos}.
 * @param {object} [params.network=networks.bitcoin] A [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @returns {Promise<object[]>} An array of utxos: `[{tx, n, path}]`, where
 * `tx` is a hex encoded string of the transaction, `n` is the vout (an integer)
 * and `path` is a string. F.ex.: "84’/0’/0’/0/0" .
 */
export async function fetchDerivationPathsUtxos({
  extPubGetter,
  paths,
  utxoFetcher = blockstreamFetchUtxos,
  network = networks.bitcoin
}) {
  const utxos = [];
  for (const path of paths) {
    const address = await getDerivationPathAddress({
      extPubGetter,
      path,
      network
    });
    const addressUtxos = await utxoFetcher(address);
    addressUtxos.map(utxo => utxos.push({ tx: utxo.tx, n: utxo.vout, path }));
  }
  return utxos;
}

/**
 * Checks if the derivation paths `usedPaths` meet `gapLimit` and 
 * `gapAccountLimit` restrictions and returns normalized parsed paths.
 * That is: parsed, de-duplicated and sorted.
 *
 * Detailed explanation:
 *
 * Parse an array of serialized used derivation paths (array of strings) and
 * returns an array of parsed paths with the following structure:
 * `[{ purpose, coinType, accountNumber, index, isChange }]`.
 *
 * It removes duplicated derivation paths and it throws if 
 * derivation paths do not respect the gap limit or the gap account limit.
 *
 * In addition, derivation paths are sorted in this order: `coinType, purpose, accountNumber,
 * isChange, index`.
 *
 * This means it orders all derivation paths by `coinType` in
 * ascending order (Bitcoin=0, Testnet=1), but if some have the same `coinType`
 * then it sorts them by `purpose` in ascending order (LEGACY=44,
 * NESTED_SEGWIT=49, NATIVE_SEGWIT=849), but if some have the same `purpose` it
 * sorts them by `isChange` order (isChange=false, isChange=true), but if some
 * have the same `isChange` it sorts them by `index`.
 *
 * Behaviour is similar to SQL `ORDER BY` keyworkd with several columns.
 *
 * Note that `usedPaths` elements may have been written using different formatting
 * options. For example:
 * ```
 * ["84’/0’/0’/0/0", "m/84'/0'/0'/0/0", "M/84'/0'/0'/0/0", "84H/0H/0H/0/0"]
 * ```
 *This function is able to correctly parse all of them.
 *
 * @param {object} params
 * @param {string[]} params.usedPaths An array of used derivation paths.
 *
 * `usedPaths` can contain different purposes (Legacy, Nested or Segwit) and
 * different account numbers as well. This is because it is possible to create
 * vaults using different accounts if all of them can be spawned from the same
 * seed. The software chooses the default receiving account using
 * {@link module:wallet.getDefaultAccount getDefaultAccount}. Note that `gapLimit`
 * and `gapAccountLimit` are checked and enforced for each purpose detected
 * in the `usedPaths` list.
 * @param {number} [params.gapLimit=GAP_LIMIT] The gap limit. See [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#Address_gap_limit).
 * @param {number} [params.gapAccountLimit=GAP_ACCOUNT_LIMIT] The gap account limit: Number of consecutive unused accounts that can be hit. If the software hits `gapAccountLimit` unused accounts in a row, it expects there are no used accounts beyond this point.

 * @returns {object[]} An array of used parsed derivation paths without duplicates and
 * sorted in this order: coinType, purpose, accountNumber, isChange, index ASC.
 */
function normalizeDerivationPaths({
  usedPaths,
  gapLimit = GAP_LIMIT,
  gapAccountLimit = GAP_ACCOUNT_LIMIT
}) {
  const usedParsedPaths = [];
  //serialized using a canonical (unique) form.
  const _usedPaths = [];
  if (Number.isSafeInteger(gapLimit) === false || gapLimit < 1)
    throw new Error('Invalid gapLimit');
  if (Number.isSafeInteger(gapAccountLimit) === false || gapAccountLimit < 1)
    throw new Error('Invalid gapAccountLimit');
  if (!Array.isArray(usedPaths)) throw new Error('Invalid usedPaths');
  for (const usedPath of usedPaths) {
    //This will throw if bad formatted derivation path
    const usedParsedPath = parseDerivationPath(usedPath);
    const _usedPath = serializeDerivationPath(usedParsedPath);
    if (_usedPaths.indexOf(_usedPath) < 0) {
      _usedPaths.push(_usedPath);
      usedParsedPaths.push(usedParsedPath);
    }
  }

  //Sort them in this order: coinType, purpose, accountNumber, isChange, index ASC
  usedParsedPaths.sort((a, b) => a.coinType - b.coinType);
  usedParsedPaths.sort((a, b) =>
    a.coinType === b.coinType ? a.purpose - b.purpose : 0
  );
  usedParsedPaths.sort((a, b) =>
    a.coinType === b.coinType && a.purpose === b.purpose
      ? a.accountNumber - b.accountNumber
      : 0
  );
  usedParsedPaths.sort((a, b) =>
    a.coinType === b.coinType &&
    a.purpose === b.purpose &&
    a.accountNumber === b.accountNumber
      ? a.isChange - b.isChange
      : 0
  );
  usedParsedPaths.sort((a, b) =>
    a.coinType === b.coinType &&
    a.purpose === b.purpose &&
    a.accountNumber === b.accountNumber &&
    a.isChange === b.isChange
      ? a.index - b.index
      : 0
  );
  if (usedParsedPaths.length > 1) {
    //Check GAP_ACCOUNT_LIMIT
    usedParsedPaths.reduce((prevParsedPath, parsedPath) => {
      const prevAccountNumber =
        parsedPath.coinType === prevParsedPath.coinType &&
        parsedPath.purpose === prevParsedPath.purpose
          ? prevParsedPath.accountNumber
          : -1;
      if (parsedPath.accountNumber - prevAccountNumber > gapAccountLimit) {
        throw new Error(
          'Unreachable derivation path. Increase the gap account limit.'
        );
      }
      return parsedPath;
    });
    //Check GAP_LIMIT
    usedParsedPaths.reduce((prevParsedPath, parsedPath) => {
      const prevIndex =
        parsedPath.coinType === prevParsedPath.coinType &&
        parsedPath.purpose === prevParsedPath.purpose &&
        parsedPath.accountNumber === prevParsedPath.accountNumber &&
        parsedPath.isChange === prevParsedPath.isChange
          ? prevParsedPath.index
          : -1;
      if (parsedPath.index - prevIndex > gapLimit) {
        throw new Error('Unreachable derivation path. Increase the gap limit.');
      }
      return parsedPath;
    });
  } else if (usedParsedPaths.length === 1) {
    if (usedParsedPaths[0].accountNumber >= gapAccountLimit) {
      throw new Error(
        'Unreachable derivation path. Increase the gap account limit.'
      );
    }
    if (usedParsedPaths[0].index >= gapLimit) {
      throw new Error('Unreachable derivation path. Increase the gap limit.');
    }
  }
  return usedParsedPaths;
}

/**
 * Given a set of used derivation paths for the same mnemonic and network, an account
 * can be defined as the pair `{ purpose, accountNumber }`.
 *
 * Given a set of derivation paths with used utxos, this function chooses the
 * a **default account** pair using this criteria:
 *
 * It first selects the purpose used amongst all usedPaths in this order of
 * preference: Native Segit > Segwit > Legacy.
 *
 * Then, it chooses the largest account number used for the previously selected
 * purpose.
 *
 * `gapAccountLimit` is checked and enforced for each purpose detected in the list of usedPaths.
 *
 * @param {object} params
 * @param {string[]} param.usedPaths An array usedPaths.
 * @param {number} [params.gapLimit=GAP_LIMIT] The gap limit. See [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#Address_gap_limit).
 * @param {number} [params.gapAccountLimit=GAP_ACCOUNT_LIMIT] The gap account limit: Number of consecutive unused accounts that can be hit. If the software hits `gapAccountLimit` unused accounts in a row, it expects there are no used accounts beyond this point.
 * @returns {object} `{ purpose, accountNumber }`.
 */
function getDefaultAccount({
  usedPaths,
  gapLimit = GAP_LIMIT,
  gapAccountLimit = GAP_ACCOUNT_LIMIT
}) {
  if (!Array.isArray(usedPaths)) throw new Error('Invalid usedPaths');
  const usedParsedPaths = normalizeDerivationPaths({
    usedPaths,
    gapLimit,
    gapAccountLimit
  });
  if (usedParsedPaths.length === 0) {
    return { purpose: NATIVE_SEGWIT, accountNumber: 0 };
  }
  let purpose = LEGACY;
  for (const parsedPath of usedParsedPaths) {
    if (parsedPath.purpose === NESTED_SEGWIT && purpose === LEGACY)
      purpose = NESTED_SEGWIT;
    if (parsedPath.purpose === NATIVE_SEGWIT) purpose = NATIVE_SEGWIT;
  }
  let accountNumber = 0;
  for (const parsedPath of usedParsedPaths) {
    if (
      parsedPath.purpose === purpose &&
      accountNumber < parsedPath.accountNumber
    )
      accountNumber = parsedPath.accountNumber;
  }
  return { purpose, accountNumber };
}

/**
 * Given a set of used derivation paths `usedPaths` it selects and returns the
 * last one that was used to receive change (if `isChange === true`) or
 * the last path that received funds from external addresses if
 * `isChange === false`.
 *
 * It returns `-1` if no paths have been used yet for the passed parameters.
 *
 * You don't need to pass the purpose or accountNumber. The function internally
 * finds the common purpose or accountNumber among all the derivation paths.
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
 * @param {string[]} params.usedPaths An non-empty array of used derivation
 * paths.
 * It's important to pass used derivation paths (not only the currently funded
 * ones). Otherwise the privacy of the user can be compromised for address
 * reuse.
 *
 * `usedPaths` can contain different purposes (Legacy, Nested or Segwit) and
 * different account numbers as well. This is because it is possible to create
 * vaults using different accounts if all of them can be spawned from the same
 * seed. The software chooses the default receiving account using
 * {@link module:wallet.getDefaultAccount getDefaultAccount}. Note that `gapLimit`
 * and `gapAccountLimit` are checked and enforced for each purpose detected
 * in the `usedPaths` list.
 * compromising the privacy of the user.
 * @param {number} [params.purpose] The purpose we want to transform to: LEGACY,
 * NATIVE_SEGWIT or NESTED_SEGWIT.
 * @param {number} [params.accountNumber] The account number as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 * @param {boolean} params.isChange Whether this is a change address or not as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 * @param {number} [params.gapLimit=GAP_LIMIT] The gap limit. See [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#Address_gap_limit).
 * @param {number} [params.gapAccountLimit=GAP_ACCOUNT_LIMIT] The gap account limit: Number of consecutive unused accounts that can be hit. If the software hits `gapAccountLimit` unused accounts in a row, it expects there are no used accounts beyond this point.
 * @param {object} [params.network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * @returns {string} The last derivation path used or -1 if it has not been used yet.
 *
 */

function getLastDerivationPath({
  usedPaths,
  purpose,
  accountNumber,
  isChange,
  gapLimit = GAP_LIMIT,
  gapAccountLimit = GAP_ACCOUNT_LIMIT,
  network = networks.bitcoin
}) {
  checkNetwork(network);
  if (purpose) {
    checkPurpose(purpose);
  }
  if (typeof isChange !== 'boolean')
    throw new Error('Incorrect isChange parameter!');
  //Try to serialize index 0. This is run to make it throw if invalid parameters
  if (typeof purpose !== 'undefined' && typeof accountNumber !== 'undefined')
    serializeDerivationPath({
      purpose,
      coinType: getNetworkCoinType(network),
      accountNumber,
      isChange,
      index: 0
    });
  if (!Array.isArray(usedPaths)) throw new Error('Invalid usedPaths');

  //Order the paths and check gap limits and gap account limits
  const usedParsedPaths = normalizeDerivationPaths({
    usedPaths,
    gapLimit,
    gapAccountLimit
  });

  if (
    usedParsedPaths.length === 0 &&
    (typeof purpose === 'undefined' || typeof accountNumber === 'undefined')
  ) {
    throw new Error(
      'Must specify a purpose AND an account number since this wallet has never been used!'
    );
  }
  if (usedParsedPaths.length > 1) {
    usedParsedPaths.reduce((prevParsedPath, parsedPath) => {
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
  for (const parsedPath of usedParsedPaths) {
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

  if (maxIndex === -1) {
    //Impossible to find an account used based on the input parameters.
    return -1;
  } else {
    return serializeDerivationPath({
      purpose:
        typeof purpose !== 'undefined' ? purpose : usedParsedPaths[0].purpose,
      coinType: getNetworkCoinType(network),
      accountNumber:
        typeof accountNumber !== 'undefined'
          ? accountNumber
          : usedParsedPaths[0].accountNumber,
      isChange,
      index: maxIndex
    });
  }
}

/**
 * It returns the next receiving derivation path available. If
 * `isChange === false` it returns the next path available to receive
 * funds from external addresses. If `isChange === false` it returns the next
 * path available for change.
 *
 * Optionally, it omits at least `skip` addresses to leave the next available
 * derivation paths for other uses. The function verifies that `skip` is less
 * than the `gapLimit`. Otherwise, it throws.
 *
 * After omitting `skip` addresses, it returns the first derivation path
 * that is not in the array of `prereservedPaths`.
 * However, it returns the last path before reaching the `gapLimit` if it is
 * reached while omitting `prereservedPaths`. It returns it anyway, regardless
 * of whether it's in the list of `prereservedPaths` or not. And so
 * `prereservedPaths` is a list of nice-to-omit paths (but not required).
 *
 * Motivation for the `prereservedPaths` and `skip` parameters:
 *
 * You can use this function to get the derivation path that
 * will receive the protected funds in a vault after unlocking them.
 *
 * The final address that receives the funds after unlock belongs to the
 * same original account from which the funds were taken.
 *
 * This receiving address is chosen and encoded into a pre-signed transaction
 * during the vault creation process. Then this address is
 * stored off-chain and it is impossible to know which one it is by looking at
 * the blockchain.
 *
 * However, this same account can still receive new funds in new addresses.
 * Due to the way BIP32 works, it is impossible to reserve the receiving
 * addresses used for vaults as they are generated deterministically. And so
 * other software wallets handling the same HD seed can unnoticedly end up using
 * the receiving address of a vault.
 *
 * The best we can do for selecting the vault's receiving addresses is to choose
 * a derivation path that is very far down the sequence of derivation paths
 * (omitting `skip` addresses). But we ensure that it will be within the
 * `gapLimit` to ensure that any wallet implementation can still find it.
 * Address overlapping can still occur, but this reduces the chances if this
 * account is rarely used after funds are locked.
 *
 * Another thing to keep in mind is that an account can have multiple vaults
 * associated with it. This is handled by passing an array of
 * `prereservedPaths` that correspond to the receiving addresses of these other
 * vaults. Then, the software tries not to use these derivation paths if possible.
 *
 * Note on address reuse: when address overlapping occurs, funds remain
 * completely secure, but [privacy may be sligthly reduced](https://en.bitcoin.it/wiki/Address_reuse).
 * This is usually never a problem and this function greatly reduces that
 * possibility anyway, even if this doesn't usually matter to the average user.
 * If address reuse is really a concern for the user, it can be alleviated by
 * increasing `gapLimit` and `skip` parameters.
 *
 *
 * @param {object} params
 * @param {string[]} params.usedPaths An array of strings of used derivation paths.
 * It's important to pass used derivation paths (not only the currently funded
 * ones). Otherwise this function may end up picking an address used in the past
 * compromising the privacy of the user.
 *
 * `usedPaths` can contain different purposes (Legacy, Nested or Segwit) and
 * different account numbers as well. This is because it is possible to create
 * vaults using different accounts if all of them can be spawned from the same
 * seed. The software chooses the default receiving account using
 * {@link module:wallet.getDefaultAccount getDefaultAccount}. Note that `gapLimit`
 * and `gapAccountLimit` are checked and enforced for each purpose detected
 * in the `usedPaths` list.
 * @param {boolean} params.isChange Whether this is a change address or not as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
 * @param {string[]} [params.prereservedPaths=Array(0)] This array of paths contains
 * derivation paths that it would be nice not to choose. However, the software
 * does not offer any guarantee that these will not be chosen. Use this array
 * to pass derivation paths of other vaults' receiving addresses.
 * @param {number} [params.skip=0] The number of empty addresses
 * left after the next available derivation path. `skip = 0` tries to use the next
 * available one (does leave 0 empty addresses). `skip = 19` would mean it uses
 * the last available address if `gapLimit = 20`. The `skip` number is a target
 * number. The final number of addresss skiped may be larger if they are in the
 * list of `prereservedPaths` (unless `gapLimit` is reached).
 * @param {number} [params.gapLimit=GAP_LIMIT] The gap limit. See [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#Address_gap_limit).
 * @param {number} [params.gapAccountLimit=GAP_ACCOUNT_LIMIT] The gap account limit: Number of consecutive unused accounts that can be hit. If the software hits `gapAccountLimit` unused accounts in a row, it expects there are no used accounts beyond this point.
 * @param {object} [params.network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * @returns {string} The next external (receiving) derivation path.
 */
export function getNextDerivationPath({
  usedPaths,
  prereservedPaths = [],
  isChange,
  skip = 0,
  gapLimit = GAP_LIMIT,
  gapAccountLimit = GAP_ACCOUNT_LIMIT,
  network = networks.bitcoin
}) {
  if (typeof isChange !== 'boolean')
    throw new Error('Incorrect isChange parameter!');
  if (
    Number.isSafeInteger(gapLimit) === false ||
    Number.isSafeInteger(skip) === false ||
    skip < 0 ||
    skip >= gapLimit
  )
    throw new Error('Invalid skip');
  if (!Array.isArray(prereservedPaths))
    throw new Error('Invalid prereservedPaths');
  if (isChange === true && skip !== 0)
    console.log(
      'You are trying to skip change addresses. Are you sure you want to do this?'
    );
  if (isChange === true && prereservedPaths.length !== 0)
    console.log(
      'You have prereserved change addresses. Are you sure you want to do this?'
    );

  const defaultAccount = getDefaultAccount({
    usedPaths,
    gapLimit,
    gapAccountLimit
  });

  const lastPath = getLastDerivationPath({
    usedPaths,
    ...defaultAccount,
    gapLimit,
    gapAccountLimit,
    isChange,
    network
  });

  let nextParsedPath;
  let maxIndexWithinGap;
  if (lastPath === -1) {
    nextParsedPath = {
      ...defaultAccount,
      coinType: getNetworkCoinType(network),
      index: skip,
      isChange
    };
    maxIndexWithinGap = gapLimit - 1;
  } else {
    const lastParsedPath = parseDerivationPath(lastPath);
    nextParsedPath = {
      ...lastParsedPath,
      index: lastParsedPath.index + skip + 1
    };
    maxIndexWithinGap = lastParsedPath.index + gapLimit;
  }

  prereservedPaths
    .map(prereservedPath => parseDerivationPath(prereservedPath))
    .filter(
      prereservedParsedPath =>
        prereservedParsedPath.purpose === nextParsedPath.purpose &&
        prereservedParsedPath.coinType === nextParsedPath.coinType &&
        prereservedParsedPath.accountNumber === nextParsedPath.accountNumber &&
        prereservedParsedPath.isChange === nextParsedPath.isChange &&
        prereservedParsedPath.index + 1 <= maxIndexWithinGap
    )
    .sort((prevPath, path) => prevPath.index - path.index)
    .map(prereservedParsedPath => {
      if (prereservedParsedPath.index === nextParsedPath.index)
        nextParsedPath.index = prereservedParsedPath.index + 1;
    });
  return serializeDerivationPath(nextParsedPath);
}

export const exportedForTesting = {
  getLastDerivationPath,
  normalizeDerivationPaths,
  getDefaultAccount
};
