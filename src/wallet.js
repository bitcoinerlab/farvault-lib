//Good explanation of bips
//https://learnmeabitcoin.com/technical/derivation-paths#fn1

import LedgerTransport from '@ledgerhq/hw-transport-webusb';
import LedgerAppBtc from '@ledgerhq/hw-app-btc';
import {
  initHDInterface,
  LEDGER_NANO_INTERFACE,
  SOFT_HD_INTERFACE
} from './HDInterface';
import {
  changePubType,
  derivePubKey,
  networkCoinType,
  pubAccountNumber
} from './bip32';

import b58 from 'bs58check';
import { payments, networks } from 'bitcoinjs-lib';
const { p2sh, p2wpkh, p2pkh } = payments;

import {
  XPUB,
  YPUB,
  ZPUB,
  TPUB,
  UPUB,
  VPUB,
  PUBVERSION,
  PUBVERSIONSIZE,
  BIP32_PURPOSE,
  GAP_LIMIT,
  GAP_ACCOUNT_LIMIT,
  PUBTYPES
} from './walletConstants';

import { blockstreamFetchAddress, blockstreamFetchUTXOS } from './dataFetchers';
import { checkNetwork, checkPubType, checkCoinTypePubType } from './check';

export function getPubAddress(
  pub,
  index = 0,
  isChange = false,
  //Specify the network since BCH and other shitcoins may use the same pubType
  network = networks.bitcoin
) {
  const pubType = getPubType(pub);
  checkNetwork(network);
  checkCoinTypePubType(networkCoinType(network), pubType);
  let functionCall;
  if (pubType === XPUB || pubType === TPUB) {
    functionCall = getLegacyAddress;
  } else if (pubType === YPUB || pubType === UPUB) {
    functionCall = getNestedSegwitAddress;
  } else if (pubType === ZPUB || pubType === VPUB) {
    functionCall = getNativeSegwitAddress;
  } else {
    throw new Error('Invalid pubType');
  }
  return functionCall(pub, index, isChange, network);
}
function getLegacyAddress(
  pub,
  index = 0,
  isChange = false,
  //Specify the network since BCH and other shitcoins may use the same pubType
  network = networks.bitcoin
) {
  if (pub.slice(0, 4) !== XPUB && pub.slice(0, 4) !== TPUB)
    throw new Error('Not xpub or tpub');
  return p2pkh({
    pubkey: derivePubKey(pub, index, isChange, network),
    network
  }).address;
}
function getNestedSegwitAddress(
  pub,
  index = 0,
  isChange = false,
  //Specify the network since BCH and other shitcoins may use the same pubType
  network = networks.bitcoin
) {
  if (pub.slice(0, 4) !== YPUB && pub.slice(0, 4) !== UPUB)
    throw new Error('Not ypub or upub');
  return p2sh({
    redeem: p2wpkh({
      pubkey: derivePubKey(pub, index, isChange, network),
      network
    }),
    network
  }).address;
}
function getNativeSegwitAddress(
  pub,
  index = 0,
  isChange = false,
  //Specify the network since BCH and other shitcoins may use the same pubType
  network = networks.bitcoin
) {
  if (pub.slice(0, 4) !== ZPUB && pub.slice(0, 4) !== VPUB)
    throw new Error('Not zpub or vpub');
  return p2wpkh({
    pubkey: derivePubKey(pub, index, isChange, network),
    network
  }).address;
}

function getPubType(pub) {
  const pubType = pub.slice(0, 4);
  checkPubType(pubType);
  return pubType;
}

async function fetchPubBalance(
  pub,
  network = networks.bitcoin,
  addressFetcher = blockstreamFetchAddress
) {
  const addresses = [];
  let balance = 0;
  let pubUsed = false;
  checkNetwork(network);
  checkCoinTypePubType(networkCoinType(network), getPubType(pub));

  for (const change of [true, false]) {
    for (
      let index = 0, consecutiveUnusedAddresses = 0;
      consecutiveUnusedAddresses < GAP_LIMIT;
      index++
    ) {
      const address = getPubAddress(pub, index, change, network);
      const { used, balance: addressBalance } = await addressFetcher(
        address,
        network
      );
      const accountNumber = pubAccountNumber(pub, network);
      const derivationPath = `${
        BIP32_PURPOSE[getPubType(pub)]
      }'/${networkCoinType(network)}'/${accountNumber}'/${
        change ? 1 : 0
      }/${index}`;
      //console.log({
      //  address,
      //  derivationPath,
      //  pubType: getPubType(pub),
      //  accountNumber,
      //  change,
      //  index,
      //  used,
      //  addressBalance
      //});
      if (addressBalance !== 0) {
        addresses.push({ address, derivationPath });
        balance += addressBalance;
      }
      if (used === true) {
        consecutiveUnusedAddresses = 0;
        pubUsed = true;
      } else {
        consecutiveUnusedAddresses++;
      }
    }
  }

  return {
    addresses,
    balance,
    used: pubUsed /*has this pub been used (even if balance is zero)?*/
  };
}

//This should be bip32UTXO(network, addressFetcher, HDInterface)
export async function bip32UnspentAddresses(
  HDInterface,
  network = networks.bitcoin,
  addressFetcher = blockstreamFetchAddress
) {
  //let bip32Balance = 0;
  const bip32Addresses = [];
  for (const pubType of Object.values(PUBTYPES[networkCoinType(network)])) {
    //console.log('TRACE', 'bip32UnspentAddresses pubType', { pubType });
    for (
      let accountNumber = 0, consecutiveUnusedAccounts = 0;
      consecutiveUnusedAccounts < GAP_ACCOUNT_LIMIT;
      accountNumber++
    ) {
      const pub = await HDInterface.getPub({ pubType, accountNumber, network });
      //console.log('TRACE', 'bip32UnspentAddresses pubType', { accountNumber, consecutiveUnusedAccounts, pub });
      //This should be fetchPubUTXO(pub, network, addressFetcher)
      const { balance, addresses, used } = await fetchPubBalance(
        pub,
        network,
        addressFetcher
      );
      //console.log({ accountNumber, pubType, pub, balance, used });
      if (used) {
        consecutiveUnusedAccounts = 0;
        bip32Addresses.push(...addresses);
      } else {
        consecutiveUnusedAccounts++;
      }
    }
  }
  return bip32Addresses;
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
  const uAddresses = await bip32UnspentAddresses(
    HDInterface,
    network,
    addressFetcher
  );
  //console.log({ uAddresses });
  for (const address of uAddresses) {
    const addressUtxos = await utxoFetcher(address.address, network);
    addressUtxos.map(addressUtxo =>
      utxos.push({ ...addressUtxo, derivationPath: address.derivationPath })
    );
  }
  //console.log({ utxos });
  return uAddresses;
}

export async function softwareBalance(
  network = networks.testnet,
  addressFetcher = blockstreamFetchAddress,
  utxoFetcher = blockstreamFetchUTXOS
) {
  const HDInterface = await initHDInterface(SOFT_HD_INTERFACE);
  const uAddresses = await bip32UnspentAddresses(
    HDInterface,
    network,
    addressFetcher
  );
  //console.log({ uAddresses });
  for (const address of uAddresses) {
    const addressUtxos = await utxoFetcher(address.address, network);
    addressUtxos.map(addressUtxo =>
      utxos.push({ ...addressUtxo, derivationPath: address.derivationPath })
    );
  }
  //console.log({ utxos });
  return uAddresses;
}
