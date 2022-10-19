import { HDInterface } from './HDInterface';
import LedgerTransport from '@ledgerhq/hw-transport-webusb';
import LedgerTransportNodejs from '@ledgerhq/hw-transport-node-hid-noevents';
import LedgerAppBtc from '@ledgerhq/hw-app-btc';
import { NATIVE_SEGWIT, NESTED_SEGWIT, LEGACY } from '../constants';
import { getNetworkId, getNetworkCoinType, networks } from '../networks';
import memoize from 'lodash.memoize';
export const WEB_TRANSPORT = 'WEB_TRANSPORT';
export const NODEJS_TRANSPORT = 'NODEJS_TRANSPORT';
import { unlockScript } from '../scripts';

import { Transaction, payments, script } from 'bitcoinjs-lib';

import { checkNetwork, checkPurpose, checkExtPub } from '../check';
import {
  setExtPubPrefix,
  parseDerivationPath,
  serializeDerivationPath
} from '../bip44';

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

/**
 * Implements an interface to a Ledger device.
 *
 * It is derived from {@link HDInterface} and it implements all the methods
 * described there.
 */
export class LedgerHDInterface extends HDInterface {
  #transport;
  #ledgerTransport;
  #ledgerAppBtc;
  #ledgerAppBtc_instanceId;
  #ledgerAppBtc_name;
  #ledgerAppBtc_version;
  #ledgerAppBtc_flags;

  /**
   * Constructor
   *
   * @param {object} params
   * @param {string} params.transport Either `NODEJS_TRANSPORT` for use on
   * the command line or `WEB_TRANSPORT` for use in a browser-based
   * implementation.
   */
  constructor({ transport }) {
    super();
    if (transport !== WEB_TRANSPORT && transport !== NODEJS_TRANSPORT) {
      throw new Error('Invalid transport');
    } else {
      this.#transport = transport;
    }

    //Overwrite own method to allow memoization
    this.getExtPub = memoize(
      this.getExtPub,
      //The memoize resolver: how to get a key from the params ->
      ({ purpose, accountNumber, network = networks.bitcoin }) =>
        this.#ledgerAppBtc_instanceId.toString() +
        '_' +
        purpose.toString() +
        '_' +
        accountNumber.toString() +
        '_' +
        getNetworkId(network)
    );
  }

  /**
   * Implements {@link HDInterface#init}.
   */
  async init() {
    try {
      this.#ledgerTransport =
        this.#transport === WEB_TRANSPORT
          ? await LedgerTransport.create()
          : await LedgerTransportNodejs.create();
    } catch (error) {
      if (error.id === 'NoDeviceFound') {
        throw new Error(
          'You must be plug in the Ledger Device into an USB port and enter the PIN code.'
        );
      } else {
        throw new Error(error);
      }
    }
    const { name, version, flags } = await getApp(this.#ledgerTransport);
    if (name !== 'Bitcoin' && name !== 'Bitcoin Test') {
      throw new Error(
        name === 'BOLOS'
          ? 'You have correclty plugged in the Ledger device but you must open the Bitcoin App. Please open it and try again.'
          : 'You have correclty plugged in the Ledger device but you must open the Bitcoin App. Please, close the ' +
            name +
            ' App, open Bitcoin and try again.'
      );
    }
    this.#ledgerAppBtc = new LedgerAppBtc(this.#ledgerTransport);
    this.#ledgerAppBtc_instanceId = Date.now();
    this.#ledgerAppBtc_name = name;
    this.#ledgerAppBtc_version = version;
    this.#ledgerAppBtc_flags = flags;
  }

  /**
   * Implements {@link HDInterface#getExtPub}.
   */
  async getExtPub({ purpose, accountNumber, network = networks.bitcoin }) {
    checkPurpose(purpose);
    checkNetwork(network);
    if (!Number.isInteger(accountNumber) || accountNumber < 0)
      throw new Error('Invalid accountNumber');
    if (
      (network === networks.bitcoin && this.#ledgerAppBtc_name !== 'Bitcoin') ||
      ((network === networks.regtest || network === networks.testnet) &&
        this.#ledgerAppBtc_name !== 'Bitcoin Test')
    ) {
      throw new Error(
        "There is a mismatch between Ledger's App and the network requested."
      );
    }

    const extPub = setExtPubPrefix({
      extPub: await this.#ledgerAppBtc.getWalletXpub({
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
        //Note that network.bip32.public will be === constants.XPUBVERSION
        //for mainnet and === constants.TPUBVERSION for testnet and regtest
        xpubVersion: network.bip32.public
      }),
      purpose,
      network
    });
    checkExtPub({ extPub, accountNumber, network });
    return extPub;
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
   * @param {object} utxo An utxo like this: `{path, witnessScript}`
   * @returns {number} A bip68 encoded sequence or `undefined`
   *
   */
  async #getUtxoSequence(utxo, network) {
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
      const pubkey = await this.getPublicKey(utxo.path, network);
      const unlockedScript = unlockScript({ script, pubkey });
      if (unlockedScript === false) {
        throw new Error('It is impossible to unlock this script');
      }
      sequence = unlockedScript.sequence;
    }
    return sequence;
  }

  /**
   * Implements {@link HDInterface#createSigners}.
   */
  async createSigners({ psbt, utxos, network = networks.bitcoin }) {
    checkNetwork(network);
    if (
      (network === networks.bitcoin && this.#ledgerAppBtc_name !== 'Bitcoin') ||
      ((network === networks.regtest || network === networks.testnet) &&
        this.#ledgerAppBtc_name !== 'Bitcoin Test')
    ) {
      throw new Error(
        "There is a mismatch between Ledger's App and the network requested."
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

      const sequence = await this.#getUtxoSequence(utxo, network);
      let redeemScript;
      if (purpose === NATIVE_SEGWIT || purpose === NESTED_SEGWIT) {
        //The redeemScript for NESTED_SEGWIT and NATIVE_SEGWIT must be p2pkh
        //for some reason?!?!?!?
        //This has been thoroughly tested
        const pubkey = await this.getPublicKey(utxo.path, network);
        redeemScript = payments
          .p2pkh({ pubkey, network })
          .output.toString('hex');
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
        //This has been thoroughly tested
        redeemScript = utxo.witnessScript;
        segwitInputTypes.push(true);
      } else {
        throw new Error('redeemScript not implemented for this purpose');
      }

      ledgerInputs.push([
        this.#ledgerAppBtc.splitTransaction(
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
      const ledgerTx = this.#ledgerAppBtc.splitTransaction(
        tx.toHex(),
        isSegwit
      );
      const ledgerOutputScriptHex = this.#ledgerAppBtc
        .serializeTransactionOutputs(ledgerTx)
        .toString('hex');

      const ledgerTxSignatures = await this.#ledgerAppBtc.signP2SHTransaction({
        inputs: ledgerInputs,
        associatedKeysets: ledgerDerivationPaths,
        outputScriptHex: ledgerOutputScriptHex,
        segwit: isSegwit,
        transactionVersion: psbt.version
      });
      return ledgerTxSignatures;
    };
    let ledgerTxSignaturesSegwit, ledgerTxSignaturesLegacy;
    //If one of the inputs was segwit we request the ledger device to sign a
    //segwit tx as if all the utxos were segwit. This is a limitation with
    //signP2SHTransaction. It forces to sign assuming everything is segwit/not seg.
    //Later we will pair the correct signature with the correct utxo
    if (segwitInputTypes.includes(true))
      ledgerTxSignaturesSegwit = await getLedgerTxSignatures(true);
    //If one of the inputs was NOT segwit we request the ledger device to sign a
    //segwit tx as if all the utxos were NOT segwit.
    if (segwitInputTypes.includes(false))
      ledgerTxSignaturesLegacy = await getLedgerTxSignatures(false);

    //This is were we match legacySignatures with legacy utxos and segwitSignatures
    //with segwit utxos:
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

  /**
   * Implements {@link HDInterface#close}.
   */
  async close() {
    await this.#ledgerTransport.close();
  }
}
