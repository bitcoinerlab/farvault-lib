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

#-rpcworkqueue=32 for more throughput
#See: https://github.com/bitcoinjs/regtest-server
#Set -rpcthreads=100 if you plan to runs concurrent tests

#user: farvault_user, password: farvault_passwd
#rpcauth obtained using https://github.com/bitcoin/bitcoin/blob/master/share/rpcauth/rpcauth.py
#or tools like this one: https://jlopp.github.io/bitcoin-core-rpc-auth-generator/
#Note that you must scape the $ symbol -> https://github.com/bitcoin/bitcoin/issues/20057
#-rpcauth=farvault_user:cda868f098032b9309dfa30f07e3c941\$6d50e3dd8eecc0dd311f6b2492df5937301ce7a319fb4696c890b91a289b692c

/Applications/Bitcoin\ Core\ 22.app/Contents/MacOS/Bitcoin-Qt \
  -datadir=/tmp/regtest1/bitcoind \
  -regtest \
  -server \
  -txindex \
  -fallbackfee=0.0002 \
  -zmqpubhashtx=tcp://127.0.0.1:30001 \
  -zmqpubhashblock=tcp://127.0.0.1:30001 \
  -rpcworkqueue=32

