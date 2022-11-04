#!/bin/sh
bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind createwallet farvault_tests
GEN_ADDRESS=$(bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind getnewaddress "" bech32)
#regtest-server expects 432 blocks mined.
#https://github.com/bitcoinjs/regtest-server/blob/master/docker/run_bitcoind_service.sh
bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind generatetoaddress 432 $GEN_ADDRESS

