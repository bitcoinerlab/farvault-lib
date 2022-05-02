import {
  initHDInterface,
  LEDGER_NANO_INTERFACE,
  SOFT_HD_INTERFACE
} from '../src/HDInterface';

import { networks } from 'bitcoinjs-lib';
import { playgroundPayment } from '../src/payments';
import { fetchDerivationPaths, getDerivationPathAddress } from '../src/wallet';
import {
  blockstreamFetchAddress,
  blockstreamFetchUTXOs
} from '../src/dataFetchers';

async function ledgerBalance({
  network = networks.bitcoin,
  addressFetcher = blockstreamFetchAddress,
  utxoFetcher = blockstreamFetchUTXOs
}) {
  const addresses = [];
  const utxos = [];
  const HDInterface = await initHDInterface(LEDGER_NANO_INTERFACE);
  const { fundedDerivationPaths: derivationPaths } = await fetchDerivationPaths(
    {
      extPubGetter: async params => HDInterface.getExtPub(params),
      addressFetcher,
      network
    }
  );
  //console.log({ derivationPaths });
  for (const derivationPath of derivationPaths) {
    const address = await getDerivationPathAddress({
      extPubGetter: async params => HDInterface.getExtPub(params),
      derivationPath,
      network
    });
    addresses.push(address);
    const addressUtxos = await utxoFetcher(address, network);
    addressUtxos.map(addressUtxo => utxos.push(addressUtxo));
  }
  console.log({ addresses, utxos });
  return derivationPaths;
}

async function softwareBalance({
  network = networks.bitcoin,
  addressFetcher = blockstreamFetchAddress,
  utxoFetcher = blockstreamFetchUTXOs
}) {
  const addresses = [];
  const utxos = [];
  const HDInterface = await initHDInterface(SOFT_HD_INTERFACE);
  const { fundedDerivationPaths: derivationPaths } = await fetchDerivationPaths(
    {
      extPubGetter: async params => HDInterface.getExtPub(params),
      addressFetcher,
      network
    }
  );
  //console.log({ derivationPaths });
  for (const derivationPath of derivationPaths) {
    const address = await getDerivationPathAddress({
      extPubGetter: async params => HDInterface.getExtPub(params),
      derivationPath,
      network
    });
    addresses.push(address);
    const addressUtxos = await utxoFetcher(address, network);
    addressUtxos.map(addressUtxo => utxos.push(addressUtxo));
  }
  console.log({ addresses, utxos });
  return derivationPaths;
}

const ledgerBalanceTestnet = () => ledgerBalance({ network: networks.testnet });
//const softwareBalanceTestnet = () => console.log('hello world');
const softwareBalanceTestnet = () =>
  softwareBalance({ network: networks.testnet });

const playgroundPaymentTestnet = () =>
  playgroundPayment({ network: networks.testnet, useLedger: false });
export {
  ledgerBalanceTestnet,
  softwareBalanceTestnet,
  playgroundPaymentTestnet
};

import {
  requestNonce,
  requestLogout,
  requestProtectedContent
} from '../src/digiSign/client.js';
export { requestNonce, requestLogout, requestProtectedContent };
