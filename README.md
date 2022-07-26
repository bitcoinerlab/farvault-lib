A javascript Bitcoin cold storage time-lock wallet for node.js, browsers and react-native compatible.
This is the complementary cryptographic library for the Vault App (iOS/Android/Macos/Win/Linux) [@farvault/FarVault](https://github.com/farvault/FarVault) (private until alpha).

- Supports P2PKH, P2SH-P2WPKH, and P2WPKH.
- Supports creating transactions covering multiple accounts from the same BIP32 seed. This can be useful in case a user wants to protect all funds under the seed.
- Supports creating transactions with inputs mixing different input types: P2PKH, P2WPKH, P2SH-P2WPKH and P2SH/P2WSH/P2SW-P2WSH (FarVarvault scripts).
- It has a plugin-like interface to make it easy to add different HW wallet support.
- It currently has support for the Ledger Nano signing device. The ledger device can also sign FarVault P2SH/P2WSH scripts even when mixing different input types.
- A fair amount of tests.

## How does it work?

In FarVault stolen or extorted coins can be cancelled for a week. And cancellation can be delegated.

Pre-signed transactions are stored, not keys. Keys are deleted. Pre-signed transactions are relative-time-locked. They are cancellable for a week -or whatever the user chooses-, and freely spendable by the wallet key after a week.

The cancelation is another pre-signed transaction that can be safely given to 3rd parties. The cancel transaction just immediately sends the vaulted coins to very-cold storage. For example a bank vault in a different country or somewhere really annoying to get since this is a very low probability event.

A FarVault script looks like this:

```
 <MATURED_PUB>
 OP_CHECKSIG
 OP_NOTIF
 <RUSHED_PUB>
 OP_CHECKSIG
 OP_ELSE
 <ENCODED_LOCKTIME>
 OP_CHECKSEQUENCEVERIFY
 OP_ENDIF
```

,where `<MATURED_PUB>` corresponds to a pubKey controlled by the user's hot wallet and `<RUSHED_PUB>` is the pubKey where the user (or a delegated person) can send funs in case of an emergency (in case coins are stolen/extorted).

## Usage

See [this integration test](./test/integration/farvault.test.js) to learn how to init a BIP32 signing device, scan the blockchain for utxos and create transactions (including FarVault vaults).

Note that this is the core library of the FarVault App which will also be open sourced when it reaches an alpha state.

## Tests

See [the testing environment](./testing_environment).

`npm run test`

## Documentation

`npm run docs`

## Acknowledgments

The initial idea of this project was outlined by Adam Back in the btc_pro Telegram group as a response to the author of this library when he was asked for ideas to build something for Bitcoin.

This library is heavily based on the excellent [bitcoinjs](https://github.com/bitcoinjs) umbrella of Bitcoin libraries.
