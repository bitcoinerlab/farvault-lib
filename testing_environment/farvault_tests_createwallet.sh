#!/bin/sh
bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind createwallet farvault_tests
GEN_ADDRESS=$(bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind getnewaddress)
bitcoin-cli -regtest -datadir=/tmp/regtest1/bitcoind generatetoaddress 101 $GEN_ADDRESS

