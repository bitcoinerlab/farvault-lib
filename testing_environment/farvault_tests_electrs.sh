#!/bin/sh
cd ~/bitcoin/electrs
cargo run --release --bin electrs -- -vvvv --daemon-dir /tmp/regtest1/bitcoind --db-dir /tmp/regtest1/electrs --network regtest
