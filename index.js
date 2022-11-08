import { ElectrumExplorer } from './src/explorer/electrum';
import { EsploraExplorer } from './src/explorer/esplora';
const Explorer = { ElectrumExplorer, EsploraExplorer };
import * as transactions from './src/transactions';
import * as scripts from './src/scripts';
import * as discovery from './src/discovery';
import * as decodeTx from './src/decodeTx';
import { SoftHDSigner } from './src/HDSigner/soft';
import { LedgerHDSigner } from './src/HDSigner/ledger';
const HDSigner = { SoftHDSigner, LedgerHDSigner };
import * as coinselect from './src/coinselect';
import * as fees from './src/fees';
import * as bip44 from './src/bip44';
import * as constants from './src/constants';
import { networks } from './src/networks';
export {
  Explorer,
  transactions,
  scripts,
  discovery,
  decodeTx,
  HDSigner,
  coinselect,
  fees,
  bip44,
  constants,
  networks
};
