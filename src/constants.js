export const BITCOIN = 'BITCOIN';
export const REGTEST = 'REGTEST';
export const TESTNET = 'TESTNET';
export const SIGNET = 'SIGNET';

//As defined in splip44:
//https://github.com/satoshilabs/slips/blob/master/slip-0044.md
export const COINTYPE = {
  [BITCOIN]: 0,
  [TESTNET]: 1,
  [SIGNET]: 1,
  [REGTEST]: 1
};

//Purposes as defined in BIP44, BIP49 and BIP84
export const LEGACY = 44;
export const NESTED_SEGWIT = 49;
export const NATIVE_SEGWIT = 84;

export const XPUB = 'xpub';
export const YPUB = 'ypub';
export const ZPUB = 'zpub';

export const TPUB = 'tpub';
export const UPUB = 'upub';
export const VPUB = 'vpub';

//https://github.com/satoshilabs/slips/blob/master/slip-0132.md
export const XPUBVERSION = 0x0488b21e;
export const YPUBVERSION = 0x049d7cb2;
export const ZPUBVERSION = 0x04b24746;

export const TPUBVERSION = 0x043587cf;
export const UPUBVERSION = 0x044a5262;
export const VPUBVERSION = 0x045f1cf6;
export const PUBVERSIONSIZE = 8;

export const PUBVERSIONS = {
  [BITCOIN]: {
    [LEGACY]: XPUBVERSION,
    [NESTED_SEGWIT]: YPUBVERSION,
    [NATIVE_SEGWIT]: ZPUBVERSION
  },
  [TESTNET]: {
    [LEGACY]: TPUBVERSION,
    [NESTED_SEGWIT]: UPUBVERSION,
    [NATIVE_SEGWIT]: VPUBVERSION
  },
  [SIGNET]: {
    [LEGACY]: TPUBVERSION,
    [NESTED_SEGWIT]: UPUBVERSION,
    [NATIVE_SEGWIT]: VPUBVERSION
  },
  [REGTEST]: {
    [LEGACY]: TPUBVERSION,
    [NESTED_SEGWIT]: UPUBVERSION,
    [NATIVE_SEGWIT]: VPUBVERSION
  }
};

export const PURPOSES = {
  [XPUB]: LEGACY,
  [YPUB]: NESTED_SEGWIT,
  [ZPUB]: NATIVE_SEGWIT,
  [TPUB]: LEGACY,
  [UPUB]: NESTED_SEGWIT,
  [VPUB]: NATIVE_SEGWIT
};

export const EXTENDEDPUBTYPES = {
  [BITCOIN]: {
    [LEGACY]: XPUB,
    [NESTED_SEGWIT]: YPUB,
    [NATIVE_SEGWIT]: ZPUB
  },
  [TESTNET]: {
    [LEGACY]: TPUB,
    [NESTED_SEGWIT]: UPUB,
    [NATIVE_SEGWIT]: VPUB
  },
  [SIGNET]: {
    [LEGACY]: TPUB,
    [NESTED_SEGWIT]: UPUB,
    [NATIVE_SEGWIT]: VPUB
  },
  [REGTEST]: {
    [LEGACY]: TPUB,
    [NESTED_SEGWIT]: UPUB,
    [NATIVE_SEGWIT]: VPUB
  }
};

export const GAP_ACCOUNT_LIMIT = 1;
export const GAP_LIMIT = 20;
export const VAULT_SKIP = 15; //How many addresses skip from latest used path

export const ESPLORA_BLOCKSTREAM_URL = 'https://blockstream.info/api';
export const ESPLORA_BLOCKSTREAM_TESTNET_URL = 'https://blockstream.info/testnet/api';
export const ESPLORA_LOCAL_REGTEST_URL = 'http://127.0.0.1:3002';

export const ELECTRUM_BLOCKSTREAM_HOST = 'electrum.blockstream.info';
export const ELECTRUM_BLOCKSTREAM_PORT = 50002;
export const ELECTRUM_BLOCKSTREAM_PROTOCOL = 'ssl';

export const ELECTRUM_BLOCKSTREAM_TESTNET_HOST = 'electrum.blockstream.info';
export const ELECTRUM_BLOCKSTREAM_TESTNET_PORT = 60002;
export const ELECTRUM_BLOCKSTREAM_TESTNET_PROTOCOL = 'ssl';

export const ELECTRUM_LOCAL_REGTEST_HOST = '127.0.0.1';
export const ELECTRUM_LOCAL_REGTEST_PORT = 60401;
export const ELECTRUM_LOCAL_REGTEST_PROTOCOL = 'tcp';

export const PSBT_VERSION = 2;
