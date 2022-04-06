#!/bin/sh

rm -rf /tmp/regtest1
mkdir -p /tmp/regtest1/bitcoind /tmp/regtest1/electrs

#Options: https://manpages.debian.org/testing/bitcoind/bitcoind.1.en.html

/Applications/Bitcoin-Qt.app/Contents/MacOS/Bitcoin-Qt \
  -datadir=/tmp/regtest1/bitcoind \
  -regtest \
  -server \
  -txindex \
  -fallbackfee=0.0002 \
  -zmqpubhashtx=tcp://127.0.0.1:30001 \
  -zmqpubhashblock=tcp://127.0.0.1:30001
