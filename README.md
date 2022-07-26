A javascript Bitcoin cold storage time-lock wallet for Node.js, browsers and React-Native compatible.

This is the complementary cryptographic library for the FarVault App (iOS/Android/Macos/Win/Linux) [@farvault/FarVault](https://github.com/farvault/FarVault) (private until alpha).

## How does it work?

FarVault helps protect Bitcoiners against extortion and coin theft. Stolen or extorted coins can be canceled for a week. And the cancellation can be delegated to third parties without risk.

Pre-signed transactions are stored, not keys. Keys are deleted. Pre-signed transactions are relative-time-locked. They are cancellable for a week -or whatever the user chooses-, and freely spendable by the wallet key after a week.

Cancellation is another pre-signed transaction that can be safely given to 3rd parties. The cancellation transaction immediately sends the compromised coins to very cold storage. For example a BIP39 plate stored in bank vault in a different country or somewhere really annoying to get since this is a very low probability event.

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
where `<MATURED_PUB>` corresponds to a pubKey controlled by the user's hot wallet and `<RUSHED_PUB>` is the pubKey where the user (or a delegated person) can send funs in case of an emergency (in case coins are stolen/extorted).

## Feature Set

- Supports creating transactions covering multiple accounts from the same BIP32 seed. This can be useful in case a user wants to protect all funds under the seed.
- Supports creating transactions mixing different input types: P2PKH, P2WPKH, P2SH-P2WPKH and P2SH/P2WSH/P2SW-P2WSH (FarVarvault scripts).
- It has a plugin-like interface to make it easy to add different HW wallet support.
- It currently has support for the Ledger Nano signing device. The Ledger device can sign FarVault P2SH/P2WSH scripts even when combined with other inputs.
- A fair amount of tests.

## Usage

See [this integration test](./test/integration/farvault.test.js) to learn how to init a BIP32 signing device, scan the blockchain for utxos and create transactions (including FarVault vaults).

Note that this is the core crypto library of the FarVault App which will also be open sourced when it reaches an alpha state.

## Tests

See [the testing environment](./testing_environment) for details.

`npm run test`

## Documentation

`npm run docs`

## Acknowledgments

The initial idea of this project was outlined by [Adam Back](https://en.wikipedia.org/wiki/Adam_Back) in the btc_pro Telegram group as a response to the [author of this library](https://github.com/landabaso) who was looking for interesting ideas that could be build for Bitcoin.

This library is heavily based on the excellent [bitcoinjs](https://github.com/bitcoinjs) umbrella of Bitcoin libraries. Thanks to [Jonathan Underwood](https://github.com/junderw) for all the work put in there.

[Salvatore Ingala](https://github.com/bigspider) helped find a better script that saves some bytes.
