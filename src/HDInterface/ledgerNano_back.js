//FIXME: Usar createPaymentTransactionNew en lugar de signP2SHTransaction y
//extraer las signatures de las tx generadas.
//Ver si sirve para P2SH. Creo que sí! Creo que incluso quizá valga para taproot
import LedgerTransport from '@ledgerhq/hw-transport-webusb';
import LedgerAppBtc from '@ledgerhq/hw-app-btc';
import { networks } from 'bitcoinjs-lib';
import {
  BIP32_PURPOSE,
  NATIVE_SEGWIT,
  NESTED_SEGWIT,
  LEGACY
} from '../walletConstants';

import { Transaction, payments, script, address } from 'bitcoinjs-lib';

import ECPairFactory from 'ecpair';
let fromPublicKey;
import('tiny-secp256k1').then(ecc => {
  fromPublicKey = ECPairFactory(ecc).fromPublicKey;
});

import {
  validateNetwork,
  validatePubType,
  validateCoinTypePubType
} from '../validation';
import {
  changePubType,
  networkCoinType,
  parseDerivationPath,
  derivePubKey
} from '../bip32';
import { PUBTYPES } from '../walletConstants';

export async function init() {
  const ledgerTransport = await LedgerTransport.create();
  const ledgerAppBtc = new LedgerAppBtc(ledgerTransport);
  return ledgerAppBtc;
}

import { classifyScript } from '../classifyScript';

//Ledger nano uses uncompressed pub keys but bitcoinjs and FarVault use
//compressed pub keys
function compressPublicKey(pk) {
  const { publicKey } = fromPublicKey(pk);
  return publicKey;
}

//FIXME: Cache it!
export async function getPub(
  ledgerAppBtc,
  pubType,
  accountNumber,
  //Specify the network since BCH and other shitcoins may use the same pubType
  network = networks.testnet
) {
  validatePubType(pubType);
  validateNetwork(network);
  validateCoinTypePubType(networkCoinType(network), pubType);
  if (!Number.isInteger(accountNumber) || accountNumber < 0)
    throw new Error('Invalid accountNumber');

  return changePubType(
    await ledgerAppBtc.getWalletXpub({
      //Note below the ' after accountNumber (it's hardened)
      path: `${BIP32_PURPOSE[pubType]}'/${networkCoinType(
        network
      )}'/${accountNumber}'`,
      //Ledger only accepts xpub or tpub byte version for xpubVersion as in
      //the original BIP32 implementation
      //bitcoinjs-lib (network.bip32.public) also only references xpub or tpub
      //for network = bitcoin, and network = testnet, respectively
      xpubVersion: network.bip32.public
    }),
    pubType
  );
}

/*This function is unused. We use the more general one getPublicKey
 * at index.js*/
export async function getPublicKey(
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
  if (networkCoinType(network) !== coinType) {
    throw new Error('Network mismatch');
  }
  const pubType = PUBTYPES[coinType][purpose];
  const pub = await getPub(ledgerAppBtc, pubType, accountNumber, network);
  return derivePubKey(pub, index, isChange, network);
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

    const ledgerTxSignatures = await ledgerAppBtc.signP2SHTransaction({
      inputs: ledgerInputs,
      associatedKeysets: ledgerDerivationPaths,
      outputScriptHex: ledgerOutputScriptHex,
      segwit: isSegwit,
      transactionVersion: psbt.version
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

export async function pay(
  ledgerAppBtc,
  { psbt, psbtHasWitnesses, utxo, isSegwit, psbtVersion, network }
) {
  const lockTime = 0;
  const sigHashType = Transaction.SIGHASH_ALL;
  const tx = psbt.__CACHE.__TX;
  //Convert Inputs to Ledger Format
  const ledgerUTXO = ledgerAppBtc.splitTransaction(
    utxo.tx,
    Transaction.fromHex(utxo.tx).hasWitnesses()
  );
  //Convert Outputs to Ledger Format
  const ledgerTX = ledgerAppBtc.splitTransaction(tx.toHex(), psbtHasWitnesses);
  const outputScriptHex = ledgerAppBtc
    .serializeTransactionOutputs(ledgerTX)
    .toString('hex');
  const paymentHex = await ledgerAppBtc.createPaymentTransactionNew({
    inputs: [[ledgerUTXO, utxo.n]],
    associatedKeysets: [utxo.derivationPath],
    outputScriptHex,
    segwit: psbtHasWitnesses,
    useTrustedInputForSegwit: true, //Must be always true
    transactionVersion: psbtVersion,
    lockTime,
    sigHashType,
    //FIXME->bech32 missing one extra check: if (hasWitnesses AND if input it is not a Embedded Segwit)
    //Also, there is bech32m which is used for taproot but may also be used for future segwit outputs (not P2WSH or P2WPKH)
    additionals: Transaction.fromHex(utxo.tx).hasWitnesses()
      ? ['bech32'] // bech32 for spending native segwit outputs (84' paths)
      : []
  });
  return paymentHex;
}
