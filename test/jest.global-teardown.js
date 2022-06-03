import { stopTestingEnvironment } from './tools';
module.exports = async function (globalConfig, projectConfig) {

  if (globalThis.__TESTING_ENVIRONMENT__)
    await stopTestingEnvironment(globalThis.__TESTING_ENVIRONMENT__);
};
