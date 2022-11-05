//Run it from the root project path as this:
//npx babel-node ./example/discovery.js

import { Discovery } from '../src/discovery';
import { Explorer } from '../src/explorer';
import { SoftHDInterface } from '../src/HDInterface/soft';
import { networks } from '../src/networks';
import { ELECTRUM, ESPLORA } from '../src/constants';

async function discovery() {
  const network = networks.testnet;
  //const network = networks.bitcoin;
  const service = ELECTRUM;
  //const service = ESPLORA;
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  const softHDInterface = new SoftHDInterface({ mnemonic });
  await softHDInterface.init();
  const extPubGetter = softHDInterface.getExtPub.bind(softHDInterface);

  const explorer = new Explorer({ network, service });
  //If you want to specify a local server:
  //const explorer = new Explorer({
  //  service: ELECTRUM,
  //  host: '127.0.0.1',
  //  port: 123456,
  //  protocol: 'ssl', //'ssl' or 'tcp'
  //  network
  //});
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
