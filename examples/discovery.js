#! /usr/bin/env npx babel-node

/*
 * This example shows how to connect to an Electrum server (or Esplora server)
 * and retrieve all the Accounts, Addresses and UTXOs of a certain seed.
 * In the example we use the "abandon" seed which has been used a lot in the
 * past by developers.
 *
 * How to run it:
 *
 * A) chmod +x discovery.js
 * then run it from the root project path as this:
 * ./examples/discovery.js
 *
 * B) Or, you can run it from the root project path as this:
 * npx babel-node ./examples/discovery.js
 */

import { Discovery } from '../src/discovery';
import { EsploraExplorer } from '../src/explorer/esplora';
import { ElectrumExplorer } from '../src/explorer/electrum';
import { SoftHDSigner } from '../src/HDSigner/soft';
import { networks } from '../src/networks';
import {
  ESPLORA_BLOCKSTREAM_URL,
  ESPLORA_BLOCKSTREAM_TESTNET_URL,
  ESPLORA_LOCAL_REGTEST_URL
} from '../src/constants';

async function discovery() {
  const network = networks.testnet;
  //const network = networks.bitcoin;
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  const softHDSigner = new SoftHDSigner({ mnemonic });
  await softHDSigner.init();
  const extPubGetter = softHDSigner.getExtPub.bind(softHDSigner);

  //const explorer = new EsploraExplorer(); //= new EsploraExplorer({url: ESPLORA_BLOCKSTREAM_URL}) = new EsploraExplorer({url: 'https://blockstream.info/api'});
  //const explorer = new EsploraExplorer({ url: ESPLORA_BLOCKSTREAM_TESTNET_URL });
  //const explorer = new EsploraExplorer({url: ESPLORA_LOCAL_REGTEST_URL});
  //const explorer = new ElectrumExplorer();
  //const explorer = new ElectrumExplorer({network: networks.testnet});
  //const explorer = new ElectrumExplorer({network: networks.regtest});
  //If you want to specify a local server:
  //const explorer = new ElectrumExplorer({
  //  host: '127.0.0.1',
  //  port: 123456,
  //  protocol: 'ssl', //'ssl' or 'tcp'
  //  network
  //});
  let esploraUrl;
  if (network === networks.bitcoin) esploraUrl = ESPLORA_BLOCKSTREAM_URL;
  else if (network === networks.testnet)
    esploraUrl = ESPLORA_BLOCKSTREAM_TESTNET_URL;
  else if (network === networks.regtest) esploraUrl = ESPLORA_LOCAL_REGTEST_URL;
  else throw new Error('Define a url for this network');
  const explorer = new EsploraExplorer({ url: esploraUrl });

  await explorer.connect();

  let lastAccounts = [];
  //This function will get triggered everytime something changes in the wallet
  function walletChanged() {
    const newAccounts = discovery.getAccounts({ network });
    if (newAccounts.length !== lastAccounts.length) {
      const accountsDifference = newAccounts.filter(
        newAccount =>
          !lastAccounts.find(
            lastAccount => lastAccount.extPub === newAccount.extPub
          )
      );
      console.log('NEW ACCOUNT DETECTED:', accountsDifference);
      lastAccounts = newAccounts;
    }
  }

  const discovery = new Discovery({ extPubGetter, explorer }, walletChanged);
  await discovery.fetch({ network });

  console.log('NETWORKS:', discovery.getNetworkIds());

  console.log('ACCOUNTS:', discovery.getAccounts({ network }));

  console.log(
    'USED DERIVATION PATHS:',
    discovery.getUsedDerivationPaths({ network })
  );

  console.log(
    'FUNDED DERIVATION PATHS:',
    discovery.getFundedDerivationPaths({ network })
  );

  await discovery.fetchUtxos({ network });

  console.log('UTXOS:', discovery.getUtxos({ network }));

  await explorer.close();
}

discovery();
