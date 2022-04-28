import { networks } from 'bitcoinjs-lib';
import { playgroundPayment } from '../src/payments';
import { ledgerBalance, softwareBalance } from '../src/wallet';

const ledgerBalanceTestnet = () => ledgerBalance({ network: networks.testnet });
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
