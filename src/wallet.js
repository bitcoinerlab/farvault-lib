/** @module wallet */
//Good explanation of bips
//https://learnmeabitcoin.com/technical/derivation-paths#fn1

import {
  initHDInterface,
  LEDGER_NANO_INTERFACE,
  SOFT_HD_INTERFACE
} from './HDInterface';
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
import { checkNetwork, checkExtPub } from './check';

/**
 * Given a {@link module:HDInterface HDInterface} it returns the `address` that
 * corresponds to a `derivationPath`.
 *
 * @param {object} HDInterface See {@link module:HDInterface HDInterface}.
 * @param {string} derivationPath F.ex.: "84’/0’/0’/0/0", "m/44'/1'/10'/0/0",
 * "m/49h/1h/8h/1/1"...
 * @param {Object} network [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 * @returns {string} A Bitcoin address
 */
export async function getDerivationPathAddress({
  HDInterface,
  derivationPath,
  network = networks.testnet
}) {
  const { purpose, accountNumber, index, isChange } = parseDerivationPath(
    derivationPath
  );
  const extPub = await HDInterface.getExtPub({
    purpose,
    accountNumber,
    network
  });
  return getExtPubAddress(extPub, index, isChange, network);
}

export function getExtPubAddress(
  extPub,
  index = 0,
  isChange = false,
  network = networks.bitcoin
) {
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
  return functionCall(extPub, index, isChange, network);
}
function getLegacyAddress(
  extPub,
  index = 0,
  isChange = false,
  network = networks.bitcoin
) {
  if (extPub.slice(0, 4) !== XPUB && extPub.slice(0, 4) !== TPUB)
    throw new Error('Not xpub or tpub');
  return p2pkh({
    pubkey: deriveExtPub({ extPub, index, isChange, network }),
    network
  }).address;
}
function getNestedSegwitAddress(
  extPub,
  index = 0,
  isChange = false,
  network = networks.bitcoin
) {
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
function getNativeSegwitAddress(
  extPub,
  index = 0,
  isChange = false,
  network = networks.bitcoin
) {
  if (extPub.slice(0, 4) !== ZPUB && extPub.slice(0, 4) !== VPUB)
    throw new Error('Not zpub or vpub');
  return p2wpkh({
    pubkey: deriveExtPub({ extPub, index, isChange, network }),
    network
  }).address;
}

/**
 * Queries an Internet service to get all the addresses of an extended pub key
 * that have funds.
 *
 * This gets all the funds of particular extended pub. For example, to get the
 * funds of account 0 of LEGACY addresses.
 *
 * It returns the `balance` in satoshis, the funded `derivationPaths`,
 * and it also returns whether it has been `used`. Note that "used" here means
 * that this extPub account might have had some funds in the past even if
 * it does not have anymore.
 *
 * @param {string} extPub An extended pub key.
 * @param {Object} network A [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @param {function} addressFetcher One function that conforms to the values returned by {@link module:dataFetchers.esploraFetchAddress esploraFetchAddress}.
 * @returns {object} return
 * @returns {boolean} return.used Whether that extended pub ever received sats (event if it's current balance is now 0)
 * @returns {number} return.balance Number of sats controlled by this extended pub key
 * @returns {string[]} return.derivationPaths An array of derivationPaths corresponding to addresses with funds (>0 sats).`.
 */
export async function fetchExtPubFundedDerivationPaths(
  extPub,
  network = networks.bitcoin,
  addressFetcher = blockstreamFetchAddress
) {
  checkExtPub({ extPub, network });
  const derivationPaths = [];
  let balance = 0;
  let extPubUsed = false;

  for (const isChange of [true, false]) {
    for (
      let index = 0, consecutiveUnusedAddresses = 0;
      consecutiveUnusedAddresses < GAP_LIMIT;
      index++
    ) {
      const address = getExtPubAddress(extPub, index, isChange, network);
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
        derivationPaths.push(derivationPath);
        balance += addressBalance;
      }
      if (used === true) {
        consecutiveUnusedAddresses = 0;
        extPubUsed = true;
      } else {
        consecutiveUnusedAddresses++;
      }
    }
  }

  return {
    derivationPaths,
    balance,
    used: extPubUsed
  };
}

/**
 * Queries an Internet service to get all the addresses with
 * positive funds that can be derived from a HD wallet. This includes P2WPKH,
 * P2SH-P2WPKH and P2PKH extended pub types.
 *
 * This gets all the funds of a HD Wallet (including all accounts).
 * It tries to get funds from LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT wallets.
 *
 * For each address type, it starts checking if account number #0 has funds.
 * Every time that one acount number has been used, then this function tries to
 * get funds from the following account number. This is done even if the current
 * account number has no funds (because they have been spent).
 *
 * It returns the list of derivationPaths that control the funded addresses.
 *
 * @param {object} HDInterface An HDInterface as the one in {@link module:HDInterface}.
 * @param {Object} network A [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @param {function} addressFetcher One function that conforms to the values returned by {@link module:dataFetchers.esploraFetchAddress esploraFetchAddress}.
 * @returns {string[]} return.derivationPaths An array of derivationPaths corresponding to addresses with funds (>0 sats).`.
 */
export async function fetchFundedDerivationPaths(
  HDInterface,
  addressFetcher = blockstreamFetchAddress,
  network = networks.bitcoin
) {
  const fundedDerivationPaths = [];
  for (const purpose of [LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT]) {
    for (
      let accountNumber = 0, consecutiveUnusedAccounts = 0;
      consecutiveUnusedAccounts < GAP_ACCOUNT_LIMIT;
      accountNumber++
    ) {
      const extPub = await HDInterface.getExtPub({
        purpose,
        accountNumber,
        network
      });
      const { derivationPaths, used } = await fetchExtPubFundedDerivationPaths(
        extPub,
        network,
        addressFetcher
      );
      if (used) {
        consecutiveUnusedAccounts = 0;
        fundedDerivationPaths.push(...derivationPaths);
      } else {
        consecutiveUnusedAccounts++;
      }
    }
  }
  return fundedDerivationPaths;
}

/**
 * Queries an Internet service to get all the UTXOS from a list of
 * derivationPaths.
 *
 * For each address type, it starts checking if account number #0 has funds.
 * Every time that one acount number has been used, then this function tries to
 * get funds from the following account number. This is done even if the current
 * account number has no funds (because they have been spent).
 *
 * @param {object} HDInterface An HDInterface as the one in {@link module:HDInterface}.
 * @param {string[]} derivationPaths An array of derivationPaths from the HDInterface.`.
 * @param {function} utxoFetcher One function that conforms to the values returned by {@link module:dataFetchers.esploraFetchUTXOs esploraFetchUTXOs}.
 * @param {Object} network A [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @returns {object[]} An array of utxos: `[{tx, n, derivationPath}]`, where `tx` is a hex encoded string of the transaction,
 * `n` is the vout (an integer) and `derivationPath` is a string. F.ex.: "84’/0’/0’/0/0" .
 */
export async function fetchUTXOs(
  HDInterface,
  derivationPaths,
  utxoFetcher = blockstreamFetchUTXOs,
  network = networks.bitcoin
) {
  const utxos = [];
  for (const derivationPath of derivationPaths) {
    const address = await getDerivationPathAddress({
      HDInterface,
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

export async function ledgerBalance(
  network = networks.testnet,
  addressFetcher = blockstreamFetchAddress,
  utxoFetcher = blockstreamFetchUTXOs
) {
  //console.log(
  //  await utxoFetcher(
  //    'tb1q9wjm2s3dwk6jvalnw0v3aervtnj9rgv035pyar',
  //    networks.testnet
  //  )
  //);

  const utxos = [];
  const HDInterface = await initHDInterface(LEDGER_NANO_INTERFACE);
  const derivationPaths = await fetchFundedDerivationPaths(
    HDInterface,
    addressFetcher,
    network
  );
  //console.log({ derivationPaths });
  for (const derivationPath of derivationPaths) {
    const address = await getDerivationPathAddress({
      HDInterface,
      derivationPath,
      network
    });
    const addressUtxos = await utxoFetcher(address, network);
    addressUtxos.map(addressUtxo =>
      utxos.push({
        ...addressUtxo,
        derivationPath
      })
    );
  }
  //console.log({ utxos });
  return derivationPaths;
}

export async function softwareBalance(
  network = networks.testnet,
  addressFetcher = blockstreamFetchAddress,
  utxoFetcher = blockstreamFetchUTXOs
) {
  const HDInterface = await initHDInterface(SOFT_HD_INTERFACE);
  const derivationPaths = await fetchFundedDerivationPaths(
    HDInterface,
    addressFetcher,
    network
  );
  //console.log({ derivationPaths });
  for (const derivationPath of derivationPaths) {
    const address = await getDerivationPathAddress({
      HDInterface,
      derivationPath,
      network
    });
    const addressUtxos = await utxoFetcher(address, network);
    addressUtxos.map(addressUtxo =>
      utxos.push({ ...addressUtxo, derivationPath })
    );
  }
  //console.log({ utxos });
  return derivationPaths;
}
