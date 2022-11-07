import { startTestingEnvironment } from './tools';
import { NODEJS_TRANSPORT, LedgerHDSigner } from '../src/HDSigner/ledger';
module.exports = async function (globalConfig, projectConfig) {
  const start =
    globalConfig.testPathPattern === '' ||
    globalConfig.testPathPattern.indexOf('farvault.test.js') !== -1 ||
    globalConfig.testPathPattern.indexOf('discovery.test.js') !== -1 ||
    globalConfig.testPathPattern.indexOf('explorer.test.js') !== -1
      ? true
      : false;
  const startElectrs =
    globalConfig.testPathPattern === '' ||
    globalConfig.testPathPattern.indexOf('farvault.test.js') !== -1 ||
    globalConfig.testPathPattern.indexOf('discovery.test.js') !== -1 ||
    globalConfig.testPathPattern.indexOf('explorer.test.js') !== -1
      ? true
      : false;

  process.env.__LEDGER_DETECTED__ = true;
  try {
    const HDSigner = new LedgerHDSigner({ transport: NODEJS_TRANSPORT });
    await HDSigner.init();
    await HDSigner.close();
  } catch (err) {
    process.env.__LEDGER_DETECTED__ = false;
  }

  globalThis.__TESTING_ENVIRONMENT__ = start
    ? await startTestingEnvironment()
    : false;
};
