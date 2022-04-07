This section describes the set of tools that you will use to run a Bitcoin regtest environment including a block explorer and a javascript library that can manage the Bitcoin node.

Regression test mode (regtest mode) lets you instantly create a brand-new private block chain with the same basic rules as the Bitcoin mainnet.

In this section you will install:
* The Bitcoin full node
* The tool for controlling and querying the Bitcoin node: bitcoin-cli
* A blockchain index engine that let's you query complex data (for example: how much Bitcoin is controlled by a single address): electrs
* An express HTTP server that you can pair with a client library to control and test the Bitcoin node using javascript: regtest-server.

Once you have installed bitcoind, bitcoin-cli, electrs and regtest-server you can lunch them in order any time by calling these commands:

```
bitcoind.sh
createwallet.sh
electrs.sh
regtest_server.sh
```


`bitcoind.sh`, `electrs.sh` and `regtest_server.sh` can be stopped with CTRL-C. These commands will automatically delete the old instance and create a new one.

You might need to adapt the scripts provided if you decide to use custom paths. These scripts assume you install the tools below in `~/bitcoin` and the temporary blockchain data in `/tmp/regtest1`.

# Install bitcoin (bitcoind)

If you want to install the graphical version (Bitcoin-QT): https://bitcoin.org/en/download

If you want to install bitcoind, then read instructions how to compile: https://github.com/bitcoin/bitcoin/blob/master/doc/ (search for build-\*.md).

For example, for macOS, follow these instructions: https://github.com/bitcoin/bitcoin/blob/master/doc/build-osx.md

# Run bitcoind

Prepare directories and run bitcoind:

`bitcoind.sh`:
```
rm -rf /tmp/regtest1/bitcoind
mkdir -p /tmp/regtest1/bitcoind

bitcoind \
  -datadir=/tmp/regtest1/bitcoind \
  -regtest \
  -server \
  -txindex \
  -zmqpubhashtx=tcp://127.0.0.1:30001 \
  -zmqpubhashblock=tcp://127.0.0.1:30001

```
Options: `-txindex -zmqpubhashtx=tcp://127.0.0.1:30001 -zmqpubhashblock=tcp://127.0.0.1:30001` are required by regtest-server that we will install at the end.

# Install bitcoin-cli
You will also need to install `bitcoin-cli` (to send commands to your Bitcoin node).

If you installed bitcoind above then you can skip this step.

If you are using Bitcoin-QT, then you must download the sources and compile bitcoin-cli (but you can skip compiling bitcoind):
```
mkdir ~/bitcoin
cd bitcoin
git clone https://github.com/bitcoin/bitcoin.git
cd bitcoin
./autgen.sh
./configure --enable-hardening --disable-wallet --disable-upnp-default --without-miniupnpc
make ./src/bitcoin-cli
```
Then add ~/bitcoin/bitcoin/src/ to your $PATH

## Sending commands to your Bitcoin node

You are ready to send commands to your bitcoin server.

Use this command to create a wallet:
```
bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind createwallet farvault_tests
```

Use this command to mine 101 blocks. Why 101? Satoshi introduced a special rule that made all the Bitcoins in the 100 blocks not spendable. So let's create an address owned by our `farvault_tests` wallet, mine 101 and then send the coins there:
```
GEN_ADDRESS=$(bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind getnewaddress)
bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind generatetoaddress 101 $GEN_ADDRESS
```

`createwallet.sh` will automatically create the wallet and generate 101 blocks for you using the commands above.

You can do many other things. For example you can receive a deposit. See:
```
DEPOSIT_ADDRESS=$(bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind getnewaddress)
bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind sendtoaddress $DEPOSIT_ADDRESS 10
bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind generatetoaddress 1 $GEN_ADDRESS
```
Note how we mined a new block so that the transaction is confimed.

# Install Blockstream's electrs
Electrs is the backend used by one of the best Bitcoin block explorers: https://blockstream.info/

We will use it very often to check the funds of different addresses. The API is described here: https://github.com/Blockstream/esplora/blob/master/API.md

Note that a Bitcoin node does not provide a fast and reasonable way to see how many Bitcoin can be spent with a certain address. Thus, we need a different server (such as electrs) that indexes data wrt addresses.

```
mkdir ~/bitcoin/electrs
cd ~/bitcoin/electrs
```
Download it:
```
git clone https://github.com/blockstream/electrs && cd electrs
git checkout new-index
```

# Run electrs:
You might need to install Rust before running electrs: https://doc.rust-lang.org/cargo/getting-started/installation.html

Once you have installed Rust, this is how you can run electrs so that it connects to the regtest bitcoin daemon which we just installed above:

`electrs.sh`:
```
rm -rf /tmp/regtest1/electrs
mkdir -p /tmp/regtest1/electrs
cd ~/bitcoin/electrs
cargo run --release --bin electrs -- -vvvv --daemon-dir /tmp/regtest1/bitcoind --db-dir /tmp/regtest1/electrs --network regtest
```

You can now access the esplora API like this: http://127.0.0.1:3002/blocks/tip/hash

# Install regtest-server

Now install the regtest-server. This nodejs utility will let you run automated tests on a regtest network using javascript.

regtest-server is an express server that can talk with bitcoind. Once it is pared with the regtest-client library you will be able to do cool stuff like this:

```
const bitcoin = require('bitcoinjs-lib');
const { RegtestUtils } = require('regtest-client');
const regtestUtils = new RegtestUtils(bitcoin);
const unspent = await regtestUtils.faucet(p2pkh.address, 2e4);
```
Read the docs here: https://github.com/bitcoinjs/regtest-client

To install regtest-server:
```
cd ~/bitcoin/
git clone https://github.com/bitcoinjs/regtest-server
cd regtest-server
npm install
```
Note: If npm install fails, read this: https://github.com/bitcoinjs/regtest-server/issues/12

Run it like this:
`regtest_server.sh`:
```
#!/bin/sh
rm -rf /tmp/regtest1/regtest-server
mkdir -p /tmp/regtest1/regtest-server/regtest-data
echo "satoshi" > /tmp/regtest1/regtest-server/regtest-data/KEYS
export RPCCOOKIE=/tmp/regtest1/bitcoind/regtest/.cookie
export KEYDB=/tmp/regtest1/regtest-server/regtest-data/KEYS
export INDEXDB=/tmp/regtest1/regtest-server/regtest-data/db
export ZMQ=tcp://127.0.0.1:30001
export RPCCONCURRENT=32
export RPC=http://localhost:18443
export PORT=8080

node index.js
```
