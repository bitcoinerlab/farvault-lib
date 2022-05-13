import {
  initHDInterface,
  LEDGER_NANO_INTERFACE,
  SOFT_HD_INTERFACE
} from '../src/HDInterface';

import { networks } from 'bitcoinjs-lib';
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
  const { fundedPaths } = await fetchDerivationPaths({
    extPubGetter: async params => HDInterface.getExtPub(params),
    addressFetcher,
    network
  });
  for (const path of fundedPaths) {
    const address = await getDerivationPathAddress({
      extPubGetter: async params => HDInterface.getExtPub(params),
      path,
      network
    });
    addresses.push(address);
    const addressUtxos = await utxoFetcher(address, network);
    addressUtxos.map(addressUtxo => utxos.push(addressUtxo));
  }
  console.log({ addresses, utxos });
  return fundedPaths;
}

async function softwareBalance({
  network = networks.bitcoin,
  addressFetcher = blockstreamFetchAddress,
  utxoFetcher = blockstreamFetchUTXOs
}) {
  const addresses = [];
  const utxos = [];
  const HDInterface = await initHDInterface(SOFT_HD_INTERFACE);
  const { fundedPaths } = await fetchDerivationPaths({
    extPubGetter: async params => HDInterface.getExtPub(params),
    addressFetcher,
    network
  });
  for (const path of fundedPaths) {
    const address = await getDerivationPathAddress({
      extPubGetter: async params => HDInterface.getExtPub(params),
      path,
      network
    });
    addresses.push(address);
    const addressUtxos = await utxoFetcher(address, network);
    addressUtxos.map(addressUtxo => utxos.push(addressUtxo));
  }
  console.log({ addresses, utxos });
  return fundedPaths;
}

const ledgerBalanceTestnet = () => ledgerBalance({ network: networks.testnet });
//const softwareBalanceTestnet = () => console.log('hello world');
const softwareBalanceTestnet = () =>
  softwareBalance({ network: networks.testnet });

export { ledgerBalanceTestnet, softwareBalanceTestnet };

import {
  requestNonce,
  requestLogout,
  requestProtectedContent
} from '../src/digiSign/client.js';
export { requestNonce, requestLogout, requestProtectedContent };
