import { coinselect } from '../src/coinselect';
import { decodeTx } from '../src/decodeTx';
import { parseDerivationPath } from '../src/bip32';
import { LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT } from '../src/walletConstants';
import { initHDInterface, SOFT_HD_INTERFACE } from '../src/HDInterface';
import { fixtures } from './fixtures/coinselect';
import { Psbt, payments } from 'bitcoinjs-lib';

const targets = [];
const feeRate = 1;

describe('Coinselect', () => {
  describe('Coinselect invalid tests', () => {
    fixtures.invalid.map(fixture => {
      test(fixture.description, () => {
        const t = () =>
          coinselect({
            utxos: fixture.utxos,
            targets: fixture.targets,
            feeRate: fixture.feeRate,
            changeAddress: () => fixture.changeAddress,
            network: fixture.network
          });
        expect(t).toThrow(fixture.exception);
      });
    });
  });
  describe('Coinselect valid tests', () => {
    fixtures.valid.map(fixture => {
      test(fixture.description, async () => {
        const network = fixture.network;
        const { utxos, targets, fee } = coinselect({
          utxos: fixture.utxos,
          targets: fixture.targets,
          feeRate: fixture.feeRate,
          changeAddress: () => fixture.changeAddress,
          network: fixture.network
        });

        const HDInterface = await initHDInterface(SOFT_HD_INTERFACE, {
          mnemonic: fixture.mnemonic
        });
        const psbt = new Psbt({ network });

        for (const utxo of utxos) {
          const purpose = parseDerivationPath(utxo.derivationPath).purpose;
          let redeemScript = undefined;
          if (purpose === NESTED_SEGWIT) {
            const pubkey = await HDInterface.getPublicKey(
              utxo.derivationPath,
              network
            );
            const p2wpkh = payments.p2wpkh({ pubkey, network });
            redeemScript = payments.p2sh({ redeem: p2wpkh, network }).redeem
              .output;
          } else if (purpose !== NATIVE_SEGWIT && purpose !== LEGACY) {
            throw new Error(
              'Can only freeze P2WPKH, P2SH-P2WPK and P2PKH addresses'
            );
          }

          psbt.addInput({
            hash: decodeTx(utxo.tx).txid,
            index: utxo.n,
            nonWitnessUtxo: Buffer.from(utxo.tx, 'hex'),
            ...(redeemScript ? { redeemScript } : {})
          });
        }

        targets.forEach(target => psbt.addOutput(target));

        const signers = await HDInterface.createSigners({
          psbt,
          utxos,
          network
        });
        for (let index = 0; index < utxos.length; index++) {
          psbt.signInput(index, {
            network,
            publicKey: await HDInterface.getPublicKey(
              utxos[index].derivationPath,
              network
            ),
            sign: signers[index]
          });
        }
        psbt.finalizeAllInputs();

        expect(fee).toEqual(psbt.getFee());
        const txVSize = psbt.extractTransaction().virtualSize();
        const actualFeerate = psbt.getFee() / txVSize;
        expect(actualFeerate).toBeGreaterThanOrEqual(fixture.feeRate);
        expect(actualFeerate).toBeGreaterThanOrEqual(1);

        //console.log({
        //  fee,
        //  feeRate: fixture.feeRate,
        //  tx: psbt.extractTransaction().toHex(),
        //  txVSize,
        //  actualFeerate
        //});
      });
    });
  });
  describe('Coinselect tests with no solution', () => {
    fixtures.nosolution.map(fixture => {
      test(fixture.description, () => {
        const { utxos, targets, fee } = coinselect({
          utxos: fixture.utxos,
          targets: fixture.targets,
          feeRate: fixture.feeRate,
          changeAddress: () => fixture.changeAddress,
          network: fixture.network
        });
        expect(utxos).toBeUndefined();
        expect(targets).toBeUndefined();
      });
    });
  });
});
