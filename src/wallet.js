/** @module wallet */
//Good explanation of bips
//https://learnmeabitcoin.com/technical/derivation-paths#fn1

import {
  initHDInterface,
  LEDGER_NANO_INTERFACE,
  SOFT_HD_INTERFACE
} from './HDInterface';
import {
  deriveExtendedPub,
  getNetworkCoinType,
  getExtendedPubAccountNumber,
  getExtendedPubPurpose,
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

import { blockstreamFetchAddress, blockstreamFetchUTXOS } from './dataFetchers';
import { checkNetwork } from './check';

export async function getDerivationPathAddress(
  HDInterface,
  derivationPath,
  network = networks.testnet
) {
  const { purpose, accountNumber, index, isChange } = parseDerivationPath(
    derivationPath
  );
  const extendedPub = await HDInterface.getExtendedPub({
    purpose,
    accountNumber,
    network
  });
  return getExtendedPubAddress(extendedPub, index, isChange, network);
}

export function getExtendedPubAddress(
  extendedPub,
  index = 0,
  isChange = false,
  network = networks.bitcoin
) {
  const purpose = getExtendedPubPurpose(extendedPub, network);
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
  return functionCall(extendedPub, index, isChange, network);
}
function getLegacyAddress(
  extendedPub,
  index = 0,
  isChange = false,
  network = networks.bitcoin
) {
  if (extendedPub.slice(0, 4) !== XPUB && extendedPub.slice(0, 4) !== TPUB)
    throw new Error('Not xpub or tpub');
  return p2pkh({
    pubkey: deriveExtendedPub(extendedPub, index, isChange, network),
    network
  }).address;
}
function getNestedSegwitAddress(
  extendedPub,
  index = 0,
  isChange = false,
  network = networks.bitcoin
) {
  if (extendedPub.slice(0, 4) !== YPUB && extendedPub.slice(0, 4) !== UPUB)
    throw new Error('Not ypub or upub');
  return p2sh({
    redeem: p2wpkh({
      pubkey: deriveExtendedPub(extendedPub, index, isChange, network),
      network
    }),
    network
  }).address;
}
function getNativeSegwitAddress(
  extendedPub,
  index = 0,
  isChange = false,
  network = networks.bitcoin
) {
  if (extendedPub.slice(0, 4) !== ZPUB && extendedPub.slice(0, 4) !== VPUB)
    throw new Error('Not zpub or vpub');
  return p2wpkh({
    pubkey: deriveExtendedPub(extendedPub, index, isChange, network),
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
 * It returns the `balance` in satoshis, the funded `addressesDescriptors`,
 * and it also returns whether it has been `used`. Note that "used" here means
 * that this extendedPub account might have had some funds in the past even if
 * it does not have anymore.
 *
 * @param {string} extendedPub An extended pub key.
 * @param {Object} network A [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @param {function} addressFetcher One function that conforms to the values returned by {@link module:dataFetchers.esploraFetchAddress esploraFetchAddress}.
 * @returns {object} return
 * @returns {boolean} return.used Whether that extended pub ever received sats (event if it's current balance is now 0)
 * @returns {number} return.balance Number of sats controlled by this extended pub key
 * @returns {object[]} return.addressesDescriptors An array of addressDescriptor objects corresponding to addresses with funds (>0 sats). An `addressDescriptor = {derivationPath, network}`.
 */
async function fetchExtendedPubFundedAddressesDescriptors(
  extendedPub,
  network = networks.bitcoin,
  addressFetcher = blockstreamFetchAddress
) {
  const addressesDescriptors = [];
  let balance = 0;
  let extendedPubUsed = false;
  checkNetwork(network);

  for (const isChange of [true, false]) {
    for (
      let index = 0, consecutiveUnusedAddresses = 0;
      consecutiveUnusedAddresses < GAP_LIMIT;
      index++
    ) {
      const address = getExtendedPubAddress(
        extendedPub,
        index,
        isChange,
        network
      );
      const { used, balance: addressBalance } = await addressFetcher(
        address,
        network
      );
      const accountNumber = getExtendedPubAccountNumber(extendedPub, network);
      const purpose = getExtendedPubPurpose(extendedPub, network);
      const derivationPath = serializeDerivationPath({
        purpose,
        coinType: getNetworkCoinType(network),
        accountNumber,
        isChange,
        index
      });

      if (addressBalance !== 0) {
        addressesDescriptors.push({
          network,
          derivationPath
        });
        balance += addressBalance;
      }
      if (used === true) {
        consecutiveUnusedAddresses = 0;
        extendedPubUsed = true;
      } else {
        consecutiveUnusedAddresses++;
      }
    }
  }

  return {
    addressesDescriptors,
    balance,
    //has this extendedPub been used (even if balance is zero)?
    used: extendedPubUsed
  };
}

/**
 * Queries an Internet service to get all the addresses descriptors with
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
 * @param {object} HDInterface An HDInterface as the one in {@link module:HDInterface}.
 * @param {Object} network A [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js).
 * @param {function} addressFetcher One function that conforms to the values returned by {@link module:dataFetchers.esploraFetchAddress esploraFetchAddress}.
 * @returns {object[]} return.addressesDescriptors An array of addressDescriptor objects corresponding to addresses with funds (>0 sats). An `addressDescriptor = {derivationPath, network}`.
 */
export async function fetchFundedAddressesDescriptors(
  HDInterface,
  network = networks.bitcoin,
  addressFetcher = blockstreamFetchAddress
) {
  const fundedAddressesDescriptors = [];
  for (const purpose of [LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT]) {
    for (
      let accountNumber = 0, consecutiveUnusedAccounts = 0;
      consecutiveUnusedAccounts < GAP_ACCOUNT_LIMIT;
      accountNumber++
    ) {
      const extendedPub = await HDInterface.getExtendedPub({
        purpose,
        accountNumber,
        network
      });
      const {
        balance,
        addressesDescriptors,
        used
      } = await fetchExtendedPubFundedAddressesDescriptors(
        extendedPub,
        network,
        addressFetcher
      );
      if (used) {
        consecutiveUnusedAccounts = 0;
        fundedAddressesDescriptors.push(...addressesDescriptors);
      } else {
        consecutiveUnusedAccounts++;
      }
    }
  }
  return fundedAddressesDescriptors;
}

export async function fetchUTXOSDescriptors(
  HDInterface,
  addressesDescriptors,
  utxoFetcher = blockstreamFetchUTXOS
) {
  const utxosDescritptors = [];
  for (const addressDescriptor of addressesDescriptors) {
    const utxos = await utxoFetcher(
      await getDerivationPathAddress(
        HDInterface,
        addressDescriptor.derivationPath,
        addressDescriptor.network
      )
    );
    utxos.map(utxo =>
      utxosDescritptors.push({
        tx: utxo.tx,
        n: utxo.vout,
        derivationPath: addressDescriptor.derivationPath,
        network: addressDescriptor.network
      })
    );
  }
  return utxosDescritptors;
}

export async function ledgerBalance(
  network = networks.testnet,
  addressFetcher = blockstreamFetchAddress,
  utxoFetcher = blockstreamFetchUTXOS
) {
  //console.log(
  //  await utxoFetcher(
  //    'tb1q9wjm2s3dwk6jvalnw0v3aervtnj9rgv035pyar',
  //    networks.testnet
  //  )
  //);

  const utxos = [];
  const HDInterface = await initHDInterface(LEDGER_NANO_INTERFACE);
  const addressesDescriptors = await fetchFundedAddressesDescriptors(
    HDInterface,
    network,
    addressFetcher
  );
  //console.log({ addressesDescriptors });
  for (const addressDescriptor of addressesDescriptors) {
    const addressUtxos = await utxoFetcher(addressDescriptor.address, network);
    addressUtxos.map(addressUtxo =>
      utxos.push({
        ...addressUtxo,
        derivationPath: addressDescriptor.derivationPath
      })
    );
  }
  //console.log({ utxos });
  return addressesDescriptors;
}

export async function softwareBalance(
  network = networks.testnet,
  addressFetcher = blockstreamFetchAddress,
  utxoFetcher = blockstreamFetchUTXOS
) {
  const HDInterface = await initHDInterface(SOFT_HD_INTERFACE);
  const addressesDescriptors = await fetchFundedAddressesDescriptors(
    HDInterface,
    network,
    addressFetcher
  );
  //console.log({ addressesDescriptors });
  for (const address of addressesDescriptors) {
    const addressUtxos = await utxoFetcher(address.address, network);
    addressUtxos.map(addressUtxo =>
      utxos.push({ ...addressUtxo, derivationPath: address.derivationPath })
    );
  }
  //console.log({ utxos });
  return addressesDescriptors;
}
