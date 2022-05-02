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
        const t = async () =>
          await coinselect({
            utxos: fixture.utxos,
            targets: fixture.targets,
            feeRate: fixture.feeRate,
            changeAddress: async () => fixture.changeAddress,
            network: fixture.network
          });
        expect(t).rejects.toThrow(fixture.exception);
      });
    });
  });
  describe('Coinselect valid tests', () => {
    fixtures.valid.map(fixture => {
      test(fixture.description, async () => {
        const changeAddress = jest.fn(async () => fixture.changeAddress);

        const network = fixture.network;
        const { utxos, targets, fee } = await coinselect({
          utxos: fixture.utxos,
          targets: fixture.targets,
          feeRate: fixture.feeRate,
          changeAddress,
          network: fixture.network
        });
        expect(utxos).not.toBeUndefined();
        expect(targets).not.toBeUndefined();

        expect([fixture.targets.length, fixture.targets.length + 1]).toContain(
          targets.length
        );
        if (targets.length > fixture.targets.length) {
          expect(changeAddress).toHaveBeenCalledTimes(1);
          changeAddress.mockClear();
          expect(fixture.changeAddress).toEqual(
            targets[targets.length - 1].address
          );
        }

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

        const txVSize = psbt.extractTransaction().virtualSize();
        const actualFeeRate = psbt.getFee() / txVSize;

        //console.log({
        //  fee,
        //  psbtFee: psbt.getFee(),
        //  feeRate: fixture.feeRate,
        //  //tx: psbt.extractTransaction().toHex(),
        //  txVSize,
        //  actualFeeRate
        //});
        //
        expect(fee).toEqual(psbt.getFee());
        expect(actualFeeRate).toBeGreaterThanOrEqual(fixture.feeRate);
        expect(actualFeeRate).toBeGreaterThanOrEqual(1);
        //We should not expect actualFeeRate to deviate much from target feeRate
        //It can be larger (never lower) but let's say no more than 10% larger.
        //The test below is not very scientific. Good for tests, but that's it.
        expect(actualFeeRate).toBeLessThan(1.1 * fixture.feeRate);

        //The total value in the utxos = fee + total value un the targets
        expect(
          utxos.reduce(
            (accumul, utxo) => accumul + decodeTx(utxo.tx).vout[utxo.n].value,
            0
          )
        ).toEqual(
          fee + targets.reduce((accumul, target) => accumul + target.value, 0)
        );
      });
    });
  });
  describe('Coinselect tests with no solution', () => {
    fixtures.nosolution.map(fixture => {
      test(fixture.description, async () => {
        const { utxos, targets, fee } = await coinselect({
          utxos: fixture.utxos,
          targets: fixture.targets,
          feeRate: fixture.feeRate,
          changeAddress: async () => fixture.changeAddress,
          network: fixture.network
        });
        expect(utxos).toBeUndefined();
        expect(targets).toBeUndefined();
      });
    });
  });
});
