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
cd ~/bitcoin/regtest-server/
node index.js
