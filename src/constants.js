//As defined in splip44:
//https://github.com/satoshilabs/slips/blob/master/slip-0044.md
export const BITCOIN_COINTYPE = 0;
//Note that both regtest and testnet have cointype = 1
export const TESTNET_COINTYPE = 1;
export const REGTEST_COINTYPE = 1;


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
  [BITCOIN_COINTYPE]: {
    [LEGACY]: XPUBVERSION,
    [NESTED_SEGWIT]: YPUBVERSION,
    [NATIVE_SEGWIT]: ZPUBVERSION
  },
  [TESTNET_COINTYPE]: {
    [LEGACY]: TPUBVERSION,
    [NESTED_SEGWIT]: UPUBVERSION,
    [NATIVE_SEGWIT]: VPUBVERSION
  },
  [REGTEST_COINTYPE]: {
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
  [BITCOIN_COINTYPE]: {
    [LEGACY]: XPUB,
    [NESTED_SEGWIT]: YPUB,
    [NATIVE_SEGWIT]: ZPUB
  },
  [TESTNET_COINTYPE]: {
    [LEGACY]: TPUB,
    [NESTED_SEGWIT]: UPUB,
    [NATIVE_SEGWIT]: VPUB
  },
  [REGTEST_COINTYPE]: {
    [LEGACY]: TPUB,
    [NESTED_SEGWIT]: UPUB,
    [NATIVE_SEGWIT]: VPUB
  }
};

export const GAP_ACCOUNT_LIMIT = 1;
export const GAP_LIMIT = 20;
export const VAULT_SKIP = 15;//How many addresses skip from latest used path

export const BLOCKSTREAM_EXPLORER_BASEURL = 'https://blockstream.info';
export const ESPLORA_BASEURL = 'http://127.0.0.1:3002';

export const PSBT_VERSION = 2;
