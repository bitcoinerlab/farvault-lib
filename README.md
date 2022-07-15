A javascript Bitcoin wallet library for node.js, browsers and react-native compatible.

* Supports P2PKH, P2SH-P2WPKH, and P2WPKH.
* Supports creating transactions covering multiple accounts from the same BIP32 seed.
* Supports creating transactions with inputs from different account types (including P2SH and P2WSH).
* It has a plugin-like interface to make it easy to add different HW wallet support.
* It currently already has support for the Ledger Nano signing device.

## Usage
See [this integration test](./test/integration/farvault.test.js) to learn how to init a BIP32 signing device, scan the blockchain for utxos and create transactions (including FarVault vaults).

## Tests
See [the testing environment](./testing_environment).

## Documentation
`npm run docs`
