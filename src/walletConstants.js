export const XPUB = 'xpub';
export const YPUB = 'ypub';
export const ZPUB = 'zpub';

export const TPUB = 'tpub';
export const UPUB = 'upub';
export const VPUB = 'vpub';

export const XPUBVERSION = 0x0488b21e;
export const YPUBVERSION = 0x049d7cb2;
export const ZPUBVERSION = 0x04b24746;

export const TPUBVERSION = 0x043587cf;
export const UPUBVERSION = 0x044a5262;
export const VPUBVERSION = 0x045f1cf6;

export const PUBVERSION = {
  [XPUB]: XPUBVERSION,
  [YPUB]: YPUBVERSION,
  [ZPUB]: ZPUBVERSION,
  [TPUB]: TPUBVERSION,
  [UPUB]: UPUBVERSION,
  [VPUB]: VPUBVERSION
};
export const PUBVERSIONSIZE = 8;

//Purposes:
export const LEGACY = 44;
export const NESTED_SEGWIT = 49;
export const NATIVE_SEGWIT = 84;

export const BIP32_PURPOSE = {
  [XPUB]: LEGACY,
  [YPUB]: NESTED_SEGWIT,
  [ZPUB]: NATIVE_SEGWIT,
  [TPUB]: LEGACY,
  [UPUB]: NESTED_SEGWIT,
  [VPUB]: NATIVE_SEGWIT
};

export const BITCOIN_COINTYPE = 0;
//This is for both regtest and testnet
export const TESTNET_COINTYPE = 1;

export const PUBTYPES = {
  [BITCOIN_COINTYPE]: {
    [LEGACY]: XPUB,
    [NESTED_SEGWIT]: YPUB,
    [NATIVE_SEGWIT]: ZPUB
  },
  [TESTNET_COINTYPE]: {
    [LEGACY]: TPUB,
    [NESTED_SEGWIT]: UPUB,
    [NATIVE_SEGWIT]: VPUB
  }
};

export const GAP_LIMIT = 20;
export const GAP_ACCOUNT_LIMIT = 1;

export const BLOCKSTREAM_EXPLORER_BASEURL = 'https://blockstream.info';
