//From now on, everytime we import fetch from 'cross-fetch' we will in fact import
//cross-fetch, except the default function returned in cross-fetch will
//be replaced with fetchMock.

//This is needed to handle mockAbort.
//Aborting a network request in fetch calls DOMException, but it is
//not globally defined in nodejs. So import it with this package:
import DOMException from 'node-domexception';

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

import {
  blockstreamFetchAddress,
  blockstreamFetchUTXOs,
  blockstreamFetchFeeEstimates
} from '../src/dataFetchers';

describe('dataFetchers: blockstreamFetchFeeEstimates', () => {
  test('Estimates parse correct json data', async () => {
    fetch.doMock();
    fetch.mockResponse('hello world');
    expect(blockstreamFetchFeeEstimates()).rejects.toThrow(
      'Invalid json format!'
    );
    fetch.mockResponse(JSON.stringify({ hello: 'world' }));
    expect(blockstreamFetchFeeEstimates()).rejects.toThrow(
      'Invalid esplora fee estimates!'
    );
    fetch.mockResponse(JSON.stringify({ a: 123 }));
    expect(blockstreamFetchFeeEstimates()).rejects.toThrow(
      'Invalid esplora fee estimates!'
    );
    fetch.mockResponse(JSON.stringify({ 12: 'a' }));
    expect(blockstreamFetchFeeEstimates()).rejects.toThrow(
      'Invalid esplora fee estimates!'
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
