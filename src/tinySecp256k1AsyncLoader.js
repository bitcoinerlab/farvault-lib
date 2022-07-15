//This is the case when this is run in the browser and we are tryint to
//load a webassembly object.
//If this is the case, since this is a browser build, it will be packed with
//webpack that will enforce
//webassembly to load asyncronously. In order to make this work
//you must set these options in webpack.config.js:
//  experiments: {
//  tiny-secp256k1 used for elliptic curves is "C" compiled into webassembly
//  asyncWebAssembly: true,
//  topLevelAwait: true,
//},
//In addition you must add this plugin:
//    new webpack.DefinePlugin({
//      'window.webAssemblyIsLoadingAsynchronous': JSON.stringify(true),
//    }),
//
import ecc from 'tiny-secp256k1';
export default await ecc;
