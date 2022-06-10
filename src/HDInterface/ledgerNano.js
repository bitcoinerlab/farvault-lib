/** @module HDInterface/ledgerNano */

//FIXME: Usar createPaymentTransactionNew en lugar de signP2SHTransaction y
//extraer las signatures de las tx generadas.
//Ver si sirve para P2SH. Creo que sí! Creo que incluso quizá valga para taproot
//FIXME: Opcion 2 arreglar signP2SHTransaction para que sea como createPaymentTransactionNew
//https://github.com/LedgerHQ/ledgerjs/blob/3577b9ffa748028faba8a95c05c666df90bbf3d3/packages/hw-app-btc/src/createTransaction.js#L65
//=
//https://github.com/LedgerHQ/ledgerjs/blob/master/packages/hw-app-btc/src/signP2SHTransaction.ts

import LedgerTransport from '@ledgerhq/hw-transport-webusb';
import LedgerTransportNodejs from '@ledgerhq/hw-transport-node-hid-noevents';
import LedgerAppBtc from '@ledgerhq/hw-app-btc';
import { NATIVE_SEGWIT, NESTED_SEGWIT, LEGACY } from '../walletConstants';
import memoize from 'lodash.memoize';
export const WEB_TRANSPORT = 'WEB_TRANSPORT';
export const NODEJS_TRANSPORT = 'NODEJS_TRANSPORT';
import { unlockScript } from '../scripts';

import {
  //  crypto,
  Transaction,
  payments,
  script,
  address,
  networks
} from 'bitcoinjs-lib';

import ECPairFactory from 'ecpair';
let fromPublicKey;
import('tiny-secp256k1').then(ecc => {
  fromPublicKey = ECPairFactory(ecc).fromPublicKey;
});

import { checkNetwork, checkPurpose, checkExtPub } from '../check';
import {
  setExtPubPrefix,
  getNetworkCoinType,
  parseDerivationPath,
  deriveExtPub,
  serializeDerivationPath
} from '../bip32';

//https://github.com/LedgerHQ/ledgerjs/issues/122#issuecomment-568265915
async function getApp(transport) {
  var r = await transport.send(0xb0, 0x01, 0x00, 0x00);
  var i = 0;
  var format = r[i++];
  var nameLength = r[i++];
  var name = r.slice(i, (i += nameLength)).toString('ascii');
  var versionLength = r[i++];
  var version = r.slice(i, (i += versionLength)).toString('ascii');
  var flagLength = r[i++];
  var flags = r.slice(i, (i += flagLength));
  return { name, version, flags };
}

export async function init(transport = WEB_TRANSPORT) {
  if (transport !== WEB_TRANSPORT && transport !== NODEJS_TRANSPORT) {
    throw new Error('Invalid transport');
  }
  let ledgerTransport;
  try {
    ledgerTransport =
      transport === WEB_TRANSPORT
        ? await LedgerTransport.create()
        : await LedgerTransportNodejs.create();
  } catch (error) {
    if (error.id === 'NoDeviceFound') {
      throw new Error(
        'You must be plug in the LedgerNano Device into an USB port and enter the PIN code.'
      );
    } else {
      throw new Error(error);
    }
  }
  const { name, version, flags } = await getApp(ledgerTransport);
  if (name !== 'Bitcoin' && name !== 'Bitcoin Test') {
    throw new Error(
      name === 'BOLOS'
        ? 'You have correclty plugged in the Ledger Nano device but you must open the Bitcoin App. Please open it and try again.'
        : 'You have correclty plugged in the Ledger Nano device but you must open the Bitcoin App. Please, close the ' +
          name +
          ' App, open Bitcoin and try again.'
    );
  }
  const ledgerAppBtc = new LedgerAppBtc(ledgerTransport);
  ledgerAppBtc.farvaultInternalInformation = {
    instanceId: Date.now(),
    name,
    version
  };
  return { ledgerTransport, ledgerAppBtc };
}

export async function close(ledgerTransport) {
  await ledgerTransport.close();
}

//Ledger nano uses uncompressed pub keys but bitcoinjs and FarVault use
//compressed pub keys
function compressPublicKey(pk) {
  const { publicKey } = fromPublicKey(pk);
  return publicKey;
}

export const getExtPub = memoize(
  async function (
    ledgerAppBtc,
    { purpose, accountNumber, network = networks.bitcoin }
  ) {
    checkPurpose(purpose);
    checkNetwork(network);
    if (!Number.isInteger(accountNumber) || accountNumber < 0)
      throw new Error('Invalid accountNumber');
    if (
      (network === networks.bitcoin &&
        ledgerAppBtc.farvaultInternalInformation.name !== 'Bitcoin') ||
      ((network === networks.regtest || network === networks.testnet) &&
        ledgerAppBtc.farvaultInternalInformation.name !== 'Bitcoin Test')
    ) {
      throw new Error(
        "There is a mismatch between Ledger's Nano App and the network requested."
      );
    }

    const extPub = setExtPubPrefix({
      extPub: await ledgerAppBtc.getWalletXpub({
        path: serializeDerivationPath({
          purpose,
          coinType: getNetworkCoinType(network),
          accountNumber
        }),
        //Ledger only accepts xpub or tpub byte version for xpubVersion as in
        //the original BIP32 implementation
        //bitcoinjs-lib (network.bip32.public) also only references xpub or tpub
        //for network = bitcoin, and network = testnet, respectively
        //Read setExtPubPrefix documentation to understand why this is here.
        //Note that network.bip32.public will be === walletConstants.XPUBVERSION
        //for mainnet and === walletConstants.TPUBVERSION for testnet and regtest
        xpubVersion: network.bip32.public
      }),
      purpose,
      network
    });
    checkExtPub({ extPub, accountNumber, network });
    return extPub;
  },
  //The memoize resolver: how to get a key from the params ->
  (ledgerAppBtc, { purpose, accountNumber, network = networks.bitcoin }) =>
    ledgerAppBtc.farvaultInternalInformation.instanceId.toString() +
    '_' +
    purpose.toString() +
    '_' +
    accountNumber.toString() +
    '_' +
    network.bip32.public.toString()
);

async function getPublicKey(ledgerAppBtc, path, network = networks.bitcoin) {
  const {
    purpose,
    coinType,
    accountNumber,
    index,
    isChange
  } = parseDerivationPath(path);
  if (getNetworkCoinType(network) !== coinType) {
    throw new Error('Network mismatch');
  }
  const extPub = await getExtPub(ledgerAppBtc, {
    purpose,
    accountNumber,
    network
  });
  return deriveExtPub({ extPub, index, isChange, network });
}

/** Tries to obtain the lockTime from an utxo
 *
 * If the utxo has a witnessScript or redeemScript, then it parses the script
 * and checks if this is a script we know how to spend (a relativeTimeLockScript
 * for now)
 *
 * If this is a script that we know how to spend then it returns the appropriate
 * sequence.
 *
 * Otherwise it returns `undefined`.
 *
 * @param {object} ledgerAppBtc A [`'@ledgerhq/hw-app-btc'`](https://github.com/LedgerHQ/ledgerjs/tree/master/packages/hw-app-btc#btc) object
 * @param {object} utxo An utxo like this: `{path, witnessScript}`
 * @returns {number} A bip68 encoded sequence or `undefined`
 *
 */
async function getUtxoSequence(ledgerAppBtc, utxo, network) {
  let sequence = undefined;
  let script = undefined;
  if (typeof utxo.witnessScript === 'string') {
    script = utxo.witnessScript;
  }
  if (typeof utxo.redeemScript === 'string') {
    if (typeof utxo.witnessScript === 'string') {
      throw new Error(
        'Cannot have redeemScript and witnessScript at the same time'
      );
    }
    script = utxo.redeemScript;
  }
  if (typeof script !== 'undefined') {
    const pubkey = await getPublicKey(ledgerAppBtc, utxo.path, network);
    const unlockedScript = unlockScript({ script, pubkey });
    if (unlockedScript === false) {
      throw new Error('It is impossible to unlock this script');
    }
    sequence = unlockedScript.sequence;
  }
  return sequence;
}

/**
 * Pass all the utxos that will be signed. The psbt may have more utxos.
 * Also pass the psbt (still not finalized and unlocking scripts may have
 * not been set yet. Just the basic psbt that can be signed.
 *
 * Read some discussion about the motivation behind this function [here](https://github.com/bitcoinjs/bitcoinjs-lib/issues/1517#issuecomment-1064914601).
 *
 * Utxos must include:
 * * utxo.witnessScript for P2WSH.
 * * utxo.redeemScript for P2SH.
 *
 * The sequence is obtained from the locking script in witnessScript and redeemScript
 * by parsing the script and comparing it with the known scripts that this
 * wallet software can spend.
 *
 * @param {object} ledgerAppBtc A [`'@ledgerhq/hw-app-btc'`](https://github.com/LedgerHQ/ledgerjs/tree/master/packages/hw-app-btc#btc) object
 * @param {objects} parameters
 * @param {object} parameters.psbt [bitcoinjs-lib Psbt object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/psbt.js)
 * @param {string} parameters.utxos[].path Derivation path. F.ex.: `44'/1'/1'/0/0`.
 * @param {string} parameters.utxos[].tx The transaction serialized in hex.
 * @param {number} parameters.utxos[].n The vout index of the tx above.
 * @param {string} [parameters.utxos[].witnessScript] The witnessScript serialized in hex in case the utxo can be redeemed with an unlocking script.
 * @param {object} [parameters.network=networks.bitcoin] [bitcoinjs-lib network object](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js)
 */
export async function createSigners(
  ledgerAppBtc,
  { psbt, utxos, network = networks.bitcoin }
) {
  checkNetwork(network);
  if (
    (network === networks.bitcoin &&
      ledgerAppBtc.farvaultInternalInformation.name !== 'Bitcoin') ||
    ((network === networks.regtest || network === networks.testnet) &&
      ledgerAppBtc.farvaultInternalInformation.name !== 'Bitcoin Test')
  ) {
    throw new Error(
      "There is a mismatch between Ledger's Nano App and the network requested."
    );
  }
  const tx = psbt.__CACHE.__TX; //It's a private param. May change in future.

  //See if any of the inputs is segwit. If an input is segwit then the tx
  //is also segwit
  const ledgerInputs = [];

  const segwitInputTypes = [];

  for (const utxo of utxos) {
    if (typeof utxo.path === 'undefined') {
      throw new Error('Must pass a path for signing an input');
    }
    if (utxo.witnessScript && utxo.redeemScript) {
      throw new Error(
        'Either pass a single utxo.path for P2PKH, P2SH-P2WPKH, P2WPKH. \
        Or utxo.path + utxo.witnessScript for P2WSH/P2SH-P2WSH. \
        Or utxo.path +  utxo.redeemScript for Legacy P2SH.'
      );
    }
    const purpose =
      !utxo.witnessScript &&
      !utxo.redeemScript &&
      parseDerivationPath(utxo.path).purpose;

    const sequence = await getUtxoSequence(ledgerAppBtc, utxo, network);
    let redeemScript;
    if (purpose === NATIVE_SEGWIT || purpose === NESTED_SEGWIT) {
      //The redeemScript for NESTED_SEGWIT and NATIVE_SEGWIT must be p2pkh
      //for some reason?!?!?!?
      const pubkey = await getPublicKey(ledgerAppBtc, utxo.path, network);
      redeemScript = payments.p2pkh({ pubkey, network }).output.toString('hex');
      segwitInputTypes.push(true);
    } else if (purpose === LEGACY) {
      redeemScript = undefined;
      segwitInputTypes.push(false);
    }
    //Legacy P2SH (not P2SH-P2WSH)
    else if (utxo.redeemScript) {
      redeemScript = utxo.redeemScript;
      segwitInputTypes.push(false);
    }
    //P2WSH or P2SH-P2WSH
    else if (utxo.witnessScript) {
      //Yeah, the redeemScript = witnessScript even for P2SH-P2WSH...
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
      ...(sequence ? [sequence] : [])
    ]);
  }
  const ledgerDerivationPaths = utxos.map(utxo => utxo.path);

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
