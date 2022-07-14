//npm install tiny-secp256k1-v1@npm:tiny-secp256k1@1

/*
//import * as ecc from 'tiny-secp256k1-v1';
//import * as ecc from 'tiny-secp256k1';
//import * as ecc from './noble_ecc.js';
import * as ecc from 'tiny-secp256k1-v1/js.js';

import ECPairFactory from 'ecpair';
import BIP32Factory from 'bip32';

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);
export { bip32, ECPair };
*/

//https://stackoverflow.com/a/47880734/1660381
function wasmSupported() {
  try {
    if (
      typeof WebAssembly === 'object' &&
      typeof WebAssembly.instantiate === 'function'
    ) {
      const module = new WebAssembly.Module(
        Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
      );
      if (module instanceof WebAssembly.Module)
        return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
    }
  } catch (e) {}
  return false;
}

const NOBLE_ECC = 'NOBLE_ECC';
const ELLIPTIC_ECC = 'ELLIPTIC_ECC';
const BITCORE_WASM_ECC = 'BITCORE_WASM_ECC';

//const eccEngine = NOBLE_ECC;
const eccEngine = wasmSupported()
  ? BITCORE_WASM_ECC
  : typeof BigInt === 'function'
  ? NOBLE_ECC
  : ELLIPTIC_ECC;

let bip32, ECPair;
import ECPairFactory from 'ecpair';
import BIP32Factory from 'bip32';
(async () => {
  console.log(`Importing ecc engine: ${eccEngine}.`);
  const ecc =
    eccEngine === NOBLE_ECC
      ? (await import('./noble_ecc.js')).default
      : eccEngine === BITCORE_WASM_ECC
      ? await import('tiny-secp256k1')
      : await import('tiny-secp256k1-v1/js.js');
  bip32 = BIP32Factory(ecc);
  ECPair = ECPairFactory(ecc);
})();
export { bip32, ECPair };
