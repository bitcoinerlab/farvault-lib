import fetch from 'isomorphic-fetch';
import {
  BLOCKSTREAM_EXPLORER_BASEURL,
  ESPLORA_BASEURL
} from './walletConstants';
import { networks } from 'bitcoinjs-lib';
import { validateNetwork } from './validation';
export async function esploraFetchAddress(address, baseUrl = ESPLORA_BASEURL) {
  //console.log('TRACE esploraFetchAddress', {
  //  baseUrl,
  //  url: `${baseUrl}/address/${address}`,
  //  address
  //});
  const chain_stats = (
    await (await fetch(`${baseUrl}/address/${address}`)).json()
  )['chain_stats'];
  return {
    used: chain_stats['tx_count'] !== 0,
    balance: chain_stats['funded_txo_sum'] - chain_stats['spent_txo_sum']
  };
}

export async function esploraFetchUTXOS(address, baseUrl = ESPLORA_BASEURL) {
  //console.log('TRACE esploraFetchUTXOS', {
  //  baseUrl,
  //  url: `${baseUrl}/address/${address}/utxo`,
  //  address
  //});
  const utxos = [];
  const fetchedUtxos = await (
    await fetch(`${baseUrl}/address/${address}/utxo`)
  ).json();

  for (const utxo of fetchedUtxos) {
    if (utxo.status.confirmed === true) {
      const tx = await (await fetch(`${baseUrl}/tx/${utxo.txid}/hex`)).text();
      utxos.push({ tx, vout: parseInt(utxo.vout) });
    }
  }
  return utxos;
}

export function blockstreamFetchAddress(address, network = networks.bitcoin) {
  return esploraFetchAddress(
    address,
    `${BLOCKSTREAM_EXPLORER_BASEURL}/${
      network === networks.bitcoin ? '' : 'testnet/'
    }api`
  );
}
export function blockstreamFetchUTXOS(address, network = networks.bitcoin) {
  return esploraFetchUTXOS(
    address,
    `${BLOCKSTREAM_EXPLORER_BASEURL}/${
      network === networks.bitcoin ? '' : 'testnet/'
    }api`
  );
}
