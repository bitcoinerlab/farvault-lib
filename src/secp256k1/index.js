/** @module secp256k1 */
const NOBLE_SECP256K1 = 'NOBLE_SECP256K1';
const ELLIPTIC_SECP256K1 = 'ELLIPTIC_SECP256K1';
const BITCORE_WASM_SECP256K1 = 'BITCORE_WASM_SECP256K1';

function wasmSupported() {
  //https://stackoverflow.com/a/47880734/1660381
  //Do not let it run on react-native (WASM works on the iOS simulator but not
  //on real device).
  //It's better to debug in the simulator using the same engine.
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative')
    return false;
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

//const secp256k1Engine = NOBLE_SECP256K1;
const secp256k1Engine = wasmSupported()
  ? BITCORE_WASM_SECP256K1
  : typeof BigInt === 'function'
  ? NOBLE_SECP256K1
  : ELLIPTIC_SECP256K1;

console.log(`Importing secp256k1 engine: ${secp256k1Engine}.`);

if (secp256k1Engine === ELLIPTIC_SECP256K1) {
  //We used to make it work installing an alias package:
  //npm install tiny-secp256k1-v1@npm:tiny-secp256k1@1
  //and then:
  //require('tiny-secp256k1-v1/js.js')
  //But elliptic does not work with ecpair version 2.1 and above
  //since it does not provide all the functions required by ecpair.
  //We decided to deprecate its usage
  throw new Error('Elliptic cannot be used anymore since ecpair 2.1');
}

const secp256k1 =
  secp256k1Engine === NOBLE_SECP256K1
    ? require('./nobleSecp256k1Wrapper.js')
    : require('tiny-secp256k1');
module.exports = secp256k1;
