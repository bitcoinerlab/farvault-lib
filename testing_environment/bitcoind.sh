#!/bin/sh

rm -rf /tmp/regtest1/bitcoind
mkdir -p /tmp/regtest1/bitcoind

#For some reason, bitcoind v23.0 is very slow on mac
#We keep using v22 binaries.
#More info about this problem:
#https://bitcoin.stackexchange.com/questions/113898/bitcoin-v23-is-10-times-slower-than-v22-on-macos-for-basic-regtest-tests
#https://github.com/bitcoin/bitcoin/issues/24120#issuecomment-1140229076
#https://github.com/bitcoin/bitcoin/issues/24501#issuecomment-1140197201


#/Applications/Bitcoin-Qt.app/Contents/MacOS/Bitcoin-Qt \
#bitcoind \
#/Applications/Bitcoin\ Core\ 22.app/Contents/MacOS/Bitcoin-Qt \

/Applications/Bitcoin\ Core\ 22.app/Contents/MacOS/Bitcoin-Qt \
  -datadir=/tmp/regtest1/bitcoind \
  -regtest \
  -server \
  -txindex \
  -fallbackfee=0.0002 \
  -zmqpubhashtx=tcp://127.0.0.1:30001 \
  -zmqpubhashblock=tcp://127.0.0.1:30001
