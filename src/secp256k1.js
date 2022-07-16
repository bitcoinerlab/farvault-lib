const NOBLE_ECC = 'NOBLE_ECC';
const ELLIPTIC_ECC = 'ELLIPTIC_ECC';
const BITCORE_WASM_ECC = 'BITCORE_WASM_ECC';

function wasmSupported() {
  //https://stackoverflow.com/a/47880734/1660381
  //Do not let it run on react-native (it will run on iOS simulator but not on
  //real device. It's better to debug using the same engine.
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

const eccEngine = wasmSupported()
  ? BITCORE_WASM_ECC
  : typeof BigInt === 'function'
  ? NOBLE_ECC
  : ELLIPTIC_ECC;

console.log(`Importing ecc engine: ${eccEngine}.`);

const ecc =
  eccEngine === NOBLE_ECC
    ? require('./noble_ecc.js')
    : eccEngine === ELLIPTIC_ECC
    ? require('tiny-secp256k1-v1/js.js') //npm install tiny-secp256k1-v1@npm:tiny-secp256k1@1
    : require('tiny-secp256k1');
module.exports = ecc;
