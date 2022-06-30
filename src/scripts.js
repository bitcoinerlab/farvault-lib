/** @module scripts */

import bip68 from 'bip68';
import { payments, script as bscript, opcodes } from 'bitcoinjs-lib';

/**
 *
 * Use this function instead of bitcoinjs-lib's equivalent `script.number.encode`
 * when encoding numbers to be compiled with `fromASM` to avoid problems.
 *
 * Motivation:
 *
 * Numbers in Bitcoin assembly code are represented in hex and in Little Endian.
 * Decimal: 32766 - Big endian: 0x7FFE - Little Endian: 0xFE7F.
 *
 * This function takes an integer and encodes it so that bitcoinjs-lib `fromASM`
 * can compile it. This is basically what bitcoinjs-lib's `script.number.encode`
 * does.
 *
 * Note that `fromASM` already converts integers from 1 to 16 to
 * OP_1 ... OP_16 {@link https://github.com/bitcoinjs/bitcoinjs-lib/blob/59b21162a2c4645c64271ca004c7a3755a3d72fb/src/script.js#L33 here}.
 * This is done in Bitcoin to save some bits.
 *
 * Neither this function nor `script.number.encode` convert numbers to
 * their op code equivalent since this is done later in `fromASM`.
 *
 * Both functions simply convert numbers to Little Endian.
 *
 * However, the `0` number is an edge case that we specially handle with this
 * function.
 *
 * bitcoinjs-lib's `bscript.number.encode(0)` produces an empty Buffer.
 * This is what the Bitcoin interpreter does and it is what `script.number.encode` was
 * implemented to do.
 *
 * The problem is `bscript.number.encode(0).toString('hex')` produces an
 * empty string and thus it should not be used to serialize number zero before `fromASM`.
 *
 * A zero should produce the OP_0 ASM symbolic code (corresponding to a `0` when
 * compiled).
 *
 * So, this function will produce a string in hex format in Little Endian
 * encoding for integers not equal to `0` and it will return `OP_0` for `0`.
 *
 * Read more about the this {@link https://github.com/bitcoinjs/bitcoinjs-lib/issues/1799#issuecomment-1122591738 here}.
 *
 * Use it in combination with `fromASM` like this:
 *
 * ```javascript
 * //To produce "0 1 OP_ADD":
 * fromASM(
 * `${numberEncodeAsm(0)} ${numberEncodeAsm(1)} OP_ADD`
 *   .trim().replace(/\s+/g, ' ')
 * )
 * ```
 *
 * @param {number} number An integer.
 * @returns {string} Returns `"OP_0"` for `number === 0` and a hex string representing other numbers in Little Endian encoding.
 */
function numberEncodeAsm(number) {
  if (Number.isSafeInteger(number) === false) {
    throw new Error('Invalid number');
  }
  if (number === 0) {
    return 'OP_0';
  } else return bscript.number.encode(number).toString('hex');
}

/**
 * Use this function to decode numbers after they have been decompiled using
 * bitcoinjs-lib's `script.decompile`.
 *
 * Note that numbers are compiled as `OP_0` for `0`, and to:
 * `OP_1,... OP_16` for `1,... 16`,
 * where `OP_1 = 0x51 = 81`, `OP_2 = 0x52 = 82`, ...
 *
 * Thats the reason for `script.decompile` to produce `Buffer` types for
 * numbers > 16 and to produce `number` types for numbers <= 16.
 * The later correspond to an op code. For example. `OP_1` = 0x51 (of type number).
 * And `Buffer` types correspond to binary representations of encoded numbers in
 * Little Endian.
 *
 * Other numbers can be successfully decompiled using `bscript.number.decode`.
 *
 * Read more about the this {@link https://github.com/bitcoinjs/bitcoinjs-lib/issues/1799#issuecomment-1121656429 here}.
 *
 * @param {number|Buffer} decompiled A decompiled number.
 * @returns {number} The decoded number after OP code lookup or after converting from a Buffer in Little Endian encoding.
 */
function scriptNumberDecode(decompiled) {
  if (typeof decompiled === 'number' && decompiled === 0) {
    //OP_0, OP_FALSE:
    return 0;
  } else {
    if (
      typeof decompiled === 'number' &&
      decompiled >= 0x51 && // OP_1 (or OP_TRUE)
      decompiled <= 0x60 // OP_16
    ) {
      return bscript.number.decode(Buffer.from([decompiled - 0x50]));
    } else {
      if (!Buffer.isBuffer(decompiled))
        throw new Error('Invalid decompiled number');
      // this is a Buffer
      const decoded = bscript.number.decode(decompiled);
      if (decoded >= 0 && decoded <= 16)
        throw new Error('0 to 16 should have been compiled using op codes');
      return decoded;
    }
  }
}

/**
 * It compiles the FarVault locking script:
 * ```
 * <MATURED_PUB>
 * OP_CHECKSIG
 * OP_NOTIF
 * <RUSHED_PUB>
 * OP_CHECKSIG
 * OP_ELSE
 * <ENCODED_LOCKTIME>
 * OP_CHECKSEQUENCEVERIFY
 * OP_ENDIF
 * ```
 * @param {Buffer} maturedPublicKey The public key that can unlock funds after timelock.
 * @param {Buffer} rushedPublicKey The public key that can unlock the funds anytime.
 * @param {number} bip68LockTime A BIP68 encoded timelock time.
 * @returns {Buffer} The script
 */
export function createRelativeTimeLockScript({
  maturedPublicKey,
  rushedPublicKey,
  bip68LockTime
}) {
  //No need to memoize it
  if (typeof bip68LockTime === 'number' && bip68LockTime === 0) {
    throw new Error('FarVault does not allow sequence to be 0.');
    /*
     * If bip68LockTime is 0 while unlocking a matured pubkey, then
     * the UNLOCKING + LOCKING script is evaluated
     * resulting into a zero (where 0 === OP_FALSE) on the top of the stack.
     *
     * Note that OP_CHECKSEQUENCEVERIFY behaves as a NOP if the check is ok and
     * it does not consume bip68LockTime value.
     *
     * This is fine when bip68LockTime != 0 but if bip68LockTime is zero then
     * it produces the following error when the miner evaluates the script:
     *
     * non-mandatory-script-verify-flag (Script evaluated without error but finished with a false/empty top stack element
     *
     * This is how the ulocking is evaluated when unlocking with a matured key.
     * Note how a zero would be left at the top if ENCODED_LOCKTIME = 0 ->
     *
     * <MATURED_SIGNATURE> <- This is the unlocking script.
     * <MATURED_PUB> <- Here and below corresponds to the locking script.
     * OP_CHECKSIG
     * OP_NOTIF
     * <RUSHED_PUB>
     * OP_CHECKSIG
     * OP_ELSE
     * <ENCODED_LOCKTIME>
     * OP_CHECKSEQUENCEVERIFY
     * OP_ENDIF
     *
     * -> If we're in the matured branch:
     *
     * TRUE
     * OP_NOTIF
     * <RUSHED_PUB>
     * OP_CHECKSIG
     * OP_ELSE
     * <ENCODED_LOCKTIME>
     * OP_CHECKSEQUENCEVERIFY
     * OP_ENDIF
     *
     * ->
     *
     * TRUE
     * OP_ELSE
     * <ENCODED_LOCKTIME>
     * OP_CHECKSEQUENCEVERIFY
     * OP_ENDIF
     *
     * ->
     *
     * <ENCODED_LOCKTIME>
     * OP_CHECKSEQUENCEVERIFY
     *
     * -> OP_CHECKSEQUENCEVERIFY behaves as a NOP if the sequence is ok:
     *
     * <ENCODED_LOCKTIME>
     *
     * -> If ENCODED_LOCKTIME = 0:
     *
     * FALSE
     */
  }

  //Do some more validation before producing the lockins script:
  if (
    !Buffer.isBuffer(maturedPublicKey) ||
    Buffer.byteLength(maturedPublicKey) !== 33
  ) {
    throw new Error('Invalid maturedPublicKey');
  }
  if (
    !Buffer.isBuffer(rushedPublicKey) ||
    Buffer.byteLength(rushedPublicKey) !== 33
  ) {
    throw new Error('Invalid rushedPublicKey');
  }
  if (
    typeof bip68LockTime !== 'number' ||
    bip68.encode(bip68.decode(bip68LockTime)) !== bip68LockTime
  ) {
    throw new Error('Invalid bip68LockTime');
  }
  return bscript.fromASM(
    `
      ${maturedPublicKey.toString('hex')}
      OP_CHECKSIG
      OP_NOTIF
          ${rushedPublicKey.toString('hex')}
          OP_CHECKSIG 
      OP_ELSE
          ${numberEncodeAsm(bip68LockTime)}
          OP_CHECKSEQUENCEVERIFY
      OP_ENDIF
    `
      .trim()
      .replace(/\s+/g, ' ')
  );
}

/**
 * Gets the sequence and the unlockingScript for a given script.
 * Right now it only parses FarVault's relativeTimeLockScripts.
 *
 * Note that this function cannot return the unlockingScript since unlocking
 * scripts will often include a signature.
 * Instead, we return a callback function
 * createUnlockingScripts(signature) that will create a unlockingScript
 * given a signature.
 *
 * This function can be expanded to implement other scripts in the future.
 *
 * @param {object} parameters
 * @param {string} parameters.script The locking script in hex
 * @param {Buffer} parameters.pubkey The public key that unlocks this script
 *
 * @returns {object|boolean} `false` if if cannot be parsed or
 * `{sequence, createUnlockingScripts}`
 * where `sequence` is a `number` containing the bip68 encoded lock time and
 * `createUnlockingScript` is a callback function that you can pass a signature
 * and it will return the unlockingScript.
 */
export function unlockScript({ script, pubkey }) {
  let sequence;
  let createUnlockingScript;

  //This wallet only knows how to spend relativeTimeLockScript's
  const parsedScript = parseRelativeTimeLockScript(script);
  if (parsedScript === false) {
    return false;
  }
  const { maturedPublicKey, rushedPublicKey, bip68LockTime } = parsedScript;
  //partialSig[0] has a zero because the input is only signed with
  //one pubkey. Either rushed or matured. It's not multi-sig
  if (Buffer.compare(pubkey, maturedPublicKey) === 0) {
    //This script have a CSV lock if it is unlocking the matured branch:
    sequence = bip68LockTime;
    //this is how matured transactions can be unlocked:
    createUnlockingScript = signature => bscript.compile([signature]);
  } else if (Buffer.compare(pubkey, rushedPublicKey) === 0) {
    //this is how rushed transactions can are unlocked:
    createUnlockingScript = signature =>
      bscript.compile([signature, opcodes.OP_0]);
  } else {
    throw new Error(
      "This wallet's utxo pubkey cannot spend this relativeTimeLockScript."
    );
  }
  return { sequence, createUnlockingScript };
}

/**
 * It decompiles a Bitcoin script and tries to parse it as if it were a
 * FarVault locking script.
 *
 * scripts with bip68LockTime = zero are not considered to be valid
 * since unlocking it would leave OP_FALSE
 * false on the top of the stack (read comments on function
 * `createRelativeTimeLockScript` to see how unlocking would work).
 *
 * @param {string} relativeTimeLockScript The locking script in hex
 * @returns {bool|object} Returns `false` if `relativeTimeLockScript` is not a FarVault locking script or `{maturedPublicKey, rushedPublicKey, bip68LockTime}` otherwise, where `maturedPublicKey` and `rushedPath` are public keys (type: `Buffer`) and `bip68LockTime` is a BIP68 encoded time (type: `number`).
 */
export function parseRelativeTimeLockScript(relativeTimeLockScript) {
  if (typeof relativeTimeLockScript !== 'string') {
    throw new Error(
      'Invalid type for relativeTimeLockScript: ' +
        typeof relativeTimeLockScript
    );
  }
  //No need to memoize
  const decompiled = bscript.decompile(
    Buffer.from(relativeTimeLockScript, 'hex')
  );
  if (
    //decompile returns null on faulty script:
    decompiled !== null &&
    //Make sure the relativeTimeLockScript was encoded using minimal ops.
    //For example it is an error to use 0a instead of OP_10 for representing
    //numbers
    //However script.decompile will take a 0a and decompile it. Even worse it will
    //will convert it to OP_10! But this is wrong!
    //See test with description for an invalid script that this will catch:
    //'parseRelativeTimeLockScript returns false when using 0a instead of OP_10 for the bip68LockTime in the script'
    bscript.compile(decompiled).toString('hex') === relativeTimeLockScript &&
    decompiled.length === 9 &&
    Buffer.isBuffer(decompiled[0]) &&
    Buffer.byteLength(decompiled[0]) === 33 &&
    decompiled[1] === opcodes.OP_CHECKSIG &&
    decompiled[2] === opcodes.OP_NOTIF &&
    Buffer.isBuffer(decompiled[3]) &&
    Buffer.byteLength(decompiled[3]) === 33 &&
    decompiled[4] === opcodes.OP_CHECKSIG &&
    decompiled[5] === opcodes.OP_ELSE &&
    bip68.encode(bip68.decode(scriptNumberDecode(decompiled[6]))) ===
      scriptNumberDecode(decompiled[6]) &&
    scriptNumberDecode(decompiled[6]) !== 0 &&
    decompiled[7] === opcodes.OP_CHECKSEQUENCEVERIFY &&
    decompiled[8] === opcodes.OP_ENDIF
  ) {
    return {
      maturedPublicKey: decompiled[0],
      rushedPublicKey: decompiled[3],
      bip68LockTime: scriptNumberDecode(decompiled[6])
    };
  }
  return false;
}
export const exportedForTesting = {
  numberEncodeAsm,
  scriptNumberDecode
};

/*
 * These 4 functions below are basically
 * bitcoinjs-lib's PSBT: classifyScript
 */

export function isP2SH(script) {
  try {
    payments.p2sh({ output: script });
    return true;
  } catch (err) {
    return false;
  }
}
export function isP2WSH(script) {
  try {
    payments.p2wsh({ output: script });
    return true;
  } catch (err) {
    return false;
  }
}
export function isP2WPKH(script) {
  try {
    payments.p2wpkh({ output: script });
    return true;
  } catch (err) {
    return false;
  }
}
export function isP2PKH(script) {
  try {
    payments.p2pkh({ output: script });
    return true;
  } catch (err) {
    return false;
  }
}
