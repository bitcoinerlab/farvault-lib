import { Transaction, address, script } from 'bitcoinjs-lib';

//https://github.com/bitcoinjs/bitcoinjs-lib/issues/1606
export function decodeTx(hex, network) {
  const tx = Transaction.fromHex(hex);
  return {
    txid: tx.getId(),
    witnesshash: tx.getHash(true /*for witness*/).toString('hex'),
    size: tx.byteLength(),
    vsize: tx.virtualSize(),
    weight: tx.weight(),
    version: tx.version,
    locktime: tx.locktime,
    hasWitnesses: tx.hasWitnesses(),
    vin: tx.ins.map(input => ({
      txid: Buffer.from(input.hash).reverse().toString('hex'),
      vout: input.index,
      scriptSig: {
        asm: script.toASM(input.script),
        hex: input.script.toString('hex')
      },
      txinwitness: input.witness.map(b => b.toString('hex')),
      sequence: input.sequence
    })),
    vout: tx.outs.map((output, i) => ({
      value: output.value,
      n: i,
      scriptPubKey: {
        asm: script.toASM(output.script),
        hex: output.script.toString('hex')
      },
      address: address.fromOutputScript(output.script, network)
    }))
  };
}
