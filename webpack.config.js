//Example with ledger nano and sepk
//https://github.com/bitcoinjs/tiny-secp256k1/issues/70
//https://github.com/bitcoinjs/tiny-secp256k1/tree/master/examples/react-app

const isProd = false;
const path = require('path');
const webpack = require('webpack');

module.exports = [
  {
    target: 'web',
    devtool: isProd ? false : 'inline-cheap-source-map',
    mode: isProd ? 'production' : 'development',
    entry: {
      app: './playground/clientIndex.js'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/dist/',
      filename: 'bundle.js',

      //So I can call methods globally
      library: {
        name: 'playgroundLib',
        type: 'var'
      }
    },
    resolve: {
      //These are node polyfills needed by the bip39 package
      fallback: {
        stream: require.resolve('stream-browserify')
        //buffer: require.resolve('buffer')
        //buffer: require.resolve('buffer/')
      }
      //alias: {
      //  process: 'process/browser'
      //}
    },
    plugins: [
      //These is also needed because bip39 package uses Buffer.
      //https://viglucci.io/how-to-polyfill-buffer-with-webpack-5
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer']
      }),
      //xpub-lib triggers a "process" is undefined.
      //https://stackoverflow.com/questions/70368760/react-uncaught-referenceerror-process-is-not-defined
      //new webpack.DefinePlugin({
      //  process: { env: {} }
      //})
      //
      //Avoid packing wordlist for other languages (not english)
      //https://github.com/bitcoinjs/bip39 + https://github.com/bitcoinjs/bip39/issues/130
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/(?!english)/,
        contextRegExp: /bip39\/src\/wordlists$/
      })
    ],
    experiments: {
      //tiny-secp256k1 used for elliptic curves is "C" compiled into webassembly
      asyncWebAssembly: true
    }
  },
  {
    target: 'node',
    devtool: isProd ? false : 'inline-cheap-source-map',
    mode: isProd ? 'production' : 'development',
    entry: {
      app: './playground/serverIndex.js'
    },
    output: {
      path: path.join(__dirname, '/dist/playgroundTranspiledServer/'), //where the compiled app goes
      publicPath: '/playgroundTranspiledServer/', //where the server serves this file from
      filename: 'index.js',
      library: {
        type: 'commonjs2'
      }
    }
  }
];
