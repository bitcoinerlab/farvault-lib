import { BLOCKSTREAM_EXPLORER_BASEURL } from './walletConstants';
import { networks } from 'bitcoinjs-lib';
import { validateNetwork } from './validation';
export async function esploraFetchAddress(
  address,
  network = networks.bitcoin,
  baseUrl = BLOCKSTREAM_EXPLORER_BASEURL
) {
  validateNetwork(network);
  const chain_stats = (
    await (
      await fetch(
        `${baseUrl}/${
          network === networks.bitcoin ? '' : 'testnet/'
        }api/address/${address}`
      )
    ).json()
  )['chain_stats'];
  return {
    used: chain_stats['tx_count'] !== 0,
    balance: chain_stats['funded_txo_sum'] - chain_stats['spent_txo_sum']
  };
}

export async function esploraFetchUTXOS(
  address,
  network = networks.bitcoin,
  baseUrl = BLOCKSTREAM_EXPLORER_BASEURL
) {
  const utxos = [];
  validateNetwork(network);
  const fetchedUtxos = await (
    await fetch(
      `${baseUrl}/${
        network === networks.bitcoin ? '' : 'testnet/'
      }api/address/${address}/utxo`
    )
  ).json();

  for (const utxo of fetchedUtxos) {
    if (utxo.status.confirmed === true) {
      const tx = await (
        await fetch(
          `${baseUrl}/${network === networks.bitcoin ? '' : 'testnet/'}api/tx/${
            utxo.txid
          }/hex`
        )
      ).text();
      utxos.push({ tx, vout: parseInt(utxo.vout) });
    }
  }
  return utxos;
}

export function blockstreamFetchAddress(address, network = networks.bitcoin) {
  return esploraFetchAddress(address, network, BLOCKSTREAM_EXPLORER_BASEURL);
}
export function blockstreamFetchUTXOS(address, network = networks.bitcoin) {
  return esploraFetchUTXOS(address, network, BLOCKSTREAM_EXPLORER_BASEURL);
}
