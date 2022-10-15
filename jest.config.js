module.exports = {
  globalSetup: './test/jest.global-setup.js',
  globalTeardown: './test/jest.global-teardown.js',
  //This was added by the FarVault team:
  //https://github.com/LedgerHQ/ledger-live/issues/763#issuecomment-1259736939
  moduleNameMapper: {
    '@ledgerhq/devices/hid-framing': '@ledgerhq/devices/lib/hid-framing'
  }
};
