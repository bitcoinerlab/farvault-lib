import bjsCoinSelect from 'coinselect';
import { parseDerivationPath } from './bip32';
import { decodeTx } from './decodeTx';
import { LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT } from './walletConstants';
import { networks } from 'bitcoinjs-lib';

//https://github.com/bitcoinjs/coinselect/issues/69
export function coinSelect({
  utxos,
  target,
  feeRate,
  network = networks.testnet
}) {
  const csUtxos = utxos.map(utxo => {
    const { purpose } = parseDerivationPath(utxo.derivationPath);
    const decodedTx = decodeTx(utxo.tx);
    const csUtxo = {};
    csUtxo.value = decodedTx.vout[utxo.n].value;
    if (purpose === LEGACY) {
    } else if (purpose === NESTED_SEGWIT) {
      csUtxo.script = { length: 50 };
    } else if (purpose === NATIVE_SEGWIT) {
      csUtxo.script = { length: 27 };
    } else {
      throw new Error(
        'Coin select does only work with p2wpkh, p2sh-p2wpkh or p2wpkh'
      );
    }
    return csUtxo;
  });
  console.log({ csUtxos });

  const csTargets = [target];
  const { inputs, outputs, fee } = bjsCoinSelect(csUtxos, csTargets, feeRate);
  return { inputs, outputs, fee };
}
