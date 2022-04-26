//FIXME: Usar createPaymentTransactionNew en lugar de signP2SHTransaction y
//extraer las signatures de las tx generadas.
//Ver si sirve para P2SH. Creo que sí! Creo que incluso quizá valga para taproot
//FIXME: Opcion 2 arreglar signP2SHTransaction para que sea como createPaymentTransactionNew
//https://github.com/LedgerHQ/ledgerjs/blob/3577b9ffa748028faba8a95c05c666df90bbf3d3/packages/hw-app-btc/src/createTransaction.js#L65
//=
//https://github.com/LedgerHQ/ledgerjs/blob/master/packages/hw-app-btc/src/signP2SHTransaction.ts

import LedgerTransport from '@ledgerhq/hw-transport-webusb';
import LedgerAppBtc from '@ledgerhq/hw-app-btc';
import { crypto, networks } from 'bitcoinjs-lib';
import { NATIVE_SEGWIT, NESTED_SEGWIT, LEGACY } from '../walletConstants';

import { Transaction, payments, script, address } from 'bitcoinjs-lib';

import ECPairFactory from 'ecpair';
let fromPublicKey;
import('tiny-secp256k1').then(ecc => {
  fromPublicKey = ECPairFactory(ecc).fromPublicKey;
});

import { checkNetwork, checkPurpose } from '../check';
import {
  setExtendedPubPrefix,
  getNetworkCoinType,
  parseDerivationPath,
  deriveExtendedPub
} from '../bip32';

export async function init() {
  const ledgerTransport = await LedgerTransport.create();
  const ledgerAppBtc = new LedgerAppBtc(ledgerTransport);
  ledgerAppBtc.instanceId = Date.now();
  return ledgerAppBtc;
}

import { classifyScript } from '../classifyScript';

//Ledger nano uses uncompressed pub keys but bitcoinjs and FarVault use
//compressed pub keys
function compressPublicKey(pk) {
  const { publicKey } = fromPublicKey(pk);
  return publicKey;
}

//memoizes getExtendedPub_internal
export const getExtendedPub = (function () {
  const extendedPubs = [];
  return async function (ledgerAppBtc, args) {
    const paramsHash = crypto
      .sha256(
        ledgerAppBtc.instanceId.toString() +
          args.purpose +
          args.accountNumber.toString() +
          args.network.bip32.public
      )
      .toString('hex');
    if (extendedPubs[paramsHash]) {
      return extendedPubs[paramsHash];
    } else {
      extendedPubs[paramsHash] = getExtendedPub_internal(ledgerAppBtc, args);
      return extendedPubs[paramsHash];
    }
  };
})();

async function getExtendedPub_internal(
  ledgerAppBtc,
  { purpose, accountNumber, network = networks.testnet }
) {
  checkPurpose(purpose);
  checkNetwork(network);
  if (!Number.isInteger(accountNumber) || accountNumber < 0)
    throw new Error('Invalid accountNumber');

  return setExtendedPubPrefix(
    await ledgerAppBtc.getWalletXpub({
      //Note below the ' after accountNumber (it's hardened)
      path: `${purpose}'/${getNetworkCoinType(network)}'/${accountNumber}'`,
      //Ledger only accepts xpub or tpub byte version for xpubVersion as in
      //the original BIP32 implementation
      //bitcoinjs-lib (network.bip32.public) also only references xpub or tpub
      //for network = bitcoin, and network = testnet, respectively
      xpubVersion: network.bip32.public
    }),
    purpose,
    network
  );
}

async function getPublicKey(
  ledgerAppBtc,
  derivationPath,
  network = networks.testnet
) {
  const {
    purpose,
    coinType,
    accountNumber,
    index,
    isChange
  } = parseDerivationPath(derivationPath);
  if (getNetworkCoinType(network) !== coinType) {
    throw new Error('Network mismatch');
  }
  const extendedPub = await getExtendedPub(ledgerAppBtc, {
    purpose,
    accountNumber,
    network
  });
  return deriveExtendedPub(extendedPub, index, isChange, network);
}

/*
 * https://github.com/bitcoinjs/bitcoinjs-lib/issues/1517#issuecomment-1064914601
 *
 * redeemScript is conditions that lock the script
 * Use a utxo.derivationPath for P2PKH, P2SH-P2WPKH, P2WPKH.
 * utxo.witnessScript for P2WSH. utxo.redeemScript for P2SH.
 * Pass sequence un a utxo if you want to sing an unlocking tx for a timelock
 */
export async function createSigners(ledgerAppBtc, { psbt, utxos, network }) {
  const tx = psbt.__CACHE.__TX; //It's a private param. May change in future.

  //See if any of the inputs is segwit. If an input is segwit then the tx
  //is also segwit
  const ledgerInputs = [];

  const segwitInputTypes = [];

  for (const utxo of utxos) {
    if (typeof utxo.derivationPath === 'undefined') {
      throw new Error('Must pass a derivationPath for signing an input');
    }
    if (utxo.witnessScript && utxo.redeemScript) {
      throw new Error(
        'Either pass only a utxo.derivationPath for P2PKH, P2SH-P2WPKH, P2WPKH. \
        Or utxo.derivationPath + utxo.witnessScript for P2WSH. \
        Or utxo.derivationPath +  utxo.redeemScript for P2SH.'
      );
    }
    const purpose =
      !utxo.witnessScript &&
      !utxo.redeemScript &&
      parseDerivationPath(utxo.derivationPath).purpose;

    let redeemScript;
    /*if (purpose === NESTED_SEGWIT) {
      const pubkey = await getPublicKey(ledgerAppBtc, utxo.derivationPath);
      redeemScript = payments.p2sh({
        redeem: payments.p2wpkh({ pubkey, network }),
        network
      }).redeem.output;
      segwitInputTypes.push(true);
    } else if (purpose === NATIVE_SEGWIT) {
      redeemScript = undefined;
      segwitInputTypes.push(true);
    }*/
    if (purpose === NESTED_SEGWIT || purpose === NATIVE_SEGWIT) {
      const pubkey = await getPublicKey(ledgerAppBtc, utxo.derivationPath);
      //The redeemScript for NESTED_SEGWIT and NATIVE_SEGWIT must be p2pkh
      //I don't konw why. It's hacky. Who knows what Ledger soft does
      redeemScript = payments.p2pkh({ pubkey, network }).output.toString('hex');
      segwitInputTypes.push(true);
    } else if (purpose === LEGACY) {
      redeemScript = undefined;
      segwitInputTypes.push(false);
    } else if (utxo.redeemScript) {
      throw new Error('P2SH has never been tested! Make tests first!');
      //P2SH
      redeemScript = utxo.redeemScript;
      segwitInputTypes.push(false);
    } else if (utxo.witnessScript) {
      //PW2SH
      redeemScript = utxo.witnessScript;
      segwitInputTypes.push(true);
    } else {
      throw new Error('redeemScript not implemented for this purpose');
    }

    ledgerInputs.push([
      ledgerAppBtc.splitTransaction(
        utxo.tx,
        Transaction.fromHex(utxo.tx).hasWitnesses()
      ),
      utxo.n,
      ...(redeemScript ? [redeemScript] : []),
      ...(utxo.sequence ? [utxo.sequence] : [])
    ]);
  }
  const ledgerDerivationPaths = utxos.map(utxo => utxo.derivationPath);

  const getLedgerTxSignatures = async isSegwit => {
    const ledgerTx = ledgerAppBtc.splitTransaction(tx.toHex(), isSegwit);
    const ledgerOutputScriptHex = ledgerAppBtc
      .serializeTransactionOutputs(ledgerTx)
      .toString('hex');
    // From BtcNew.js
    // segwit for P2SH-P2WPKH.
    // additionals["bech32"] for P2WPKH.
    // additionals["bech32m"] for taproot.
    // I believe it cannot mix accounts.
    //const ledgerTxSignatures = await ledgerAppBtc.createPaymentTransactionNew({
    const ledgerTxSignatures = await ledgerAppBtc.signP2SHTransaction({
      inputs: ledgerInputs,
      associatedKeysets: ledgerDerivationPaths,
      //associatedKeysets: [undefined, ledgerDerivationPaths[1]],
      outputScriptHex: ledgerOutputScriptHex,
      segwit: isSegwit,
      //segwit: true,
      //segwit: false,
      transactionVersion: psbt.version
      //additionals: ["bech32"]
      //additionals: [""]
    });
    return ledgerTxSignatures;
  };
  let ledgerTxSignaturesSegwit, ledgerTxSignaturesLegacy;
  if (segwitInputTypes.includes(true))
    ledgerTxSignaturesSegwit = await getLedgerTxSignatures(true);
  if (segwitInputTypes.includes(false))
    ledgerTxSignaturesLegacy = await getLedgerTxSignatures(false);
  const ledgerTxSignatures = [];
  for (let index = 0; index < utxos.length; index++) {
    ledgerTxSignatures.push(
      segwitInputTypes[index]
        ? ledgerTxSignaturesSegwit[index]
        : ledgerTxSignaturesLegacy[index]
    );
  }

  const signers = [];
  for (let index = 0; index < utxos.length; index++) {
    const ledgerSignature = ledgerTxSignatures[index];
    const encodedSignature = segwitInputTypes[index]
      ? Buffer.from(ledgerSignature, 'hex')
      : Buffer.concat([
          Buffer.from(ledgerSignature, 'hex'),
          Buffer.from('01', 'hex') // SIGHASH_ALL
        ]);
    const decoded = script.signature.decode(encodedSignature);
    signers.push(hash => decoded.signature);
  }
  return signers;
}
