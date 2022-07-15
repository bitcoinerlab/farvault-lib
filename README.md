A javascript Bitcoin-wallet library for node.js, browsers and react-native compatible.

* It supports P2PKH, P2SH-P2WPKH and P2WPKH.
* It supports creating transactions covering multiple accounts from the same BIP32 seed.
* It supports creating transactions with inputs from different account types (including P2SH and P2WSH).
* It has a plug-in like interface so that it is easy to add HW wallet support.
* It currently already have support for the Ledger Nano signing device.

## Usage
See [this integration test](./test/integration/farvault.test.js) to learn how to init a BIP32 signing device, scan the blockchain for utxos and create transactions (including FarVault vaults).

## Tests
See [the testing environment](./testing_environment).

## Documentation
`npm run docs`
