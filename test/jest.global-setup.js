import { startTestingEnvironment } from './tools';
import {
  initHDInterface,
  LEDGER_NANO_INTERFACE,
  NODEJS_TRANSPORT
} from '../src/HDInterface';
module.exports = async function (globalConfig, projectConfig) {
  const start =
    globalConfig.testPathPattern === '' ||
    globalConfig.testPathPattern.indexOf('farvault.test.js') !== -1 ||
    globalConfig.testPathPattern.indexOf('transactions.test.js') !== -1
      ? true
      : false;
  const startElectrs =
    globalConfig.testPathPattern === '' ||
    globalConfig.testPathPattern.indexOf('farvault.test.js') !== -1
      ? true
      : false;

  process.env.__LEDGER_NANO_DETECTED__ = true;
  try {
    await initHDInterface(LEDGER_NANO_INTERFACE, {
      transport: NODEJS_TRANSPORT
    });
  } catch (err) {
    process.env.__LEDGER_NANO_DETECTED__ = false;
  }

  globalThis.__TESTING_ENVIRONMENT__ = start
    ? await startTestingEnvironment()
    : false;
};
