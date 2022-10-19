import { stopTestingEnvironment } from './tools';
module.exports = async function (globalConfig, projectConfig) {
  if (globalThis.__TESTING_ENVIRONMENT__)
    await stopTestingEnvironment(globalThis.__TESTING_ENVIRONMENT__);

  if (process.env.__LEDGER_DETECTED__ === 'false') {
    //Note process.env stringifies stuff
    console.warn(
      `WARNING: Please note that tests for the Ledger Nano device were not run for not having detected it.
Plug in a Ledger Nano running the "Bitcoin Test (BTC)" App. The device must use this seed:
find subject time jump river dignity resist water arrange runway purpose question exchange random concert guitar rifle sun slim add pet loud depend view`
    );
  }
};
