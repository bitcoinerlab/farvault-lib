# Setup

## Install bitcoin (bitcoind)
If you want to install the graphical version (Bitcoin-QT): https://bitcoin.org/en/download
If you want to install bitcoind, then read instructions how to compile it here https://github.com/bitcoin/bitcoin/blob/master/doc/ (search for build-\*.md). For example, fo macos: https://github.com/bitcoin/bitcoin/blob/master/doc/build-osx.md

## Install bitcoin-cli
You will also need to install `bitcoin-cli` (to send commands to your Bitcoin node).
If you compiled bitcoind above then you can skip this step.
If you are using Bitcoin-QT, then you must download the sources but you can skip compiling bitcoind:
```
mkdir ~/bitcoin
cd bitcoin
git clone https://github.com/bitcoin/bitcoin.git
cd  bitcoin
./autgen.sh
./configure --enable-hardening --disable-wallet --disable-upnp-default --without-miniupnpc
make ./src/bitcoin-cli
```

Prepare directories and run bitcoind:

```
mkdir -p /tmp/regtest1/bitcoind

bitcoind \
  -datadir=/tmp/regtest1/bitcoind \
  -regtest \
  -server \
  -txindex \
  -zmqpubhashtx=tcp://127.0.0.1:30001 \
  -zmqpubhashblock=tcp://127.0.0.1:30001

```
Note:  If you installed Bitcoin-QT, then use `/Applications/Bitcoin-Qt.app/Contents/MacOS/Bitcoin-Qt` instead of `bitcoind` in macOs (similarly in windows).

Options: `-txindex -zmqpubhashtx=tcp://127.0.0.1:30001 -zmqpubhashblock=tcp://127.0.0.1:30001` are required by regtest-server.

Install Blockstream's electrs:
* https://github.com/Blockstream/electrs

Choose a path where you want to install electrs. For example:
```
mkdir ~/bitcoin/electrs
cd ~/bitcoin/electrs
```
Download Blockstream's electrs:
```
git clone https://github.com/blockstream/electrs && cd electrs
git checkout new-index
```
You might need to install Rust + Rust's cargo first if you don't have it installed in your system
* https://doc.rust-lang.org/cargo/getting-started/installation.html

This is how we will run it so that it connects to the regtest bitcoin daemon which we just started above:

```
mkdir -p /tmp/regtest1/electrs
cargo run --release --bin electrs -- -vvvv --daemon-dir /tmp/regtest1/bitcoind --db-dir /tmp/regtest1/electrs --network regtest
```

Now you must send commands to your bitcoin server. You can use the Console on yout Bitcoin-QT app (Window->Console) or install bitcoin-cli

```

#These two are equivalent:
#Write this on the Bitcoin-QT Console:
createwallet farvault_tests
#Or write this on a terminal (note you need to specify all the environment when calling bitcoin-cli):
bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind createwallet farvault_tests
```

Adapt the following commands to Bitcoin-QT by removing the `bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind `:

```
GEN_ADDRESS=$(bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind getnewaddress)
#satoshi introduced a special rule that does not allow anyone spend the bitcoins generated in the first 100 blocks.
#So let's mine 101 and send all mined coins to the address generated above:
bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind generatetoaddress 101 $GEN_ADDRESS
```

Other things you can do:
```
Receive a deposit:
DEPOSIT_ADDRESS=$(bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind getnewaddress)
bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind sendtoaddress $DEPOSIT_ADDRESS 10
bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind generatetoaddress 1 $GEN_ADDRESS
```

You can now access the esplora API like this:

http://127.0.0.1:3002/blocks/tip/hash

Now install the regtest-client / regtest-server pair that will let us run tests:

```
cd ~/bitcoin/
git clone https://github.com/bitcoinjs/regtest-server
cd regtest-server
npm install
#If npm install fails, read this:https://github.com/bitcoinjs/regtest-server/issues/12
```

Create a file `~/bitcoin/regtest-server/run_regtest_server.sh` with these contents:
```
#/bin/sh
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
