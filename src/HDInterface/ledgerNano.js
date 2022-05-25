/** @module HDInterface/ledgerNano */

//FIXME: Usar createPaymentTransactionNew en lugar de signP2SHTransaction y
//extraer las signatures de las tx generadas.
//Ver si sirve para P2SH. Creo que sí! Creo que incluso quizá valga para taproot
//FIXME: Opcion 2 arreglar signP2SHTransaction para que sea como createPaymentTransactionNew
//https://github.com/LedgerHQ/ledgerjs/blob/3577b9ffa748028faba8a95c05c666df90bbf3d3/packages/hw-app-btc/src/createTransaction.js#L65
//=
//https://github.com/LedgerHQ/ledgerjs/blob/master/packages/hw-app-btc/src/signP2SHTransaction.ts

import LedgerTransport from '@ledgerhq/hw-transport-webusb';
import LedgerAppBtc from '@ledgerhq/hw-app-btc';
import { NATIVE_SEGWIT, NESTED_SEGWIT, LEGACY } from '../walletConstants';

import {
  crypto,
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

//memoizes getExtPub_internal
export const getExtPub = (function () {
  const extPubs = [];
  return async function (ledgerAppBtc, args) {
    const paramsHash = crypto
      .sha256(
        ledgerAppBtc.instanceId.toString() +
          args.purpose +
          args.accountNumber.toString() +
          args.network.bip32.public
      )
      .toString('hex');
    if (extPubs[paramsHash]) {
      return extPubs[paramsHash];
    } else {
      extPubs[paramsHash] = getExtPub_internal(ledgerAppBtc, args);
      return extPubs[paramsHash];
    }
  };
})();

async function getExtPub_internal(
  ledgerAppBtc,
  { purpose, accountNumber, network = networks.bitcoin }
) {
  checkPurpose(purpose);
  checkNetwork(network);
  if (!Number.isInteger(accountNumber) || accountNumber < 0)
    throw new Error('Invalid accountNumber');

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
}

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
 * and checks if this is a script we know how to spend (a relativeTimeLockScript)
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
async function getUtxoSequence(ledgerAppBtc, utxo) {
  let sequence;
  let script;
  if (typeof utxo.witnessScript === 'string') {
    script = utxo.witnessScript;
  }
  if (typeof utxo.redeemScript === 'string') {
    if (typeof utxo.witnessScript == 'string') {
      throw new Error(
        'Cannot have redeemScript and witnessScript at the same time'
      );
    }
    script = utxo.redeemScript;
  }
  const parsedScript = parseRelativeTimeLockScript(Buffer.from(script, 'hex'));
  if (parsedScript !== false) {
    const pubkey = await getPublicKey(ledgerAppBtc, utxo.path);
    const { maturedPublicKey, rushedPublicKey, bip68LockTime } = parsedScript;
    if (Buffer.compare(pubkey, maturedPublicKey) === 0) {
      sequence = bip68LockTime;
    }
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
        'Either pass only a utxo.path for P2PKH, P2SH-P2WPKH, P2WPKH. \
        Or utxo.path + utxo.witnessScript for P2WSH. \
        Or utxo.path +  utxo.redeemScript for P2SH.'
      );
    }
    const purpose =
      !utxo.witnessScript &&
      !utxo.redeemScript &&
      parseDerivationPath(utxo.path).purpose;

    const sequence = await getUtxoSequence(ledgerAppBtc, utxo);

    let redeemScript;

    /*if (purpose === NESTED_SEGWIT) {
      const pubkey = await getPublicKey(ledgerAppBtc, utxo.path);
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
      const pubkey = await getPublicKey(ledgerAppBtc, utxo.path);
      //The redeemScript for NESTED_SEGWIT and NATIVE_SEGWIT must be p2pkh
      //I don't konw why. It's hacky. Who knows why Ledger soft works this way.
      //Intuitively it should work as in the commented block above.
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
      ...(sequence ? [sequence] : [])
    ]);
  }
  const ledgerDerivationPaths = utxos.map(utxo => utxo.path);

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
