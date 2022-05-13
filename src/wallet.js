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
 * corresponds to a derivation `path`.
 *
 * @param {object} params
 * @param {module:HDInterface.extPubGetter} params.extPubGetter An **async** function that resolves the extended pub key.
 * @param {string} params.path F.ex.: "84’/0’/0’/0/0", "m/44'/1'/10'/0/0",
 * "m/49h/1h/8h/1/1"...
 * @param {object} [params.network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 *
 * @returns {string} A Bitcoin address
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
 * Appart from the funded `fundedPaths` and used `usedPaths`,
 * it also returns the `balance` in satoshis, and it also returns whether the
 * extPub has been `used` or not.
 *
 * Note that `used` denotes whether the extPub account has ever had any
 * funds at any point in the history even if it is currently unfunded. So it
 * might be the case that `used === true` and
 * `fundedPaths.length === 0`.
 *
 * @param {object} params
 * @param {string} params.extPub An extended pub key.
 * @param {object} [params.network=networks.bitcoin] A [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @param {function} [params.addressFetcher=blockstreamFetchAddress] One function that conforms to the values returned by {@link module:dataFetchers.esploraFetchAddress esploraFetchAddress}.
 * @returns {object} return
 *
 * @returns {boolean} return.used Whether that extended pub ever received sats (event if it's current balance is now 0)
 * @returns {number} return.balance Number of sats controlled by this extended pub key
 * @returns {string[]} return.usedPaths An array of derivation paths corresponding to addresses that have had funds at some point in the past.`.
 * @returns {string[]} return.fundedPaths An array of derivation paths corresponding to addresses with funds (>0 sats).`.
 */
async function fetchExtPubDerivationPaths({
  extPub,
  network = networks.bitcoin,
  addressFetcher = blockstreamFetchAddress,
  gapLimit = GAP_LIMIT
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
 * @param {object} params
 * @param {module:HDInterface.extPubGetter} params.extPubGetter An **async** function that resolves the extended pub key.
 * @param {object} [params.network=networks.bitcoin] A [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @param {function} [params.addressFetcher=blockstreamFetchAddress] One function that conforms to the values returned by {@link module:dataFetchers.esploraFetchAddress esploraFetchAddress}.
 *
 * @returns {object} return
 * @returns {string[]} return.usedPaths An array of derivation paths corresponding to addresses that have had funds at some point in the past.`.
 * @returns {string[]} return.fundedPaths An array of derivation paths corresponding to addresses with funds (>0 sats).`.
 */
export async function fetchDerivationPaths({
  extPubGetter,
  addressFetcher = blockstreamFetchAddress,
  network = networks.bitcoin,
  gapLimit = GAP_LIMIT,
  gapAccountLimit = GAP_ACCOUNT_LIMIT
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
 * Queries an online API to get all the UTXOS from a list of
 * derivation paths.
 *
 * @param {object} params
 * @param {module:HDInterface.extPubGetter} params.extPubGetter An **async** function that resolves the extended pub key.
 * @param {string[]} params.paths An array of derivation paths.`.
 * @param {function} [params.utxoFetcher=blockstreamFetchUTXOs] One function that conforms to the values returned by {@link module:dataFetchers.esploraFetchUTXOs esploraFetchUTXOs}.
 * @param {object} [params.network=networks.bitcoin] A [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @returns {object[]} An array of utxos: `[{tx, n, path}]`, where
 * `tx` is a hex encoded string of the transaction, `n` is the vout (an integer)
 * and `path` is a string. F.ex.: "84’/0’/0’/0/0" .
 */
export async function fetchUTXOs({
  extPubGetter,
  paths,
  utxoFetcher = blockstreamFetchUTXOs,
  network = networks.bitcoin
}) {
  const utxos = [];
  for (const path of paths) {
    const address = await getDerivationPathAddress({
      extPubGetter,
      path,
      network
    });
    const addressUTXOs = await utxoFetcher(address);
    addressUTXOs.map(utxo => utxos.push({ tx: utxo.tx, n: utxo.vout, path }));
  }
  return utxos;
}

/**
 * Return the usedPaths in canonical form: parsed, de-duplicated and sorted.
 *
 * Parse an array of serialized usedPaths (array of strings) and
 * return an array of parsed objects:
 * `[{ purpose, coinType, accountNumber, index, isChange }]`.
 *
 * It removes duplicated derivation paths and it throws if 
 * usedPaths do not respect the GAP_LIMIT or the GAP_ACCOUNT_LIMIT.
 *
 * In addition paths sorted in this order: coinType, purpose, accountNumber,
 * isChange, index ASC.
 *
 * @param {string[]} usedPaths An array of usedPaths.
 * Note that usedPaths may have been written using different formatting
 * options. For example:
 * ```
 * ["84’/0’/0’/0/0", "m/84'/0'/0'/0/0", "M/84'/0'/0'/0/0", "84H/0H/0H/0/0"]
 * ```
 * This function reads them, parses them and removes duplicates.
 * In addition it checks bad formatting and throws.

 * @returns {object[]} An array of used parsed paths without duplicates and
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
      if (
        parsedPath.coinType === prevParsedPath.coinType &&
        parsedPath.purpose === prevParsedPath.purpose &&
        parsedPath.accountNumber - prevParsedPath.accountNumber >
          gapAccountLimit
      ) {
        throw new Error(
          'Unreachable derivation path. Increase the GAP_ACCOUNT_LIMIT.'
        );
      }
      return parsedPath;
    });
    //Check GAP_LIMIT
    usedParsedPaths.reduce((prevParsedPath, parsedPath) => {
      if (
        parsedPath.coinType === prevParsedPath.coinType &&
        parsedPath.purpose === prevParsedPath.purpose &&
        parsedPath.accountNumber === prevParsedPath.accountNumber &&
        parsedPath.isChange === prevParsedPath.isChange &&
        parsedPath.index - prevParsedPath.index > gapLimit
      ) {
        throw new Error('Unreachable derivation path. Increase the GAP_LIMIT.');
      }
      return parsedPath;
    });
  } else if (usedParsedPaths.length === 1) {
    if (usedParsedPaths[0].accountNumber > gapAccountLimit) {
      throw new Error(
        'Unreachable derivation path. Increase the GAP_ACCOUNT_LIMIT.'
      );
    }
    if (usedParsedPaths[0].index > gapLimit) {
      throw new Error('Unreachable derivation path. Increase the GAP_LIMIT.');
    }
  }
  return usedParsedPaths;
}

/**
 * Given a set of usedPaths for the same mnemonic and network, an account
 * can be defined as the pair `{ purpose, accountNumber }`.
 *
 * Given a set of derivation paths with used utxos, this function chooses the
 * a **default account** pair using this criteria:
 *
 * It first selects the purpose used amongst all usedPaths in this order of
 * preference: *Native Segit > Segwit > Legacy.
 *
 * Then, it chooses the largest account number used for the previously selected
 * purpose.
 *
 * @param {string[]} usedPaths An array usedPaths.
 * @returns {object} `{ purpose, accountNumber }`.
 */
export function getDefaultAccount({
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
 * Given a set of used derivation paths it returns the next change address (if
 * `isChange === true`) or the next external address if `isChange === false`.
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
 * @param {string[]} params.usedPaths An array of used usedPaths.
 * It's important to pass used usedPaths (not only the currently funded
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
  usedPaths,
  purpose,
  accountNumber,
  isChange,
  network,
  gapLimit = GAP_LIMIT,
  gapAccountLimit = GAP_ACCOUNT_LIMIT
}) {
  checkNetwork(network);
  if (purpose) {
    checkPurpose(purpose);
  }
  if (typeof isChange !== 'boolean')
    throw new Error('Incorrect isChange parameter!');
  if (!Array.isArray(usedPaths)) throw new Error('Invalid usedPaths');

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

  return serializeDerivationPath({
    purpose:
      typeof purpose !== 'undefined' ? purpose : usedParsedPaths[0].purpose,
    coinType: getNetworkCoinType(network),
    accountNumber:
      typeof accountNumber !== 'undefined'
        ? accountNumber
        : usedParsedPaths[0].accountNumber,
    isChange,
    index: maxIndex + 1
  });
}

//function getNextDerivationPath({
//  usedPaths,
//  isChange,
//  network,
//  gapLimit = GAP_LIMIT,
//  gapAccountLimit = GAP_ACCOUNT_LIMIT
//}) {
//  return getNextExplicitDerivationPath({
//    usedPaths,
//    ...getDefaultAccount({ usedPaths, gapLimit, gapAccountLimit }),
//    isChange,
//    network
//  });
//}

/**
 * Returns the next change address.
 *
 * It uses {@link module:wallet.getNextExplicitDerivationPath getNextExplicitDerivationPath} particularized for {@link module:wallet.getDefaultAccount the `usedPaths`' default account} and
 * `isChange = true`.
 * @param {object} params
 * @param {string[]} params.usedPaths An array of used usedPaths.
 * It's important to pass used usedPaths (not only the currently funded
 * ones). Otherwise this function may end up picking an address used in the past
 * compromising the privacy of the user.
 * @param {object} params.network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * @returns {string} The next change derivation path.
 */
export function getNextChangeDerivationPath({
  usedPaths,
  network,
  gapLimit = GAP_LIMIT,
  gapAccountLimit = GAP_ACCOUNT_LIMIT
}) {
  return getNextExplicitDerivationPath({
    usedPaths,
    ...getDefaultAccount({ usedPaths, gapLimit, gapAccountLimit }),
    isChange: true,
    network
  });
}

/**
 * Returns the next available receiving address.
 *
 * It uses {@link module:wallet.getNextExplicitDerivationPath getNextExplicitDerivationPath} particularized for {@link module:wallet.getDefaultAccount the `usedPaths`' default account} and
 * `isChange = false`.
 * @param {object} params
 * @param {string[]} params.usedPaths An array of used usedPaths.
 * It's important to pass used usedPaths (not only the currently funded
 * ones). Otherwise this function may end up picking an address used in the past
 * compromising the privacy of the user.
 * @param {object} params.network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * @returns {string} The next external (receiving) derivation path.
 */
export function getNextReceivingDerivationPath({
  usedPaths,
  network,
  gapLimit = GAP_LIMIT,
  gapAccountLimit = GAP_ACCOUNT_LIMIT
}) {
  return getNextExplicitDerivationPath({
    usedPaths,
    ...getDefaultAccount({ usedPaths, gapLimit, gapAccountLimit }),
    isChange: false,
    network
  });
}
