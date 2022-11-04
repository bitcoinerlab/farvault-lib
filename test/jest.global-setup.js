import { startTestingEnvironment } from './tools';
import { NODEJS_TRANSPORT, LedgerHDInterface } from '../src/HDInterface/ledger';
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
    const HDInterface = new LedgerHDInterface({ transport: NODEJS_TRANSPORT });
    await HDInterface.init();
    await HDInterface.close();
  } catch (err) {
    process.env.__LEDGER_DETECTED__ = false;
  }

  globalThis.__TESTING_ENVIRONMENT__ = start
    ? await startTestingEnvironment()
    : false;
};
