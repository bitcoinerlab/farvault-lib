//See ~/tmp/disccovery.js
import { networks } from './networks';
import { payments } from 'bitcoinjs-lib';
import { createRelativeTimeLockScript } from './scripts';
const { p2sh, p2wpkh, p2pkh, p2wsh } = payments;
import BIP32Factory from 'bip32';
import * as ecc from './secp256k1';
let bjsBip32;
if (typeof ecc === 'object' && typeof ecc.then === 'function') {
  (async () => {
    //webpack modules will load WASM asynchronously. Node won't.
    bjsBip32 = BIP32Factory(await ecc);
  })();
} else {
  bjsBip32 = BIP32Factory(ecc);
}

//Regular expressions cheat sheet
//https://www.keycdn.com/support/regex-cheat-sheet

//hardened characters
const reHardened = String.raw`(['hH])`;
//a level is a series of integers followed (optional) by a hardener char
const reLevel = String.raw`(\d+${reHardened}?)`;
//a path component is a level followed by a slash "/" char
const rePathComponent = String.raw`(${reLevel}\/)`;

//A path formed by a series of path components that can be hardened: /2'/23H/23
const reOriginPath = String.raw`(\/${rePathComponent}*${reLevel})`; //The "*" means: "match 0 or more of the previous"
//an origin is something like this: [d34db33f/44'/0'/0'] where the path is optional. The fingerPrint is 8 chars hex
const reOrigin = String.raw`(\[[0-9a-fA-F]{8}(${reOriginPath})?\])`;

//Something like this: 0252972572d465d016d4c501887b8df303eee3ed602c056b1eb09260dfa0da0ab2
const reCompressedPubKey = String.raw`((02|03)[0-9a-fA-F]{64})`;
//TODO: Note that rePubKey should be:
//${reCompressedPubKey}|${reUncompressedPubKey}|${reXonlyPubKey}
//as explained here://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md#reference
//As it is right now it only supports compressed pub keys
const rePubKey = String.raw`(${reCompressedPubKey})`;

const reXpub = String.raw`([xyYzZtuUvV]pub[1-9A-HJ-NP-Za-km-z]{79,108})`;
//reRangeLevel is like reLevel but using a wildcard "*"
const reRangeLevel = String.raw`(\*(${reHardened})?)`;
//A path can be finished with stuff like this: /23 or /23h or /* or /*'
const rePath = String.raw`(\/(${rePathComponent})*(${reRangeLevel}|${reLevel}))`;
//rePath is optional (note the "zero"): Followed by zero or more /NUM or /NUM' path elements to indicate unhardened or hardened derivation steps between the fingerprint and the key or xpub/xprv root that follows
const reXpubKey = String.raw`(${reXpub})(${rePath})?`;

const reActualKey = String.raw`(${reXpubKey}|${rePubKey})`; //This should also include WIF encoded private keys
//reOrigin is optional: Optionally, key origin information, consisting of:
const reDescKey = String.raw`(${reOrigin})?(${reActualKey})`;

const rePkh = String.raw`pkh\(${reDescKey}\)`;
const reWpkh = String.raw`wpkh\(${reDescKey}\)`;
const reShWpkh = String.raw`sh\(wpkh\(${reDescKey}\)\)`;

const reMiniscript = String.raw`(.*?)`; //matches anything. TODO: This has to be properly done.

//RegExp makers:
const makeReSh = re => String.raw`sh\(${re}\)`;
const makeReWsh = re => String.raw`wsh\(${re}\)`;
const makeReShWsh = re => makeReSh(makeReWsh(re));

const makeReOut = re => String.raw`^${re}$`; //starts and finishes like re (not composable)

const rePkhOut = makeReOut(rePkh);
const reWpkhOut = makeReOut(reWpkh);
const reShWpkhOut = makeReOut(reShWpkh);

const reShMiniscriptOut = makeReOut(makeReSh(reMiniscript));
const reShWshMiniscriptOut = makeReOut(makeReShWsh(reMiniscript));
const reWshMiniscriptOut = makeReOut(makeReWsh(reMiniscript));

/** Takes a descriptor and returns a pubKey in binary format*/
function desc2PubKey({ desc, network = networks.bitcoin }) {
  //TODO: assert that there is only one desc
  const descKey = desc.match(reDescKey)[0];
  const mPubKey = descKey.match(rePubKey);
  if (mPubKey) {
    return Buffer.from(mPubKey[0], 'hex');
  } else {
    const xPubKey = descKey.match(reXpubKey)[0];
    const xPub = xPubKey.match(reXpub)[0];
    const path = xPubKey.match(rePath)[0];
    return bjsBip32
      .fromBase58(xPub, network)
      .derivePath(path.replaceAll('H', "'").replaceAll('h', "'").slice(1))
      .publicKey;
  }
}

const reFVScript = String.raw`andor\(pk\(${reDescKey}\),older\((\d+)\),pk\(${reDescKey}\)\)`;
const reFVScriptParams = String.raw`andor\(pk\((.*?)\),older\((\d+)\),pk\((.*?)\)\)`;
/** Takes a miniscript and compiles it into a binary buffer.
 * We will have a set of miniscripts pre-compiled (no need to import the
 * miniscript compiler.
 * TODO: Use one of the WASM ports to compile it.
 * We are doing a hack right now to support FarVault scripts but this is not
 * general.
 */
function compile({ miniscript, network }) {
  //Predefined script types (no need to use a miniscript compiler):
  if (miniscript.match(reFVScript)) {
    const scriptParams = miniscript.match(reFVScriptParams);
    const maturedPublicKey = desc2PubKey({ desc: scriptParams[1], network });
    const bip68LockTime = Number(scriptParams[2]);
    const rushedPublicKey = desc2PubKey({ desc: scriptParams[3], network });
    return createRelativeTimeLockScript({
      maturedPublicKey,
      rushedPublicKey,
      bip68LockTime
    });
  } else {
    throw new Error('Unsupported miniscript.');
  }
}

/*
TODO:
Must implement "Non-malleable satisfaction algorithm" described here:
https://bitcoin.sipa.be/miniscript/
Other implementations or comments on implementations:
https://github.com/rust-bitcoin/rust-miniscript/issues/453
https://github.com/darosior/python-bip380/blob/master/bip380/miniscript/satisfaction.py
That is based on:
https://github.com/bitcoin/bitcoin/pull/17975
*/

export function satisfyier({ miniscript, network }) {
  //Predefined script types (no need to use a miniscript satisfyier):
  if (miniscript.match(reFVScript)) {
    const scriptParams = miniscript.match(reFVScriptParams);
    //const maturedPublicKey = desc2PubKey({ desc: scriptParams[1], network });
    const bip68LockTime = Number(scriptParams[2]);
    //const rushedPublicKey = desc2PubKey({ desc: scriptParams[3], network });
    //returns an array with possible: sequence, locktime, script
    return [
      {
        sequence: bip68LockTime,
        //witness or scriptsig:
        //unlockingScript: `sig(${maturedPublicKey.toString('hex')})`
        unlockingScript: `sig(${scriptParams[1]})`
      },
      {
        //witness or scriptsig:
        //unlockingScript: `sig(${rushedPublicKey.toString('hex')}) OP_0`
        unlockingScript: `sig(${scriptParams[3]}) OP_0`
      }
    ];
  } else {
    throw new Error('Unsupported miniscript.');
  }
}

function desc2Script({ desc, network }) {
  let miniscript;
  //start with longer match possible "sh(wsh("
  if (desc.match(reShWshMiniscriptOut)) {
    miniscript = desc.match(reShWshMiniscriptOut)[1]; //[1]-> whatever is found sh(wsh(->HERE<-))
  } else if (desc.match(reWshMiniscriptOut)) {
    miniscript = desc.match(reWshMiniscriptOut)[1]; //[1]-> whatever is found wsh(->HERE<-)
  } else if (desc.match(reShMiniscriptOut)) {
    miniscript = desc.match(reShMiniscriptOut)[1]; //[1]-> whatever is found sh(->HERE<-)
  } else {
    throw new Error('Could not get script from descriptor');
  }
  return compile({ miniscript, network });
}

/** Returns the address of an output descriptor*/
export function address({ desc, network = networks.bitcoin }) {
  //TODO: Assertions, make sure it is not a range desc
  //Check the network
  //Asset the pubkeys
  //legacy
  if (desc.match(rePkhOut)) {
    return p2pkh({ pubkey: desc2PubKey({ desc, network }), network }).address;
  }
  //nested segwit
  else if (desc.match(reShWpkhOut)) {
    return p2sh({
      redeem: p2wpkh({ pubkey: desc2PubKey({ desc, network }), network }),
      network
    }).address;
  }
  //native segwit
  else if (desc.match(reWpkhOut)) {
    return p2wpkh({ pubkey: desc2PubKey({ desc, network }), network }).address;
  }
  //sh(wsh(miniscript))
  else if (desc.match(reShWshMiniscriptOut)) {
    const script = desc2Script({ desc, network });
    return p2sh({
      redeem: p2wsh({ redeem: { output: script }, network }),
      network
    }).address;
  }
  //sh(miniscript)
  else if (desc.match(reShMiniscriptOut)) {
    const script = desc2Script({ desc, network });
    return p2sh({ redeem: { output: script }, network }).address;
  }
  //wsh(miniscript)
  else if (desc.match(reWshMiniscriptOut)) {
    const script = desc2Script({ desc, network });
    return p2wsh({ redeem: { output: script }, network }).address;
  }
  throw new Error('Could not parse descriptor.');
}
