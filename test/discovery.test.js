import { fixtures } from './fixtures/discovery';
import { Discovery } from '../src/discovery';
import { parseDerivationPath } from '../src/bip44';

import { esploraFetchAddress, esploraFetchUtxos } from '../src/dataFetchers';
import {
  fundRegtest,
  BITCOIND_CATCH_UP_TIME,
  REGTEST_SERVER_CATCH_UP_TIME
} from './tools';
const DISCOVERY_TIME = 60000; //60 secs
const ESPLORA_CATCH_UP_TIME = 10000;

let HDInterface, walletUtxos;
beforeAll(async () => {
  const fundingDescriptors = [];
  for (const path of Object.keys(fixtures.discovery.paths)) {
    const pathContents = fixtures.discovery.paths[path];
    if (Array.isArray(pathContents)) {
      for (const fundings of pathContents) {
        fundingDescriptors.push({
          value: fundings.balance,
          ...parseDerivationPath(path)
        });
      }
    } else
      fundingDescriptors.push({
        value: pathContents.balance,
        ...parseDerivationPath(path)
      });
  }
  const {
    HDInterface: _HDInterface,
    paths,
    utxos: _utxos,
    regtestUtils
  } = await fundRegtest({
    mnemonic: fixtures.discovery.mnemonic,
    fundingDescriptors,
    network: fixtures.discovery.network
  });
  HDInterface = _HDInterface;
  walletUtxos = _utxos;
  //Give esplora some time to catch up
  await new Promise(r => setTimeout(r, ESPLORA_CATCH_UP_TIME));
}, ESPLORA_CATCH_UP_TIME + BITCOIND_CATCH_UP_TIME + REGTEST_SERVER_CATCH_UP_TIME + DISCOVERY_TIME);

for (const valid of fixtures.discovery.valid) {
  describe(`Discovery: dynamically generate a wallet on the regtest and discover it. Case: ${valid.description}`, () => {
    const network = fixtures.discovery.network;
    let discovery;
    beforeAll(async () => {
      discovery = new Discovery({
        extPubGetter: HDInterface.getExtPub,
        addressFetcher: address => esploraFetchAddress(address),
        utxoFetcher: address => esploraFetchUtxos(address),
        network,
        gapLimit: valid.gapLimit,
        forceFetchChange: valid.forceFetchChange,
        gapAccountLimit: valid.gapAccountLimit
      });

      //Do it twice to make it also works also con consecutive calls
      for (let i = 0; i < 2; i++) {
        await discovery.fetch(network);
        await discovery.fetchUtxos({ network });
      }
    }, DISCOVERY_TIME);

    test('getNetworkIds', () => {
      expect(discovery.getNetworkIds()).toEqual(
        expect.arrayContaining(fixtures.discovery.networkIds)
      );
      expect(discovery.getNetworkIds().length).toEqual(
        fixtures.discovery.networkIds.length
      );
    });

    test('getUsedDerivationPaths and getFundedDerivationPaths', () => {
      const fundedPaths = discovery.getFundedDerivationPaths({ network });
      const usedPaths = discovery.getUsedDerivationPaths({ network });

      //For the valid tests above we know that usedPaths === fundedPaths
      //because in the tests we prepared, we never spent an utxo:
      expect(fundedPaths).toEqual(expect.arrayContaining(usedPaths));
      expect(fundedPaths.length).toEqual(usedPaths.length);

      expect(usedPaths).toEqual(expect.arrayContaining(valid.usedPaths));
      expect(usedPaths.length).toEqual(valid.usedPaths.length);
    });

    test('getUtxos', () => {
      const utxos = discovery.getUtxos({ network });
      //We have the utxos in walletFundedUtxos. But we need to extract
      //the ones we know that were used in this Case.
      const usedPaths = discovery.getFundedDerivationPaths({ network });
      const walletFundedUtxos = walletUtxos.filter(utxo =>
        usedPaths.includes(utxo.path)
      );
      expect(utxos).toEqual(expect.arrayContaining(walletFundedUtxos));
      expect(utxos.length).toEqual(walletFundedUtxos.length);
    });

    test('getAccounts & getUsedDerivationPaths on each account', () => {
      const accounts = discovery.getAccounts({ network }).map(account => ({
        balance: account.balance,
        extPub: account.extPub,
        usedPaths: discovery.getUsedDerivationPaths({
          network,
          extPub: account.extPub
        })
      }));
      expect(accounts).toEqual(expect.arrayContaining(valid.accounts));
      expect(accounts.length).toEqual(valid.accounts.length);
    });

    test('getUsedDerivationPaths/getFundedDerivationPaths each account', async () => {
      const accounts = discovery.getAccounts({ network });
      for (const account of accounts) {
        const extPubUsedPaths = discovery.getUsedDerivationPaths({
          network,
          extPub: account.extPub
        });
        const extPubFundedPaths = discovery.getFundedDerivationPaths({
          network,
          extPub: account.extPub
        });

        //For the valid tests above we know that extPubUsedPaths === extPubFundedPaths
        //because in the tests we prepared, we never spent an utxo:
        expect(extPubFundedPaths).toEqual(
          expect.arrayContaining(extPubUsedPaths)
        );
        expect(extPubFundedPaths.length).toEqual(extPubUsedPaths.length);

        const validExtPubUsedPaths = valid.accounts.find(
          validAccount => validAccount.extPub === account.extPub
        ).usedPaths;
        expect(extPubUsedPaths).toEqual(
          expect.arrayContaining(validExtPubUsedPaths)
        );
        expect(extPubUsedPaths.length).toEqual(validExtPubUsedPaths.length);
      }
    });

    test(
      'fetchUtxos and getUtxos on each account',
      async () => {
        const test_discovery = new Discovery({
          extPubGetter: HDInterface.getExtPub,
          addressFetcher: address => esploraFetchAddress(address),
          utxoFetcher: address => esploraFetchUtxos(address),
          network,
          gapLimit: valid.gapLimit,
          forceFetchChange: valid.forceFetchChange,
          gapAccountLimit: valid.gapAccountLimit
        });
        await test_discovery.fetch(network);

        const accounts = test_discovery.getAccounts({
          network
        });
        for (const [index, account] of accounts.entries()) {
          const extPub = account.extPub;
          //These were fecthed beforeAll for all the accounts:
          const all_utxos = discovery.getUtxos({ network });
          const extpub_utxos = discovery.getUtxos({ network, extPub });

          //Now fetch and get only extPub
          await test_discovery.fetchUtxos({
            network,
            extPub
          });
          const test_utxos = test_discovery.getUtxos({ network, extPub });

          //test_utxos must be the same as the utxos subset requested in beforeAll:
          expect(extpub_utxos).toEqual(expect.arrayContaining(test_utxos));
          expect(extpub_utxos.length).toEqual(test_utxos.length);
          //test_utxos (for one extPub) is within all_utxos:
          expect(all_utxos).toEqual(expect.arrayContaining(test_utxos));

          expect(all_utxos).toEqual(expect.arrayContaining(test_utxos));
          expect(all_utxos.length).toBeGreaterThan(test_utxos.length);

          if (index < accounts.length - 1) {
            //This should throw because we cannot get all the utxos since
            //they have not been all fetched yet
            expect(() => test_discovery.getUtxos({ network })).toThrow(
              `Utxos for this account ${
                accounts[index + 1].extPub
              } have not been retrieved yet!`
            );
          } else {
            //on the last fetch, test_discovery should finally have
            //all the utxos.
            const test_all_utxos = test_discovery.getUtxos({ network });
            expect(test_all_utxos).toEqual(expect.arrayContaining(all_utxos));
            expect(test_all_utxos.length).toEqual(all_utxos.length);
            //This should not throw:
          }
        }
      },
      DISCOVERY_TIME
    );
  });
}
