//From now on, everytime we import fetch from 'cross-fetch' we will in fact import
//cross-fetch, except the default function returned in cross-fetch will
//be replaced with fetchMock.

//This is needed to handle mockAbort.
//Aborting a network request in fetch calls DOMException, but it is
//not globally defined in nodejs. So import it with this package:
import DOMException from 'node-domexception';

import { fixtures } from './fixtures/explorer';
import {
  esploraFetchFeeEstimates,
  blockstreamEsploraUrl
} from '../src/explorer/esplora';
import { ELECTRUM } from '../src/constants';
import { networks, getNetworkCoinType } from '../src/networks';
import { createTransaction } from '../src/transactions';
import { getExtPubAddress, serializeDerivationPath } from '../src/bip44';

function blockstreamFetchFeeEstimates(network = networks.bitcoin) {
  return esploraFetchFeeEstimates(blockstreamEsploraUrl(network));
}

import {
  fundRegtest,
  BITCOIND_CATCH_UP_TIME,
  REGTEST_SERVER_CATCH_UP_TIME,
  ESPLORA_CATCH_UP_TIME
} from './tools';

jest.mock('cross-fetch', () => {
  const fetchMock = require('jest-fetch-mock');
  // Require the original module to not be mocked...
  const originalFetch = jest.requireActual('cross-fetch');
  return {
    __esModule: true,
    ...originalFetch,
    default: fetchMock
  };
});

import fetch from 'cross-fetch';
//Do not mock unless we explicitelly ask it to do.
fetch.dontMock();

import { Explorer } from '../src/explorer';

let HDInterface, walletUtxos, regtestUtils;
beforeAll(async () => {
  const {
    HDInterface: _HDInterface,
    paths,
    utxos: _utxos,
    regtestUtils: _regtestUtils
  } = await fundRegtest({
    mnemonic: fixtures.local.mnemonic,
    fundingDescriptors: fixtures.local.fundingDescriptors,
    network: fixtures.local.network
  });
  HDInterface = _HDInterface;
  walletUtxos = _utxos;
  regtestUtils = _regtestUtils;
  //Give esplora some time to catch up
  await new Promise(r => setTimeout(r, ESPLORA_CATCH_UP_TIME));
}, ESPLORA_CATCH_UP_TIME + BITCOIND_CATCH_UP_TIME + REGTEST_SERVER_CATCH_UP_TIME + 10000);

describe('esploraFetchFeeEstimates for blockstream server', () => {
  test('Estimates parse correct json data', async () => {
    fetch.doMock();
    fetch.mockResponse('hello world');
    expect(blockstreamFetchFeeEstimates()).rejects.toThrow(
      'Invalid json format!'
    );
    fetch.mockResponse(JSON.stringify({ hello: 'world' }));
    expect(blockstreamFetchFeeEstimates()).rejects.toThrow(
      'Invalid fee estimates!'
    );
    fetch.mockResponse(JSON.stringify({ a: 123 }));
    expect(blockstreamFetchFeeEstimates()).rejects.toThrow(
      'Invalid fee estimates!'
    );
    fetch.mockResponse(JSON.stringify({ 12: 'a' }));
    expect(blockstreamFetchFeeEstimates()).rejects.toThrow(
      'Invalid fee estimates!'
    );
    fetch.dontMock();
  });

  test('blockstream fee data returns the 28 fee elements as described in their doc', async () => {
    fetch.dontMock();
    expect(Object.keys(await blockstreamFetchFeeEstimates()).length).toEqual(
      28
    );
    expect(Object.keys(await blockstreamFetchFeeEstimates())).toEqual(
      expect.arrayContaining([
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
        '11',
        '12',
        '13',
        '14',
        '15',
        '16',
        '17',
        '18',
        '19',
        '20',
        '21',
        '22',
        '23',
        '24',
        '25',
        '144',
        '504',
        '1008'
      ])
    );
    fetch.dontMock();
  });
  test('network errors fail', async () => {
    fetch.doMock();
    //fetch.mockReject(new Error('Network Error. Failed!'));
    fetch.mockAbortOnce();
    //Note we don't await since we assume that the promise rejects
    //https://jestjs.io/docs/expect#rejects
    expect(blockstreamFetchFeeEstimates()).rejects.toThrow(
      'The operation was aborted'
    );
    fetch.mockRejectOnce(new Error('Unknown Network Error!'));
    expect(blockstreamFetchFeeEstimates()).rejects.toThrow(
      'Unknown Network Error!'
    );
    fetch.mockOnce('Not found', { status: 404 });
    expect(blockstreamFetchFeeEstimates()).rejects.toThrow('Service is down!');
    fetch.dontMock();
  });
});

describe('Explorer: Tests with local servers', () => {
  const explorers = [];
  for (const server of fixtures.local.servers) {
    test(`Create and connect to ${server.service}`, async () => {
      let explorer;
      expect(() => (explorer = new Explorer(server))).not.toThrow();
      await expect(explorer.connect()).resolves.not.toThrow();
      explorers.push(explorer);
    }, 10000);
  }
  test('fetchAddress & fetchUtxos', async () => {
    const network = fixtures.local.network;
    for (const explorer of explorers) {
      expect({ balance: 0, used: false }).toEqual(
        await explorer.fetchAddress(fixtures.local.unusedAddress)
      );
      expect(
        (await explorer.fetchUtxos(fixtures.local.unusedAddress)).length
      ).toEqual(0);
    }
    for (const descriptor of fixtures.local.fundingDescriptors) {
      const extPub = await HDInterface.getExtPub({
        purpose: descriptor.purpose,
        accountNumber: descriptor.accountNumber,
        network
      });
      const address = getExtPubAddress({
        extPub,
        index: descriptor.index,
        isChange: descriptor.isChange,
        network
      });
      expect(address).toEqual(descriptor.address);
      let addressUtxos;
      for (const explorer of explorers) {
        const { balance, used } = await explorer.fetchAddress(address);
        expect(balance).toEqual(descriptor.value);
        expect(used).toEqual(true);
        addressUtxos = await explorer.fetchUtxos(address);
        addressUtxos = addressUtxos.map(utxo => ({
          ...utxo,
          path: serializeDerivationPath({
            ...descriptor,
            coinType: getNetworkCoinType(network)
          })
        }));
        expect(walletUtxos).toEqual(expect.arrayContaining(addressUtxos));
        expect(addressUtxos.length).toEqual(1);
      }
      //Now spend those addresses. We will check later that
      //they are used but balance is zero
      const tx = await createTransaction({
        utxos: addressUtxos,
        targets: [
          {
            address: fixtures.local.burnAddress,
            value: descriptor.value - 1000
          }
        ], //1000 sat fee
        createSigners: HDInterface.createSigners.bind(HDInterface),
        getPublicKey: HDInterface.getPublicKey.bind(HDInterface),
        network
      });
      await regtestUtils.broadcast(tx);
    }
    //confirm the transactions above
    await regtestUtils.mine(6);
    await new Promise(r => setTimeout(r, 5000)); //Esplora needs some time
    for (const descriptor of fixtures.local.fundingDescriptors) {
      for (const explorer of explorers) {
        //We've spent them above. They should come now as used with 0 balance.
        expect({ balance: 0, used: true }).toEqual(
          await explorer.fetchAddress(descriptor.address)
        );
        expect((await explorer.fetchUtxos(descriptor.address)).length).toEqual(
          0
        );
      }
    }
  }, 10000);
  test('close', async () => {
    for (const explorer of explorers) {
      await explorer.close();
    }
  });
});

describe('Explorer: Tests with public servers', () => {
  const explorers = [];
  for (const server of fixtures.public.servers) {
    test(`Create and connect to ${server.service} on ${
      server.service === ELECTRUM ? server.host : server.url
    }`, async () => {
      let explorer;
      expect(() => (explorer = new Explorer(server))).not.toThrow();
      await expect(explorer.connect()).resolves.not.toThrow();
      explorers.push(explorer);
    }, 10000);
  }
  test('fetchFeeEstimates', async () => {
    for (const explorer of explorers) {
      const feeEstimates = await explorer.fetchFeeEstimates();
      const T = [
        ...Array.from({ length: 25 }, (_, i) => i + 1),
        144,
        504,
        1008
      ];
      expect(Object.keys(feeEstimates).map(n => Number(n))).toEqual(
        expect.arrayContaining(T)
      );
      expect(Object.keys(feeEstimates).length).toEqual(T.length);
      let prevIndex;
      for (const index of Object.keys(feeEstimates)) {
        if (prevIndex)
          expect(feeEstimates[prevIndex]).toBeGreaterThanOrEqual(
            feeEstimates[index]
          );
        prevIndex = index;
      }
    }
  }, 30000);
  test('close', async () => {
    for (const explorer of explorers) {
      await explorer.close();
    }
    await new Promise(r => setTimeout(r, 9000)); //give some time so that keepalive timeouts are closed after explorer.close
  }, 10000);
});
